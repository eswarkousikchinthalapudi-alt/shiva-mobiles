import "server-only";
import { eq } from "drizzle-orm";
import QRCode from "qrcode";
import { getDb, schema } from "@/db";
import { decryptString, encryptString } from "@/lib/security/crypto";
import { newTotpSecret, totpUri } from "@/lib/security/totp";
import type { AdminSession } from "./dal";

/** Makes (or reuses) the secret for the 2FA setup screen. Returns the QR code and the text key. */
export async function getTotpSetup(session: AdminSession): Promise<{ qrDataUrl: string; secret: string }> {
  const db = await getDb();
  let secret: string;
  if (session.pendingTotpEnc) {
    secret = await decryptString(session.pendingTotpEnc, "totp");
  } else {
    secret = newTotpSecret();
    await db
      .update(schema.adminSessions)
      .set({ pendingTotpEnc: await encryptString(secret, "totp") })
      .where(eq(schema.adminSessions.id, session.id));
  }
  const settings = await db.select({ name: schema.shopSettings.shopName }).from(schema.shopSettings).limit(1);
  const issuer = settings[0]?.name || "Shiva Mobiles";
  const uri = totpUri(secret, session.user.username, issuer);
  const qrDataUrl = await QRCode.toDataURL(uri, { errorCorrectionLevel: "M", margin: 1, width: 240 });
  return { qrDataUrl, secret };
}

/** Reads and clears the one-time message stored on a session. */
export async function takeFlash(sessionId: string, flashEnc: string | null): Promise<string | null> {
  if (!flashEnc) return null;
  const db = await getDb();
  await db.update(schema.adminSessions).set({ flashEnc: null }).where(eq(schema.adminSessions.id, sessionId));
  try {
    return await decryptString(flashEnc, "flash");
  } catch {
    return null;
  }
}
