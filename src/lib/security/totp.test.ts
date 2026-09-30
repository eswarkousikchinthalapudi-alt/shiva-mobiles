import { describe, expect, it } from "vitest";
import { currentTotp, newTotpSecret, totpUri, verifyTotp } from "./totp";

const NOW = Date.UTC(2026, 8, 29, 6, 0, 10); // fixed time, 10 s into a 30 s step
const STEP = Math.floor(NOW / 30000);

describe("verifyTotp", () => {
  const secret = newTotpSecret();

  it("accepts the current code and returns its time-step", () => {
    const result = verifyTotp(secret, currentTotp(secret, NOW), null, NOW);
    expect(result).toEqual({ ok: true, step: STEP });
  });

  it("accepts a code with a space in the middle", () => {
    const code = currentTotp(secret, NOW);
    expect(verifyTotp(secret, `${code.slice(0, 3)} ${code.slice(3)}`, null, NOW).ok).toBe(true);
  });

  it("allows one step of clock drift, not more", () => {
    expect(verifyTotp(secret, currentTotp(secret, NOW - 30000), null, NOW).ok).toBe(true);
    expect(verifyTotp(secret, currentTotp(secret, NOW + 30000), null, NOW).ok).toBe(true);
    expect(verifyTotp(secret, currentTotp(secret, NOW - 90000), null, NOW).ok).toBe(false);
  });

  it("refuses to use the same code twice", () => {
    const code = currentTotp(secret, NOW);
    const first = verifyTotp(secret, code, null, NOW);
    expect(first.ok).toBe(true);
    expect(verifyTotp(secret, code, first.ok ? first.step : null, NOW).ok).toBe(false);
  });

  it("rejects wrong and malformed codes", () => {
    const code = currentTotp(secret, NOW);
    const wrong = String((Number(code) + 1) % 1000000).padStart(6, "0");
    expect(verifyTotp(secret, wrong, null, NOW).ok).toBe(false);
    expect(verifyTotp(secret, "12345", null, NOW).ok).toBe(false);
    expect(verifyTotp(secret, "abcdef", null, NOW).ok).toBe(false);
  });
});

describe("totpUri", () => {
  it("builds an otpauth link the apps understand", () => {
    const uri = totpUri("JBSWY3DPEHPK3PXP", "owner", "Shiva Mobiles");
    expect(uri.startsWith("otpauth://totp/")).toBe(true);
    expect(uri).toContain("secret=JBSWY3DPEHPK3PXP");
    expect(uri).toContain("issuer=Shiva%20Mobiles");
  });
});
