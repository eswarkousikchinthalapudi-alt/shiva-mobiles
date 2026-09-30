"use server";

import { eq, sql } from "drizzle-orm";
import { redirect } from "next/navigation";
import { refresh } from "next/cache";
import { getDb, schema } from "@/db";
import { audit } from "@/lib/audit";
import { getAdminOrNull, getAdminSession } from "@/lib/auth/dal";
import { regenerateRecoveryCodes } from "@/lib/auth/recovery";
import { checkSecondFactor } from "@/lib/auth/second-factor";
import { createSession, destroyAllSessions, destroyOtherSessions } from "@/lib/auth/session";
import { encryptString } from "@/lib/security/crypto";
import { checkPasswordStrength, hashPassword, verifyPassword } from "@/lib/security/password";
import { rateLimit } from "@/lib/security/rate-limit";
import { getRequestInfo } from "@/lib/security/request";

export type SecurityFormState = { error?: string } | undefined;

/** Checks the current password again before a sensitive change. */
async function confirmPassword(userId: string, password: string): Promise<string | null> {
  const limit = await rateLimit(`reauth:${userId}`, 8, 15 * 60);
  if (!limit.allowed) return "Too many tries. Wait a few minutes and try again.";
  const db = await getDb();
  const [user] = await db.select({ passwordHash: schema.adminUsers.passwordHash }).from(schema.adminUsers).where(eq(schema.adminUsers.id, userId)).limit(1);
  if (!user || !(await verifyPassword(password, user.passwordHash))) return "Your current password is not correct.";
  return null;
}

export async function changePasswordAction(_prev: SecurityFormState, formData: FormData): Promise<SecurityFormState> {
  const admin = await getAdminOrNull({ allowPasswordChange: true });
  if (!admin) redirect("/admin/login");
  const current = String(formData.get("current") ?? "").slice(0, 200);
  const next = String(formData.get("password") ?? "").slice(0, 201);
  const confirm = String(formData.get("confirm") ?? "").slice(0, 201);
  if (!current || !next) return { error: "Fill in all the boxes." };
  const wrong = await confirmPassword(admin.id, current);
  if (wrong) return { error: wrong };
  if (next !== confirm) return { error: "The two new passwords don't match." };
  if (next === current) return { error: "Pick a new password that is different from the old one." };
  const weak = checkPasswordStrength(next, admin.username);
  if (weak) return { error: weak };

  const db = await getDb();
  await db
    .update(schema.adminUsers)
    // Database clock for both times, so the new session is never older than the change.
    .set({ passwordHash: await hashPassword(next), passwordChangedAt: sql`now()`, mustChangePassword: false, updatedAt: new Date() })
    .where(eq(schema.adminUsers.id, admin.id));
  await destroyAllSessions(admin.id);
  await createSession(admin.id, "full", await getRequestInfo());
  await audit(admin, "password_changed", { entity: "admin_user", entityId: admin.id });
  redirect(admin.mustChangePassword ? "/admin?welcome=1" : "/admin/security?changed=1");
}

/** Password plus a 2-step code (or a recovery code), for changes that could take over the account. */
async function confirmPasswordAndCode(formData: FormData): Promise<{ error: string } | { session: NonNullable<Awaited<ReturnType<typeof getAdminSession>>> }> {
  const session = await getAdminSession();
  if (!session || session.stage !== "full") redirect("/admin/login");
  const wrong = await confirmPassword(session.user.id, String(formData.get("current") ?? "").slice(0, 200));
  if (wrong) return { error: wrong };
  const used = await checkSecondFactor(session.user, String(formData.get("code") ?? ""));
  if (!used) {
    await audit(session.user, "login_code_failed", { entity: "admin_user", entityId: session.user.id, details: { note: "on the security page" } });
    return { error: "The 6-digit code (or recovery code) is not correct." };
  }
  return { session };
}

export async function newRecoveryCodesAction(_prev: SecurityFormState, formData: FormData): Promise<SecurityFormState> {
  const admin = await getAdminOrNull();
  if (!admin) redirect("/admin/login");
  const checked = await confirmPasswordAndCode(formData);
  if ("error" in checked) return checked;
  const session = checked.session;
  const codes = await regenerateRecoveryCodes(admin.id);
  const db = await getDb();
  await db
    .update(schema.adminSessions)
    .set({ flashEnc: await encryptString(JSON.stringify({ recoveryCodes: codes }), "flash") })
    .where(eq(schema.adminSessions.id, session.id));
  await audit(admin, "recovery_codes_regenerated", { entity: "admin_user", entityId: admin.id });
  redirect("/admin/recovery-codes");
}

/** For a new phone: switches off the old authenticator and starts setup again. */
export async function resetMyAuthenticatorAction(_prev: SecurityFormState, formData: FormData): Promise<SecurityFormState> {
  const admin = await getAdminOrNull();
  if (!admin) redirect("/admin/login");
  const checked = await confirmPasswordAndCode(formData);
  if ("error" in checked) return checked;
  const db = await getDb();
  await db
    .update(schema.adminUsers)
    .set({ totpSecretEnc: null, totpEnabledAt: null, totpLastStep: null, updatedAt: new Date() })
    .where(eq(schema.adminUsers.id, admin.id));
  await db.delete(schema.adminRecoveryCodes).where(eq(schema.adminRecoveryCodes.userId, admin.id));
  await destroyAllSessions(admin.id);
  await createSession(admin.id, "setup_2fa", await getRequestInfo());
  await audit(admin, "2fa_reset_by_self", { entity: "admin_user", entityId: admin.id });
  redirect("/admin/setup-2fa");
}

export async function logoutOtherDevicesAction(): Promise<void> {
  const admin = await getAdminOrNull({ allowPasswordChange: true });
  const session = await getAdminSession();
  if (!admin || !session) redirect("/admin/login");
  await destroyOtherSessions(admin.id, session.id);
  await audit(admin, "other_sessions_ended", { entity: "admin_user", entityId: admin.id });
  refresh();
}
