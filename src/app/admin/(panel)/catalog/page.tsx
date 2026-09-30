import { Plus, Search } from "lucide-react";
import Link from "next/link";
import { and, asc, count, desc, ilike, isNull, or, sql, type SQL } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { requireAdmin } from "@/lib/auth/dal";
import { fullModelName } from "@/lib/listings";
import { buttonClass } from "@/components/ui/button";
import { Alert, PageHeader, TabNav } from "@/components/admin/ui";

export const metadata = { title: "Phone catalog" };

const SOURCE: Record<string, string> = {
  seed: "Sample data",
  ai: "Free AI",
  wikipedia: "Wikipedia",
  gsmarena: "From GSMArena",
  pasted: "Pasted specs",
  manual: "Added by hand",
};

export default async function CatalogPage({ searchParams }: { searchParams: Promise<{ q?: string; show?: string; deleted?: string }> }) {
  await requireAdmin();
  const params = await searchParams;
  const q = (params.q ?? "").trim().slice(0, 60);
  const show = params.show === "unchecked" ? "unchecked" : "all";
  const m = schema.phoneModels;
  const conditions: SQL[] = [];
  if (show === "unchecked") conditions.push(isNull(m.verifiedAt));
  if (q) {
    const like = `%${q.replace(/[\\%_]/g, "\\$&")}%`;
    const match = or(ilike(sql`${m.brand} || ' ' || ${m.name}`, like), sql`array_to_string(${m.aliases}, ' ') ILIKE ${like}`);
    if (match) conditions.push(match);
  }
  const db = await getDb();
  const [rows, [unchecked], [total]] = await Promise.all([
    db
      .select({
        id: m.id,
        brand: m.brand,
        name: m.name,
        launchYear: m.launchYear,
        specSource: m.specSource,
        verifiedAt: m.verifiedAt,
        variants: m.variants,
        stock: sql<number>`(select count(*)::int from ${schema.listings} l where l.model_id = ${m.id} and l.status in ('available','reserved'))`,
      })
      .from(m)
      .where(conditions.length ? and(...conditions) : undefined)
      .orderBy(asc(m.brand), desc(m.launchYear), asc(m.name))
      .limit(300),
    db.select({ n: count() }).from(m).where(isNull(m.verifiedAt)),
    db.select({ n: count() }).from(m),
  ]);

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        title="Phone catalog"
        subtitle="Specs for each model. Every phone you add uses these."
        action={
          <Link href="/admin/catalog/new" className={buttonClass("primary", "md")}>
            <Plus className="h-4 w-4" aria-hidden /> Add a model
          </Link>
        }
      />
      {params.deleted ? (
        <Alert tone="ok" className="mb-4">
          Model deleted.
        </Alert>
      ) : null}
      {Number(unchecked?.n ?? 0) > 0 ? (
        <Alert tone="warn" className="mb-4">
          {unchecked?.n} {Number(unchecked?.n) === 1 ? "model has" : "models have"} specs nobody has checked yet. Customers see these specs, so please check
          them.
        </Alert>
      ) : null}
      <TabNav
        label="Show models"
        tabs={[
          { href: `/admin/catalog${q ? `?q=${encodeURIComponent(q)}` : ""}`, label: "All", count: Number(total?.n ?? 0), active: show === "all" },
          {
            href: `/admin/catalog?show=unchecked${q ? `&q=${encodeURIComponent(q)}` : ""}`,
            label: "Not checked",
            count: Number(unchecked?.n ?? 0),
            active: show === "unchecked",
          },
        ]}
      />
      <form method="get" className="mb-4 flex gap-2" role="search">
        {show === "unchecked" ? <input type="hidden" name="show" value="unchecked" /> : null}
        <label htmlFor="catalog-q" className="sr-only">
          Search models
        </label>
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-faint" aria-hidden />
          <input
            id="catalog-q"
            name="q"
            defaultValue={q}
            placeholder="Search by name or model number"
            className="h-11 w-full rounded-[12px] border border-line-strong bg-surface pl-11 pr-3 focus:border-brand focus:outline-none"
          />
        </div>
        <button type="submit" className={buttonClass("secondary", "md")}>
          Search
        </button>
      </form>
      {rows.length === 0 ? (
        <p className="rounded-[20px] border border-dashed border-line-strong bg-surface p-8 text-center text-muted">No models found.</p>
      ) : (
        <ul className="divide-y divide-line overflow-hidden rounded-[20px] border border-line bg-surface">
          {rows.map((r) => (
            <li key={r.id}>
              <Link href={`/admin/catalog/${r.id}`} className="flex items-center justify-between gap-3 p-4 hover:bg-surface-2">
                <div className="min-w-0">
                  <p className="font-semibold">{fullModelName(r.brand, r.name)}</p>
                  <p className="text-sm text-muted">
                    {[
                      r.launchYear,
                      `${r.variants.length} variant${r.variants.length === 1 ? "" : "s"}`,
                      SOURCE[r.specSource],
                      r.stock ? `${r.stock} in stock` : null,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                </div>
                {r.verifiedAt ? (
                  <span className="shrink-0 rounded-full bg-ok-soft px-2.5 py-0.5 text-xs font-semibold text-ok">Checked</span>
                ) : (
                  <span className="shrink-0 rounded-full bg-warn-soft px-2.5 py-0.5 text-xs font-semibold text-warn">Check specs</span>
                )}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
