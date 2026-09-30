"use server";

import { and, eq, ne, sql } from "drizzle-orm";
import { refresh } from "next/cache";
import { z } from "zod";
import { getDb, schema } from "@/db";
import type { AdminRole } from "@/db/schema";
import { audit } from "@/lib/audit";
import { getAdminOrNull } from "@/lib/auth/dal";
import { destroyAllSessions } from "@/lib/auth/session";
import { randomBytes } from "@/lib/security/crypto";
import { hashPassword } from "@/lib/security/password";

export type TeamResult = { ok: true; tempPassword?: string } | { ok: false; error: string };

// 32 characters, so every byte maps evenly. No i, l, o or 1 (easy to misread).
const ALPHABET = "abcdefghjkmnpqrstuvwxyz023456789";

/** Easy-to-read temporary password like "k7mp-3xq9-vt2h". The person must change it at first login. */
function temporaryPassword(): string {
  const chars = [...randomBytes(12)].map((b) => ALPHABET[b % ALPHABET.length]).join("");
  return `${chars.slice(0, 4)}-${chars.slice(4, 8)}-${chars.slice(8)}`;
}

const uuid = z.string().uuid();

async function ownerOnly() {
  return getAdminOrNull({ role: "owner" });
}

async function targetUser(id: string) {
  if (!uuid.safeParse(id).success) return null;
  const db = await getDb();
  const [user] = await db.select().from(schema.adminUsers).where(eq(schema.adminUsers.id, id)).limit(1);
  return user ?? null;
}

async function otherActiveOwners(exceptId: string) {
  const db = await getDb();
  const [row] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(schema.adminUsers)
    .where(and(eq(schema.adminUsers.role, "owner"), eq(schema.adminUsers.isActive, true), ne(schema.adminUsers.id, exceptId)));
  return Number(row?.n ?? 0);
}

const memberSchema = z.object({
  name: z.string().trim().min(2, "Enter their name.").max(60),
  username: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9._-]{3,32}$/, "Username: 3–32 lowercase letters, numbers, dot, dash or underscore."),
  role: z.enum(["owner", "staff"]),
});

export async function addMemberAction(input: z.infer<typeof memberSchema>): Promise<TeamResult> {
  const admin = await ownerOnly();
  if (!admin) return { ok: false, error: "Only the owner can add people." };
  const parsed = memberSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Check the form." };
  const { name, username, role } = parsed.data;
  const db = await getDb();
  const [existing] = await db.select({ id: schema.adminUsers.id }).from(schema.adminUsers).where(eq(schema.adminUsers.username, username)).limit(1);
  if (existing) return { ok: false, error: "That username is taken. Pick another one." };
  const tempPassword = temporaryPassword();
  const [created] = await db
    .insert(schema.adminUsers)
    .values({ name, username, role, passwordHash: await hashPassword(tempPassword), mustChangePassword: true })
    .returning({ id: schema.adminUsers.id });
  await audit(admin, "team_member_added", { entity: "admin_user", entityId: created.id, details: { username, role } });
  refresh();
  return { ok: true, tempPassword };
}

export async function resetMemberPasswordAction(userId: string): Promise<TeamResult> {
  const admin = await ownerOnly();
  if (!admin) return { ok: false, error: "Only the owner can do this." };
  const user = await targetUser(userId);
  if (!user) return { ok: false, error: "Unknown person." };
  if (user.id === admin.id) return { ok: false, error: "Change your own password on the “My login and security” page." };
  const tempPassword = temporaryPassword();
  const db = await getDb();
  await db
    .update(schema.adminUsers)
    .set({ passwordHash: await hashPassword(tempPassword), mustChangePassword: true, passwordChangedAt: sql`now()`, updatedAt: new Date() })
    .where(eq(schema.adminUsers.id, user.id));
  await destroyAllSessions(user.id);
  await audit(admin, "team_password_reset", { entity: "admin_user", entityId: user.id, details: { username: user.username } });
  refresh();
  return { ok: true, tempPassword };
}

export async function resetMember2faAction(userId: string): Promise<TeamResult> {
  const admin = await ownerOnly();
  if (!admin) return { ok: false, error: "Only the owner can do this." };
  const user = await targetUser(userId);
  if (!user) return { ok: false, error: "Unknown person." };
  if (user.id === admin.id) return { ok: false, error: "Use “Set up on a new phone” on your own security page." };
  const db = await getDb();
  await db
    .update(schema.adminUsers)
    .set({ totpSecretEnc: null, totpEnabledAt: null, totpLastStep: null, updatedAt: new Date() })
    .where(eq(schema.adminUsers.id, user.id));
  await db.delete(schema.adminRecoveryCodes).where(eq(schema.adminRecoveryCodes.userId, user.id));
  await destroyAllSessions(user.id);
  await audit(admin, "team_2fa_reset", { entity: "admin_user", entityId: user.id, details: { username: user.username } });
  refresh();
  return { ok: true };
}

export async function setMemberActiveAction(userId: string, active: boolean): Promise<TeamResult> {
  const admin = await ownerOnly();
  if (!admin) return { ok: false, error: "Only the owner can do this." };
  const user = await targetUser(userId);
  if (!user) return { ok: false, error: "Unknown person." };
  if (user.id === admin.id) return { ok: false, error: "You can't switch off your own account." };
  if (!active && user.role === "owner" && (await otherActiveOwners(user.id)) === 0) return { ok: false, error: "The shop needs at least one owner." };
  const db = await getDb();
  await db.update(schema.adminUsers).set({ isActive: active, updatedAt: new Date() }).where(eq(schema.adminUsers.id, user.id));
  if (!active) await destroyAllSessions(user.id);
  await audit(admin, active ? "team_member_enabled" : "team_member_disabled", {
    entity: "admin_user",
    entityId: user.id,
    details: { username: user.username },
  });
  refresh();
  return { ok: true };
}

export async function setMemberRoleAction(userId: string, role: AdminRole): Promise<TeamResult> {
  const admin = await ownerOnly();
  if (!admin) return { ok: false, error: "Only the owner can do this." };
  if (role !== "owner" && role !== "staff") return { ok: false, error: "Unknown role." };
  const user = await targetUser(userId);
  if (!user) return { ok: false, error: "Unknown person." };
  if (user.id === admin.id) return { ok: false, error: "You can't change your own role." };
  if (role === "staff" && user.role === "owner" && (await otherActiveOwners(user.id)) === 0) return { ok: false, error: "The shop needs at least one owner." };
  const db = await getDb();
  await db.update(schema.adminUsers).set({ role, updatedAt: new Date() }).where(eq(schema.adminUsers.id, user.id));
  await audit(admin, "team_role_changed", { entity: "admin_user", entityId: user.id, details: { username: user.username, role } });
  refresh();
  return { ok: true };
}
