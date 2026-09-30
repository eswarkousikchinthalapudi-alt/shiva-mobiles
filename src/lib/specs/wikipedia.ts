import "server-only";
import { NodeType, parse, type HTMLElement, type Node } from "node-html-parser";
import { readBodyLimited } from "@/lib/security/body";

/**
 * Finds a phone's Wikipedia article and turns it into plain text (the spec
 * box first), for the free AI to read the specs out of. Wikipedia allows
 * this kind of use as long as the tool identifies itself and keeps to a
 * few requests, which one lookup does (one search, one article).
 */

const API = "https://en.wikipedia.org/w/api.php";
const USER_AGENT = "ShivaMobilesCatalog/1.0 (https://shiva-mobiles.onrender.com; second-hand phone shop catalog; one article per lookup)";
const TIMEOUT_MS = 10_000;
const MAX_BYTES = 3_000_000;
const MAX_TEXT = 30_000;

export type WikiArticle = { title: string; url: string; text: string };

// ---------------------------------------------------------------------------
// Choosing the article (pure)
// ---------------------------------------------------------------------------

const STOP = new Set(["5g", "4g", "lte", "phone", "phones", "mobile", "smartphone", "the", "and", "new", "edition", "dual", "sim", "gb", "ram"]);

export function queryTokens(query: string): string[] {
  return [
    ...new Set(
      query
        .toLowerCase()
        .split(/[^a-z0-9+]+/)
        .map((t) => t.replace(/\+$/, "plus"))
        .filter((t) => t.length >= 2 && !STOP.has(t)),
    ),
  ];
}

/** The search result that is most likely the phone: shares its model token (the one with digits) or at least two words with the query. */
export function pickResult(query: string, results: { title: string }[]): string | null {
  const wanted = queryTokens(query);
  if (!wanted.length) return null;
  let best: { title: string; score: number } | null = null;
  for (const { title } of results) {
    if (/\(disambiguation\)|^list of|^comparison of|^timeline of/i.test(title)) continue;
    const have = new Set(queryTokens(title));
    const shared = wanted.filter((t) => have.has(t));
    const modelMatch = shared.some((t) => /\d/.test(t));
    if (!modelMatch && shared.length < 2) continue;
    const score = shared.length + (modelMatch ? 2 : 0);
    if (!best || score > best.score) best = { title, score };
  }
  return best?.title ?? null;
}

// ---------------------------------------------------------------------------
// Rendered article → text (pure)
// ---------------------------------------------------------------------------

const BLOCKS = new Set(["P", "DIV", "TR", "LI", "H2", "H3", "H4", "TABLE", "UL", "OL", "DD", "DT", "BLOCKQUOTE", "SECTION"]);
const SKIP = new Set(["STYLE", "SCRIPT", "NOSCRIPT", "SUP", "FIGURE", "FIGCAPTION", "IMG"]);

function textOf(node: Node, cellSep: string): string {
  if (node.nodeType === NodeType.TEXT_NODE) return node.text;
  if (node.nodeType !== NodeType.ELEMENT_NODE) return "";
  const el = node as HTMLElement;
  const tag = el.tagName;
  if (SKIP.has(tag)) return "";
  if (tag === "BR") return "\n";
  const inner = el.childNodes.map((c) => textOf(c, cellSep)).join("");
  if (tag === "TD" || tag === "TH") return `${inner}${cellSep}`;
  if (tag === "LI") return `${inner}; `;
  return BLOCKS.has(tag) ? `${inner}\n` : inner;
}

const tidy = (s: string) =>
  s
    .replace(/[   ]/g, " ")
    .replace(/\[\s*(?:\d+|[a-z]|note \d+|citation needed)\s*\]/gi, "")
    .replace(/;\s*(?=\n|$)/g, "")
    .replace(/[ \t]+/g, " ")
    .replace(/\s*\n\s*/g, "\n")
    .trim();

/** The article as text: the spec box as "Label: value" lines, then the rest of the article. */
export function wikiHtmlToText(html: string): string {
  const root = parse(html, { comment: false });
  for (const el of root.querySelectorAll("style, script, .reference, .mw-editsection, .navbox, .noprint, #toc, .hatnote, .mw-empty-elt, .reflist, .sidebar")) {
    el.remove();
  }
  const lines: string[] = [];
  for (const box of root.querySelectorAll("table.infobox")) {
    for (const tr of box.querySelectorAll("tr")) {
      const label = tr.querySelector("th");
      const data = tr.querySelector("td");
      if (label && data) lines.push(`${tidy(textOf(label, ""))}: ${tidy(textOf(data, " ")).replace(/\n/g, "; ")}`);
      else if (label) lines.push(tidy(textOf(label, "")));
    }
    box.remove();
  }
  const body = tidy(textOf(root, " | "));
  return `${lines.join("\n")}\n\n${body}`.trim().slice(0, MAX_TEXT);
}

// ---------------------------------------------------------------------------
// Fetching
// ---------------------------------------------------------------------------

async function apiJson(params: Record<string, string>): Promise<unknown> {
  const url = `${API}?${new URLSearchParams({ format: "json", formatversion: "2", ...params })}`;
  const response = await fetch(url, {
    cache: "no-store",
    signal: AbortSignal.timeout(TIMEOUT_MS),
    headers: { "User-Agent": USER_AGENT, Accept: "application/json" },
  });
  if (!response.ok) throw new Error(`wikipedia ${response.status}`);
  const body = await readBodyLimited(response, MAX_BYTES);
  if (!body) throw new Error("wikipedia response too large");
  return JSON.parse(new TextDecoder().decode(body));
}

export function articleUrl(title: string) {
  return `https://en.wikipedia.org/wiki/${encodeURIComponent(title.replace(/ /g, "_"))}`;
}

/** Looks the phone up on Wikipedia. Returns null when there is no fitting article, and never throws. */
export async function findWikipediaArticle(query: string): Promise<WikiArticle | null> {
  const q = queryTokens(query).join(" ");
  if (!q) return null;
  try {
    const search = (await apiJson({ action: "query", list: "search", srsearch: q, srlimit: "6", srnamespace: "0" })) as {
      query?: { search?: { title: string }[] };
    };
    const title = pickResult(query, search.query?.search ?? []);
    if (!title) return null;
    const page = (await apiJson({ action: "parse", page: title, prop: "text", redirects: "1", disabletoc: "1" })) as {
      parse?: { title?: string; text?: string };
    };
    if (!page.parse?.text) return null;
    const finalTitle = page.parse.title || title;
    return { title: finalTitle, url: articleUrl(finalTitle), text: wikiHtmlToText(page.parse.text) };
  } catch (error) {
    console.warn("[wikipedia] lookup failed", error);
    return null;
  }
}
