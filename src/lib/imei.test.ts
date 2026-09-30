import { describe, expect, it } from "vitest";
import { normalizeImei } from "./imei";

describe("normalizeImei", () => {
  it("accepts a valid IMEI", () => {
    expect(normalizeImei("490154203237518")).toBe("490154203237518");
  });

  it("ignores spaces and dashes", () => {
    expect(normalizeImei("49-015420-323751-8")).toBe("490154203237518");
    expect(normalizeImei(" 4901 5420 3237 518 ")).toBe("490154203237518");
  });

  it("rejects a wrong check digit", () => {
    expect(normalizeImei("490154203237519")).toBeNull();
  });

  it("rejects the wrong length", () => {
    expect(normalizeImei("49015420323751")).toBeNull();
    expect(normalizeImei("4901542032375180")).toBeNull();
    expect(normalizeImei("")).toBeNull();
  });
});
