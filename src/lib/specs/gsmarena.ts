import "server-only";
import { NodeType, parse, type HTMLElement, type Node } from "node-html-parser";
import type { ModelInput } from "@/lib/admin/catalog";
import { readBodyLimited } from "@/lib/security/body";
import { parseGsmarenaLink, redirectTarget } from "./link";
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
 * Only ever fetches GSMArena phone pages: the first address is rebuilt from
 * the phone's id in the pasted link, and redirects are followed only to other
 * GSMArena phone pages. One page per request, a bot-style user agent that
 * names the tool, a timeout and a size limit. It never uses GSMArena's
 * search, which is protected against automated use.
 */

// "compatible; …" is the usual way for tools to identify themselves. Words like
// "Mobile" or "phone" are left out: sites treat those as phone browsers and
// redirect to their phone site.
const USER_AGENT = "Mozilla/5.0 (compatible; ShivaShopCatalog/1.1)";
const MAX_PAGE_BYTES = 3_000_000;
const TIMEOUT_MS = 15_000;
const MAX_REDIRECTS = 4;

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
  return cleanLines(textOf(el).replace(/[\u00a0\u2009\u202f]/g, " ")).join("\n");
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
/** The page's <title>, e.g. "Samsung Galaxy A54 - Full phone specifications". */
export function pageTitle(html: string): string {
  const match = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(html);
  return match ? parse(match[1]).text.replace(/\s+/g, " ").trim().slice(0, 120) : "";
}

export function parseGsmarenaHtml(html: string, sourceUrl: string): ModelInput | null {
  const root = parse(html, { comment: false });
  // The desktop and phone versions of the site differ a little, so look in a few places.
  const heading = root.querySelector('[data-spec="modelname"]') ?? root.querySelector("h1.specs-phone-name-title") ?? root.querySelector("h1");
  const fromTitle = pageTitle(html).replace(/\s*-\s*full phone specifications.*$/i, "");
  const fullName = (heading ? cellText(heading).replace(/\n/g, " ") : "") || fromTitle;
  const rows = readRows(root.querySelector("#specs-list") ?? root);
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

const TRY_LATER = "Try again in a few minutes, or add the specs by hand.";
const shortUrl = (url: string) => url.replace(/^https?:\/\//, "").slice(0, 80);

/** Keeps cookies GSMArena sets on a redirect, as a browser would, for the next request. */
function cookieJar() {
  const jar = new Map<string, string>();
  return {
    /** Returns true when a cookie was added or changed. */
    take(response: Response): boolean {
      let changed = false;
      for (const cookie of response.headers.getSetCookie?.() ?? []) {
        const pair = cookie.split(";")[0] ?? "";
        const eq = pair.indexOf("=");
        if (eq <= 0) continue;
        const name = pair.slice(0, eq).trim();
        const value = pair.slice(eq + 1).trim();
        if (jar.get(name) !== value) changed = true;
        jar.set(name, value);
      }
      return changed;
    },
    header(): Record<string, string> {
      return jar.size ? { Cookie: [...jar].map(([k, v]) => `${k}=${v}`).join("; ") } : {};
    },
  };
}

export async function readGsmarenaSpecs(input: string): Promise<ReadOutcome> {
  const checked = parseGsmarenaLink(input);
  if (!checked.ok) return checked;
  const canonical = checked.link.url;

  const hit = cache.get(canonical);
  if (hit && Date.now() - hit.at < CACHE_MS) return { ok: true, specs: structuredClone(hit.specs) };

  const cookies = cookieJar();
  const visited = new Set<string>();
  let url = canonical;
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    visited.add(url);
    let response: Response;
    try {
      response = await fetch(url, {
        redirect: "manual",
        cache: "no-store",
        signal: AbortSignal.timeout(TIMEOUT_MS),
        headers: { "User-Agent": USER_AGENT, Accept: "text/html,application/xhtml+xml", "Accept-Language": "en-US,en;q=0.8", ...cookies.header() },
      });
    } catch (error) {
      console.error("[gsmarena] fetch failed", url, error);
      return { ok: false, error: "Couldn't reach GSMArena. Check the internet connection and try again, or add the specs by hand." };
    }
    const newCookies = cookies.take(response);

    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get("location") ?? "";
      console.warn("[gsmarena] redirect", response.status, url, "->", location);
      const next = redirectTarget(location, url);
      if (!next) {
        return {
          ok: false,
          error: `GSMArena sent our server to a different page instead of the phone's specs. ${TRY_LATER} (Details: ${response.status} to ${shortUrl(location) || "nowhere"})`,
        };
      }
      // Coming back to a page is fine once a cookie was set (a simple cookie check); otherwise it's a loop.
      if (visited.has(next) && !newCookies) {
        return { ok: false, error: `GSMArena kept sending our server back and forth. ${TRY_LATER} (Details: ${response.status} loop via ${shortUrl(next)})` };
      }
      url = next;
      continue;
    }
    if (response.status === 404) return { ok: false, error: "GSMArena says this page doesn't exist. Check the link." };
    if (response.status === 429) return { ok: false, error: "GSMArena is busy right now. Wait a minute and try again." };
    if (!response.ok) {
      console.error("[gsmarena] status", response.status, url);
      return { ok: false, error: `GSMArena didn't let our server read the page just now. ${TRY_LATER} (Details: ${response.status} from ${shortUrl(url)})` };
    }

    const body = await readBodyLimited(response, MAX_PAGE_BYTES);
    if (!body) return { ok: false, error: "That page is too large to read." };
    const html = new TextDecoder("utf-8").decode(body);
    if (isBotCheckPage(html)) {
      console.error("[gsmarena] bot check page", url);
      return {
        ok: false,
        error: `GSMArena asked our server to prove it's human, so it couldn't read the page. ${TRY_LATER} (Details: check page at ${shortUrl(url)})`,
      };
    }
    const specs = parseGsmarenaHtml(html, canonical);
    if (!specs) {
      console.error("[gsmarena] no specs found", url, pageTitle(html));
      return {
        ok: false,
        error: `Couldn't find the specs on that page. Make sure it's the phone's main page on GSMArena. (Details: page "${pageTitle(html) || "untitled"}" at ${shortUrl(url)})`,
      };
    }

    if (cache.size >= 50) cache.delete(cache.keys().next().value as string);
    cache.set(canonical, { at: Date.now(), specs: structuredClone(specs) });
    return { ok: true, specs };
  }
  return { ok: false, error: `GSMArena redirected our server too many times. ${TRY_LATER}` };
}
