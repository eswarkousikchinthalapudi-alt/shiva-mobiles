import { describe, expect, it } from "vitest";
import { displayMobile, formatInr, normalizeIndianMobile, whatsappLink } from "./format";
import { isValidAnswers } from "./sell-quiz";

describe("normalizeIndianMobile", () => {
  it("accepts common ways of writing a number", () => {
    for (const input of ["9876543210", "98765 43210", "+91 98765 43210", "919876543210", "09876543210", "+91-98765-43210"]) {
      expect(normalizeIndianMobile(input)).toBe("9876543210");
    }
  });

  it("rejects numbers that aren't Indian mobiles", () => {
    for (const input of ["1234567890", "5876543210", "98765432", "98765432101", "", "abcdefghij"]) {
      expect(normalizeIndianMobile(input)).toBeNull();
    }
  });

  it("shows numbers in a readable way", () => {
    expect(displayMobile("9876543210")).toBe("+91 98765 43210");
  });
});

describe("formatInr", () => {
  it("uses Indian digit grouping", () => {
    expect(formatInr(32999)).toBe("₹32,999");
    expect(formatInr(124999)).toBe("₹1,24,999");
    expect(formatInr(null)).toBe("—");
  });
});

describe("whatsappLink", () => {
  it("builds a wa.me link with the message encoded", () => {
    expect(whatsappLink("+91 98765 43210", "Hi & hello?")).toBe("https://wa.me/919876543210?text=Hi%20%26%20hello%3F");
  });
});

describe("isValidAnswers", () => {
  const ok = { power: "yes", screen: "perfect", body: "marks", battery: "good", faults: ["camera"], extras: ["box"] };

  it("accepts a complete set of answers", () => {
    expect(isValidAnswers(ok)).toBe(true);
  });

  it("rejects unknown or repeated answers", () => {
    expect(isValidAnswers({ ...ok, screen: "shattered" })).toBe(false);
    expect(isValidAnswers({ ...ok, faults: ["camera", "camera"] })).toBe(false);
    expect(isValidAnswers({ ...ok, extras: ["gold"] })).toBe(false);
    expect(isValidAnswers({ ...ok, faults: "camera" })).toBe(false);
    expect(isValidAnswers(null)).toBe(false);
  });
});
