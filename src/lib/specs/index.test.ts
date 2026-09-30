import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ModelInput } from "@/lib/admin/catalog";

const wiki = vi.hoisted(() => ({ findWikipediaArticle: vi.fn() }));
const ai = vi.hoisted(() => ({ aiLookupEnabled: vi.fn(), extractWithAi: vi.fn(), lookupWithAi: vi.fn() }));
const gsm = vi.hoisted(() => ({ readGsmarenaSpecs: vi.fn() }));
vi.mock("./wikipedia", () => wiki);
vi.mock("./openrouter", () => ai);
vi.mock("./gsmarena", () => gsm);

import { lookupSpecs } from "./index";

const specs: ModelInput = {
  brand: "Samsung",
  name: "Galaxy S26 Ultra",
  aliases: [],
  os: "Android",
  launchYear: 2026,
  chipset: "Snapdragon 8 Elite Gen 5",
  performance: 4,
  displayInches: 6.9,
  displayType: "Dynamic LTPO AMOLED 2X",
  refreshHz: 120,
  mainCameraMp: 200,
  cameraSummary: null,
  frontCameraMp: 12,
  batteryMah: 5000,
  chargingW: 60,
  has5g: true,
  variants: [{ ramGb: 12, storageGb: 256, launchPriceInr: null }],
  sourceUrls: [],
};
const article = {
  title: "Samsung Galaxy S26",
  url: "https://en.wikipedia.org/wiki/Samsung_Galaxy_S26",
  text: "System-on-chip: Snapdragon 8 Elite Gen 5\nBattery: 5000 mAh",
};

describe("lookupSpecs", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    ai.aiLookupEnabled.mockReturnValue(true);
  });

  it("reads Wikipedia with the free AI first and links the article", async () => {
    wiki.findWikipediaArticle.mockResolvedValue(article);
    ai.extractWithAi.mockResolvedValue({ ok: true, specs });
    const result = await lookupSpecs("Samsung s26 ultra 5G");
    expect(result).toMatchObject({ ok: true, data: { source: "wikipedia", specs: { chipset: "Snapdragon 8 Elite Gen 5", sourceUrls: [article.url] } } });
    expect(ai.extractWithAi).toHaveBeenCalledWith(expect.stringContaining("System-on-chip"), "Samsung s26 ultra 5G");
    expect(ai.lookupWithAi).not.toHaveBeenCalled();
  });

  it("falls back to the AI's memory when Wikipedia has nothing", async () => {
    wiki.findWikipediaArticle.mockResolvedValue(null);
    ai.lookupWithAi.mockResolvedValue({ ok: true, specs: { ...specs, brand: "Realme", name: "11 Pro 5G" } });
    const result = await lookupSpecs("RMX3771");
    expect(result).toMatchObject({ ok: true, data: { source: "ai", specs: { brand: "Realme" } } });
  });

  it("falls back to memory when the article doesn't cover the phone, and explains when nothing knows it", async () => {
    wiki.findWikipediaArticle.mockResolvedValue(article);
    ai.extractWithAi.mockResolvedValue({ ok: false, error: "The free AI found no specs for this phone in that text." });
    ai.lookupWithAi.mockResolvedValue({ ok: false, error: "The free AI doesn't know this phone." });
    const result = await lookupSpecs("Galaxy S26 Edge");
    expect(result).toMatchObject({
      ok: false,
      error: expect.stringMatching(/Wikipedia's page \(Samsung Galaxy S26\) doesn't list this phone, and the free AI doesn't know it either/),
    });
    expect(ai.lookupWithAi).toHaveBeenCalledTimes(1);
  });

  it("stops on real AI problems instead of trying again from memory", async () => {
    wiki.findWikipediaArticle.mockResolvedValue(article);
    ai.extractWithAi.mockResolvedValue({ ok: false, error: "The OPENROUTER_API_KEY is not valid." });
    expect(await lookupSpecs("Galaxy S26 Ultra")).toEqual({ ok: false, error: "The OPENROUTER_API_KEY is not valid." });
    expect(ai.lookupWithAi).not.toHaveBeenCalled();
  });

  it("reads Wikipedia with patterns when the AI is off", async () => {
    ai.aiLookupEnabled.mockReturnValue(false);
    wiki.findWikipediaArticle.mockResolvedValue({
      ...article,
      text: "Samsung Galaxy A54 5G\nSystem-on-chip: Exynos 1380\nDisplay: 6.4 in Super AMOLED, 120 Hz\nBattery: 5000 mAh\nCharging: 25 W wired\nFront camera: 32 MP\nRear camera: 50 MP wide",
    });
    const result = await lookupSpecs("Galaxy A54");
    expect(result).toMatchObject({
      ok: true,
      data: { source: "wikipedia", note: expect.stringMatching(/without AI/), specs: { chipset: "Exynos 1380", batteryMah: 5000 } },
    });
    expect(ai.extractWithAi).not.toHaveBeenCalled();
  });

  it("uses the typed name when the source gave none", async () => {
    wiki.findWikipediaArticle.mockResolvedValue(null);
    ai.lookupWithAi.mockResolvedValue({ ok: true, specs: { ...specs, brand: "", name: "" } });
    const result = await lookupSpecs("Galaxy A54");
    expect(result).toMatchObject({ ok: true, data: { specs: { brand: "Samsung", name: "Galaxy A54" } } });
  });

  it("reads a GSMArena link directly", async () => {
    gsm.readGsmarenaSpecs.mockResolvedValue({ ok: true, specs });
    const result = await lookupSpecs("https://www.gsmarena.com/samsung_galaxy_s26_ultra_5g-14320.php");
    expect(result).toMatchObject({ ok: true, data: { source: "gsmarena" } });
    expect(wiki.findWikipediaArticle).not.toHaveBeenCalled();
  });
});
