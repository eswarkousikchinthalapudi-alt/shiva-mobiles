import { Search, X } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { getT } from "@/i18n/server";
import { activeFilterCount, filtersToSearchParams, parseFilters, type Filters, type PricePreset } from "@/lib/filters";
import { brandCounts, searchListings } from "@/lib/listings";
import { buttonClass } from "@/components/ui/button";
import { cn } from "@/components/ui/cn";
import { FilterSheetButton, FilterSidebar, SortSelect } from "@/components/site/filters";
import { PhoneCard } from "@/components/site/phone-card";
import type { TagKey } from "@/lib/tags";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getT();
  return { title: t.browse.title, description: t.meta.phones };
}

const QUICK_TAGS: TagKey[] = ["just-arrived", "price-dropped", "gaming", "camera", "parents", "students", "big-battery", "5g"];

function hrefWith(filters: Filters, patch: Partial<Filters>) {
  const params = filtersToSearchParams({ ...filters, ...patch, page: patch.page ?? 1 });
  const query = params.toString();
  return query ? `/phones?${query}` : "/phones";
}

export default async function PhonesPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const filters = parseFilters(await searchParams);
  const [{ t, lang }, result, brands] = await Promise.all([getT(), searchListings(filters), brandCounts()]);
  const priceLabels: Record<PricePreset, string> = {
    "under-10k": t.browse.priceUnder10,
    "10k-20k": t.browse.price10to20,
    "20k-30k": t.browse.price20to30,
    "above-30k": t.browse.priceAbove30,
  };

  // Chips for filters in use, each links to the same search without it.
  const chips: { label: string; href: string }[] = [];
  if (filters.q) chips.push({ label: `"${filters.q}"`, href: hrefWith(filters, { q: "" }) });
  if (filters.os) chips.push({ label: filters.os === "ios" ? t.browse.iphone : t.browse.android, href: hrefWith(filters, { os: null }) });
  if (filters.price) chips.push({ label: priceLabels[filters.price], href: hrefWith(filters, { price: null }) });
  for (const brand of filters.brands) chips.push({ label: brand, href: hrefWith(filters, { brands: filters.brands.filter((b) => b !== brand) }) });
  for (const grade of filters.grades)
    chips.push({ label: `${grade} ${t.grade[grade]}`, href: hrefWith(filters, { grades: filters.grades.filter((g) => g !== grade) }) });
  if (filters.battery) chips.push({ label: `${t.browse.battery} ${filters.battery}%+`, href: hrefWith(filters, { battery: null }) });
  if (filters.ram) chips.push({ label: `RAM ${filters.ram} GB+`, href: hrefWith(filters, { ram: null }) });
  if (filters.storage) chips.push({ label: `${filters.storage} GB+`, href: hrefWith(filters, { storage: null }) });
  if (filters.fiveG) chips.push({ label: "5G", href: hrefWith(filters, { fiveG: false }) });
  if (filters.boxBill) chips.push({ label: t.browse.boxBill, href: hrefWith(filters, { boxBill: false }) });
  if (filters.brandWarranty) chips.push({ label: t.browse.brandWarranty, href: hrefWith(filters, { brandWarranty: false }) });
  if (filters.tag) chips.push({ label: t.tag[filters.tag], href: hrefWith(filters, { tag: null }) });

  const hidden = filtersToSearchParams({ ...filters, q: "", page: 1 });

  return (
    <div className="mx-auto max-w-6xl px-4 pb-10 pt-6 sm:pt-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-bold sm:text-4xl">{filters.q ? t.browse.searchFor(filters.q) : t.browse.title}</h1>
          <p className="mt-1 text-muted" aria-live="polite">
            {t.browse.count(result.total)}
          </p>
        </div>
      </div>

      <form action="/phones" method="get" role="search" className="mt-5 flex gap-2">
        {[...hidden.entries()].map(([key, value], i) => (
          <input key={`${key}-${i}`} type="hidden" name={key} value={value} />
        ))}
        <label htmlFor="browse-search" className="sr-only">
          {t.action.search}
        </label>
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-faint" aria-hidden />
          <input
            id="browse-search"
            name="q"
            type="search"
            defaultValue={filters.q}
            maxLength={60}
            autoComplete="off"
            placeholder={t.home.searchPlaceholder}
            className="h-12 w-full rounded-[14px] border border-line-strong bg-surface pl-12 pr-4 text-base placeholder:text-faint focus:border-brand focus:outline-none"
          />
        </div>
        <button type="submit" className={buttonClass("primary", "lg", "h-12")}>
          {t.action.search}
        </button>
      </form>

      <nav aria-label={t.a11y.quickFilters} className="scroll-row -mx-4 mt-4 flex gap-2 overflow-x-auto px-4 pb-1">
        {QUICK_TAGS.map((tag) => {
          const active = filters.tag === tag;
          return (
            <Link
              key={tag}
              href={hrefWith(filters, { tag: active ? null : tag })}
              scroll={false}
              aria-current={active ? "true" : undefined}
              className={cn(
                "inline-flex h-9 shrink-0 items-center rounded-full border px-3.5 text-sm font-medium",
                active ? "border-brand bg-brand text-brand-fg" : "border-line-strong bg-surface hover:border-brand",
              )}
            >
              {t.tag[tag]}
            </Link>
          );
        })}
      </nav>

      <div className="mt-6 grid gap-6 lg:grid-cols-[17rem_1fr]">
        <aside className="hidden lg:block">
          <div className="sticky top-20">
            <FilterSidebar filters={filters} brands={brands} />
          </div>
        </aside>

        <section aria-label={t.browse.title}>
          <div className="flex gap-2 lg:justify-end">
            <FilterSheetButton filters={filters} brands={brands} />
            <SortSelect filters={filters} />
          </div>

          {chips.length > 0 ? (
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <span className="sr-only">{t.browse.activeFilters}</span>
              {chips.map((chip) => (
                <Link
                  key={chip.label + chip.href}
                  href={chip.href}
                  scroll={false}
                  className="inline-flex h-8 items-center gap-1.5 rounded-full bg-brand-soft pl-3 pr-2 text-sm font-medium text-brand-ink hover:brightness-95"
                >
                  {chip.label}
                  <X className="h-3.5 w-3.5" aria-label={t.action.clear} />
                </Link>
              ))}
              {activeFilterCount(filters) + (filters.q ? 1 : 0) > 1 ? (
                <Link href="/phones" className="text-sm font-medium text-muted underline-offset-4 hover:underline">
                  {t.browse.clearFilters}
                </Link>
              ) : null}
            </div>
          ) : null}

          {result.items.length === 0 ? (
            <div className="mt-6 rounded-[22px] border border-dashed border-line-strong bg-surface p-8 text-center">
              <h2 className="font-display text-xl font-semibold">{t.browse.emptyTitle}</h2>
              <p className="mx-auto mt-2 max-w-md text-muted">{t.browse.emptyText}</p>
              <div className="mt-5 flex flex-wrap justify-center gap-3">
                <Link href={`/wanted${filters.q ? `?want=${encodeURIComponent(filters.q)}` : ""}`} className={buttonClass("primary", "md")}>
                  {t.browse.notifyMe}
                </Link>
                <Link href="/phones" className={buttonClass("secondary", "md")}>
                  {t.browse.clearFilters}
                </Link>
              </div>
            </div>
          ) : (
            <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:gap-4">
              {result.items.map((item, index) => (
                <PhoneCard key={item.id} item={item} lang={lang} priority={index < 4} />
              ))}
            </div>
          )}

          {result.hasMore ? (
            <div className="mt-8 text-center">
              <Link href={hrefWith(filters, { page: filters.page + 1 })} scroll={false} className={buttonClass("secondary", "lg")}>
                {t.action.showMore}
              </Link>
            </div>
          ) : null}
        </section>
      </div>
    </div>
  );
}
