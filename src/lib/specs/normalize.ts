/**
 * Small, pure helpers that turn spec-sheet text ("Exynos 1380 (5 nm)",
 * "128GB 8GB RAM, 256GB 8GB RAM", …) into the catalog's fields.
 * Used for both the GSMArena reader and the AI lookup.
 */
import type { ModelVariant } from "@/db/schema";

export type Tier = 1 | 2 | 3 | 4;

const clampInt = (n: number | null | undefined, min: number, max: number): number | null => {
  if (n === null || n === undefined || !Number.isFinite(n)) return null;
  const r = Math.round(n);
  return r >= min && r <= max ? r : null;
};

export function firstNumber(text: string | null | undefined, pattern: RegExp): number | null {
  const m = text ? pattern.exec(text) : null;
  return m ? Number(m[1]) : null;
}

export const toInt = clampInt;

/** Collapses spaces and trims each line; drops empty lines. */
export function cleanLines(text: string): string[] {
  return text
    .split(/\n+/)
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter(Boolean);
}

// ---------------------------------------------------------------------------
// Brand and model name
// ---------------------------------------------------------------------------

/** GSMArena files some sub-brands under the parent maker ("Xiaomi Redmi Note 12"). Shops in India call them by the sub-brand. */
const SUB_BRANDS: { maker: string; prefix: string; brand: string }[] = [
  { maker: "xiaomi", prefix: "redmi ", brand: "Redmi" },
  { maker: "xiaomi", prefix: "poco ", brand: "Poco" },
  { maker: "vivo", prefix: "iqoo ", brand: "iQOO" },
];

const BRAND_SPELLING: Record<string, string> = {
  vivo: "Vivo",
  oneplus: "OnePlus",
  iqoo: "iQOO",
  hmd: "HMD",
  zte: "ZTE",
  lg: "LG",
  htc: "HTC",
  tcl: "TCL",
  poco: "Poco",
  realme: "Realme",
  oppo: "Oppo",
};

function brandSpelling(word: string) {
  return BRAND_SPELLING[word.toLowerCase()] ?? word.charAt(0).toUpperCase() + word.slice(1);
}

/** "Xiaomi Redmi Note 12 5G" → { brand: "Redmi", name: "Note 12 5G" }; "Apple iPhone 13" → { brand: "Apple", name: "iPhone 13" }. */
export function splitBrand(fullName: string): { brand: string; name: string } {
  const clean = fullName.replace(/\s+/g, " ").trim();
  const space = clean.indexOf(" ");
  if (space < 0) return { brand: brandSpelling(clean), name: clean };
  const maker = clean.slice(0, space);
  const rest = clean.slice(space + 1);
  for (const sub of SUB_BRANDS) {
    if (maker.toLowerCase() === sub.maker && rest.toLowerCase().startsWith(sub.prefix)) {
      return { brand: sub.brand, name: rest.slice(sub.prefix.length).trim() };
    }
  }
  return { brand: brandSpelling(maker), name: rest };
}

// ---------------------------------------------------------------------------
// Chipset and speed tier
// ---------------------------------------------------------------------------

/**
 * "Qualcomm SM8550-AC Snapdragon 8 Gen 2 (4 nm)" → "Snapdragon 8 Gen 2",
 * "Mediatek MT6769Z Helio G85 (12nm)" → "Helio G85", "Apple A15 Bionic (5 nm)" → "A15 Bionic".
 * When a phone has different chips by region, the Indian one is used if listed.
 */
export function cleanChipset(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const lines = cleanLines(raw);
  if (!lines.length) return null;
  let line = lines.find((l) => /\bindia\b/i.test(l)) ?? lines.find((l) => /\b(row|international|global)\b/i.test(l)) ?? lines[0];
  line = line
    .replace(/\s+-\s+.*$/, "") // " - International", " - USA"
    .replace(/\(\s*\d+(?:\.\d+)?\s*nm\s*\)/gi, "")
    .replace(/\s+/g, " ")
    .trim();
  const snapdragon = /snapdragon.*/i.exec(line);
  if (snapdragon) line = snapdragon[0];
  line = line
    .replace(/^mediatek\s+/i, "")
    .replace(/^MT\d+\w*\s+/i, "")
    .replace(/^qualcomm\s+/i, "")
    .replace(/^(?:SM|MSM|SDM)\d+[\w-]*\s+/i, "")
    .replace(/^apple\s+/i, "")
    .replace(/^google\s+/i, "")
    .replace(/^samsung\s+/i, "")
    .replace(/\s+5G$/i, "")
    .trim();
  return line ? line.slice(0, 80) : null;
}

