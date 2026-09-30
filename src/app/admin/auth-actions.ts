"use server";

import { and, eq, isNull, sql } from "drizzle-orm";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getDb, schema } from "@/db";
import { audit } from "@/lib/audit";
import { getAdminSession } from "@/lib/auth/dal";
import { knownDeviceFor, rememberDevice } from "@/lib/auth/device";
import { regenerateRecoveryCodes } from "@/lib/auth/recovery";
import { checkSecondFactor } from "@/lib/auth/second-factor";
import { MAX_CODE_ATTEMPTS, createSession, destroyAllSessions, destroyCurrentSession } from "@/lib/auth/session";
import { decryptString, encryptString, timingSafeEqualString } from "@/lib/security/crypto";
import { checkPasswordStrength, getDummyHash, hashPassword, verifyPassword } from "@/lib/security/password";
import { rateLimit, resetRateLimit } from "@/lib/security/rate-limit";
import { getRequestInfo } from "@/lib/security/request";
import { verifyTotp } from "@/lib/security/totp";

export type FormState = { error?: string; ok?: boolean; username?: string } | undefined;

const loginSchema = z.object({
  username: z.string().trim().toLowerCase().min(1).max(40),
  password: z.string().min(1).max(200),
});

function minutes(seconds: number) {
  const m = Math.ceil(seconds / 60);
  return m === 1 ? "1 minute" : `${m} minutes`;
}

export async function loginAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = loginSchema.safeParse({ username: formData.get("username"), password: formData.get("password") });
  if (!parsed.success) return { error: "Enter your username and password." };
  const { username, password } = parsed.data;
  const info = await getRequestInfo();

  const db = await getDb();
  const [user] = await db.select().from(schema.adminUsers).where(eq(schema.adminUsers.username, username)).limit(1);
  // A browser that completed a login before gets its own limit, so strangers' wrong tries can't lock the owner out.
  const device = user ? await knownDeviceFor(user.id) : null;
  const userKey = device ? `login-device:${username}:${device}` : `login-user:${username}`;
  const ipLimit = await rateLimit(`login-ip:${info.ip}`, 20, 15 * 60);
  const userLimit = await rateLimit(userKey, 8, 15 * 60);
  if (!ipLimit.allowed || !userLimit.allowed) {
    await audit(null, "login_blocked", { entity: "admin_user", details: { username: user ? username : "(unknown username)" } });
    const wait = Math.max(ipLimit.allowed ? 0 : ipLimit.retryAfterSeconds, userLimit.allowed ? 0 : userLimit.retryAfterSeconds);
    return { error: `Too many attempts. Try again in ${minutes(wait)}.`, username };
  }

  let ok = false;
  if (user && user.isActive) {
    ok = await verifyPassword(password, user.passwordHash);
  } else {
    // Same amount of work as a real check, so timing doesn't reveal usernames.
    await verifyPassword(password, await getDummyHash());
  }
  if (!ok || !user) {
    // Only real usernames are logged: a password typed into the wrong box must not end up in the log.
    await audit(null, "login_failed", { entity: "admin_user", details: { username: user ? username : "(unknown username)" } });
    return { error: "Wrong username or password.", username };
  }

  await resetRateLimit(userKey);
  await destroyCurrentSession();
  if (user.totpEnabledAt && user.totpSecretEnc) {
    await createSession(user.id, "mfa_pending", info);
    redirect("/admin/login/verify");
  }
  await createSession(user.id, "setup_2fa", info);
  redirect("/admin/setup-2fa");
}

export async function verifyCodeAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const session = await getAdminSession();
  if (!session || session.stage !== "mfa_pending" || !session.user.totpSecretEnc) redirect("/admin/login");
  if (session.failedAttempts >= MAX_CODE_ATTEMPTS) {
    await destroyCurrentSession();
    redirect("/admin/login?reason=too-many-codes");
  }
  const limit = await rateLimit(`mfa:${session.user.id}`, 10, 15 * 60);
  const daily = await rateLimit(`mfa-day:${session.user.id}`, 30, 24 * 3600);
  if (!limit.allowed || !daily.allowed) {
    const wait = limit.allowed ? daily.retryAfterSeconds : limit.retryAfterSeconds;
    return { error: `Too many tries. Wait ${minutes(wait)} and try again, or ask the owner for help.` };
  }

  const db = await getDb();
  const used = await checkSecondFactor(session.user, String(formData.get("code") ?? ""));

  if (!used) {
    await db
      .update(schema.adminSessions)
      .set({ failedAttempts: sql`${schema.adminSessions.failedAttempts} + 1` })
      .where(eq(schema.adminSessions.id, session.id));
    await audit(session.user, "login_code_failed", { entity: "admin_user", entityId: session.user.id });
    const left = MAX_CODE_ATTEMPTS - session.failedAttempts - 1;
    return {
      error:
        left > 0
          ? `That code didn't work. Check that the time on your phone is correct. ${left} ${left === 1 ? "try" : "tries"} left.`
          : "That code didn't work. Please log in again.",
    };
  }

  await db.update(schema.adminUsers).set({ lastLoginAt: new Date() }).where(eq(schema.adminUsers.id, session.user.id));
  const info = await getRequestInfo();
  await destroyCurrentSession();
  await createSession(session.user.id, "full", info);
  await rememberDevice(session.user.id);
  await audit(session.user, used === "recovery" ? "login_with_recovery_code" : "login", { entity: "admin_user", entityId: session.user.id });
  redirect(used === "recovery" ? "/admin/security?recovery=used" : "/admin");
}

