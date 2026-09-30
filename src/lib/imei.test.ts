import { describe, expect, it } from "vitest";
import { containsImei, fieldWithImei, maskImeis } from "./imei";

describe("containsImei", () => {
  it("finds a 15-digit IMEI with a valid check digit", () => {
    expect(containsImei("490154203237518")).toBe(true);
    expect(containsImei("IMEI: 490154203237518, checked")).toBe(true);
    expect(containsImei("IMEI490154203237518")).toBe(true);
  });

  it("finds IMEIs written with spaces or dashes", () => {
    expect(containsImei("49-015420-323751-8")).toBe(true);
    expect(containsImei("4901 5420 3237 518")).toBe(true);
  });

  it("finds two IMEIs next to each other (dual SIM)", () => {
    expect(containsImei("490154203237518 356938035643809")).toBe(true);
  });

  it("finds a 16-digit IMEISV", () => {
    expect(containsImei("3569380356438091")).toBe(true);
  });

  it("ignores ordinary numbers", () => {
    expect(containsImei("")).toBe(false);
    expect(containsImei(null)).toBe(false);
    expect(containsImei("Battery 88%, bought on 12-03-2024, call 9876543210")).toBe(false);
    expect(containsImei("KYM result ok, ref 20260930")).toBe(false);
    // 15 digits but the check digit is wrong: not an IMEI
    expect(containsImei("490154203237519")).toBe(false);
  });
});

describe("maskImeis", () => {
  it("removes IMEIs and keeps the rest", () => {
    expect(maskImeis("Redmi Note 12, IMEI 490154203237518")).toBe("Redmi Note 12, IMEI [IMEI removed]");
    expect(maskImeis("Galaxy A54 128GB")).toBe("Galaxy A54 128GB");
  });
});

describe("fieldWithImei", () => {
  it("names the first field that has an IMEI", () => {
    expect(fieldWithImei({ Colour: "Black", Notes: "IMEI 490154203237518" })).toBe("Notes");
    expect(fieldWithImei({ Colour: "Black", Notes: "Small scratch" })).toBeNull();
  });
});
