import { describe, expect, it } from "vitest";
import { scoreWant, type PhoneFacts } from "./wanted-match";

const phone = (brand: string, name: string, priceInr: number, extra: Partial<PhoneFacts> = {}): PhoneFacts => ({
  brand,
  name,
  priceInr,
  has5g: false,
  batteryMah: 4000,
  ...extra,
});

const want = (wantText: string, maxBudget: number | null = null) => ({ wantText, maxBudget });

describe("scoreWant", () => {
  it("matches the model they named", () => {
    expect(scoreWant(want("iPhone 13"), phone("Apple", "iPhone 13", 38000))).not.toBeNull();
    expect(scoreWant(want("Galaxy A54"), phone("Samsung", "Galaxy A54 5G", 22000))).not.toBeNull();
  });

  it("does not match another brand", () => {
    expect(scoreWant(want("iPhone 13"), phone("Samsung", "Galaxy S21 FE 5G", 25000))).toBeNull();
    expect(scoreWant(want("Redmi Note 12"), phone("Samsung", "Galaxy A34 5G", 14000))).toBeNull();
  });

  it("does not match another model number of the same brand", () => {
    expect(scoreWant(want("iPhone 13 or 14"), phone("Apple", "iPhone 12", 26000))).toBeNull();
    expect(scoreWant(want("iPhone 13 or 14"), phone("Apple", "iPhone 14 Plus", 45000))).not.toBeNull();
  });

  it("matches any phone of a brand when only the brand is named", () => {
    expect(scoreWant(want("any Samsung phone"), phone("Samsung", "Galaxy M34 5G", 12000))).not.toBeNull();
  });

  it("treats series names as their brand", () => {
    expect(scoreWant(want("Nord CE 3"), phone("OnePlus", "Nord CE 3 Lite 5G", 12000))).not.toBeNull();
  });

  it("respects the budget, with 5% leeway", () => {
    expect(scoreWant(want("iPhone 13", 40000), phone("Apple", "iPhone 13", 41500))).not.toBeNull();
    expect(scoreWant(want("iPhone 13", 40000), phone("Apple", "iPhone 13", 43000))).toBeNull();
  });

  it("matches described needs when no brand is named", () => {
    const fiveG = phone("Redmi", "12 5G", 9000, { has5g: true, batteryMah: 5000 });
    const fourG = phone("Redmi", "13C", 7000, { has5g: false, batteryMah: 5000 });
    expect(scoreWant(want("any 5G phone with big battery", 12000), fiveG)).not.toBeNull();
    expect(scoreWant(want("any 5G phone with big battery", 12000), fourG)).toBeNull();
  });

  it("does not match vague requests without a budget or features", () => {
    expect(scoreWant(want("good phone for my father"), phone("Redmi", "13C", 7000))).toBeNull();
  });

  it("ranks an exact model above a brand-only match", () => {
    const exact = scoreWant(want("Samsung A54"), phone("Samsung", "Galaxy A54 5G", 22000))!;
    const brandOnly = scoreWant(want("Samsung"), phone("Samsung", "Galaxy A54 5G", 22000))!;
    expect(exact).toBeGreaterThan(brandOnly);
  });
});
