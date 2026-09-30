/**
 * Crypto helpers built on Web Crypto so they run in any modern JS runtime.
 *
 * APP_SECRET (32+ random characters) is the root secret. It is used to
 * derive the key that encrypts IMEIs and 2FA secrets at rest, and to hash
 * values we must look up but never store in plain form.
 */
import fs from "node:fs";
import path from "node:path";

const encoder = new TextEncoder();
const decoder = new TextDecoder();

export function toBase64Url(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString("base64url");
}

export function fromBase64Url(value: string): Uint8Array<ArrayBuffer> {
  const decoded = Buffer.from(value, "base64url");
  const out = new Uint8Array(new ArrayBuffer(decoded.length));
  out.set(decoded);
  return out;
}

export function randomBytes(length: number): Uint8Array<ArrayBuffer> {
  const bytes = new Uint8Array(new ArrayBuffer(length));
  crypto.getRandomValues(bytes);
  return bytes;
}

/** URL-safe random token, 32 bytes = 256 bits by default. */
export function randomToken(length = 32): string {
  return toBase64Url(randomBytes(length));
}

export async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", encoder.encode(value));
  return Buffer.from(digest).toString("hex");
}

/** Constant-time comparison of two byte arrays. */
export function timingSafeEqualBytes(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}

export function timingSafeEqualString(a: string, b: string): boolean {
  return timingSafeEqualBytes(encoder.encode(a), encoder.encode(b));
}

let cachedSecret: string | null = null;

/**
 * Returns APP_SECRET. In development a random secret is created once and
 * kept in .data/dev-secret so encrypted values survive restarts.
 */
export function getAppSecret(): string {
  if (cachedSecret) return cachedSecret;
  const fromEnv = process.env.APP_SECRET?.trim();
  if (fromEnv) {
    if (fromEnv.length < 32) throw new Error("APP_SECRET must be at least 32 characters long.");
    cachedSecret = fromEnv;
    return fromEnv;
  }
  if (process.env.NODE_ENV === "production") {
    throw new Error("APP_SECRET is not set. Generate one with: openssl rand -base64 48");
  }
  const file = path.resolve(".data/dev-secret");
  try {
    cachedSecret = fs.readFileSync(file, "utf8").trim();
  } catch {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    cachedSecret = randomToken(48);
    fs.writeFileSync(file, cachedSecret, { mode: 0o600 });
  }
  return cachedSecret;
}

const keyCache = new Map<string, Promise<CryptoKey>>();

async function deriveKey(purpose: string, usage: "encrypt" | "hmac"): Promise<CryptoKey> {
  const cacheKey = `${purpose}:${usage}`;
  const existing = keyCache.get(cacheKey);
  if (existing) return existing;
  const promise = (async () => {
    const base = await crypto.subtle.importKey("raw", encoder.encode(getAppSecret()), "HKDF", false, ["deriveKey"]);
    const params = { name: "HKDF", hash: "SHA-256", salt: encoder.encode("shiva-mobiles/v1"), info: encoder.encode(purpose) };
    if (usage === "encrypt") {
      return crypto.subtle.deriveKey(params, base, { name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]);
    }
    return crypto.subtle.deriveKey(params, base, { name: "HMAC", hash: "SHA-256", length: 256 }, false, ["sign"]);
  })();
  keyCache.set(cacheKey, promise);
  return promise;
}

/** AES-256-GCM. Output: v1.<iv>.<ciphertext+tag>, both base64url. */
export async function encryptString(plain: string, purpose = "data-at-rest"): Promise<string> {
  const key = await deriveKey(purpose, "encrypt");
  const iv = randomBytes(12);
  const cipher = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, encoder.encode(plain));
  return `v1.${toBase64Url(iv)}.${toBase64Url(new Uint8Array(cipher))}`;
}

export async function decryptString(token: string, purpose = "data-at-rest"): Promise<string> {
  const [version, ivPart, dataPart] = token.split(".");
  if (version !== "v1" || !ivPart || !dataPart) throw new Error("Unknown encrypted value format");
  const key = await deriveKey(purpose, "encrypt");
  const plain = await crypto.subtle.decrypt({ name: "AES-GCM", iv: fromBase64Url(ivPart) }, key, fromBase64Url(dataPart));
  return decoder.decode(plain);
}

/** Keyed hash for values we look up later (tokens, recovery codes, IPs). */
export async function keyedHash(value: string, purpose = "lookup"): Promise<string> {
  const key = await deriveKey(purpose, "hmac");
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(value));
  return Buffer.from(signature).toString("hex");
}
