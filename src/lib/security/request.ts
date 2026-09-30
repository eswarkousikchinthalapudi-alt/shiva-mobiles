import "server-only";
import { headers } from "next/headers";

function validIp(value: string | null | undefined): string | null {
  const ip = value?.trim();
  if (!ip || ip.length > 45) return null;
  // IPv4, or IPv6 (hex groups with colons, optionally ending in IPv4)
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(ip)) return ip;
  if (ip.includes(":") && /^[0-9a-fA-F:]+(:\d{1,3}(\.\d{1,3}){3})?$/.test(ip)) return ip;
  return null;
}

let warned = false;

/**
 * Client IP address, used for rate limits and the activity log. Set these to
 * match how the app is hosted (see README, "Visitor IP addresses"):
 *
 * - TRUSTED_IP_HEADER: a header your proxy sets and visitors can't fake,
 *   e.g. "cf-connecting-ip" behind Cloudflare, or "x-real-ip" behind nginx.
 *   Several can be listed, comma-separated; the first one present is used.
 * - Otherwise X-Forwarded-For is used, counting TRUSTED_PROXY_HOPS entries
 *   from the right (default 1 = the address added by the proxy in front of
 *   the app). Entries further left can be typed in by anyone.
 *
 * Without a proxy in front, these headers come straight from the visitor, so
 * always run behind one in production.
 */
export function ipFromHeaders(h: Headers): string {
  const custom = process.env.TRUSTED_IP_HEADER?.trim().toLowerCase();
  if (custom && custom !== "x-forwarded-for") {
    for (const name of custom
      .split(",")
      .map((part) => part.trim())
      .filter(Boolean)) {
      const ip = validIp(h.get(name));
      if (ip) return ip;
    }
    return "unknown";
  }
  if (!custom && process.env.NODE_ENV === "production" && !warned) {
    warned = true;
    console.warn("[ip] TRUSTED_IP_HEADER is not set; using X-Forwarded-For. Check the README section on visitor IP addresses.");
  }
  const hops = Math.min(5, Math.max(1, Number(process.env.TRUSTED_PROXY_HOPS) || 1));
  const forwarded = (h.get("x-forwarded-for") ?? "")
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
  return validIp(forwarded[forwarded.length - hops]) ?? "unknown";
}

export async function getRequestInfo() {
  const h = await headers();
  return {
    ip: ipFromHeaders(h),
    userAgent: (h.get("user-agent") ?? "").slice(0, 300),
  };
}
