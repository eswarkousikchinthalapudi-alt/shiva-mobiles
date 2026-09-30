import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { nameFromText, parseSpecsText, rowsFromText, trimForAi } from "./text";

const fixture = (name: string) => readFileSync(fileURLToPath(new URL(`./fixtures/${name}`, import.meta.url)), "utf8");

describe("rowsFromText", () => {
  it("reads copied table rows with sections, labels and continued lines", () => {
    const rows = rowsFromText(fixture("copied-gsmarena-galaxy-s26-ultra.txt"));
    const chipset = rows.find((r) => r.section === "Platform" && r.label === "Chipset");
    expect(chipset?.value).toBe("Qualcomm SM8850 Snapdragon 8 Elite Gen 5 (3 nm)");
    const main = rows.find((r) => r.section === "Main Camera");
    expect(main?.label).toBe("Quad");
    expect(main?.value.split("\n")).toHaveLength(4);
    const internal = rows.find((r) => r.section === "Memory" && r.label === "Internal");
    expect(internal?.value).toContain("UFS 4.1");
  });
});

describe("nameFromText", () => {
  it("finds the phone's name and skips review and price lines", () => {
    expect(nameFromText(fixture("copied-gsmarena-galaxy-s26-ultra.txt"))).toBe("Samsung Galaxy S26 Ultra 5G");
    expect(nameFromText(fixture("copied-loose-galaxy-s26-ultra.txt"))).toBe("Samsung Galaxy S26 Ultra 5G");
    expect(nameFromText("Some page without a phone")).toBeNull();
  });
});

describe("parseSpecsText", () => {
  it("reads a whole GSMArena page copied from the browser", () => {
    const { specs, found } = parseSpecsText(fixture("copied-gsmarena-galaxy-s26-ultra.txt"));
    expect(specs).toEqual({
      brand: "Samsung",
      name: "Galaxy S26 Ultra 5G",
      aliases: ["SM-S948B", "SM-S948B/DS", "SM-S948U", "SM-S948U1", "SM-S948W", "SM-S948N", "SM-S9480", "SM-S948E", "SM-S948E/DS"],
      os: "Android",
      launchYear: 2026,
      chipset: "Snapdragon 8 Elite Gen 5",
      performance: 4,
      displayInches: 6.9,
      displayType: "Dynamic LTPO AMOLED 2X",
      refreshHz: 120,
      mainCameraMp: 200,
      cameraSummary: "200MP + 10MP telephoto + 50MP periscope + 50MP ultra-wide",
      frontCameraMp: 12,
      batteryMah: 5000,
      chargingW: 60,
      has5g: true,
      variants: [
        { ramGb: 12, storageGb: 256, launchPriceInr: null },
        { ramGb: 12, storageGb: 512, launchPriceInr: null },
        { ramGb: 16, storageGb: 1024, launchPriceInr: null },
      ],
      sourceUrls: [],
    });
    expect(found).toBe(10);
  });

  it("reads loose text from other spec sites with patterns", () => {
    const { specs, found } = parseSpecsText(fixture("copied-loose-galaxy-s26-ultra.txt"));
    expect(specs).toMatchObject({
      brand: "Samsung",
      name: "Galaxy S26 Ultra 5G",
      chipset: "Snapdragon 8 Elite Gen 5",
      performance: 4,
      displayInches: 6.9,
      displayType: "Dynamic AMOLED 2X",
      refreshHz: 120,
      mainCameraMp: 200,
      frontCameraMp: 12,
      batteryMah: 5000,
      chargingW: 60,
      launchYear: 2026,
      has5g: true,
      variants: [
        { ramGb: 12, storageGb: 256, launchPriceInr: null },
        { ramGb: 12, storageGb: 512, launchPriceInr: null },
        { ramGb: 16, storageGb: 1024, launchPriceInr: null },
      ],
    });
    expect(found).toBe(10);
  });

  it("uses the typed name when the text has none, and handles iPhones", () => {
    const { specs } = parseSpecsText(
      "Display\tType\tSuper Retina XDR OLED\n\tSize\t6.1 inches\nPlatform\tOS\tiOS 17\n\tChipset\tApple A16 Bionic (4 nm)\nMemory\tInternal\t128GB 6GB RAM, 256GB 6GB RAM",
      "iPhone 15",
    );
    expect(specs).toMatchObject({
      brand: "Apple",
      name: "iPhone 15",
      os: "iOS",
      chipset: "A16 Bionic",
      performance: 4,
      displayInches: 6.1,
      variants: [
        { ramGb: null, storageGb: 128 },
        { ramGb: null, storageGb: 256 },
      ],
    });
  });

  it("finds little in text that isn't about a phone", () => {
    const { specs, found } = parseSpecsText("Welcome to our shop. Opening hours 9 to 9. Call us for the best prices!", "Galaxy A54");
    expect(found).toBe(0);
    expect(specs).toMatchObject({ brand: "Samsung", name: "Galaxy A54", chipset: null, batteryMah: null, variants: [] });
  });
});

describe("trimForAi", () => {
  it("keeps the part around the specs", () => {
    const text = `${"x".repeat(20_000)}\nNetwork\tTechnology\t5G\n${"y".repeat(20_000)}`;
    const cut = trimForAi(text);
    expect(cut.length).toBe(14_000);
    expect(cut).toContain("Network\tTechnology");
    expect(trimForAi("short")).toBe("short");
  });
});
