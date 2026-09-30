import type { ModelInput } from "@/lib/admin/catalog";
import type { ModelVariant } from "@/db/schema";
import {
  cleanChipset,
  firstNumber,
  parseBatteryMah,
  parseCameras,
  parseChargingW,
  parseDisplayType,
  parseModelCodes,
  parseVariants,
  parseYear,
  performanceFromChipset,
  splitBrand,
  toInt,
} from "./normalize";

/**
 * Reads phone specs from text that staff copied from a specs web page
 * (select all → copy → paste). Nothing is fetched, so it works for every
 * phone and every site, including sites that block automated readers.
 *
 * Text copied from a spec table (GSMArena and similar) keeps its cells
 * separated by tabs, so those rows are read by section and label. Anything
 * missing is then looked for in the whole text with patterns ("5000 mAh",
 * "6.7 inches", "Snapdragon 7s Gen 2", "8 GB RAM + 128 GB").
 */

const SECTIONS = new Set([
  "network",
  "launch",
  "body",
  "display",
  "platform",
  "memory",
  "main camera",
  "selfie camera",
  "sound",
  "comms",
  "features",
  "battery",
  "misc",
  "tests",
]);

const BRANDS = [
  "samsung",
  "apple",
  "xiaomi",
  "redmi",
  "poco",
  "oneplus",
  "oppo",
  "vivo",
  "iqoo",
  "realme",
  "motorola",
  "moto",
  "nothing",
  "google",
  "honor",
  "huawei",
  "nokia",
  "hmd",
  "infinix",
  "tecno",
  "lava",
  "sony",
  "asus",
  "lenovo",
  "lg",
  "micromax",
  "itel",
  "cmf",
];

type Row = { section: string; label: string; value: string };

const clean = (s: string) => s.replace(/[   ]/g, " ").trim();

/** Rows of a copied spec table: section (Display, Battery, …), label (Type, Size, …) and value. */
export function rowsFromText(text: string): Row[] {
  const rows: Row[] = [];
  let section = "";
  for (const raw of text.split(/\r?\n/)) {
    if (!raw.trim()) continue;
    const cells = raw.split("\t").map(clean);
    while (cells.length && !cells[0]) cells.shift();
    if (!cells.length) continue;
    const first = cells[0].toLowerCase();
    if (cells.length >= 3) {
      if (SECTIONS.has(first)) {
        section = cells[0];
        rows.push({ section, label: cells[1], value: cells.slice(2).join(" ") });
      } else {
        rows.push({ section, label: cells[0], value: cells.slice(1).join(" ") });
      }
    } else if (cells.length === 2) {
      if (SECTIONS.has(first)) {
        section = cells[0];
        rows.push({ section, label: "", value: cells[1] });
      } else {
        rows.push({ section, label: cells[0], value: cells[1] });
      }
    } else if (SECTIONS.has(first) && raw.indexOf("\t") < 0) {
      // Phone-site layout: the section name sits on its own line.
      section = cells[0];
    } else if (rows.length && rows[rows.length - 1].section) {
      // A value that continues on the next line (camera lenses, extra memory notes).
      rows[rows.length - 1].value += `\n${cells[0]}`;
    }
  }
  return rows;
}

const same = (a: string, b: string) => a.toLowerCase() === b.toLowerCase();

/** The phone's full name, from a line such as "Samsung Galaxy A54" near the top of the copied page. */
export function nameFromText(text: string): string | null {
  const candidates: string[] = [];
  for (const raw of text.split(/\r?\n/).slice(0, 400)) {
    if (raw.includes("\t")) continue;
    const line = clean(raw);
    if (line.length < 4 || line.length > 60) continue;
    if (/review|opinion|picture|price|compare|\bvs\b|\bspecs?\b|specification|\s-\s|:|\?|₹|\$/i.test(line)) continue;
    const word = line.split(/\s+/)[0]?.toLowerCase();
    if (!BRANDS.includes(word) || !/\d|\b(?:pro|plus|max|ultra|lite|neo|prime|fold|flip)\b/i.test(line)) continue;
    candidates.push(line);
  }
  if (!candidates.length) return null;
  return candidates.sort((a, b) => a.length - b.length)[0];
}

const CHIP_PATTERN =
  /(?:snapdragon\s+\d[\w+]*(?:\s+elite)?(?:\s+plus)?(?:\s+gen\s+\d+)?(?:\s+5g)?|dimensity\s+\d{3,4}\+?(?:[ -](?:ultra|max|x))?|helio\s+[a-z]\d{2,3}\+?|exynos\s+\d{3,4}|apple\s+a\d{1,2}(?:\s+(?:pro|bionic))?|\ba\d{1,2}\s+(?:pro|bionic)\b|(?:google\s+)?tensor(?:\s+g\d)?|unisoc\s+[a-z]?\d{3,4}\w*|kirin\s+\d+\w*)/i;

