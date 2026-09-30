import { afterEach, describe, expect, it, vi } from "vitest";
import { decryptString, encryptString, keyedHash, timingSafeEqualString } from "./crypto";
import { checkPasswordStrength, hashPassword, verifyPassword } from "./password";
import { ipFromHeaders } from "./request";

describe("encryption", () => {
  it("round-trips a value", async () => {
    const token = await encryptString("490154203237518", "imei");
    expect(token.startsWith("v1.")).toBe(true);
    expect(token).not.toContain("490154203237518");
    expect(await decryptString(token, "imei")).toBe("490154203237518");
  });

  it("uses a new random IV every time", async () => {
    expect(await encryptString("same", "imei")).not.toBe(await encryptString("same", "imei"));
  });

  it("refuses a tampered value or the wrong purpose", async () => {
    const token = await encryptString("secret", "totp");
    const tampered = token.slice(0, -2) + (token.endsWith("A") ? "BB" : "AA");
    await expect(decryptString(tampered, "totp")).rejects.toThrow();
    await expect(decryptString(token, "imei")).rejects.toThrow();
  });

  it("makes stable keyed hashes that differ by purpose", async () => {
    expect(await keyedHash("abc", "rate-limit")).toBe(await keyedHash("abc", "rate-limit"));
    expect(await keyedHash("abc", "rate-limit")).not.toBe(await keyedHash("abc", "recovery-code"));
  });

  it("compares strings safely", () => {
    expect(timingSafeEqualString("token-1", "token-1")).toBe(true);
    expect(timingSafeEqualString("token-1", "token-2")).toBe(false);
    expect(timingSafeEqualString("short", "longer-value")).toBe(false);
  });
});

describe("passwords", () => {
  it("hashes and verifies", async () => {
    const hash = await hashPassword("blue-bicycle-morning");
    expect(hash.startsWith("pbkdf2_sha256$600000$")).toBe(true);
    expect(await verifyPassword("blue-bicycle-morning", hash)).toBe(true);
    expect(await verifyPassword("blue-bicycle-evening", hash)).toBe(false);
  });

  it("rejects broken or weak stored hashes", async () => {
    expect(await verifyPassword("x", "md5$abc")).toBe(false);
    expect(await verifyPassword("x", "pbkdf2_sha256$10$abc$def")).toBe(false);
  });

  it("checks password strength", () => {
    expect(checkPasswordStrength("short")).not.toBeNull();
    expect(checkPasswordStrength("password123")).not.toBeNull();
    expect(checkPasswordStrength("ramesh-phones-2026", "ramesh")).not.toBeNull();
    expect(checkPasswordStrength("aaaaaaaaaaaa")).not.toBeNull();
    expect(checkPasswordStrength("blue-bicycle-morning", "ramesh")).toBeNull();
  });
});

describe("ipFromHeaders", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("uses the last X-Forwarded-For address (the one our proxy added)", () => {
    const h = new Headers({ "x-forwarded-for": "1.2.3.4, 203.0.113.9" });
    expect(ipFromHeaders(h)).toBe("203.0.113.9");
  });

  it("does not trust a Cloudflare header unless told to", () => {
    const h = new Headers({ "cf-connecting-ip": "1.1.1.1", "x-forwarded-for": "198.51.100.7" });
    expect(ipFromHeaders(h)).toBe("198.51.100.7");
    vi.stubEnv("TRUSTED_IP_HEADER", "cf-connecting-ip");
    expect(ipFromHeaders(h)).toBe("1.1.1.1");
  });

  it("uses the first listed header that is present", () => {
    vi.stubEnv("TRUSTED_IP_HEADER", "true-client-ip, cf-connecting-ip");
    expect(ipFromHeaders(new Headers({ "cf-connecting-ip": "1.1.1.1" }))).toBe("1.1.1.1");
    expect(ipFromHeaders(new Headers({ "true-client-ip": "2.2.2.2", "cf-connecting-ip": "1.1.1.1" }))).toBe("2.2.2.2");
    expect(ipFromHeaders(new Headers({ "x-forwarded-for": "3.3.3.3" }))).toBe("unknown");
  });

  it("can skip more than one proxy", () => {
    vi.stubEnv("TRUSTED_PROXY_HOPS", "2");
    const h = new Headers({ "x-forwarded-for": "6.6.6.6, 203.0.113.9, 172.70.1.1" });
    expect(ipFromHeaders(h)).toBe("203.0.113.9");
  });

  it("accepts IPv6 addresses", () => {
    expect(ipFromHeaders(new Headers({ "x-forwarded-for": "2001:db8::1" }))).toBe("2001:db8::1");
    expect(ipFromHeaders(new Headers({ "x-forwarded-for": "::ffff:127.0.0.1" }))).toBe("::ffff:127.0.0.1");
  });

  it("returns 'unknown' for missing or strange values", () => {
    expect(ipFromHeaders(new Headers())).toBe("unknown");
    expect(ipFromHeaders(new Headers({ "x-forwarded-for": "<script>" }))).toBe("unknown");
    expect(ipFromHeaders(new Headers({ "x-forwarded-for": "abc" }))).toBe("unknown");
  });
});
