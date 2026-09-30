import "server-only";
import { and, arrayContains, asc, count, desc, eq, gte, ilike, inArray, isNotNull, lte, ne, or, sql, type SQL } from "drizzle-orm";
import { getDb, schema } from "@/db";
import type { Grade, ListingStatus } from "@/db/schema";
import { PRICE_PRESETS, type Filters } from "@/lib/filters";
import { testSummary, type TestResults } from "@/lib/phone-tests";
import { JUST_ARRIVED_DAYS, PRICE_DROP_DAYS, computeTags, isShopTag, type TagKey } from "@/lib/tags";

const { listings, phoneModels, listingPhotos } = schema;

export type Photo = { sm: string; md: string; lg: string; width: number; height: number };

export function mediaUrl(id: string) {
  return `/media/${id}.webp`;
}

export function fullModelName(brand: string, name: string) {
  const lowerName = name.toLowerCase();
  if (brand.toLowerCase() === "apple" || lowerName.startsWith(brand.toLowerCase())) return name;
  return `${brand} ${name}`;
}

/** Columns that are safe to show the public. Never add cost, IMEI or check refs here. */
const publicColumns = {
  id: listings.id,
  code: listings.code,
  slug: listings.slug,
  ramGb: listings.ramGb,
  storageGb: listings.storageGb,
  color: listings.color,
  grade: listings.grade,
  batteryHealth: listings.batteryHealth,
  batteryNote: listings.batteryNote,
  priceInr: listings.priceInr,
  launchPriceInr: listings.launchPriceInr,
  previousPriceInr: listings.previousPriceInr,
  priceDroppedAt: listings.priceDroppedAt,
  warrantyMonths: listings.warrantyMonths,
  brandWarrantyUntil: listings.brandWarrantyUntil,
  hasBox: listings.hasBox,
  hasCharger: listings.hasCharger,
  hasBill: listings.hasBill,
  tests: listings.tests,
  notesEn: listings.notesEn,
  notesTe: listings.notesTe,
  shopTags: listings.shopTags,
  imeiStatus: listings.imeiStatus,
  imeiCheckedAt: listings.imeiCheckedAt,
  status: listings.status,
  publishedAt: listings.publishedAt,
  soldAt: listings.soldAt,
  modelId: phoneModels.id,
  brand: phoneModels.brand,
  modelName: phoneModels.name,
  modelSlug: phoneModels.slug,
  os: phoneModels.os,
  launchYear: phoneModels.launchYear,
  chipset: phoneModels.chipset,
  performance: phoneModels.performance,
  displayInches: phoneModels.displayInches,
  displayType: phoneModels.displayType,
  refreshHz: phoneModels.refreshHz,
  mainCameraMp: phoneModels.mainCameraMp,
  cameraSummary: phoneModels.cameraSummary,
  frontCameraMp: phoneModels.frontCameraMp,
  batteryMah: phoneModels.batteryMah,
  chargingW: phoneModels.chargingW,
  has5g: phoneModels.has5g,
};

type ColumnValue<C> = C extends { _: { data: infer D; notNull: infer N } } ? (N extends true ? D : D | null) : never;
type PublicRow = { [K in keyof typeof publicColumns]: ColumnValue<(typeof publicColumns)[K]> };

export type ListingCardData = {
  id: string;
  code: string;
  slug: string;
  name: string;
  brand: string;
  ramGb: number | null;
  storageGb: number;
  color: string;
  grade: Grade;
  batteryHealth: number | null;
  priceInr: number;
  launchPriceInr: number | null;
  status: ListingStatus;
  photo: Photo | null;
  tags: TagKey[];
  testsPassed: number;
  testsTotal: number;
  imeiVerified: boolean;
};

export type ListingDetail = ListingCardData & {
  photos: Photo[];
  modelId: string;
  os: "iOS" | "Android";
  batteryNote: string | null;
  previousPriceInr: number | null;
  warrantyMonths: number;
  brandWarrantyUntil: string | null;
  hasBox: boolean;
  hasCharger: boolean;
  hasBill: boolean;
  tests: TestResults;
  failedTests: string[];
  notesEn: string;
  notesTe: string;
  imeiCheckedAt: Date | null;
  publishedAt: Date | null;
  specs: {
    launchYear: number | null;
    chipset: string | null;
    performance: number | null;
    displayInches: number | null;
    displayType: string | null;
    refreshHz: number | null;
    mainCameraMp: number | null;
    cameraSummary: string | null;
    frontCameraMp: number | null;
    batteryMah: number | null;
    chargingW: number | null;
    has5g: boolean;
  };
};

