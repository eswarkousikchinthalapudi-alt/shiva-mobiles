import { describe, expect, it } from "vitest";
import { DEFAULT_PRICING, estimatePrice, withDefaults } from "./pricing";
import type { SellAnswers } from "./sell-quiz";

const perfect: SellAnswers = { power: "yes", screen: "perfect", body: "perfect", battery: "good", faults: [], extras: ["box", "charger", "bill"] };

describe("estimatePrice", () => {
  it("gives no estimate without a base price", () => {
    expect(estimatePrice(null, perfect)).toBeNull();
    expect(estimatePrice(0, perfect)).toBeNull();
  });

  it("gives no estimate when the phone does not switch on", () => {
    expect(estimatePrice(20000, { ...perfect, power: "no" })).toBeNull();
  });

  it("shows a range around the base price for a perfect phone with everything", () => {
    const e = estimatePrice(20000, perfect)!;
    expect(e.point).toBe(20000);
    expect(e.min).toBe(18000); // 10% below
    expect(e.max).toBe(21000); // 5% above
    expect(e.cutPercent).toBe(0);
    expect(e.flatCuts).toBe(0);
  });

  it("adds up percent cuts and flat cuts for missing items", () => {
    const e = estimatePrice(20000, { ...perfect, screen: "scratches", battery: "weak", extras: ["charger"] })!;
    // 5% + 8% = 13% cut, then ₹300 (box) + ₹500 (bill)
    expect(e.cutPercent).toBe(13);
    expect(e.flatCuts).toBe(800);
    expect(e.point).toBe(16600);
  });

  it("never cuts more than the maximum percent", () => {
    const e = estimatePrice(
      20000,
      { power: "yes", screen: "cracked", body: "damaged", battery: "bad", faults: ["camera", "speaker_mic", "charging"], extras: ["box", "charger", "bill"] },
      DEFAULT_PRICING,
    )!;
    expect(e.cutPercent).toBe(DEFAULT_PRICING.maxCutPercent);
    expect(e.point).toBe(6000);
  });

  it("adds a little when brand warranty is left", () => {
    const e = estimatePrice(20000, { ...perfect, extras: ["box", "charger", "bill", "warranty"] })!;
    expect(e.cutPercent).toBe(-5);
    expect(e.point).toBe(21000);
  });

  it("rounds to the nearest ₹100", () => {
    const e = estimatePrice(12345, perfect)!;
    for (const value of [e.min, e.max, e.point]) expect(value % 100).toBe(0);
  });

  it("uses the owner's rules when given", () => {
    const e = estimatePrice(10000, { ...perfect, screen: "scratches" }, { screen: { scratches: 20, cracked: 40 } })!;
    expect(e.point).toBe(8000);
  });
});

describe("withDefaults", () => {
  it("fills in missing nested values", () => {
    const rules = withDefaults({ screen: { scratches: 7 } } as never);
    expect(rules.screen.scratches).toBe(7);
    expect(rules.screen.cracked).toBe(DEFAULT_PRICING.screen.cracked);
    expect(rules.battery).toEqual(DEFAULT_PRICING.battery);
  });
});
