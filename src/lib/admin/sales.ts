import "server-only";
import { and, desc, eq, gte, ilike, lt, or, sql, type SQL } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { istMonthRange } from "@/lib/dates";
import { billPathOf } from "@/lib/sales";

export type SaleRow = {
  id: string;
  billNo: string;
  billPath: string | null;
  cancelled: boolean;
  createdAt: Date;
  buyerName: string;
  buyerPhone: string;
  soldPriceInr: number;
  paymentMode: string;
  warrantyMonths: number;
  warrantyUntil: string;
  reviewRequestedAt: Date | null;
  listingId: string;
  code: string;
  phoneName: string;
  storageGb: number;
  costInr: number | null;
  publishedAt: Date | null;
};

/** Sales in a month (India time), optionally filtered by bill no, buyer name or number. */
export async function salesForMonth(month: string, query = ""): Promise<SaleRow[]> {
  const db = await getDb();
  const { start, end } = istMonthRange(month);
  const conditions: SQL[] = [gte(schema.sales.createdAt, start), lt(schema.sales.createdAt, end)];
  const q = query.trim().slice(0, 40);
  if (q) {
    const like = `%${q.replace(/[\\%_]/g, "\\$&")}%`;
    const digits = q.replace(/\D/g, "");
    const match = or(
      ilike(schema.sales.billNo, like),
      ilike(schema.sales.buyerName, like),
      sql`${schema.sales.item}->>'code' ILIKE ${like}`,
      digits.length >= 4 ? ilike(schema.sales.buyerPhone, `%${digits}%`) : undefined,
    );
    if (match) conditions.push(match);
  }
  const rows = await db
    .select({
      sale: schema.sales,
      costInr: schema.listings.costInr,
      publishedAt: schema.listings.publishedAt,
    })
    .from(schema.sales)
    .innerJoin(schema.listings, eq(schema.listings.id, schema.sales.listingId))
    .where(and(...conditions))
    .orderBy(desc(schema.sales.createdAt))
    .limit(500);
  return Promise.all(
    rows.map(async (r) => ({
      id: r.sale.id,
      billNo: r.sale.billNo,
      billPath: await billPathOf(r.sale),
      cancelled: Boolean(r.sale.voidedAt),
      createdAt: r.sale.createdAt,
      buyerName: r.sale.buyerName,
      buyerPhone: r.sale.buyerPhone,
      soldPriceInr: r.sale.soldPriceInr,
      paymentMode: r.sale.paymentMode,
      warrantyMonths: r.sale.warrantyMonths,
      warrantyUntil: r.sale.warrantyUntil,
      reviewRequestedAt: r.sale.reviewRequestedAt,
      listingId: r.sale.listingId,
      code: r.sale.item.code,
      phoneName: r.sale.item.name,
      storageGb: r.sale.item.storageGb,
      costInr: r.costInr,
      publishedAt: r.publishedAt,
    })),
  );
}

/** Totals leave out cancelled sales. */
export function summarize(all: SaleRow[]) {
  const rows = all.filter((r) => !r.cancelled);
  const revenue = rows.reduce((a, r) => a + r.soldPriceInr, 0);
  const withCost = rows.filter((r) => r.costInr !== null);
  const margin = withCost.reduce((a, r) => a + r.soldPriceInr - (r.costInr ?? 0), 0);
  const days = rows.filter((r) => r.publishedAt).map((r) => (r.createdAt.getTime() - (r.publishedAt as Date).getTime()) / 86400000);
  return {
    count: rows.length,
    revenue,
    margin,
    marginCount: withCost.length,
    avgDaysToSell: days.length ? Math.round(days.reduce((a, d) => a + d, 0) / days.length) : null,
  };
}
