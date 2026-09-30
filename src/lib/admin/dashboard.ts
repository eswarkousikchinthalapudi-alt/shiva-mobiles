import "server-only";
import { and, count, desc, eq, gte, isNull, lt, sql, sum } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { istMonthRange, istMonthString } from "@/lib/dates";
import { fullModelName } from "@/lib/listings";

function startOfMonthIST() {
  return istMonthRange(istMonthString()).start;
}

export async function dashboardData() {
  const db = await getDb();
  const monthStart = startOfMonthIST();

  const [soldThisMonth] = await db
    .select({
      n: count(),
      revenue: sum(schema.sales.soldPriceInr),
      cost: sum(schema.listings.costInr),
      revenueWithCost: sql<string>`sum(case when ${schema.listings.costInr} is not null then ${schema.sales.soldPriceInr} else 0 end)`,
    })
    .from(schema.sales)
    .innerJoin(schema.listings, eq(schema.listings.id, schema.sales.listingId))
    .where(and(gte(schema.sales.createdAt, monthStart), isNull(schema.sales.voidedAt)));

  const newRequests = await db
    .select({
      id: schema.sellRequests.id,
      code: schema.sellRequests.code,
      modelText: schema.sellRequests.modelText,
      storageGb: schema.sellRequests.storageGb,
      area: schema.sellRequests.area,
      estimateMin: schema.sellRequests.estimateMin,
      estimateMax: schema.sellRequests.estimateMax,
      createdAt: schema.sellRequests.createdAt,
    })
    .from(schema.sellRequests)
    .where(eq(schema.sellRequests.status, "new"))
    .orderBy(desc(schema.sellRequests.createdAt))
    .limit(4);

  const wanted = await db
    .select()
    .from(schema.wantedRequests)
    .where(eq(schema.wantedRequests.status, "open"))
    .orderBy(desc(schema.wantedRequests.createdAt))
    .limit(3);

  const slowSellers = await db
    .select({
      id: schema.listings.id,
      code: schema.listings.code,
      brand: schema.phoneModels.brand,
      name: schema.phoneModels.name,
      storageGb: schema.listings.storageGb,
      priceInr: schema.listings.priceInr,
      publishedAt: schema.listings.publishedAt,
    })
    .from(schema.listings)
    .innerJoin(schema.phoneModels, eq(schema.phoneModels.id, schema.listings.modelId))
    .where(and(eq(schema.listings.status, "available"), lt(schema.listings.publishedAt, new Date(Date.now() - 30 * 86400000))))
    .orderBy(schema.listings.publishedAt)
    .limit(4);

  const [failedCodes] = await db
    .select({ n: count() })
    .from(schema.auditLog)
    .where(and(eq(schema.auditLog.action, "login_code_failed"), gte(schema.auditLog.at, new Date(Date.now() - 7 * 86400000))));
  const [drafts] = await db.select({ n: count() }).from(schema.listings).where(eq(schema.listings.status, "draft"));
  const [imeiPending] = await db
    .select({ n: count() })
    .from(schema.listings)
    .where(and(eq(schema.listings.imeiStatus, "pending"), sql`${schema.listings.status} <> 'sold'`));

  return {
    failedCodes: Number(failedCodes?.n ?? 0),
    soldThisMonth: {
      count: Number(soldThisMonth?.n ?? 0),
      revenue: Number(soldThisMonth?.revenue ?? 0),
      cost: Number(soldThisMonth?.cost ?? 0),
      margin: Number(soldThisMonth?.revenueWithCost ?? 0) - Number(soldThisMonth?.cost ?? 0),
    },
    newRequests,
    wanted,
    slowSellers: slowSellers.map((s) => ({ ...s, fullName: fullModelName(s.brand, s.name) })),
    drafts: Number(drafts?.n ?? 0),
    imeiPending: Number(imeiPending?.n ?? 0),
  };
}
