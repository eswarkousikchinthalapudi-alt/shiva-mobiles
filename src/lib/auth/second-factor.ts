import "server-only";
import { and, eq, isNull, lt, or } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { consumeRecoveryCode } from "@/lib/auth/recovery";
import { decryptString } from "@/lib/security/crypto";
import { verifyTotp } from "@/lib/security/totp";

/**
 * Checks a 6-digit authenticator code or a recovery code. A code's time-step
 * is saved in the same database statement that checks it, so the same code
 * can't be used twice, even by two requests at the same moment.
 */
export async function checkSecondFactor(user: { id: string; totpSecretEnc: string | null }, input: string): Promise<"totp" | "recovery" | null> {
  const code = String(input ?? "")
    .trim()
    .slice(0, 20);
  if (/^\d{3}\s?\d{3}$/.test(code)) {
    if (!user.totpSecretEnc) return null;
    const secret = await decryptString(user.totpSecretEnc, "totp");
    const result = verifyTotp(secret, code, null);
    if (!result.ok) return null;
    const db = await getDb();
    const updated = await db
      .update(schema.adminUsers)
      .set({ totpLastStep: result.step })
      .where(and(eq(schema.adminUsers.id, user.id), or(isNull(schema.adminUsers.totpLastStep), lt(schema.adminUsers.totpLastStep, result.step))))
      .returning({ id: schema.adminUsers.id });
    return updated.length ? "totp" : null;
  }
  if (code.length >= 10) return (await consumeRecoveryCode(user.id, code)) ? "recovery" : null;
  return null;
}
