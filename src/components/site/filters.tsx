"use client";

import { SlidersHorizontal, X } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { useT } from "@/i18n/client";
import {
  BATTERY_OPTIONS,
  EMPTY_FILTERS,
  GRADES,
  PRICE_PRESETS,
  RAM_OPTIONS,
  STORAGE_OPTIONS,
  activeFilterCount,
  filtersToSearchParams,
  type Filters,
  type PricePreset,
} from "@/lib/filters";
import { buttonClass } from "@/components/ui/button";
import { cn } from "@/components/ui/cn";

type BrandOption = { brand: string; count: number };

function useApply() {
  const router = useRouter();
  const pathname = usePathname();
  const [pending, startTransition] = useTransition();
  const apply = (next: Filters) => {
    const params = filtersToSearchParams({ ...next, page: 1 });
    const query = params.toString();
    startTransition(() => router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false }));
  };
  return { apply, pending };
}

function toggle<T>(list: T[], value: T): T[] {
  return list.includes(value) ? list.filter((v) => v !== value) : [...list, value];
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <fieldset className="border-b border-line py-4 last:border-b-0">
      <legend className="mb-2.5 text-sm font-semibold">{title}</legend>
      {children}
    </fieldset>
  );
}

function Pill({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        "h-9 rounded-full border px-3.5 text-sm font-medium transition-colors",
        active ? "border-brand bg-brand text-brand-fg" : "border-line-strong bg-surface hover:border-brand",
      )}
    >
      {children}
    </button>
  );
}

function Check({ checked, onChange, children }: { checked: boolean; onChange: () => void; children: React.ReactNode }) {
  return (
    <label className="flex min-h-10 cursor-pointer items-center gap-3 rounded-lg px-1 text-[0.95rem]">
      <input type="checkbox" checked={checked} onChange={onChange} className="h-5 w-5 shrink-0 accent-[var(--brand)]" />
      <span className="flex-1">{children}</span>
    </label>
  );
}

function Fields({ value, onChange, brands, showPrices }: { value: Filters; onChange: (next: Filters) => void; brands: BrandOption[]; showPrices: boolean }) {
  const t = useT();
  const priceLabels: Record<PricePreset, string> = {
    "under-10k": t.browse.priceUnder10,
    "10k-20k": t.browse.price10to20,
    "20k-30k": t.browse.price20to30,
    "above-30k": t.browse.priceAbove30,
  };
  const set = (patch: Partial<Filters>) => onChange({ ...value, ...patch });
  return (
    <div>
      <Group title={t.browse.type}>
        <div className="flex flex-wrap gap-2">
          <Pill active={value.os === "ios"} onClick={() => set({ os: value.os === "ios" ? null : "ios" })}>
            {t.browse.iphone}
          </Pill>
          <Pill active={value.os === "android"} onClick={() => set({ os: value.os === "android" ? null : "android" })}>
            {t.browse.android}
          </Pill>
        </div>
      </Group>
      {showPrices ? (
        <Group title={t.browse.price}>
          <div className="flex flex-wrap gap-2">
            {(Object.keys(PRICE_PRESETS) as PricePreset[]).map((preset) => (
              <Pill key={preset} active={value.price === preset} onClick={() => set({ price: value.price === preset ? null : preset })}>
                {priceLabels[preset]}
              </Pill>
            ))}
          </div>
        </Group>
      ) : null}
      {brands.length > 0 ? (
        <Group title={t.browse.brand}>
          <div className="grid grid-cols-1">
            {brands.map(({ brand, count }) => (
              <Check key={brand} checked={value.brands.includes(brand)} onChange={() => set({ brands: toggle(value.brands, brand) })}>
                {brand} <span className="text-muted">({count})</span>
              </Check>
            ))}
          </div>
        </Group>
      ) : null}
      <Group title={t.browse.condition}>
        <div className="grid grid-cols-1">
          {GRADES.map((grade) => (
            <Check key={grade} checked={value.grades.includes(grade)} onChange={() => set({ grades: toggle(value.grades, grade) })}>
              <span className="mr-1.5 font-display font-bold">{grade}</span>
              {t.grade[grade]}
            </Check>
          ))}
        </div>
      </Group>
      <Group title={t.browse.battery}>
        <div className="flex flex-wrap gap-2">
          {BATTERY_OPTIONS.map((b) => (
            <Pill key={b} active={value.battery === b} onClick={() => set({ battery: value.battery === b ? null : b })}>
              {t.browse.atLeast(`${b}%`)}
            </Pill>
          ))}
        </div>
      </Group>
      <Group title={t.browse.ram}>
        <div className="flex flex-wrap gap-2">
          {RAM_OPTIONS.map((r) => (
            <Pill key={r} active={value.ram === r} onClick={() => set({ ram: value.ram === r ? null : r })}>
              {r} GB+
            </Pill>
          ))}
        </div>
      </Group>
      <Group title={t.browse.storage}>
        <div className="flex flex-wrap gap-2">
          {STORAGE_OPTIONS.map((s) => (
            <Pill key={s} active={value.storage === s} onClick={() => set({ storage: value.storage === s ? null : s })}>
              {s} GB+
            </Pill>
          ))}
        </div>
      </Group>
      <Group title={t.browse.features}>
        <div className="grid grid-cols-1">
          <Check checked={value.fiveG} onChange={() => set({ fiveG: !value.fiveG })}>
            {t.browse.fiveG}
          </Check>
          <Check checked={value.boxBill} onChange={() => set({ boxBill: !value.boxBill })}>
            {t.browse.boxBill}
          </Check>
          <Check checked={value.brandWarranty} onChange={() => set({ brandWarranty: !value.brandWarranty })}>
            {t.browse.brandWarranty}
          </Check>
        </div>
      </Group>
    </div>
  );
}

