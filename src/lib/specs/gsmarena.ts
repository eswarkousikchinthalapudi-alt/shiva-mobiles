import "server-only";
import { NodeType, parse, type HTMLElement, type Node } from "node-html-parser";
import type { ModelInput } from "@/lib/admin/catalog";
import { readBodyLimited } from "@/lib/security/body";
import { NOT_A_PHONE_PAGE, parseGsmarenaLink } from "./link";
import {
  cleanChipset,
  cleanLines,
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
} from "./normalize";

/**
 * Reads a phone's specs from its GSMArena page, when staff paste the link.
 *
 * Only ever fetches one GSMArena phone page per request, built from the
 * phone's id in the pasted link (never the pasted URL itself), with an honest
 * user agent, a timeout and a size limit. It never uses GSMArena's search,
 * which is protected against automated use.
 */

const USER_AGENT = "ShivaMobilesCatalog/1.0 (phone shop website; reads one page when staff paste a link)";
const MAX_PAGE_BYTES = 3_000_000;
const TIMEOUT_MS = 15_000;

export type ReadOutcome = { ok: true; specs: ModelInput } | { ok: false; error: string };

// ---------------------------------------------------------------------------
// Page parsing (pure, tested with saved pages)
// ---------------------------------------------------------------------------

function textOf(node: Node): string {
  if (node.nodeType === NodeType.TEXT_NODE) return node.text;
  if (node.nodeType !== NodeType.ELEMENT_NODE) return "";
  const el = node as HTMLElement;
  const tag = el.tagName;
  if (tag === "BR") return "\n";
  if (tag === "SCRIPT" || tag === "STYLE" || tag === "NOSCRIPT") return "";
  return el.childNodes.map(textOf).join("");
}

function cellText(el: HTMLElement): string {
  return cleanLines(textOf(el).replace(/ | | /g, " ")).join("\n");
}

type Row = { section: string; label: string; value: string; spec: string | null };

function readRows(list: HTMLElement): Row[] {
  const rows: Row[] = [];
  let section = "";
  for (const tr of list.querySelectorAll("tr")) {
    const th = tr.querySelector("th");
    if (th) section = cellText(th);
    const nfo = tr.querySelector("td.nfo");
    if (!nfo) continue;
    const ttl = tr.querySelector("td.ttl");
    const spec = nfo.getAttribute("data-spec") ?? nfo.querySelector("[data-spec]")?.getAttribute("data-spec") ?? null;
    rows.push({ section, label: ttl ? cellText(ttl) : "", value: cellText(nfo), spec });
  }
  return rows;
}

const same = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

export function isBotCheckPage(html: string): boolean {
  if (html.includes('id="specs-list"')) return false;
  return /cf-turnstile|challenges\.cloudflare\.com|one quick check before you continue|just a moment\.\.\.|cf-chl-/i.test(html);
}

