/**
 * The "sell your phone" quiz. Six quick questions; the answers drive the
 * price estimate in lib/pricing.ts. Keep keys stable: they are stored with
 * each sell request.
 */

export const FAULT_KEYS = ["camera", "speaker_mic", "charging", "biometric", "buttons", "network"] as const;
export type FaultKey = (typeof FAULT_KEYS)[number];

export const EXTRA_KEYS = ["box", "charger", "bill", "warranty"] as const;
export type ExtraKey = (typeof EXTRA_KEYS)[number];

export type SellAnswers = {
  power: "yes" | "no";
  screen: "perfect" | "scratches" | "cracked";
  body: "perfect" | "marks" | "damaged";
  battery: "good" | "weak" | "bad";
  faults: FaultKey[];
  extras: ExtraKey[];
};

export const SINGLE_CHOICE = {
  power: ["yes", "no"],
  screen: ["perfect", "scratches", "cracked"],
  body: ["perfect", "marks", "damaged"],
  battery: ["good", "weak", "bad"],
} as const;

export type SingleKey = keyof typeof SINGLE_CHOICE;

export const QUESTION_ORDER = ["power", "screen", "body", "battery", "faults", "extras"] as const;
export type QuestionKey = (typeof QUESTION_ORDER)[number];

export function isValidAnswers(value: unknown): value is SellAnswers {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  for (const key of Object.keys(SINGLE_CHOICE) as SingleKey[]) {
    const allowed = SINGLE_CHOICE[key] as readonly string[];
    if (typeof v[key] !== "string" || !allowed.includes(v[key] as string)) return false;
  }
  const faults = v.faults;
  const extras = v.extras;
  if (!Array.isArray(faults) || !faults.every((f) => (FAULT_KEYS as readonly string[]).includes(f))) return false;
  if (!Array.isArray(extras) || !extras.every((e) => (EXTRA_KEYS as readonly string[]).includes(e))) return false;
  if (new Set(faults).size !== faults.length || new Set(extras).size !== extras.length) return false;
  return true;
}

/** Keeps only the known answers, so nothing extra is ever stored. */
export function cleanAnswers(value: SellAnswers): SellAnswers {
  return {
    power: value.power,
    screen: value.screen,
    body: value.body,
    battery: value.battery,
    faults: [...value.faults],
    extras: [...value.extras],
  };
}
