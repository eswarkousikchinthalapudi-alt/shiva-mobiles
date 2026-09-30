/**
 * GSMArena links: works out a phone's specs page from whatever link staff
 * paste. Pure functions, also used in the browser to tell links from names.
 */

const HOSTS = new Set(["gsmarena.com", "www.gsmarena.com", "m.gsmarena.com"]);

export type GsmarenaLink = { slug: string; id: string; url: string };
export type LinkCheck = { ok: true; link: GsmarenaLink } | { ok: false; error: string };

export const NOT_A_PHONE_PAGE = "That isn't a phone page on GSMArena. Open the phone on gsmarena.com and copy the link from the address bar.";

/** True when the text looks like a web link rather than a phone name. */
export function looksLikeLink(text: string): boolean {
  const t = text.trim();
  return /^(https?:\/\/|www\.|m\.)/i.test(t) || /\.(com|in|net|org|php)(\/|\?|$)/i.test(t) || /gsmarena/i.test(t);
}

/** Works out the phone's specs page from any GSMArena phone link (specs, pictures, opinions, prices; phone or desktop site). */
export function parseGsmarenaLink(input: string): LinkCheck {
  let text = input.trim();
  if (!/^https?:\/\//i.test(text)) text = `https://${text}`;
  let url: URL;
  try {
    url = new URL(text);
    // Links copied from Google results can be wrapped: google.com/url?q=<link>
    if (/(^|\.)google\.[a-z.]+$/i.test(url.hostname) && url.pathname === "/url") {
      const target = url.searchParams.get("q") ?? url.searchParams.get("url");
      if (target) url = new URL(target);
    }
  } catch {
    return { ok: false, error: NOT_A_PHONE_PAGE };
  }
  if (!HOSTS.has(url.hostname.toLowerCase())) {
    return { ok: false, error: "Only GSMArena links can be read. For other sites, type the phone's name instead." };
  }
  let path: string;
  try {
    path = decodeURIComponent(url.pathname);
  } catch {
    return { ok: false, error: NOT_A_PHONE_PAGE };
  }
  const match = /^\/([a-z0-9_+().&-]{2,120})-(\d{1,6})\.php$/i.exec(path);
  if (!match) return { ok: false, error: NOT_A_PHONE_PAGE };
  const slug = match[1].toLowerCase().replace(/-(pictures|reviews|price|3d-spin|user-opinions)$/, "");
  if (/-review$/.test(slug)) return { ok: false, error: "That's a review article. Open the phone's specs page on GSMArena and copy that link instead." };
  if (slug.includes("-") || !/^[a-z0-9_+().&]+$/.test(slug)) return { ok: false, error: NOT_A_PHONE_PAGE };
  const id = String(Number(match[2]));
  return { ok: true, link: { slug, id, url: `https://www.gsmarena.com/${slug}-${id}.php` } };
}

/**
 * Where a GSMArena redirect may take the reader: only another GSMArena phone
 * page (desktop or phone site), kept exactly as given apart from https.
 * Returns null for anything else.
 */
export function redirectTarget(location: string, base: string): string | null {
  let next: URL;
  try {
    next = new URL(location, base);
  } catch {
    return null;
  }
  if (!HOSTS.has(next.hostname.toLowerCase()) || !parseGsmarenaLink(next.toString()).ok) return null;
  next.protocol = "https:";
  next.hash = "";
  return next.toString();
}