/**
 * Rough speed tier from the chipset name, used for the "Speed" filter:
 * 1 everyday, 2 smooth, 3 fast, 4 top speed. Returns null when unsure,
 * so the owner can pick.
 */
export function performanceFromChipset(chipset: string | null | undefined): Tier | null {
  if (!chipset) return null;
  const c = chipset.toLowerCase();

  // Apple
  const apple = /\ba(\d{1,2})\b/.exec(c);
  if (apple && (c.includes("bionic") || c.includes("pro") || /^a\d{1,2}\b/.test(c))) {
    const n = Number(apple[1]);
    if (n >= 15) return 4;
    if (n >= 13) return 3;
    if (n >= 11) return 2;
    return 1;
  }
  if (c.includes("tensor")) return 4;

  // Snapdragon
  if (c.includes("snapdragon")) {
    if (/snapdragon 8(\+|s)? ?(gen|elite)/.test(c) || /snapdragon 8 elite/.test(c)) return 4;
    if (/snapdragon 7(\+|s)? ?gen/.test(c)) return 3;
    if (/snapdragon 6(\+|s)? ?gen/.test(c)) return 2;
    if (/snapdragon 4(\+|s)? ?gen/.test(c)) return 1;
    const n = firstNumber(c, /snapdragon (\d{3})/);
    if (n !== null) {
      if (n >= 865) return 4;
      if (n >= 835) return 3;
      if (n >= 778 && n < 800) return 3;
      if (n >= 600) return 2;
      return 1;
    }
    return null;
  }

  // MediaTek
  if (c.includes("dimensity")) {
    const n = firstNumber(c, /dimensity (\d{3,4})/);
    if (n === null) return null;
    if (n >= 9000) return 4;
    if (n >= 7000) return 3;
    if (n >= 6000) return 2;
    if (n === 1080) return 2;
    if (n >= 1000) return 3;
    return 2; // 700–930
  }
  if (c.includes("helio")) return 1;

  // Samsung Exynos
  if (c.includes("exynos")) {
    const n = firstNumber(c, /exynos (\d{3,4})/);
    if (n === null) return null;
    if (n >= 9000) return n >= 9800 ? 3 : 1; // 9810–9825 were 2018–19 flagships; 9610/9611 are basic
    if (n >= 2100 || n === 990) return 4;
    if (n >= 1380) return 3;
    if (n >= 1280) return 2;
    if (n === 880 || n === 980) return 2;
    return 1;
  }

  if (c.includes("unisoc") || c.includes("tiger") || c.includes("spreadtrum")) return 1;
  return null;
}

// ---------------------------------------------------------------------------
// Memory variants, display, cameras, battery
// ---------------------------------------------------------------------------

/** "128GB 6GB RAM, 256GB 8GB RAM, 1TB 12GB RAM" → variants. RAM is left empty for iPhones. */
export function parseVariants(raw: string | null | undefined, isIos: boolean): ModelVariant[] {
  if (!raw) return [];
  const out: ModelVariant[] = [];
  const seen = new Set<string>();
  const add = (storageGb: number, ramGb: number | null) => {
    const storage = clampInt(storageGb, 8, 2048);
    if (storage === null) return;
    const ram = isIos ? null : ramGb !== null && Number.isInteger(ramGb) ? clampInt(ramGb, 1, 32) : null;
    const key = `${ram ?? ""}/${storage}`;
    if (seen.has(key) || out.length >= 10) return;
    seen.add(key);
    out.push({ ramGb: ram, storageGb: storage, launchPriceInr: null });
  };
  const pairs = [...raw.matchAll(/(\d+(?:\.\d+)?)\s*(GB|TB)\s+(\d+(?:\.\d+)?)\s*GB\s+RAM/gi)];
  if (pairs.length) {
    for (const m of pairs) add(Number(m[1]) * (m[2].toUpperCase() === "TB" ? 1024 : 1), Number(m[3]));
  } else {
    for (const m of raw.matchAll(/(\d+(?:\.\d+)?)\s*(GB|TB)\b/gi)) add(Number(m[1]) * (m[2].toUpperCase() === "TB" ? 1024 : 1), null);
  }
  return out;
}

