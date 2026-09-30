import "server-only";
import { cookies } from "next/headers";
import { keyedHash, randomToken, timingSafeEqualString } from "@/lib/security/crypto";

const isProd = process.env.NODE_ENV === "production";
const COOKIE = isProd ? "__Host-sm_device" : "sm_device";
const MAX_AGE_SECONDS = 180 * 24 * 60 * 60;

/**
 * After a complete login (password + 2-step code), remember this browser.
 * Wrong-password tries from other devices then can't lock this person out,
 * because remembered devices get their own login-attempt limit.
 */
export async function rememberDevice(userId: string) {
  const id = randomToken(16);
  const signature = await keyedHash(`${userId}:${id}`, "device");
  (await cookies()).set(COOKIE, `${id}.${signature}`, { httpOnly: true, secure: isProd, sameSite: "lax", path: "/", maxAge: MAX_AGE_SECONDS });
}

/** This browser's device id if it was remembered for this user, else null. */
export async function knownDeviceFor(userId: string): Promise<string | null> {
  const value = (await cookies()).get(COOKIE)?.value;
  if (!value || value.length > 200) return null;
  const [id, signature] = value.split(".");
  if (!id || !signature) return null;
  const expected = await keyedHash(`${userId}:${id}`, "device");
  return timingSafeEqualString(signature, expected) ? id : null;
}
