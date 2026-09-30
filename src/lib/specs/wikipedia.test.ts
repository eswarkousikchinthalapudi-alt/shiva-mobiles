import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it, vi } from "vitest";
import { parseSpecsText } from "./text";
import { findWikipediaArticle, pickResult, queryTokens, wikiHtmlToText } from "./wikipedia";

const fixture = (name: string) => readFileSync(fileURLToPath(new URL(`./fixtures/${name}`, import.meta.url)), "utf8");

describe("pickResult", () => {
  it("picks the article that shares the model name, skipping lists", () => {
    const results = [{ title: "List of Samsung Galaxy S series smartphones" }, { title: "Samsung Galaxy S26" }, { title: "Samsung Galaxy S25" }];
    expect(pickResult("Samsung s26 ultra 5G", results)).toBe("Samsung Galaxy S26");
    expect(pickResult("Galaxy S25 Ultra", results)).toBe("Samsung Galaxy S25");
    expect(pickResult("Redmi Note 13 Pro+", [{ title: "Redmi Note 13" }, { title: "Redmi Note 12" }])).toBe("Redmi Note 13");
  });

  it("returns null when nothing fits", () => {
    expect(pickResult("RMX3771", [{ title: "Realme" }, { title: "Realme 11" }])).toBeNull();
    expect(pickResult("Vivo Y28", [{ title: "Vivo (technology company)" }])).toBeNull();
    expect(pickResult("", [{ title: "Anything" }])).toBeNull();
  });

  it("ignores filler words", () => {
    expect(queryTokens("Samsung Galaxy A54 5G dual sim")).toEqual(["samsung", "galaxy", "a54"]);
  });
});

describe("wikiHtmlToText", () => {
  it("turns the spec box into label lines and keeps the article text", () => {
    const text = wikiHtmlToText(fixture("wikipedia-galaxy-s26.html"));
    expect(text).toContain(
      "System-on-chip: S26 & S26+ (USA/China) & S26 Ultra: Qualcomm Snapdragon 8 Elite Gen 5; S26 & S26+ (Worldwide): Samsung Exynos 2600",
    );
    expect(text).toContain("Battery: S26: 4300 mAh; S26+: 4900 mAh; S26 Ultra: 5000 mAh");
    expect(text).toContain('Display: S26: 6.3" Dynamic AMOLED 2X, 120 Hz, 2340 × 1080;');
    expect(text).toContain("First released: S26, S26+ and S26 Ultra: March 11, 2026");
    expect(text).toContain("S26 Ultra | SM-S948B, SM-S948E");
    expect(text).not.toContain("[1]");
    expect(text).not.toContain("[edit]");
    expect(text).not.toContain("navigation");
    expect(text.indexOf("Manufacturer:")).toBeLessThan(text.indexOf("The Samsung Galaxy S26 is a series"));
  });

  it("gives text the plain reader can use for a single-model article", () => {
    const { specs, found } = parseSpecsText(wikiHtmlToText(fixture("wikipedia-galaxy-a54.html")), "Galaxy A54");
    expect(specs).toMatchObject({
      brand: "Samsung",
      name: "Galaxy A54 5G",
      chipset: "Exynos 1380",
      performance: 3,
      displayInches: 6.4,
      displayType: "Super AMOLED",
      refreshHz: 120,
      mainCameraMp: 50,
      frontCameraMp: 32,
      batteryMah: 5000,
      chargingW: 25,
      launchYear: 2023,
      has5g: true,
      variants: [
        { ramGb: null, storageGb: 128, launchPriceInr: null },
        { ramGb: null, storageGb: 256, launchPriceInr: null },
      ],
    });
    expect(found).toBeGreaterThanOrEqual(9);
  });
});

describe("findWikipediaArticle", () => {
  afterEach(() => vi.unstubAllGlobals());

  const json = (body: unknown) => new Response(JSON.stringify(body), { status: 200, headers: { "content-type": "application/json" } });

  it("searches, picks the article and fetches its rendered text with a proper user agent", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(json({ query: { search: [{ title: "Samsung Galaxy S26" }, { title: "Samsung Galaxy S25" }] } }))
      .mockResolvedValueOnce(json({ parse: { title: "Samsung Galaxy S26", text: fixture("wikipedia-galaxy-s26.html") } }));
    vi.stubGlobal("fetch", fetchMock);
    const article = await findWikipediaArticle("Samsung s26 ultra 5G");
    expect(article?.title).toBe("Samsung Galaxy S26");
    expect(article?.url).toBe("https://en.wikipedia.org/wiki/Samsung_Galaxy_S26");
    expect(article?.text).toContain("Snapdragon 8 Elite Gen 5");
    const [searchUrl, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(searchUrl).toContain("https://en.wikipedia.org/w/api.php?");
    expect(searchUrl).toContain("srsearch=samsung+s26+ultra");
    expect(new Headers(init.headers).get("user-agent")).toMatch(/^ShivaMobilesCatalog\/.*shiva-mobiles/);
    const [pageUrl] = fetchMock.mock.calls[1] as unknown as [string];
    expect(pageUrl).toContain("action=parse");
    expect(pageUrl).toContain("page=Samsung+Galaxy+S26");
  });

  it("returns null for no results, unrelated results, or network trouble", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => json({ query: { search: [] } })),
    );
    expect(await findWikipediaArticle("RMX3771")).toBeNull();
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => json({ query: { search: [{ title: "Realme" }] } })),
    );
    expect(await findWikipediaArticle("RMX3771")).toBeNull();
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new TypeError("fetch failed");
      }),
    );
    expect(await findWikipediaArticle("Galaxy A54")).toBeNull();
  });
});
