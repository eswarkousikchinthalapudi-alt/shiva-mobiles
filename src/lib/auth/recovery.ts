import "server-only";
import { and, eq, isNull } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { keyedHash, randomBytes } from "@/lib/security/crypto";

const ALPHABET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";
export const RECOVERY_CODE_COUNT = 8;

function newCode(): string {
  const bytes = randomBytes(10);
  const chars = [...bytes].map((b) => ALPHABET[b % 32]).join("");
  return `${chars.slice(0, 5)}-${chars.slice(5)}`;
}

export function normalizeRecoveryCode(input: string): string | null {
  const clean = input.toUpperCase().replace(/[^0-9A-Z]/g, "");
  if (clean.length !== 10 || [...clean].some((c) => !ALPHABET.includes(c))) return null;
  return clean;
}

/** Replaces the user's recovery codes. Returns the new codes (show them once). */
export async function regenerateRecoveryCodes(userId: string): Promise<string[]> {
  const db = await getDb();
  const codes = Array.from({ length: RECOVERY_CODE_COUNT }, newCode);
  await db.delete(schema.adminRecoveryCodes).where(eq(schema.adminRecoveryCodes.userId, userId));
  for (const code of codes) {
    await db.insert(schema.adminRecoveryCodes).values({
      userId,
      codeHash: await keyedHash(normalizeRecoveryCode(code)!, "recovery-code"),
    });
  }
  return codes;
}

/** Uses up a recovery code. Returns true when it was valid and unused. */
export async function consumeRecoveryCode(userId: string, input: string): Promise<boolean> {
  const normalized = normalizeRecoveryCode(input);
  if (!normalized) return false;
  const db = await getDb();
  const hash = await keyedHash(normalized, "recovery-code");
  const updated = await db
    .update(schema.adminRecoveryCodes)
    .set({ usedAt: new Date() })
    .where(and(eq(schema.adminRecoveryCodes.userId, userId), eq(schema.adminRecoveryCodes.codeHash, hash), isNull(schema.adminRecoveryCodes.usedAt)))
    .returning({ id: schema.adminRecoveryCodes.id });
  return updated.length > 0;
}

export async function unusedRecoveryCodeCount(userId: string): Promise<number> {
  const db = await getDb();
  const rows = await db
    .select({ id: schema.adminRecoveryCodes.id })
    .from(schema.adminRecoveryCodes)
    .where(and(eq(schema.adminRecoveryCodes.userId, userId), isNull(schema.adminRecoveryCodes.usedAt)));
  return rows.length;
}