function toCard(row: PublicRow, photo: Photo | null): ListingCardData {
  const summary = testSummary(row.tests as TestResults);
  return {
    id: row.id,
    code: row.code,
    slug: row.slug,
    name: fullModelName(row.brand, row.modelName),
    brand: row.brand,
    ramGb: row.ramGb,
    storageGb: row.storageGb,
    color: row.color,
    grade: row.grade,
    batteryHealth: row.batteryHealth,
    priceInr: row.priceInr,
    launchPriceInr: row.launchPriceInr,
    status: row.status,
    photo,
    tags: computeTags({
      brand: row.brand,
      grade: row.grade,
      priceInr: row.priceInr,
      previousPriceInr: row.previousPriceInr,
      priceDroppedAt: row.priceDroppedAt,
      publishedAt: row.publishedAt,
      hasBox: row.hasBox,
      hasBill: row.hasBill,
      has5g: row.has5g,
      refreshHz: row.refreshHz,
      batteryMah: row.batteryMah,
      shopTags: row.shopTags,
    }),
    testsPassed: summary.passed,
    testsTotal: summary.tested,
    imeiVerified: row.imeiStatus === "clear",
  };
}

async function photosFor(ids: string[], firstOnly: boolean): Promise<Map<string, Photo[]>> {
  const map = new Map<string, Photo[]>();
  if (ids.length === 0) return map;
  const db = await getDb();
  const rows = await db
    .select()
    .from(listingPhotos)
    .where(inArray(listingPhotos.listingId, ids))
    .orderBy(asc(listingPhotos.listingId), asc(listingPhotos.position), asc(listingPhotos.createdAt));
  for (const row of rows) {
    const list = map.get(row.listingId) ?? [];
    if (firstOnly && list.length > 0) continue;
    list.push({ sm: mediaUrl(row.smId), md: mediaUrl(row.mdId), lg: mediaUrl(row.lgId), width: row.width, height: row.height });
    map.set(row.listingId, list);
  }
  return map;
}

async function cardsFromRows(rows: PublicRow[]): Promise<ListingCardData[]> {
  const photos = await photosFor(
    rows.map((r) => r.id),
    true,
  );
  return rows.map((row) => toCard(row, photos.get(row.id)?.[0] ?? null));
}

const PUBLIC_STATUSES: ListingStatus[] = ["available", "reserved"];

function tagCondition(tag: TagKey): SQL | undefined {
  const now = Date.now();
  switch (tag) {
    case "5g":
      return eq(phoneModels.has5g, true);
    case "120hz":
      return gte(phoneModels.refreshHz, 120);
    case "big-battery":
      return gte(phoneModels.batteryMah, 5000);
    case "under-10k":
      return lte(listings.priceInr, 10000);
    case "under-20k":
      return and(lte(listings.priceInr, 20000), sql`${listings.priceInr} > 10000`);
    case "box-bill":
      return and(eq(listings.hasBox, true), eq(listings.hasBill, true));
    case "just-arrived":
      return gte(listings.publishedAt, new Date(now - JUST_ARRIVED_DAYS * 86400000));
    case "price-dropped":
      return and(gte(listings.priceDroppedAt, new Date(now - PRICE_DROP_DAYS * 86400000)), sql`${listings.previousPriceInr} > ${listings.priceInr}`);
    case "like-new":
      return eq(listings.grade, "A");
    case "iphone":
      return ilike(phoneModels.brand, "apple");
    default:
      return isShopTag(tag) ? arrayContains(listings.shopTags, [tag]) : undefined;
  }
}

function escapeLike(value: string) {
  return value.replace(/[\\%_]/g, (m) => `\\${m}`);
}

function searchCondition(q: string): SQL | undefined {
  const tokens = q
    .toLowerCase()
    .split(/\s+/)
    .map((t) => t.replace(/[^\p{L}\p{N}+-]/gu, ""))
    .filter(Boolean)
    .slice(0, 6);
  if (tokens.length === 0) return undefined;
  const compact = escapeLike(tokens.join(""));
  const haystack = sql`lower(${phoneModels.brand} || ' ' || ${phoneModels.name} || ' ' || array_to_string(${phoneModels.aliases}, ' ') || ' ' || ${listings.color} || ' ' || ${listings.code})`;
  const perToken = tokens.map((token) => sql`${haystack} LIKE ${"%" + escapeLike(token) + "%"}`);
  return or(and(...perToken), sql`replace(${haystack}, ' ', '') LIKE ${"%" + compact + "%"}`);
}