const DISPLAY_TYPES =
  /(dynamic\s+ltpo\s+amoled\s+2x|dynamic\s+amoled\s+2x|dynamic\s+amoled|super\s+amoled\s+plus|super\s+amoled|ltpo\s+amoled|ltpo\s+oled|super\s+retina\s+xdr\s+oled|liquid\s+retina\s+ips\s+lcd|p-oled|amoled|oled|ips\s+lcd|tft\s+lcd|lcd)/i;

const ACRONYMS: Record<string, string> = {
  lcd: "LCD",
  oled: "OLED",
  amoled: "AMOLED",
  ltpo: "LTPO",
  ips: "IPS",
  tft: "TFT",
  xdr: "XDR",
  "2x": "2X",
  "p-oled": "P-OLED",
};

/** "dynamic amoled 2x" → "Dynamic AMOLED 2X". */
function prettyDisplayType(raw: string): string {
  return raw
    .toLowerCase()
    .split(/\s+/)
    .map((w) => ACRONYMS[w] ?? w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

/** "128/256 GB or 1 TB" → [128, 256, 1024]: numbers take the unit that follows them. */
export function sizesInGb(line: string): number[] {
  const out: number[] = [];
  let pending: number[] = [];
  for (const m of line.matchAll(/(\d+(?:\.\d+)?)|\b(GB|TB)\b/gi)) {
    if (m[1] !== undefined) pending.push(Number(m[1]));
    else {
      const factor = m[2].toUpperCase() === "TB" ? 1024 : 1;
      for (const n of pending) out.push(n * factor);
      pending = [];
    }
  }
  return out.filter((n) => Number.isInteger(n) && n > 0);
}

/** Variants written as "8 GB RAM + 128 GB", "12GB RAM, 256GB" or "8GB/128GB". */
function variantsFromLooseText(text: string, isIos: boolean): ModelVariant[] {
  const out: ModelVariant[] = [];
  const seen = new Set<string>();
  const add = (ram: number | null, storage: number) => {
    const storageGb = toInt(storage, 8, 2048);
    if (storageGb === null) return;
    const ramGb = isIos ? null : toInt(ram, 1, 32);
    const key = `${ramGb ?? ""}/${storageGb}`;
    if (seen.has(key) || out.length >= 10) return;
    seen.add(key);
    out.push({ ramGb, storageGb, launchPriceInr: null });
  };
  for (const m of text.matchAll(/(\d{1,2})\s*GB\s*RAM\s*[+,/|]\s*(\d+(?:\.\d+)?)\s*(GB|TB)\b/gi)) {
    add(Number(m[1]), Number(m[2]) * (m[3].toUpperCase() === "TB" ? 1024 : 1));
  }
  for (const m of text.matchAll(/\b(\d{1,2})\s*GB\s*\/\s*(\d{2,4})\s*(GB|TB)\b/gi)) {
    add(Number(m[1]), Number(m[2]) * (m[3].toUpperCase() === "TB" ? 1024 : 1));
  }
  if (!out.length) {
    // Encyclopedia style: "Memory: 6 or 8 GB RAM" and "Storage: 128/256 GB or 1 TB". RAM is set only when there is a single value.
    const memory = /^\s*(?:memory|ram)\s*:\s*([^\n]+)/im.exec(text)?.[1] ?? "";
    const storage = /^\s*(?:storage|internal storage)\s*:\s*([^\n]+)/im.exec(text)?.[1] ?? "";
    const rams = sizesInGb(memory).filter((gb) => gb <= 32);
    for (const gb of sizesInGb(storage)) add(rams.length === 1 ? rams[0] : null, gb);
  }
  return out;
}

export type TextSpecs = { specs: ModelInput; found: number };

/** How many of the useful fields were found. Brand and name don't count: they may come from what staff typed. */
export function countFound(s: ModelInput): number {
  return [
    s.chipset,
    s.displayInches,
    s.displayType,
    s.refreshHz,
    s.mainCameraMp,
    s.frontCameraMp,
    s.batteryMah,
    s.chargingW,
    s.launchYear,
    s.variants.length ? 1 : null,
  ].filter((v) => v !== null && v !== undefined).length;
}

export function parseSpecsText(input: string, hint = ""): TextSpecs {
  const text = input.replace(/[   ]/g, " ");
  const rows = rowsFromText(text);
  const row = (section: string, label?: RegExp): string | null =>
    rows.find((r) => same(r.section, section) && (label === undefined || label.test(r.label)))?.value ?? null;

  const fullName = nameFromText(text) ?? hint.trim();
  const { brand, name } = fullName ? splitBrand(fullName) : { brand: "", name: "" };
  const osRow = row("Platform", /^os$/i) ?? "";
  const isIos = /\bios\b/i.test(osRow) || brand.toLowerCase() === "apple" || (!osRow && /\biphone\b/i.test(fullName));

  // Table rows first.
  let chipset = cleanChipset(row("Platform", /chipset/i));
  const display = parseDisplayType(row("Display", /^type$/i));
  let displayType = display.type;
  let refreshHz = display.type ? display.refreshHz : null;
  let displayInches = firstNumber(row("Display", /^size$/i), /(\d+(?:\.\d+)?)\s*inch/i);
  const mainRow = row("Main Camera");
  const selfieRow = row("Selfie camera");
  let cameras = parseCameras(mainRow);
  let frontMp = parseCameras(selfieRow).mainMp;
  let batteryMah = parseBatteryMah(row("Battery", /^type$/i) ?? row("Battery"));
  let chargingW = parseChargingW(row("Battery", /charging/i));
  let launchYear = parseYear(row("Launch", /announced/i)) ?? parseYear(row("Launch", /status/i));
  let variants = parseVariants(row("Memory", /internal/i), isIos);
  const aliases = parseModelCodes(row("Misc", /models/i));
  let has5g = /\b5G\b/.test(row("Network", /technology/i) ?? "");

  // Then patterns over the whole text for whatever is still missing.
  if (!chipset) {
    const m = CHIP_PATTERN.exec(text);
    chipset = cleanChipset(m ? m[0].replace(/\s+(?:octa|hexa|quad|processor|chipset|cpu).*$/i, "") : null);
  }
  if (displayInches === null) {
    const inches = firstNumber(text, /(\d(?:\.\d{1,2})?)\s*(?:inches|inch|-inch|″|"|\bin\b)/i);
    displayInches = inches !== null && inches >= 3 && inches <= 9 ? inches : null;
  }
  if (!displayType) {
    const m = DISPLAY_TYPES.exec(text);
    displayType = m ? prettyDisplayType(m[1]) : null;
  }
  if (refreshHz === null) refreshHz = toInt(firstNumber(text, /(\d{2,3})\s*Hz/i), 30, 240) ?? (displayType ? 60 : null);
  if (cameras.mainMp === null) {
    const main = firstNumber(text, /(\d{1,3}(?:\.\d)?)\s*MP\b/i);
    cameras = { mainMp: toInt(main, 1, 400), summary: null };
  }
  if (frontMp === null) {
    frontMp =
      toInt(firstNumber(text, /(\d{1,3}(?:\.\d)?)\s*MP(?:(?!\d\s*MP)[^\n]){0,25}?\b(?:front|selfie)/i), 1, 200) ??
      toInt(firstNumber(text, /\b(?:front|selfie)[^\n\d]{0,25}?(\d{1,3}(?:\.\d)?)\s*MP/i), 1, 200);
  }
  if (batteryMah === null) batteryMah = parseBatteryMah(text);
  if (chargingW === null) {
    chargingW = toInt(firstNumber(text, /(\d{1,3}(?:\.\d)?)\s*W\s*(?:wired|fast|charg|super|flash|turbo|warp|dart|vooc|hypercharge|supervooc)/i), 1, 300);
  }
  if (launchYear === null) launchYear = parseYear(/(?:announced|released|launch(?:ed|\s+date)?)[^\n]{0,30}?(20\d{2})/i.exec(text)?.[1] ?? null);
  if (!variants.length) variants = variantsFromLooseText(text, isIos);
  if (!has5g) has5g = /\b5G\b/.test(fullName) || /\b5G\s+(?:supported|yes|bands)\b|\b(?:LTE|4G)\s*\/\s*5G\b|\/\s*5G\b/i.test(text);

  const specs: ModelInput = {
    brand: brand.slice(0, 40),
    name: name.slice(0, 80),
    aliases,
    os: isIos ? "iOS" : "Android",
    launchYear,
    chipset,
    performance: performanceFromChipset(chipset),
    displayInches,
    displayType,
    refreshHz,
    mainCameraMp: cameras.mainMp,
    cameraSummary: cameras.summary,
    frontCameraMp: frontMp,
    batteryMah,
    chargingW,
    has5g,
    variants,
    sourceUrls: [],
  };
  return { specs, found: countFound(specs) };
}

/** Cuts a long paste down to the part that holds the specs, for the AI. */
export function trimForAi(text: string, max = 14_000): string {
  if (text.length <= max) return text;
  const anchor = text.search(/\bchipset\b|\bnetwork\b|\bdisplay\b/i);
  const start = Math.max(0, (anchor < 0 ? 0 : anchor) - 400);
  return text.slice(start, start + max);
}
