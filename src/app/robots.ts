import type { MetadataRoute } from "next";
import { getSiteUrl } from "@/lib/settings";

export const dynamic = "force-dynamic";

export default async function robots(): Promise<MetadataRoute.Robots> {
  const base = await getSiteUrl();
  return {
    rules: [{ userAgent: "*", allow: "/", disallow: ["/admin", "/api/", "/bill/", "/sell/track/", "/compare"] }],
    sitemap: `${base}/sitemap.xml`,
  };
}