function filterConditions(filters: Filters): SQL[] {
  const conditions: SQL[] = [inArray(listings.status, PUBLIC_STATUSES)];
  const search = searchCondition(filters.q);
  if (search) conditions.push(search);
  if (filters.brands.length) {
    conditions.push(
      inArray(
        sql`lower(${phoneModels.brand})`,
        filters.brands.map((b) => b.toLowerCase()),
      ),
    );
  }
  if (filters.price) {
    const [min, max] = PRICE_PRESETS[filters.price];
    if (min) conditions.push(sql`${listings.priceInr} > ${min}`);
    if (max) conditions.push(lte(listings.priceInr, max));
  }
  if (filters.ram) conditions.push(gte(listings.ramGb, filters.ram));
  if (filters.storage) conditions.push(gte(listings.storageGb, filters.storage));
  if (filters.grades.length) conditions.push(inArray(listings.grade, filters.grades));
  if (filters.battery) conditions.push(gte(listings.batteryHealth, filters.battery));
  if (filters.fiveG) conditions.push(eq(phoneModels.has5g, true));
  if (filters.os) conditions.push(eq(phoneModels.os, filters.os === "ios" ? "iOS" : "Android"));
  if (filters.boxBill) conditions.push(and(eq(listings.hasBox, true), eq(listings.hasBill, true))!);
  if (filters.brandWarranty) conditions.push(gte(listings.brandWarrantyUntil, sql`CURRENT_DATE`));
  if (filters.tag) {
    const condition = tagCondition(filters.tag);
    if (condition) conditions.push(condition);
  }
  return conditions;
}

function orderFor(sort: Filters["sort"]) {
  switch (sort) {
    case "price_asc":
      return [asc(listings.priceInr), desc(listings.publishedAt)];
    case "price_desc":
      return [desc(listings.priceInr), desc(listings.publishedAt)];
    case "battery":
      return [sql`${listings.batteryHealth} DESC NULLS LAST`, asc(listings.priceInr)];
    case "value":
      return [sql`(${listings.priceInr}::float / NULLIF(${listings.launchPriceInr}, 0)) ASC NULLS LAST`, asc(listings.priceInr)];
    default:
      // Available phones before reserved ones, newest first.
      return [sql`CASE WHEN ${listings.status} = 'available' THEN 0 ELSE 1 END`, desc(listings.publishedAt), desc(listings.createdAt)];
  }
}

export const PAGE_SIZE = 24;

export async function searchListings(filters: Filters) {
  const db = await getDb();
  const where = and(...filterConditions(filters));
  const [totalRow] = await db.select({ n: count() }).from(listings).innerJoin(phoneModels, eq(phoneModels.id, listings.modelId)).where(where);
  const total = Number(totalRow?.n ?? 0);
  const rows = (await db
    .select(publicColumns)
    .from(listings)
    .innerJoin(phoneModels, eq(phoneModels.id, listings.modelId))
    .where(where)
    .orderBy(...orderFor(filters.sort))
    .limit(PAGE_SIZE * filters.page)) as PublicRow[];
  return { items: await cardsFromRows(rows), total, hasMore: total > PAGE_SIZE * filters.page };
}

export async function brandCounts() {
  const db = await getDb();
  const rows = await db
    .select({ brand: phoneModels.brand, n: count() })
    .from(listings)
    .innerJoin(phoneModels, eq(phoneModels.id, listings.modelId))
    .where(inArray(listings.status, PUBLIC_STATUSES))
    .groupBy(phoneModels.brand)
    .orderBy(desc(count()), asc(phoneModels.brand));
  return rows.map((r) => ({ brand: r.brand, count: Number(r.n) }));
}

export async function countAvailable() {
  const db = await getDb();
  const [row] = await db.select({ n: count() }).from(listings).where(eq(listings.status, "available"));
  return Number(row?.n ?? 0);
}

export async function latestListings(limit = 8) {
  const db = await getDb();
  const rows = (await db
    .select(publicColumns)
    .from(listings)
    .innerJoin(phoneModels, eq(phoneModels.id, listings.modelId))
    .where(eq(listings.status, "available"))
    .orderBy(desc(listings.featured), desc(listings.publishedAt))
    .limit(limit)) as PublicRow[];
  return cardsFromRows(rows);
}

export async function recentlySold(limit = 6) {
  const db = await getDb();
  const rows = (await db
    .select(publicColumns)
    .from(listings)
    .innerJoin(phoneModels, eq(phoneModels.id, listings.modelId))
    .where(and(eq(listings.status, "sold"), isNotNull(listings.soldAt), gte(listings.soldAt, new Date(Date.now() - 45 * 86400000))))
    .orderBy(desc(listings.soldAt))
    .limit(limit)) as PublicRow[];
  return cardsFromRows(rows);
}

