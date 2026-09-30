import Link from "next/link";
import { desc, eq, sql } from "drizzle-orm";
import { getDb, schema } from "@/db";
import type { WantedStatus } from "@/db/schema";
import { requireAdmin } from "@/lib/auth/dal";
import { availablePhones, phonesForWant } from "@/lib/admin/wanted";
import { displayMobile, formatInr, formatStorage, timeAgo } from "@/lib/format";
import { wantedHelloMessage, wantedPhoneMessage } from "@/lib/messages";
import { getShopSettings, getSiteUrl } from "@/lib/settings";
import { PageHeader, TabNav } from "@/components/admin/ui";
import { WantedRowActions } from "@/components/admin/wanted-row-actions";

export const metadata = { title: "Notify list" };

const TABS: { value: WantedStatus; label: string }[] = [
  { value: "open", label: "Waiting" },
  { value: "notified", label: "Told them" },
  { value: "closed", label: "Closed" },
];

export default async function WantedAdminPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  await requireAdmin();
  const { tab: rawTab } = await searchParams;
  const tab = TABS.find((t) => t.value === rawTab)?.value ?? "open";
  const db = await getDb();
  const [rows, counts, stock, settings, siteUrl] = await Promise.all([
    db.select().from(schema.wantedRequests).where(eq(schema.wantedRequests.status, tab)).orderBy(desc(schema.wantedRequests.createdAt)).limit(300),
    db
      .select({ status: schema.wantedRequests.status, n: sql<number>`count(*)::int` })
      .from(schema.wantedRequests)
      .groupBy(schema.wantedRequests.status),
    availablePhones(),
    getShopSettings(),
    getSiteUrl(),
  ]);
  const countOf = (status: WantedStatus) => Number(counts.find((c) => c.status === status)?.n ?? 0);

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="Notify list" subtitle="People waiting for a phone. Entries are deleted automatically after 90 days." />
      <TabNav
        label="Notify list groups"
        tabs={TABS.map((t) => ({ href: `/admin/wanted?tab=${t.value}`, label: t.label, count: countOf(t.value), active: t.value === tab }))}
      />
      {rows.length === 0 ? (
        <p className="rounded-[20px] border border-dashed border-line-strong bg-surface p-8 text-center text-muted">Nobody here right now.</p>
      ) : (
        <ul className="space-y-3">
          {rows.map((w) => {
            const matches = tab === "open" ? phonesForWant(w, stock) : [];
            const best = matches[0];
            const message = best
              ? wantedPhoneMessage(w.lang, {
                  name: w.name,
                  shopName: settings.shopName,
                  wantText: w.wantText,
                  phoneName: `${best.fullName} ${formatStorage(best.storageGb)}`,
                  priceInr: best.priceInr,
                  url: `${siteUrl}/phones/${best.slug}?src=wa`,
                })
              : wantedHelloMessage(w.lang, { name: w.name, shopName: settings.shopName, wantText: w.wantText });
            return (
              <li key={w.id} className="rounded-[20px] border border-line bg-surface p-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-display text-lg font-semibold">“{w.wantText}”</p>
                    <p className="text-sm text-muted">
                      {w.name} · {displayMobile(w.phone)}
                      {w.maxBudget ? ` · budget ${formatInr(w.maxBudget)}` : ""}
                      {w.lang === "te" ? " · Telugu" : ""} · {timeAgo(w.createdAt)}
                    </p>
                  </div>
                </div>
                {matches.length ? (
                  <div className="mt-3 rounded-2xl bg-ok-soft p-3">
                    <p className="text-sm font-semibold text-ok">In stock now</p>
                    <ul className="mt-1 space-y-1 text-[0.95rem]">
                      {matches.map((m) => (
                        <li key={m.id}>
                          <Link href={`/admin/phones/${m.id}`} className="font-medium hover:underline">
                            {m.fullName} {formatStorage(m.storageGb)}
                          </Link>{" "}
                          <span className="text-muted">
                            {m.code} · {formatInr(m.priceInr)}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
                <div className="mt-3">
                  <WantedRowActions id={w.id} status={w.status} phone={w.phone} message={message} messageLabel={best ? "Send the phone" : "Say hello"} />
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
