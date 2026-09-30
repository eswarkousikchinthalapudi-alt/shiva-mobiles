/**
 * Browse filters live in the URL so every search can be shared on WhatsApp.
 * This module parses and builds those URLs; it is used on server and client.
 */
import { isTagKey, type TagKey } from "./tags";

export const SORTS = ["newest", "price_asc", "price_desc", "battery", "value"] as const;
export type Sort = (typeof SORTS)[number];

export const PRICE_PRESETS = {
  "under-10k": [0, 10000],
  "10k-20k": [10000, 20000],
  "20k-30k": [20000, 30000],
  "above-30k": [30000, null],
} as const satisfies Record<string, readonly [number, number | null]>;
export type PricePreset = keyof typeof PRICE_PRESETS;

export const RAM_OPTIONS = [4, 6, 8, 12] as const;
export const STORAGE_OPTIONS = [64, 128, 256, 512] as const;
export const BATTERY_OPTIONS = [80, 85, 90] as const;
export const GRADES = ["A", "B", "C"] as const;

export type Filters = {
  q: string;
  brands: string[];
  price: PricePreset | null;
  ram: number | null;
  storage: number | null;
  grades: ("A" | "B" | "C")[];
  battery: number | null;
  fiveG: boolean;
  os: "ios" | "android" | null;
  boxBill: boolean;
  brandWarranty: boolean;
  tag: TagKey | null;
  sort: Sort;
  page: number;
};

export const EMPTY_FILTERS: Filters = {
  q: "",
  brands: [],
  price: null,
  ram: null,
  storage: null,
  grades: [],
  battery: null,
  fiveG: false,
  os: null,
  boxBill: false,
  brandWarranty: false,
  tag: null,
  sort: "newest",
  page: 1,
};

type Params = Record<string, string | string[] | undefined>;

function all(params: Params, key: string): string[] {
  const value = params[key];
  if (value === undefined) return [];
  return (Array.isArray(value) ? value : [value]).filter(Boolean);
}

function one(params: Params, key: string): string | undefined {
  return all(params, key)[0];
}

function pickNumber<T extends readonly number[]>(value: string | undefined, allowed: T): T[number] | null {
  const n = Number(value);
  return (allowed as readonly number[]).includes(n) ? (n as T[number]) : null;
}

export function parseFilters(params: Params): Filters {
  const q = (one(params, "q") ?? "").trim().slice(0, 60);
  const brands = [...new Set(all(params, "brand").map((b) => b.slice(0, 40)))].slice(0, 12);
  const priceValue = one(params, "price");
  const price = priceValue && priceValue in PRICE_PRESETS ? (priceValue as PricePreset) : null;
  const grades = all(params, "grade").filter((g): g is "A" | "B" | "C" => (GRADES as readonly string[]).includes(g));
  const osValue = one(params, "os");
  const tagValue = one(params, "tag");
  const sortValue = one(params, "sort");
  const page = Math.min(50, Math.max(1, Math.floor(Number(one(params, "page")) || 1)));
  return {
    q,
    brands,
    price,
    ram: pickNumber(one(params, "ram"), RAM_OPTIONS),
    storage: pickNumber(one(params, "storage"), STORAGE_OPTIONS),
    grades: [...new Set(grades)],
    battery: pickNumber(one(params, "battery"), BATTERY_OPTIONS),
    fiveG: one(params, "5g") === "1",
    os: osValue === "ios" || osValue === "android" ? osValue : null,
    boxBill: one(params, "boxbill") === "1",
    brandWarranty: one(params, "warranty") === "1",
    tag: tagValue && isTagKey(tagValue) ? tagValue : null,
    sort: (SORTS as readonly string[]).includes(sortValue ?? "") ? (sortValue as Sort) : "newest",
    page,
  };
}

export function filtersToSearchParams(filters: Filters): URLSearchParams {
  const params = new URLSearchParams();
  if (filters.q) params.set("q", filters.q);
  for (const brand of filters.brands) params.append("brand", brand);
  if (filters.price) params.set("price", filters.price);
  if (filters.ram) params.set("ram", String(filters.ram));
  if (filters.storage) params.set("storage", String(filters.storage));
  for (const grade of filters.grades) params.append("grade", grade);
  if (filters.battery) params.set("battery", String(filters.battery));
  if (filters.fiveG) params.set("5g", "1");
  if (filters.os) params.set("os", filters.os);
  if (filters.boxBill) params.set("boxbill", "1");
  if (filters.brandWarranty) params.set("warranty", "1");
  if (filters.tag) params.set("tag", filters.tag);
  if (filters.sort !== "newest") params.set("sort", filters.sort);
  if (filters.page > 1) params.set("page", String(filters.page));
  return params;
}

export function browseHref(filters: Partial<Filters>): string {
  const params = filtersToSearchParams({ ...EMPTY_FILTERS, ...filters });
  const query = params.toString();
  return query ? `/phones?${query}` : "/phones";
}

/** Number of filters in use (not counting search text, sort and page). */
export function activeFilterCount(filters: Filters): number {
  return (
    filters.brands.length +
    (filters.price ? 1 : 0) +
    (filters.ram ? 1 : 0) +
    (filters.storage ? 1 : 0) +
    filters.grades.length +
    (filters.battery ? 1 : 0) +
    (filters.fiveG ? 1 : 0) +
    (filters.os ? 1 : 0) +
    (filters.boxBill ? 1 : 0) +
    (filters.brandWarranty ? 1 : 0) +
    (filters.tag ? 1 : 0)
  );
}
