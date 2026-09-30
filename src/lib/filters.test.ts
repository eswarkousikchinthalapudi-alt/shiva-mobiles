import { describe, expect, it } from "vitest";
import { EMPTY_FILTERS, activeFilterCount, browseHref, filtersToSearchParams, parseFilters, withoutPriceFilters } from "./filters";
import { withoutPriceTags } from "./tags";

describe("parseFilters", () => {
  it("returns empty filters for an empty URL", () => {
    expect(parseFilters({})).toEqual(EMPTY_FILTERS);
  });

  it("reads every filter from the URL", () => {
    const f = parseFilters({
      q: " iphone ",
      brand: ["Apple", "Samsung"],
      price: "20k-30k",
      ram: "8",
      storage: "128",
      grade: ["A", "B"],
      battery: "85",
      "5g": "1",
      os: "android",
      boxbill: "1",
      warranty: "1",
      tag: "gaming",
      sort: "price_asc",
      page: "2",
    });
    expect(f).toEqual({
      q: "iphone",
      brands: ["Apple", "Samsung"],
      price: "20k-30k",
      ram: 8,
      storage: 128,
      grades: ["A", "B"],
      battery: 85,
      fiveG: true,
      os: "android",
      boxBill: true,
      brandWarranty: true,
      tag: "gaming",
      sort: "price_asc",
      page: 2,
    });
  });

  it("ignores values that are not allowed", () => {
    const f = parseFilters({ ram: "7", storage: "100", grade: ["Z"], battery: "50", os: "windows", tag: "<script>", sort: "evil", page: "-3", price: "free" });
    expect(f).toEqual(EMPTY_FILTERS);
  });

  it("limits long search text and very high page numbers", () => {
    const f = parseFilters({ q: "x".repeat(500), page: "9999" });
    expect(f.q).toHaveLength(60);
    expect(f.page).toBe(50);
  });
});

describe("building URLs", () => {
  it("round-trips through the URL", () => {
    const f = parseFilters({ brand: ["Apple"], price: "above-30k", grade: ["A"], "5g": "1", sort: "value" });
    const params = Object.fromEntries([...filtersToSearchParams(f).keys()].map((k) => [k, filtersToSearchParams(f).getAll(k)]));
    expect(parseFilters(params)).toEqual(f);
  });

  it("keeps links short when nothing is picked", () => {
    expect(browseHref({})).toBe("/phones");
    expect(browseHref({ tag: "gaming" })).toBe("/phones?tag=gaming");
  });

  it("counts active filters, not search text or sort", () => {
    const f = parseFilters({ q: "a54", brand: ["Samsung"], grade: ["A", "B"], sort: "price_desc", "5g": "1" });
    expect(activeFilterCount(f)).toBe(4);
  });
});

describe("withoutPriceFilters", () => {
  it("drops price filters, price sorting and price tags when the shop hides prices", () => {
    const filters = parseFilters({ price: "under-10k", sort: "price_asc", tag: "under-20k", brand: "Samsung" });
    const hidden = withoutPriceFilters(filters);
    expect(hidden.price).toBeNull();
    expect(hidden.sort).toBe("newest");
    expect(hidden.tag).toBeNull();
    expect(hidden.brands).toEqual(["Samsung"]);
    const kept = withoutPriceFilters(parseFilters({ sort: "battery", tag: "gaming" }));
    expect(kept.sort).toBe("battery");
    expect(kept.tag).toBe("gaming");
  });

  it("removes price tags from a tag list", () => {
    expect(withoutPriceTags(["just-arrived", "price-dropped", "under-10k", "5g"])).toEqual(["just-arrived", "5g"]);
  });
});
