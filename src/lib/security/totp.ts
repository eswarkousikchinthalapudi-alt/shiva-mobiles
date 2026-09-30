/**
 * Authenticator-app codes (TOTP, RFC 6238): 6 digits, 30 seconds, SHA-1 —
 * the defaults every authenticator app supports.
 */
import { Secret, TOTP } from "otpauth";

const PERIOD = 30;

export function newTotpSecret(): string {
  return new Secret({ size: 20 }).base32;
}

function build(secretBase32: string, label = "admin", issuer = "Shiva Mobiles") {
  return new TOTP({
    issuer,
    label,
    algorithm: "SHA1",
    digits: 6,
    period: PERIOD,
    secret: Secret.fromBase32(secretBase32),
  });
}

export function totpUri(secretBase32: string, label: string, issuer: string): string {
  return build(secretBase32, label, issuer).toString();
}

/**
 * Checks a code, allowing one step of clock drift either way. Rejects a code
 * whose time-step is not newer than `lastStep` so a code can't be replayed.
 */
export function verifyTotp(
  secretBase32: string,
  code: string,
  lastStep: number | null | undefined,
  now = Date.now(),
): { ok: true; step: number } | { ok: false } {
  const token = code.replace(/\s/g, "");
  if (!/^\d{6}$/.test(token)) return { ok: false };
  const delta = build(secretBase32).validate({ token, window: 1, timestamp: now });
  if (delta === null) return { ok: false };
  const step = Math.floor(now / 1000 / PERIOD) + delta;
  if (lastStep !== null && lastStep !== undefined && step <= lastStep) return { ok: false };
  return { ok: true, step };
}

/** Current code — used only by tests and the local demo script. */
export function currentTotp(secretBase32: string, now = Date.now()): string {
  return build(secretBase32).generate({ timestamp: now });
}