export async function confirmTotpSetupAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const session = await getAdminSession();
  if (!session || session.stage !== "setup_2fa" || !session.pendingTotpEnc) redirect("/admin/login");
  const limit = await rateLimit(`mfa-setup:${session.user.id}`, 10, 15 * 60);
  if (!limit.allowed) return { error: `Too many tries. Wait ${minutes(limit.retryAfterSeconds)} and try again.` };

  const code = String(formData.get("code") ?? "").trim();
  const secret = await decryptString(session.pendingTotpEnc, "totp");
  const result = verifyTotp(secret, code, null);
  if (!result.ok) return { error: "That code didn't work. Type the 6-digit code shown in the app right now." };

  const db = await getDb();
  // Only if 2-step login is still off: an old setup screen must not replace an authenticator set up since.
  const updated = await db
    .update(schema.adminUsers)
    .set({
      totpSecretEnc: await encryptString(secret, "totp"),
      totpEnabledAt: new Date(),
      totpLastStep: result.step,
      lastLoginAt: new Date(),
      updatedAt: new Date(),
    })
    .where(and(eq(schema.adminUsers.id, session.user.id), isNull(schema.adminUsers.totpEnabledAt)))
    .returning({ id: schema.adminUsers.id });
  if (!updated.length) {
    await destroyCurrentSession();
    redirect("/admin/login?reason=already-set-up");
  }
  const codes = await regenerateRecoveryCodes(session.user.id);
  const info = await getRequestInfo();
  await destroyCurrentSession();
  await destroyAllSessions(session.user.id);
  await createSession(session.user.id, "full", info, JSON.stringify({ recoveryCodes: codes }));
  await rememberDevice(session.user.id);
  await audit(session.user, "2fa_enabled", { entity: "admin_user", entityId: session.user.id });
  redirect("/admin/recovery-codes");
}

export async function logoutAction() {
  const session = await getAdminSession();
  await destroyCurrentSession();
  if (session) await audit(session.user, "logout", { entity: "admin_user", entityId: session.user.id });
  redirect("/admin/login");
}

// ---------------------------------------------------------------------------
// First owner account (only while no admin exists, and only with SETUP_TOKEN)
// ---------------------------------------------------------------------------

const setupSchema = z.object({
  token: z.string().min(1).max(200),
  name: z.string().trim().min(2).max(60),
  username: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9._-]{3,32}$/, "Username: 3–32 letters, numbers, dot, dash or underscore."),
  password: z.string().min(1).max(200),
  confirm: z.string(),
});

export async function setupOwnerAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const expected = process.env.SETUP_TOKEN?.trim();
  if (!expected || expected.length < 16) return { error: "Setup is switched off. Set SETUP_TOKEN (16+ characters) on the server first." };
  const info = await getRequestInfo();
  const limit = await rateLimit(`setup:${info.ip}`, 10, 60 * 60);
  if (!limit.allowed) return { error: "Too many attempts. Try again later." };

  const parsed = setupSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check the form." };
  const { token, name, username, password, confirm } = parsed.data;
  if (!timingSafeEqualString(token, expected)) return { error: "Setup token is not correct." };
  if (password !== confirm) return { error: "The two passwords don't match." };
  const weak = checkPasswordStrength(password, username);
  if (weak) return { error: weak };

  const db = await getDb();
  const existing = await db.select({ id: schema.adminUsers.id }).from(schema.adminUsers).limit(1);
  if (existing.length > 0) return { error: "An owner account already exists. Log in instead." };
  const [user] = await db
    .insert(schema.adminUsers)
    .values({ username, name, role: "owner", passwordHash: await hashPassword(password) })
    .returning();
  await audit({ id: user.id, name: user.name }, "owner_created", { entity: "admin_user", entityId: user.id });
  redirect("/admin/login?reason=created");
}
