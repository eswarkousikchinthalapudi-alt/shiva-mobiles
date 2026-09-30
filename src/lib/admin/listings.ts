import "server-only";
import { and, asc, count, desc, eq, gte, ilike, inArray, isNull, or, sql, sum, type SQL } from "drizzle-orm";
import { getDb, schema } from "@/db";
import type { ListingStatus } from "@/db/schema";
import { fullModelName, mediaUrl } from "@/lib/listings";
import { billPathOf } from "@/lib/sales";

const { listings, phoneModels, listingPhotos, listingStats } = schema;

export type AdminListingRow = {
  id: string;
  code: string;
  slug: string;
  name: string;
  storageGb: number;
  ramGb: number | null;
  color: string;
  grade: string;
  priceInr: number;
  costInr: number | null;
  status: ListingStatus;
  imeiStatus: string;
  publishedAt: Date | null;
  createdAt: Date;
  thumb: string | null;
  views: number;
  whatsappClicks: number;
};

export async function adminStatusCounts() {
  const db = await getDb();
  const rows = await db.select({ status: listings.status, n: count() }).from(listings).groupBy(listings.status);
  const counts: Record<ListingStatus, number> = { draft: 0, available: 0, reserved: 0, sold: 0, hidden: 0 };
  for (const row of rows) counts[row.status] = Number(row.n);
  return counts;
}

export async function adminListListings(options: { status?: ListingStatus | "all"; q?: string; limit?: number }) {
  const db = await getDb();
  const conditions: SQL[] = [];
  if (options.status && options.status !== "all") conditions.push(eq(listings.status, options.status));
  const q = options.q?.trim().slice(0, 60);
  if (q) {
    const like = `%${q.replace(/[\\%_]/g, "\\$&")}%`;
    conditions.push(or(ilike(listings.code, like), ilike(phoneModels.name, like), ilike(phoneModels.brand, like), ilike(listings.color, like))!);
  }
  const rows = await db
    .select({
      id: listings.id,
      code: listings.code,
      slug: listings.slug,
      brand: phoneModels.brand,
      modelName: phoneModels.name,
      storageGb: listings.storageGb,
      ramGb: listings.ramGb,
      color: listings.color,
      grade: listings.grade,
      priceInr: listings.priceInr,
      costInr: listings.costInr,
      status: listings.status,
      imeiStatus: listings.imeiStatus,
      publishedAt: listings.publishedAt,
      createdAt: listings.createdAt,
    })
    .from(listings)
    .innerJoin(phoneModels, eq(phoneModels.id, listings.modelId))
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(desc(listings.updatedAt))
    .limit(options.limit ?? 200);

  const ids = rows.map((r) => r.id);
  const thumbs = new Map<string, string>();
  const stats = new Map<string, { views: number; clicks: number }>();
  if (ids.length) {
    const photos = await db
      .select({ listingId: listingPhotos.listingId, smId: listingPhotos.smId, position: listingPhotos.position })
      .from(listingPhotos)
      .where(inArray(listingPhotos.listingId, ids))
      .orderBy(asc(listingPhotos.position));
    for (const p of photos) if (!thumbs.has(p.listingId)) thumbs.set(p.listingId, mediaUrl(p.smId));
    const statRows = await db
      .select({ listingId: listingStats.listingId, views: sum(listingStats.views), clicks: sum(listingStats.whatsappClicks) })
      .from(listingStats)
      .where(inArray(listingStats.listingId, ids))
      .groupBy(listingStats.listingId);
    for (const s of statRows) stats.set(s.listingId, { views: Number(s.views ?? 0), clicks: Number(s.clicks ?? 0) });
  }

  return rows.map<AdminListingRow>((r) => ({
    id: r.id,
    code: r.code,
    slug: r.slug,
    name: fullModelName(r.brand, r.modelName),
    storageGb: r.storageGb,
    ramGb: r.ramGb,
    color: r.color,
    grade: r.grade,
    priceInr: r.priceInr,
    costInr: r.costInr,
    status: r.status,
    imeiStatus: r.imeiStatus,
    publishedAt: r.publishedAt,
    createdAt: r.createdAt,
    thumb: thumbs.get(r.id) ?? null,
    views: stats.get(r.id)?.views ?? 0,
    whatsappClicks: stats.get(r.id)?.clicks ?? 0,
  }));
}

