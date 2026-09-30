import "server-only";
import { desc, eq, sql } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { fullModelName } from "@/lib/listings";
import { scoreWant, type PhoneFacts } from "@/lib/wanted-match";

export type { PhoneFacts };

export type WantedMatch = {
  id: string;
  name: string;
  phone: string;
  wantText: string;
  maxBudget: number | null;
  lang: "en" | "te";
  createdAt: Date;
  score: number;
};

/** Open "notify me" requests that fit a phone, best first. */
export async function findWantedMatches(phone: PhoneFacts) {
  const db = await getDb();
  const open = await db
    .select()
    .from(schema.wantedRequests)
    .where(eq(schema.wantedRequests.status, "open"))
    .orderBy(desc(schema.wantedRequests.createdAt))
    .limit(300);
  const matches: WantedMatch[] = [];
  for (const w of open) {
    const score = scoreWant(w, phone);
    if (score === null) continue;
    matches.push({ id: w.id, name: w.name, phone: w.phone, wantText: w.wantText, maxBudget: w.maxBudget, lang: w.lang, createdAt: w.createdAt, score });
  }
  return matches.sort((a, b) => b.score - a.score).slice(0, 10);
}

export type StockPhone = PhoneFacts & { id: string; code: string; slug: string; fullName: string; storageGb: number };

/** Phones for sale now, with the facts used for matching. */
export async function availablePhones(): Promise<StockPhone[]> {
  const db = await getDb();
  const rows = await db
    .select({
      id: schema.listings.id,
      code: schema.listings.code,
      slug: schema.listings.slug,
      storageGb: schema.listings.storageGb,
      priceInr: schema.listings.priceInr,
      brand: schema.phoneModels.brand,
      name: schema.phoneModels.name,
      has5g: schema.phoneModels.has5g,
      batteryMah: schema.phoneModels.batteryMah,
    })
    .from(schema.listings)
    .innerJoin(schema.phoneModels, eq(schema.phoneModels.id, schema.listings.modelId))
    .where(eq(schema.listings.status, "available"))
    .orderBy(desc(schema.listings.publishedAt))
    .limit(500);
  return rows.map((r) => ({ ...r, fullName: fullModelName(r.brand, r.name) }));
}

/** Best phones in stock for one request (up to 3). */
export function phonesForWant(want: { wantText: string; maxBudget: number | null }, stock: StockPhone[]): StockPhone[] {
  return stock
    .map((phone) => ({ phone, score: scoreWant(want, phone) }))
    .filter((m): m is { phone: StockPhone; score: number } => m.score !== null)
    .sort((a, b) => b.score - a.score || a.phone.priceInr - b.phone.priceInr)
    .slice(0, 3)
    .map((m) => m.phone);
}

export async function openWantedCount() {
  const db = await getDb();
  const [row] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(schema.wantedRequests)
    .where(eq(schema.wantedRequests.status, "open"));
  return Number(row?.n ?? 0);
}
