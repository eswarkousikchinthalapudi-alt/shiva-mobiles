import type { SellAnswers } from "./sell-quiz";

/**
 * Rules the owner controls in Admin → Pricing. Percent values are cut from
 * the base buying price; "missing" values are flat rupee cuts.
 */
export type PricingRules = {
  screen: { scratches: number; cracked: number };
  body: { marks: number; damaged: number };
  battery: { weak: number; bad: number };
  /** Percent cut for each thing that does not work */
  faultEach: number;
  missingBox: number;
  missingCharger: number;
  missingBill: number;
  /** Percent added when brand warranty is still left */
  warrantyBonus: number;
  /** Total percent cuts never go beyond this */
  maxCutPercent: number;
  /** The range shown to sellers: estimate minus rangeLow% to plus rangeHigh% */
  rangeLow: number;
  rangeHigh: number;
};

export const DEFAULT_PRICING: PricingRules = {
  screen: { scratches: 5, cracked: 35 },
  body: { marks: 5, damaged: 15 },
  battery: { weak: 8, bad: 20 },
  faultEach: 10,
  missingBox: 300,
  missingCharger: 200,
  missingBill: 500,
  warrantyBonus: 5,
  maxCutPercent: 70,
  rangeLow: 10,
  rangeHigh: 5,
};

export function withDefaults(rules: Partial<PricingRules> | null | undefined): PricingRules {
  return {
    ...DEFAULT_PRICING,
    ...(rules ?? {}),
    screen: { ...DEFAULT_PRICING.screen, ...(rules?.screen ?? {}) },
    body: { ...DEFAULT_PRICING.body, ...(rules?.body ?? {}) },
    battery: { ...DEFAULT_PRICING.battery, ...(rules?.battery ?? {}) },
  };
}

function roundTo(value: number, step: number) {
  return Math.max(0, Math.round(value / step) * step);
}

export type Estimate = { min: number; max: number; point: number; cutPercent: number; flatCuts: number };

/**
 * Returns a price range for a phone, or null when the phone does not switch
 * on (the shop checks those in person) or no base price is set.
 */
export function estimatePrice(basePrice: number | null | undefined, answers: SellAnswers, rulesInput?: Partial<PricingRules> | null): Estimate | null {
  if (!basePrice || basePrice <= 0) return null;
  if (answers.power === "no") return null;
  const rules = withDefaults(rulesInput);

  let cut = 0;
  if (answers.screen === "scratches") cut += rules.screen.scratches;
  if (answers.screen === "cracked") cut += rules.screen.cracked;
  if (answers.body === "marks") cut += rules.body.marks;
  if (answers.body === "damaged") cut += rules.body.damaged;
  if (answers.battery === "weak") cut += rules.battery.weak;
  if (answers.battery === "bad") cut += rules.battery.bad;
  cut += answers.faults.length * rules.faultEach;
  if (answers.extras.includes("warranty")) cut -= rules.warrantyBonus;
  cut = Math.min(Math.max(cut, -rules.warrantyBonus), rules.maxCutPercent);

  let flat = 0;
  if (!answers.extras.includes("box")) flat += rules.missingBox;
  if (!answers.extras.includes("charger")) flat += rules.missingCharger;
  if (!answers.extras.includes("bill")) flat += rules.missingBill;

  const point = Math.max(0, basePrice * (1 - cut / 100) - flat);
  const min = roundTo(point * (1 - rules.rangeLow / 100), 100);
  const max = roundTo(point * (1 + rules.rangeHigh / 100), 100);
  if (max <= 0) return null;
  return { min, max, point: roundTo(point, 100), cutPercent: cut, flatCuts: flat };
}