/** Turns a GSMArena phone page into catalog fields. Returns null if the page has no spec table. */
export function parseGsmarenaHtml(html: string, sourceUrl: string): ModelInput | null {
  const root = parse(html, { comment: false });
  const title = root.querySelector('[data-spec="modelname"]') ?? root.querySelector("h1.specs-phone-name-title");
  const list = root.querySelector("#specs-list");
  if (!title || !list) return null;
  const fullName = cellText(title).replace(/\n/g, " ");
  const rows = readRows(list);
  if (!fullName || rows.length < 5) return null;

  const pick = (spec: string, section?: string, label?: string): string | null => {
    const bySpec = rows.find((r) => r.spec === spec);
    if (bySpec) return bySpec.value;
    if (!section) return null;
    const bySection = rows.find((r) => same(r.section, section) && (label === undefined || same(r.label, label)));
    return bySection?.value ?? null;
  };

  const { brand, name } = splitBrand(fullName);
  const osText = pick("os", "Platform", "OS") ?? "";
  const isIos = /\bios\b/i.test(osText) || brand.toLowerCase() === "apple";
  const chipset = cleanChipset(pick("chipset", "Platform", "Chipset"));
  const display = parseDisplayType(pick("displaytype", "Display", "Type"));
  const inches = firstNumber(pick("displaysize", "Display", "Size"), /(\d+(?:\.\d+)?)\s*inch/i);
  const cameras = parseCameras(pick("cam1modules", "Main Camera"));
  const selfie = parseCameras(pick("cam2modules", "Selfie camera"));
  const charging = rows.find((r) => same(r.section, "Battery") && /charging/i.test(r.label))?.value ?? null;
  const battery = pick("batdescription1", "Battery", "Type") ?? rows.find((r) => same(r.section, "Battery"))?.value ?? null;

  return {
    brand: brand.slice(0, 40),
    name: name.slice(0, 80),
    aliases: parseModelCodes(pick("models", "Misc", "Models")),
    os: isIos ? "iOS" : "Android",
    launchYear: parseYear(pick("year", "Launch", "Announced")) ?? parseYear(pick("status", "Launch", "Status")),
    chipset,
    performance: performanceFromChipset(chipset),
    displayInches: inches !== null && inches >= 3 && inches <= 9 ? inches : null,
    displayType: display.type,
    refreshHz: display.type ? display.refreshHz : null,
    mainCameraMp: cameras.mainMp,
    cameraSummary: cameras.summary,
    frontCameraMp: selfie.mainMp,
    batteryMah: parseBatteryMah(battery),
    chargingW: parseChargingW(charging),
    has5g: /\b5G\b/.test(pick("nettech", "Network", "Technology") ?? ""),
    variants: parseVariants(pick("internalmemory", "Memory", "Internal"), isIos),
    sourceUrls: [sourceUrl],
  };
}

// ---------------------------------------------------------------------------
// Fetching
// ---------------------------------------------------------------------------

const cache = new Map<string, { at: number; specs: ModelInput }>();
const CACHE_MS = 60 * 60 * 1000;

const BLOCKED = "GSMArena didn't let our server read the page just now. Try again in a few minutes, or add the specs by hand.";

export async function readGsmarenaSpecs(input: string): Promise<ReadOutcome> {
  const checked = parseGsmarenaLink(input);
  if (!checked.ok) return checked;
  let url = checked.link.url;

  const hit = cache.get(url);
  if (hit && Date.now() - hit.at < CACHE_MS) return { ok: true, specs: structuredClone(hit.specs) };

  for (let hop = 0; hop < 3; hop++) {
    let response: Response;
    try {
      response = await fetch(url, {
        redirect: "manual",
        cache: "no-store",
        signal: AbortSignal.timeout(TIMEOUT_MS),
        headers: { "User-Agent": USER_AGENT, Accept: "text/html", "Accept-Language": "en" },
      });
    } catch (error) {
      console.error("[gsmarena] fetch failed", error);
      return { ok: false, error: "Couldn't reach GSMArena. Check the internet connection and try again, or add the specs by hand." };
    }

    if (response.status >= 300 && response.status < 400) {
      // Only follow redirects to another GSMArena phone page.
      const location = response.headers.get("location");
      const next = location ? parseGsmarenaLink(new URL(location, url).toString()) : null;
      if (!next?.ok) return { ok: false, error: NOT_A_PHONE_PAGE };
      url = next.link.url;
      continue;
    }
    if (response.status === 404) return { ok: false, error: "GSMArena says this page doesn't exist. Check the link." };
    if (response.status === 429) return { ok: false, error: "GSMArena is busy right now. Wait a minute and try again." };
    if (!response.ok) {
      console.error("[gsmarena] status", response.status);
      return { ok: false, error: BLOCKED };
    }

    const body = await readBodyLimited(response, MAX_PAGE_BYTES);
    if (!body) return { ok: false, error: "That page is too large to read." };
    const html = new TextDecoder("utf-8").decode(body);
    if (isBotCheckPage(html)) return { ok: false, error: BLOCKED };
    const specs = parseGsmarenaHtml(html, url);
    if (!specs) return { ok: false, error: "Couldn't find the specs on that page. Make sure it's the phone's main page on GSMArena." };

    if (cache.size >= 50) cache.delete(cache.keys().next().value as string);
    cache.set(url, { at: Date.now(), specs: structuredClone(specs) });
    return { ok: true, specs };
  }
  return { ok: false, error: NOT_A_PHONE_PAGE };
}