/** "Super AMOLED, 120Hz, HDR10+, 1000 nits" → { type: "Super AMOLED", refreshHz: 120 }. No Hz listed means a normal 60 Hz screen. */
export function parseDisplayType(raw: string | null | undefined): { type: string | null; refreshHz: number | null } {
  if (!raw) return { type: null, refreshHz: null };
  const first = cleanLines(raw)[0] ?? "";
  const type = first.split(",")[0]?.trim() || null;
  const hz = firstNumber(first, /(\d{2,3})\s*Hz/i);
  return { type: type ? type.slice(0, 40) : null, refreshHz: clampInt(hz ?? 60, 30, 240) };
}

const LENS_LABELS: [RegExp, string][] = [
  [/periscope/i, "periscope"],
  [/telephoto/i, "telephoto"],
  [/ultra\s*-?\s*wide/i, "ultra-wide"],
  [/macro/i, "macro"],
  [/depth/i, "depth"],
  [/b\/w|monochrome/i, "mono"],
];

/** Camera lines ("50 MP, f/1.8, (wide)…") → main MP and a short summary: "50MP + 12MP ultra-wide + 5MP macro". */
export function parseCameras(raw: string | null | undefined): { mainMp: number | null; summary: string | null } {
  if (!raw) return { mainMp: null, summary: null };
  const parts: string[] = [];
  let mainMp: number | null = null;
  for (const line of cleanLines(raw)) {
    const mp = firstNumber(line, /(\d+(?:\.\d+)?)\s*MP/i);
    if (mp === null) continue;
    const rounded = mp >= 10 ? Math.round(mp) : Math.round(mp * 10) / 10;
    if (mainMp === null) {
      mainMp = clampInt(mp, 1, 400);
      parts.push(`${rounded}MP`);
      continue;
    }
    const label = LENS_LABELS.find(([pattern]) => pattern.test(line))?.[1];
    parts.push(label ? `${rounded}MP ${label}` : `${rounded}MP`);
  }
  const summary = parts.join(" + ").slice(0, 120);
  return { mainMp, summary: summary || null };
}

export function parseBatteryMah(raw: string | null | undefined): number | null {
  return clampInt(firstNumber(raw, /(\d{3,5})\s*mAh/i), 500, 12000);
}

/** "25W wired, PD3.0, 50% in 30 min" → 25. Wireless and reverse charging are ignored. */
export function parseChargingW(raw: string | null | undefined): number | null {
  if (!raw) return null;
  const lines = cleanLines(raw);
  for (const line of lines) {
    const wired = firstNumber(line, /(\d+(?:\.\d+)?)\s*W\s+wired/i);
    if (wired !== null) return clampInt(wired, 1, 300);
  }
  for (const line of lines) {
    if (/wireless|reverse/i.test(line)) continue;
    const watts = firstNumber(line, /(\d+(?:\.\d+)?)\s*W\b/i);
    if (watts !== null) return clampInt(watts, 1, 300);
  }
  return null;
}

export function parseYear(raw: string | null | undefined): number | null {
  return clampInt(firstNumber(raw, /\b(20\d{2})\b/), 2010, 2035);
}

/** Model numbers such as "SM-A546E, SM-A546B" → aliases for search. */
export function parseModelCodes(raw: string | null | undefined): string[] {
  if (!raw) return [];
  return [
    ...new Set(
      raw
        .split(/[,;\n]/)
        .map((code) => code.trim())
        // Apple's internal ids ("iPhone14,5") are split by the comma; they aren't model numbers people type.
        .filter((code) => /^[\w./+-]{2,40}$/.test(code) && !/^iphone\d+$/i.test(code)),
    ),
  ].slice(0, 12);
}
