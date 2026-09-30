/**
 * Matching "notify me" requests to phones. Pure functions (no database), so
 * they can run anywhere and be unit tested.
 */

const STOP = new Set([
  "any",
  "a",
  "an",
  "the",
  "phone",
  "mobile",
  "with",
  "and",
  "or",
  "for",
  "my",
  "good",
  "new",
  "gb",
  "under",
  "below",
  "budget",
  "want",
  "need",
  "old",
  "father",
  "mother",
]);

/** Words that name a brand or series. If someone uses one, the phone must match it. */
const BRAND_WORDS: Record<string, string> = {
  apple: "apple",
  iphone: "apple",
  samsung: "samsung",
  galaxy: "samsung",
  redmi: "redmi",
  xiaomi: "redmi",
  mi: "redmi",
  poco: "poco",
  oneplus: "oneplus",
  nord: "oneplus",
  realme: "realme",
  narzo: "realme",
  vivo: "vivo",
  iqoo: "iqoo",
  oppo: "oppo",
  motorola: "motorola",
  moto: "motorola",
  nothing: "nothing",
  pixel: "google",
  google: "google",
  nokia: "nokia",
  infinix: "infinix",
  tecno: "tecno",
  lava: "lava",
};

function words(text: string) {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .filter(Boolean);
}

export type PhoneFacts = { brand: string; name: string; priceInr: number; has5g: boolean; batteryMah: number | null };

/**
 * How well a phone fits a "notify me" request. Returns null when it doesn't fit.
 * - If they named a brand or model, the phone must be that brand and share
 *   a model word (like "a54" or "13").
 * - If they only described what they need ("any 5G phone, big battery"),
 *   the phone must have those features.
 * Either way the price must be within their budget (5% leeway).
 */
export function scoreWant(want: { wantText: string; maxBudget: number | null }, phone: PhoneFacts): number | null {
  if (want.maxBudget && phone.priceInr > want.maxBudget * 1.05) return null;
  const phoneBrand = BRAND_WORDS[phone.brand.toLowerCase()] ?? phone.brand.toLowerCase();
  const modelWords = new Set(words(`${phone.brand} ${phone.name}`));
  const wanted = words(want.wantText).filter((word) => !STOP.has(word));
  const namedBrands = new Set(wanted.map((word) => BRAND_WORDS[word]).filter(Boolean));
  const text = want.wantText.toLowerCase();
  const wants5g = text.includes("5g");
  const wantsBattery = text.includes("battery") || text.includes("బ్యాటరీ");
  let score = 0;

  if (namedBrands.size > 0) {
    if (!namedBrands.has(phoneBrand)) return null;
    const modelHits = wanted.filter((word) => modelWords.has(word) && !BRAND_WORDS[word]);
    if (modelHits.length === 0) {
      // Only the brand was named ("any Samsung"): fine, but weaker.
      const onlyBrand = wanted.every((word) => BRAND_WORDS[word] || !/\d/.test(word));
      if (!onlyBrand) return null;
      score += 2;
    } else {
      score += 3 + modelHits.length;
    }
  } else {
    if (!wants5g && !wantsBattery && !want.maxBudget) return null;
    if (wants5g && !phone.has5g) return null;
    if (wantsBattery && (phone.batteryMah ?? 0) < 5000) return null;
    score += 1 + (wants5g ? 1 : 0) + (wantsBattery ? 1 : 0);
  }
  if (want.maxBudget) score += 1;
  return score;
}
