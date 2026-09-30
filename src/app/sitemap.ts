import type { MetadataRoute } from "next";
import { desc, inArray } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { getSiteUrl } from "@/lib/settings";

// Built on each request (it reads the database), so builds don't need a database.
export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = await getSiteUrl();
  const db = await getDb();
  const phones = await db
    .select({ slug: schema.listings.slug, updatedAt: schema.listings.updatedAt })
    .from(schema.listings)
    .where(inArray(schema.listings.status, ["available", "reserved"]))
    .orderBy(desc(schema.listings.publishedAt))
    .limit(2000);
  const pages: MetadataRoute.Sitemap = [
    { url: `${base}/`, changeFrequency: "daily", priority: 1 },
    { url: `${base}/phones`, changeFrequency: "daily", priority: 0.9 },
    { url: `${base}/sell`, changeFrequency: "monthly", priority: 0.8 },
    { url: `${base}/wanted`, changeFrequency: "monthly", priority: 0.5 },
    { url: `${base}/warranty`, changeFrequency: "yearly", priority: 0.3 },
    { url: `${base}/terms`, changeFrequency: "yearly", priority: 0.3 },
    { url: `${base}/privacy`, changeFrequency: "yearly", priority: 0.2 },
  ];
  return [...pages, ...phones.map((p) => ({ url: `${base}/phones/${p.slug}`, lastModified: p.updatedAt, changeFrequency: "weekly" as const, priority: 0.7 }))];
}
