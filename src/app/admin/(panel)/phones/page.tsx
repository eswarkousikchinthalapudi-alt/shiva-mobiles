import { Plus, Search, ShieldAlert } from "lucide-react";
import Link from "next/link";
import type { ListingStatus } from "@/db/schema";
import { requireAdmin } from "@/lib/auth/dal";
import { adminListListings, adminStatusCounts } from "@/lib/admin/listings";
import { formatInr, timeAgo } from "@/lib/format";
import { buttonClass } from "@/components/ui/button";
import { Alert, PageHeader, StatusPill, TabNav } from "@/components/admin/ui";

export const metadata = { title: "Phones" };

const TABS: { value: ListingStatus | "all"; label: string }[] = [
  { value: "available", label: "For sale" },
  { value: "reserved", label: "Reserved" },
  { value: "draft", label: "Drafts" },
  { value: "sold", label: "Sold" },
  { value: "hidden", label: "Hidden" },
  { value: "all", label: "All" },
];

export default async function AdminPhonesPage({ searchParams }: { searchParams: Promise<{ status?: string; q?: string; deleted?: string }> }) {
  const user = await requireAdmin();
  const params = await searchParams;
  const status = (TABS.find((t) => t.value === params.status)?.value ?? "available") as ListingStatus | "all";
  const q = (params.q ?? "").slice(0, 60);
  const [rows, counts] = await Promise.all([adminListListings({ status, q }), adminStatusCounts()]);
  const total = Object.values(counts).reduce((a, b) => a + b, 0);

  return (
    <div>
      <PageHeader
        title="Phones"
        subtitle={`${counts.available} for sale, ${counts.reserved} reserved, ${counts.draft} drafts`}
        action={
          <Link href="/admin/phones/new" className={buttonClass("primary", "md")}>
            <Plus className="h-4 w-4" aria-hidden /> Add a phone
          </Link>
        }
      />
      {params.deleted ? (
        <Alert tone="ok" className="mb-4">
          Phone deleted.
        </Alert>
      ) : null}

      <TabNav
        label="Filter by status"
        tabs={TABS.map((tab) => ({
          href: `/admin/phones?status=${tab.value}${q ? `&q=${encodeURIComponent(q)}` : ""}`,
          label: tab.label,
          count: tab.value === "all" ? total : counts[tab.value],
          active: tab.value === status,
        }))}
      />

      <form method="get" className="mb-4 flex gap-2" role="search">
        <input type="hidden" name="status" value={status} />
        <label htmlFor="admin-q" className="sr-only">
          Search phones
        </label>
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-faint" aria-hidden />
          <input
            id="admin-q"
            name="q"
            defaultValue={q}
            placeholder="Search by model, colour or ID (SM-0001)"
            className="h-11 w-full rounded-[12px] border border-line-strong bg-surface pl-11 pr-3 focus:border-brand focus:outline-none"
          />
        </div>
        <button type="submit" className={buttonClass("secondary", "md")}>
          Search
        </button>
      </form>

      {rows.length === 0 ? (
        <div className="rounded-[20px] border border-dashed border-line-strong bg-surface p-8 text-center text-muted">
          No phones here yet.{" "}
          <Link href="/admin/phones/new" className="font-semibold text-brand-ink underline">
            Add one
          </Link>
        </div>
      ) : (
        <ul className="divide-y divide-line overflow-hidden rounded-[20px] border border-line bg-surface">
          {rows.map((row) => (
            <li key={row.id}>
              <Link href={`/admin/phones/${row.id}`} className="flex items-center gap-3 p-3 hover:bg-surface-2">
                <div className="h-16 w-14 shrink-0 overflow-hidden rounded-xl bg-surface-2">
                  {row.thumb ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={row.thumb} alt="" className="h-full w-full object-cover" loading="lazy" />
                  ) : null}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="truncate font-semibold">{row.name}</p>
                    <StatusPill status={row.status} />
                    {row.imeiStatus !== "clear" ? (
                      <span className="inline-flex items-center gap-1 text-xs font-semibold text-warn">
                        <ShieldAlert className="h-3.5 w-3.5" aria-hidden /> IMEI {row.imeiStatus === "blocked" ? "blocked" : "not checked"}
                      </span>
                    ) : null}
                  </div>
                  <p className="truncate text-sm text-muted">
                    {row.code} · {row.ramGb ? `${row.ramGb}/` : ""}
                    {row.storageGb} GB{row.color ? `, ${row.color}` : ""} · Grade {row.grade}
                  </p>
                  <p className="text-xs text-muted">
                    {row.views} views · {row.whatsappClicks} WhatsApp · {timeAgo(row.publishedAt ?? row.createdAt)}
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="font-display text-lg font-bold tabular">{formatInr(row.priceInr)}</p>
                  {user.role === "owner" && row.costInr ? <p className="text-xs text-ok tabular">+{formatInr(row.priceInr - row.costInr)}</p> : null}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