export type AdminPhoto = { smId: string; mdId: string; lgId: string; width: number; height: number };

export async function adminGetListing(id: string) {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const db = await getDb();
  const rows = await db
    .select({ listing: listings, model: phoneModels })
    .from(listings)
    .innerJoin(phoneModels, eq(phoneModels.id, listings.modelId))
    .where(eq(listings.id, id))
    .limit(1);
  const row = rows[0];
  if (!row) return null;
  const photos = await db
    .select({ smId: listingPhotos.smId, mdId: listingPhotos.mdId, lgId: listingPhotos.lgId, width: listingPhotos.width, height: listingPhotos.height })
    .from(listingPhotos)
    .where(eq(listingPhotos.listingId, id))
    .orderBy(asc(listingPhotos.position), asc(listingPhotos.createdAt));
  const sale = await db
    .select()
    .from(schema.sales)
    .where(and(eq(schema.sales.listingId, id), isNull(schema.sales.voidedAt)))
    .limit(1);
  const billPath = sale[0] ? await billPathOf(sale[0]) : null;
  const statRows = await db
    .select({
      views: sum(listingStats.views),
      waViews: sum(listingStats.whatsappViews),
      clicks: sum(listingStats.whatsappClicks),
      calls: sum(listingStats.callClicks),
    })
    .from(listingStats)
    .where(eq(listingStats.listingId, id));
  const s = statRows[0];
  // The encrypted IMEI never leaves the server; only the last 4 digits do.
  const { imeiEnc: _imeiEnc, ...safeListing } = row.listing;
  void _imeiEnc;
  return {
    listing: safeListing,
    model: row.model,
    name: fullModelName(row.model.brand, row.model.name),
    photos: photos as AdminPhoto[],
    // Only what the page needs; the encrypted token and IMEI stay on the server.
    sale: sale[0]
      ? {
          id: sale[0].id,
          billNo: sale[0].billNo,
          billPath,
          buyerName: sale[0].buyerName,
          buyerPhone: sale[0].buyerPhone,
          soldPriceInr: sale[0].soldPriceInr,
          warrantyMonths: sale[0].warrantyMonths,
          warrantyUntil: sale[0].warrantyUntil,
          reviewRequestedAt: sale[0].reviewRequestedAt,
        }
      : null,
    stats: {
      views: Number(s?.views ?? 0),
      whatsappViews: Number(s?.waViews ?? 0),
      whatsappClicks: Number(s?.clicks ?? 0),
      calls: Number(s?.calls ?? 0),
    },
  };
}

export async function topViewedThisWeek(limit = 5) {
  const db = await getDb();
  const since = new Date(Date.now() - 7 * 86400000).toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
  const rows = await db
    .select({
      id: listings.id,
      code: listings.code,
      brand: phoneModels.brand,
      modelName: phoneModels.name,
      storageGb: listings.storageGb,
      views: sum(listingStats.views),
      clicks: sum(listingStats.whatsappClicks),
    })
    .from(listingStats)
    .innerJoin(listings, eq(listings.id, listingStats.listingId))
    .innerJoin(phoneModels, eq(phoneModels.id, listings.modelId))
    .where(and(gte(listingStats.day, since), inArray(listings.status, ["available", "reserved"])))
    .groupBy(listings.id, listings.code, phoneModels.brand, phoneModels.name, listings.storageGb)
    .orderBy(desc(sql`sum(${listingStats.views})`))
    .limit(limit);
  return rows.map((r) => ({
    id: r.id,
    code: r.code,
    name: `${fullModelName(r.brand, r.modelName)} ${r.storageGb} GB`,
    views: Number(r.views ?? 0),
    clicks: Number(r.clicks ?? 0),
  }));
}
