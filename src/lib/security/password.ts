/**
 * Password hashing with PBKDF2-HMAC-SHA256 (600,000 iterations, the OWASP
 * recommendation for this algorithm). Stored as:
 *   pbkdf2_sha256$<iterations>$<salt>$<hash>
 */
import { fromBase64Url, randomBytes, timingSafeEqualBytes, toBase64Url } from "./crypto";

const ITERATIONS = 600_000;
const KEY_LENGTH_BITS = 256;
const encoder = new TextEncoder();

async function derive(password: string, salt: Uint8Array<ArrayBuffer>, iterations: number): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey("raw", encoder.encode(password.normalize("NFKC")), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt, iterations }, key, KEY_LENGTH_BITS);
  return new Uint8Array(bits);
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const hash = await derive(password, salt, ITERATIONS);
  return `pbkdf2_sha256$${ITERATIONS}$${toBase64Url(salt)}$${toBase64Url(hash)}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [scheme, iterText, saltText, hashText] = stored.split("$");
  if (scheme !== "pbkdf2_sha256" || !iterText || !saltText || !hashText) return false;
  const iterations = Number(iterText);
  if (!Number.isInteger(iterations) || iterations < 100_000 || iterations > 5_000_000) return false;
  const expected = fromBase64Url(hashText);
  const actual = await derive(password, fromBase64Url(saltText), iterations);
  return timingSafeEqualBytes(actual, expected);
}

/** A fixed hash used to keep login timing the same when a user does not exist. */
let dummyHash: Promise<string> | null = null;
export function getDummyHash(): Promise<string> {
  dummyHash ??= hashPassword("not-a-real-password-" + toBase64Url(randomBytes(8)));
  return dummyHash;
}

const COMMON = new Set([
  "password",
  "password1",
  "password123",
  "12345678",
  "123456789",
  "1234567890",
  "qwerty123",
  "iloveyou",
  "admin123",
  "welcome123",
  "shivamobiles",
  "shiva123",
  "mobiles123",
]);

/** Returns an error message, or null when the password is acceptable. */
export function checkPasswordStrength(password: string, username?: string): string | null {
  if (password.length < 10) return "Use at least 10 characters.";
  if (password.length > 200) return "Password is too long.";
  const lower = password.toLowerCase();
  if (COMMON.has(lower)) return "This password is too common. Pick something harder to guess.";
  if (username && lower.includes(username.toLowerCase())) return "Don't use your username in the password.";
  if (/^(.)\1+$/.test(password)) return "Don't repeat the same character.";
  return null;
}
