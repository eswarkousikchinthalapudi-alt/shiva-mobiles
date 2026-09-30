import { Search } from "lucide-react";
import Link from "next/link";
import { asc, desc } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { requireAdmin } from "@/lib/auth/dal";
import { fullModelName } from "@/lib/listings";
import { getShopSettings } from "@/lib/settings";
import { buttonClass } from "@/components/ui/button";
import { Card, PageHeader } from "@/components/admin/ui";
import { BuyPriceRow, PricingRulesForm } from "@/components/admin/pricing-forms";
import { withDefaults } from "@/lib/pricing";

export const metadata = { title: "Buying prices" };

export default async function PricingPage({ searchParams }: { searchParams: Promise<{ q?: string; model?: string }> }) {
  const user = await requireAdmin();
  const params = await searchParams;
  const q = (params.q ?? "").trim().toLowerCase().slice(0, 60);
  const canEdit = user.role === "owner";
  const db = await getDb();
  const [models, prices, settings] = await Promise.all([
    db
      .select({
        id: schema.phoneModels.id,
        brand: schema.phoneModels.brand,
        name: schema.phoneModels.name,
        aliases: schema.phoneModels.aliases,
        variants: schema.phoneModels.variants,
      })
      .from(schema.phoneModels)
      .orderBy(asc(schema.phoneModels.brand), desc(schema.phoneModels.launchYear), asc(schema.phoneModels.name)),
    db.select().from(schema.buyPrices),
    getShopSettings(),
  ]);

  const priceOf = new Map(prices.map((p) => [`${p.modelId}:${p.storageGb}`, p.basePriceInr]));
  const shown = models.filter((m) => {
    if (params.model) return m.id === params.model;
    if (!q) return true;
    return `${m.brand} ${m.name} ${m.aliases.join(" ")}`.toLowerCase().includes(q);
  });
  const missing = models.filter((m) => m.variants.some((v) => !priceOf.has(`${m.id}:${v.storageGb}`))).length;

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <PageHeader
        title="Buying prices"
        subtitle="What you pay for a phone in good condition. The sell page uses these with the cut rules below to show sellers a price range."
      />
      {!canEdit ? <p className="rounded-2xl bg-surface-3 px-4 py-3 text-[0.95rem]">Only the owner can change prices. You can see them here.</p> : null}

      <Card title="Price cut rules">
        <PricingRulesForm initial={withDefaults(settings.pricing)} canEdit={canEdit} />
      </Card>

      <section aria-labelledby="prices-title" className="space-y-3">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 id="prices-title" className="font-display text-xl font-bold">
              Price for each model
            </h2>
            {missing > 0 ? (
              <p className="text-sm text-warn">{missing} models have no price for some storage sizes. Sellers of those phones see “we’ll call you”.</p>
            ) : null}
          </div>
          <form method="get" className="flex gap-2" role="search">
            <label htmlFor="pricing-q" className="sr-only">
              Search models
            </label>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-faint" aria-hidden />
              <input
                id="pricing-q"
                name="q"
                defaultValue={params.q ?? ""}
                placeholder="Search models"
                className="h-11 w-56 rounded-[12px] border border-line-strong bg-surface pl-11 pr-3 focus:border-brand focus:outline-none"
              />
            </div>
            <button type="submit" className={buttonClass("secondary", "md")}>
              Search
            </button>
          </form>
        </div>
        {params.model ? (
          <Link href="/admin/pricing" className="text-sm font-medium text-brand-ink underline">
            Show all models
          </Link>
        ) : null}
        <div className="grid gap-3">
          {shown.map((m) => {
            const storages = [...new Map(m.variants.map((v) => [v.storageGb, v.launchPriceInr])).entries()].sort((a, b) => a[0] - b[0]);
            if (storages.length === 0) {
              return (
                <p key={m.id} className="rounded-[20px] border border-dashed border-line-strong bg-surface p-4 text-[0.95rem]">
                  {fullModelName(m.brand, m.name)}: no storage sizes yet.{" "}
                  <Link href={`/admin/catalog/${m.id}`} className="font-medium text-brand-ink underline">
                    Add them in the catalog
                  </Link>
                </p>
              );
            }
            return (
              <BuyPriceRow
                key={m.id}
                modelId={m.id}
                name={fullModelName(m.brand, m.name)}
                canEdit={canEdit}
                rows={storages.map(([storageGb, launchPriceInr]) => ({ storageGb, launchPriceInr, basePriceInr: priceOf.get(`${m.id}:${storageGb}`) ?? null }))}
              />
            );
          })}
          {shown.length === 0 ? <p className="text-muted">No models match.</p> : null}
        </div>
      </section>
    </div>
  );
}