export async function listingsByCodes(codes: string[]) {
  if (codes.length === 0) return [];
  const db = await getDb();
  const rows = (await db
    .select(publicColumns)
    .from(listings)
    .innerJoin(phoneModels, eq(phoneModels.id, listings.modelId))
    .where(and(inArray(listings.code, codes), inArray(listings.status, [...PUBLIC_STATUSES, "sold"])))) as PublicRow[];
  const byCode = new Map(rows.map((r) => [r.code, r]));
  const ordered = codes.map((c) => byCode.get(c)).filter((r): r is PublicRow => Boolean(r));
  const photos = await photosFor(
    ordered.map((r) => r.id),
    true,
  );
  return ordered.map((row) => ({ ...toDetail(row, photos.get(row.id) ?? []) }));
}

function toDetail(row: PublicRow, photos: Photo[]): ListingDetail {
  const card = toCard(row, photos[0] ?? null);
  const summary = testSummary(row.tests as TestResults);
  return {
    ...card,
    photos,
    modelId: row.modelId,
    os: row.os,
    batteryNote: row.batteryNote,
    previousPriceInr: row.previousPriceInr,
    warrantyMonths: row.warrantyMonths,
    brandWarrantyUntil: row.brandWarrantyUntil,
    hasBox: row.hasBox,
    hasCharger: row.hasCharger,
    hasBill: row.hasBill,
    tests: row.tests as TestResults,
    failedTests: summary.failed,
    notesEn: row.notesEn,
    notesTe: row.notesTe,
    imeiCheckedAt: row.imeiCheckedAt,
    publishedAt: row.publishedAt,
    specs: {
      launchYear: row.launchYear,
      chipset: row.chipset,
      performance: row.performance,
      displayInches: row.displayInches,
      displayType: row.displayType,
      refreshHz: row.refreshHz,
      mainCameraMp: row.mainCameraMp,
      cameraSummary: row.cameraSummary,
      frontCameraMp: row.frontCameraMp,
      batteryMah: row.batteryMah,
      chargingW: row.chargingW,
      has5g: row.has5g,
    },
  };
}

/** Public detail page data. Drafts and hidden phones are never returned. */
export async function listingBySlug(slug: string): Promise<ListingDetail | null> {
  if (!/^[a-z0-9-]{3,120}$/.test(slug)) return null;
  const db = await getDb();
  const rows = (await db
    .select(publicColumns)
    .from(listings)
    .innerJoin(phoneModels, eq(phoneModels.id, listings.modelId))
    .where(and(eq(listings.slug, slug), inArray(listings.status, [...PUBLIC_STATUSES, "sold"])))
    .limit(1)) as PublicRow[];
  const row = rows[0];
  if (!row) return null;
  const photos = await photosFor([row.id], false);
  return toDetail(row, photos.get(row.id) ?? []);
}

export async function similarListings(current: { id: string; brand: string; priceInr: number }, limit = 6) {
  const db = await getDb();
  const low = Math.round(current.priceInr * 0.7);
  const high = Math.round(current.priceInr * 1.3);
  const rows = (await db
    .select(publicColumns)
    .from(listings)
    .innerJoin(phoneModels, eq(phoneModels.id, listings.modelId))
    .where(
      and(
        eq(listings.status, "available"),
        ne(listings.id, current.id),
        or(eq(phoneModels.brand, current.brand), and(gte(listings.priceInr, low), lte(listings.priceInr, high))),
      ),
    )
    .orderBy(sql`abs(${listings.priceInr} - ${current.priceInr})`)
    .limit(limit)) as PublicRow[];
  return cardsFromRows(rows);
}

/** Adds a page view (and a WhatsApp-referred view) to today's stats. */
export async function recordView(listingId: string, fromWhatsapp: boolean) {
  const db = await getDb();
  const day = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
  await db
    .insert(schema.listingStats)
    .values({ listingId, day, views: 1, whatsappViews: fromWhatsapp ? 1 : 0 })
    .onConflictDoUpdate({
      target: [schema.listingStats.listingId, schema.listingStats.day],
      set: {
        views: sql`${schema.listingStats.views} + 1`,
        whatsappViews: sql`${schema.listingStats.whatsappViews} + ${fromWhatsapp ? 1 : 0}`,
      },
    });
}

export async function recordClick(listingId: string, kind: "whatsapp" | "call") {
  const db = await getDb();
  const day = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
  const column = kind === "whatsapp" ? schema.listingStats.whatsappClicks : schema.listingStats.callClicks;
  await db
    .insert(schema.listingStats)
    .values({ listingId, day, whatsappClicks: kind === "whatsapp" ? 1 : 0, callClicks: kind === "call" ? 1 : 0 })
    .onConflictDoUpdate({
      target: [schema.listingStats.listingId, schema.listingStats.day],
      set: kind === "whatsapp" ? { whatsappClicks: sql`${column} + 1` } : { callClicks: sql`${column} + 1` },
    });
}
