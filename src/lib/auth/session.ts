import "server-only";
import { and, eq, lt } from "drizzle-orm";
import { cookies } from "next/headers";
import { getDb, schema } from "@/db";
import type { SessionStage } from "@/db/schema";
import { encryptString, randomToken, sha256Hex } from "@/lib/security/crypto";

const isProd = process.env.NODE_ENV === "production";

/** __Host- cookies must be Secure, so the prefix is only used over HTTPS. */
export const SESSION_COOKIE = isProd ? "__Host-sm_session" : "sm_session";

export const SESSION_LIMITS: Record<SessionStage, { maxAgeSeconds: number }> = {
  mfa_pending: { maxAgeSeconds: 10 * 60 },
  setup_2fa: { maxAgeSeconds: 30 * 60 },
  full: { maxAgeSeconds: 14 * 24 * 60 * 60 },
};

/** A full session ends after this long without use. */
export const IDLE_LIMIT_SECONDS = 3 * 24 * 60 * 60;
export const MAX_CODE_ATTEMPTS = 5;

export async function createSession(userId: string, stage: SessionStage, info: { ip: string; userAgent: string }, flash?: string): Promise<string> {
  const db = await getDb();
  const token = randomToken(32);
  const id = await sha256Hex(token);
  const { maxAgeSeconds } = SESSION_LIMITS[stage];
  await db.insert(schema.adminSessions).values({
    id,
    userId,
    stage,
    ip: info.ip,
    userAgent: info.userAgent,
    flashEnc: flash ? await encryptString(flash, "flash") : null,
    expiresAt: new Date(Date.now() + maxAgeSeconds * 1000),
  });
  const jar = await cookies();
  jar.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: isProd,
    sameSite: "lax",
    path: "/",
    maxAge: maxAgeSeconds,
    priority: "high",
  });
  return id;
}

export async function currentSessionId(): Promise<string | null> {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (!token || token.length < 20 || token.length > 200) return null;
  return sha256Hex(token);
}

export async function destroyCurrentSession(): Promise<void> {
  const id = await currentSessionId();
  if (id) {
    const db = await getDb();
    await db.delete(schema.adminSessions).where(eq(schema.adminSessions.id, id));
  }
  const jar = await cookies();
  // Same attributes as when it was set, or browsers ignore the removal of a __Host- cookie.
  jar.set(SESSION_COOKIE, "", { httpOnly: true, secure: isProd, sameSite: "lax", path: "/", maxAge: 0 });
}

export async function destroyOtherSessions(userId: string, keepId: string | null) {
  const db = await getDb();
  const sessions = await db.select({ id: schema.adminSessions.id }).from(schema.adminSessions).where(eq(schema.adminSessions.userId, userId));
  for (const s of sessions) {
    if (s.id !== keepId) await db.delete(schema.adminSessions).where(eq(schema.adminSessions.id, s.id));
  }
}

export async function destroyAllSessions(userId: string) {
  const db = await getDb();
  await db.delete(schema.adminSessions).where(eq(schema.adminSessions.userId, userId));
}

export async function pruneExpiredSessions() {
  const db = await getDb();
  await db.delete(schema.adminSessions).where(lt(schema.adminSessions.expiresAt, new Date()));
}

export async function sessionById(id: string) {
  const db = await getDb();
  const rows = await db
    .select({ session: schema.adminSessions, user: schema.adminUsers })
    .from(schema.adminSessions)
    .innerJoin(schema.adminUsers, eq(schema.adminUsers.id, schema.adminSessions.userId))
    .where(and(eq(schema.adminSessions.id, id)))
    .limit(1);
  return rows[0] ?? null;
}
