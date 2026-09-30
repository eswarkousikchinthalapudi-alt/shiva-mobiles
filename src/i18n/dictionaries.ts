import { en, type Dictionary } from "./en";
import { te } from "./te";

export type Lang = "en" | "te";
export const LANG_COOKIE = "lang";
export const dictionaries: Record<Lang, Dictionary> = { en, te };

export function isLang(value: unknown): value is Lang {
  return value === "en" || value === "te";
}

export type { Dictionary };
