import Link from "next/link";
import { desc, inArray, sql } from "drizzle-orm";
import { getDb, schema } from "@/db";
import type { SellStatus } from "@/db/schema";
import { requireAdmin } from "@/lib/auth/dal";
import { formatInr, timeAgo } from "@/lib/format";
import { Alert, PageHeader, StatusPill, TabNav } from "@/components/admin/ui";

export const metadata = { title: "Sell requests" };

const GROUPS: Record<string, { label: string; statuses: SellStatus[] }> = {
  new: { label: "New", statuses: ["new"] },
  active: { label: "In progress", statuses: ["contacted", "offer_sent", "pickup_scheduled"] },
  closed: { label: "Closed", statuses: ["bought", "rejected", "cancelled"] },
};

export default async function RequestsPage({ searchParams }: { searchParams: Promise<{ tab?: string; deleted?: string }> }) {
  await requireAdmin();
  const { tab: rawTab, deleted } = await searchParams;
  const tab = rawTab && rawTab in GROUPS ? rawTab : "new";
  const db = await getDb();
  const rows = await db
    .select({
      id: schema.sellRequests.id,
      code: schema.sellRequests.code,
      modelText: schema.sellRequests.modelText,
      storageGb: schema.sellRequests.storageGb,
      name: schema.sellRequests.name,
      area: schema.sellRequests.area,
      status: schema.sellRequests.status,
      estimateMin: schema.sellRequests.estimateMin,
      estimateMax: schema.sellRequests.estimateMax,
      offerPrice: schema.sellRequests.offerPrice,
      wantsExchange: schema.sellRequests.wantsExchange,
      createdAt: schema.sellRequests.createdAt,
      photos: sql<number>`(select count(*)::int from ${schema.sellRequestPhotos} p where p.request_id = ${schema.sellRequests.id})`,
    })
    .from(schema.sellRequests)
    .where(inArray(schema.sellRequests.status, GROUPS[tab].statuses))
    .orderBy(desc(schema.sellRequests.createdAt))
    .limit(200);
  const counts = await db
    .select({ status: schema.sellRequests.status, n: sql<number>`count(*)::int` })
    .from(schema.sellRequests)
    .groupBy(schema.sellRequests.status);
  const countFor = (key: string) => counts.filter((c) => GROUPS[key].statuses.includes(c.status)).reduce((a, c) => a + Number(c.n), 0);

  return (
    <div>
      <PageHeader title="Sell requests" subtitle="People who want to sell their phone to the shop." />
      {deleted ? (
        <Alert tone="ok" className="mb-4">
          Request deleted.
        </Alert>
      ) : null}
      <TabNav
        label="Request groups"
        tabs={Object.entries(GROUPS).map(([key, group]) => ({
          href: `/admin/requests?tab=${key}`,
          label: group.label,
          count: countFor(key),
          active: tab === key,
        }))}
      />
      {rows.length === 0 ? (
        <p className="rounded-[20px] border border-dashed border-line-strong bg-surface p-8 text-center text-muted">Nothing here.</p>
      ) : (
        <ul className="divide-y divide-line overflow-hidden rounded-[20px] border border-line bg-surface">
          {rows.map((r) => (
            <li key={r.id}>
              <Link href={`/admin/requests/${r.id}`} className="flex items-center justify-between gap-3 p-4 hover:bg-surface-2">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-semibold">
                      {r.modelText}
                      {r.storageGb ? ` ${r.storageGb} GB` : ""}
                    </p>
                    <StatusPill status={r.status} />
                    {r.wantsExchange ? <span className="rounded-full bg-tag-soft px-2 py-0.5 text-xs font-semibold">Exchange</span> : null}
                  </div>
                  <p className="text-sm text-muted">
                    {r.code} · {r.name}, {r.area} · {timeAgo(r.createdAt)}
                    {r.photos ? ` · ${r.photos} photo${r.photos === 1 ? "" : "s"}` : ""}
                  </p>
                </div>
                <div className="shrink-0 text-right text-sm">
                  {r.offerPrice ? (
                    <p className="font-display text-lg font-bold text-ok tabular">{formatInr(r.offerPrice)}</p>
                  ) : r.estimateMin ? (
                    <p className="font-medium tabular">
                      {formatInr(r.estimateMin)}–{formatInr(r.estimateMax)}
                    </p>
                  ) : (
                    <p className="text-muted">No estimate</p>
                  )}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