/** Desktop: filters apply as soon as they change. */
export function FilterSidebar({ filters, brands, showPrices = true }: { filters: Filters; brands: BrandOption[]; showPrices?: boolean }) {
  const t = useT();
  const { apply, pending } = useApply();
  const count = activeFilterCount(filters);
  return (
    <div className={cn("rounded-[20px] border border-line bg-surface px-4 py-1 transition-opacity", pending && "opacity-60")}>
      <div className="flex items-center justify-between pt-3">
        <h2 className="font-display text-lg font-semibold">{t.browse.filters}</h2>
        {count > 0 ? (
          <button
            type="button"
            className="text-sm font-medium text-brand-ink hover:underline"
            onClick={() => apply({ ...EMPTY_FILTERS, q: filters.q, sort: filters.sort })}
          >
            {t.browse.clearFilters}
          </button>
        ) : null}
      </div>
      <Fields value={filters} onChange={apply} brands={brands} showPrices={showPrices} />
    </div>
  );
}

/** Mobile: filters open in a bottom sheet and apply on "Show results". */
export function FilterSheetButton({ filters, brands, showPrices = true }: { filters: Filters; brands: BrandOption[]; showPrices?: boolean }) {
  const t = useT();
  const ref = useRef<HTMLDialogElement>(null);
  const [draft, setDraft] = useState(filters);
  const { apply, pending } = useApply();
  const count = activeFilterCount(filters);

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setDraft(filters);
          ref.current?.showModal();
        }}
        className={buttonClass("secondary", "md", "flex-1 lg:hidden")}
      >
        <SlidersHorizontal className="h-4 w-4" aria-hidden />
        {t.browse.filters}
        {count > 0 ? <span className="grid h-5 min-w-5 place-items-center rounded-full bg-brand px-1.5 text-xs text-brand-fg">{count}</span> : null}
      </button>
      <dialog ref={ref} className="sheet" aria-label={t.browse.filters} onClick={(e) => e.target === ref.current && ref.current?.close()}>
        <div className="flex max-h-[88dvh] flex-col">
          <div className="flex items-center justify-between border-b border-line px-5 py-3.5">
            <h2 className="font-display text-lg font-semibold">{t.browse.filters}</h2>
            <button
              type="button"
              onClick={() => ref.current?.close()}
              className="grid h-10 w-10 place-items-center rounded-full hover:bg-surface-3"
              aria-label={t.nav.close}
            >
              <X className="h-5 w-5" aria-hidden />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto px-5">
            <Fields value={draft} onChange={setDraft} brands={brands} showPrices={showPrices} />
          </div>
          <div className="flex gap-3 border-t border-line px-5 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
            <button type="button" className={buttonClass("ghost", "lg")} onClick={() => setDraft({ ...EMPTY_FILTERS, q: filters.q, sort: filters.sort })}>
              {t.action.clear}
            </button>
            <button
              type="button"
              disabled={pending}
              className={buttonClass("primary", "lg", "flex-1")}
              onClick={() => {
                apply(draft);
                ref.current?.close();
              }}
            >
              {t.action.applyFilters}
            </button>
          </div>
        </div>
      </dialog>
    </>
  );
}

export function SortSelect({ filters, showPrices = true }: { filters: Filters; showPrices?: boolean }) {
  const t = useT();
  const { apply } = useApply();
  return (
    <label className="relative flex-1 lg:flex-none">
      <span className="sr-only">{t.browse.sort}</span>
      <select
        value={filters.sort}
        onChange={(e) => apply({ ...filters, sort: e.target.value as Filters["sort"] })}
        className="h-11 w-full appearance-none rounded-[12px] border border-line-strong bg-surface pl-3.5 pr-9 text-[0.95rem] font-medium lg:w-56"
      >
        <option value="newest">{t.browse.sortNewest}</option>
        {showPrices ? <option value="price_asc">{t.browse.sortPriceAsc}</option> : null}
        {showPrices ? <option value="price_desc">{t.browse.sortPriceDesc}</option> : null}
        <option value="battery">{t.browse.sortBattery}</option>
        {showPrices ? <option value="value">{t.browse.sortValue}</option> : null}
      </select>
      <svg viewBox="0 0 20 20" className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" aria-hidden>
        <path d="M5 8l5 5 5-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </label>
  );
}
