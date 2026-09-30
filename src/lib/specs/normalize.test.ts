import { describe, expect, it } from "vitest";
import { cleanChipset, parseCameras, parseChargingW, parseDisplayType, parseVariants, performanceFromChipset, splitBrand } from "./normalize";

describe("splitBrand", () => {
  it("uses the names shops in India use", () => {
    expect(splitBrand("Xiaomi Redmi Note 12 5G")).toEqual({ brand: "Redmi", name: "Note 12 5G" });
    expect(splitBrand("Xiaomi Poco X6 Pro")).toEqual({ brand: "Poco", name: "X6 Pro" });
    expect(splitBrand("vivo iQOO Z9")).toEqual({ brand: "iQOO", name: "Z9" });
    expect(splitBrand("vivo Y21")).toEqual({ brand: "Vivo", name: "Y21" });
    expect(splitBrand("Xiaomi 14")).toEqual({ brand: "Xiaomi", name: "14" });
    expect(splitBrand("OnePlus Nord CE4")).toEqual({ brand: "OnePlus", name: "Nord CE4" });
    expect(splitBrand("Nothing Phone (2a)")).toEqual({ brand: "Nothing", name: "Phone (2a)" });
  });
});

describe("cleanChipset", () => {
  it("keeps just the chip name", () => {
    expect(cleanChipset("Qualcomm SM8550-AC Snapdragon 8 Gen 2 (4 nm)")).toBe("Snapdragon 8 Gen 2");
    expect(cleanChipset("Qualcomm SM6375 Snapdragon 695 5G (6 nm)")).toBe("Snapdragon 695");
    expect(cleanChipset("Mediatek MT6769Z Helio G85 (12nm)")).toBe("Helio G85");
    expect(cleanChipset("Mediatek Dimensity 7050 (6 nm)")).toBe("Dimensity 7050");
    expect(cleanChipset("Apple A15 Bionic (5 nm)")).toBe("A15 Bionic");
    expect(cleanChipset("Google Tensor G3 (4 nm)")).toBe("Tensor G3");
    expect(cleanChipset("Unisoc T606 (12 nm)")).toBe("Unisoc T606");
    expect(cleanChipset(null)).toBeNull();
  });

  it("prefers the chip sold in India or worldwide", () => {
    expect(cleanChipset("Exynos 2200 (4 nm) - Europe\nQualcomm SM8450 Snapdragon 8 Gen 1 (4 nm) - ROW")).toBe("Snapdragon 8 Gen 1");
    expect(cleanChipset("Exynos 2400 (4 nm) - International\nQualcomm SM8650-AC Snapdragon 8 Gen 3 (4 nm) - USA/Canada/China")).toBe("Exynos 2400");
    expect(cleanChipset("Qualcomm Snapdragon 8 Gen 3 (4 nm) - China\nMediatek Dimensity 9300 (4 nm) - India")).toBe("Dimensity 9300");
  });
});

describe("performanceFromChipset", () => {
  it("sorts common chips into speed tiers", () => {
    const tiers: [string, number | null][] = [
      ["Snapdragon 8 Gen 2", 4],
      ["Snapdragon 8+ Gen 1", 4],
      ["Snapdragon 8 Elite", 4],
      ["Snapdragon 888", 4],
      ["Snapdragon 855", 3],
      ["Snapdragon 7s Gen 2", 3],
      ["Snapdragon 778G", 3],
      ["Snapdragon 695", 2],
      ["Snapdragon 6 Gen 1", 2],
      ["Snapdragon 4 Gen 2", 1],
      ["Snapdragon 480", 1],
      ["Dimensity 9300", 4],
      ["Dimensity 8200", 3],
      ["Dimensity 7050", 3],
      ["Dimensity 6100+", 2],
      ["Dimensity 1080", 2],
      ["Dimensity 1200", 3],
      ["Dimensity 700", 2],
      ["Helio G99", 1],
      ["Exynos 2400", 4],
      ["Exynos 1380", 3],
      ["Exynos 1280", 2],
      ["Exynos 850", 1],
      ["Exynos 9611", 1],
      ["Exynos 9825", 3],
      ["A17 Pro", 4],
      ["A15 Bionic", 4],
      ["A13 Bionic", 3],
      ["A12 Bionic", 2],
      ["Tensor G2", 4],
      ["Unisoc T606", 1],
      ["Kirin 710", null],
      ["", null],
    ];
    for (const [chip, tier] of tiers) expect(performanceFromChipset(chip), chip).toBe(tier);
  });
});

describe("spec text", () => {
  it("reads variants", () => {
    expect(parseVariants("256GB 8GB RAM, 512GB 12GB RAM, 1TB 12GB RAM", false)).toEqual([
      { ramGb: 8, storageGb: 256, launchPriceInr: null },
      { ramGb: 12, storageGb: 512, launchPriceInr: null },
      { ramGb: 12, storageGb: 1024, launchPriceInr: null },
    ]);
    expect(parseVariants("16GB 1.5GB RAM", false)).toEqual([{ ramGb: null, storageGb: 16, launchPriceInr: null }]);
    expect(parseVariants("64GB", false)).toEqual([{ ramGb: null, storageGb: 64, launchPriceInr: null }]);
    expect(parseVariants(null, false)).toEqual([]);
  });

  it("reads the screen type and refresh rate", () => {
    expect(parseDisplayType("IPS LCD, 90Hz, 400 nits (typ)")).toEqual({ type: "IPS LCD", refreshHz: 90 });
    expect(parseDisplayType("OLED, HDR10")).toEqual({ type: "OLED", refreshHz: 60 });
  });

  it("summarises cameras", () => {
    expect(parseCameras("50 MP, f/1.8, (wide)\n2 MP, f/2.4, (depth)")).toEqual({ mainMp: 50, summary: "50MP + 2MP depth" });
    expect(parseCameras("50 MP, f/1.7, (wide)\n50 MP, f/2.6, 111mm (periscope telephoto), 5x optical zoom\nTOF 3D, (depth)")).toEqual({
      mainMp: 50,
      summary: "50MP + 50MP periscope",
    });
  });

  it("reads wired charging only", () => {
    expect(parseChargingW("Fast charging 18W")).toBe(18);
    expect(parseChargingW("15W wireless (MagSafe)\n20W wired, PD2.0")).toBe(20);
    expect(parseChargingW("Reverse wired\n15W wireless")).toBeNull();
  });
});
