import { describe, expect, it } from "vitest";
import { addMonthsToDate, daysUntil, isMonthString, istDateString, istMonthRange, shiftMonth } from "./dates";

describe("India-time dates", () => {
  it("uses the India date near midnight", () => {
    // 20:00 UTC on 28 Sept is 01:30 on 29 Sept in India.
    expect(istDateString(new Date("2026-09-28T20:00:00Z"))).toBe("2026-09-29");
    expect(istDateString(new Date("2026-09-28T18:00:00Z"))).toBe("2026-09-28");
  });

  it("gives month boundaries in India time", () => {
    const { start, end } = istMonthRange("2026-09");
    expect(start.toISOString()).toBe("2026-08-31T18:30:00.000Z");
    expect(end.toISOString()).toBe("2026-09-30T18:30:00.000Z");
  });

  it("moves between months and years", () => {
    expect(shiftMonth("2026-01", -1)).toBe("2025-12");
    expect(shiftMonth("2026-12", 1)).toBe("2027-01");
    expect(shiftMonth("2026-05", 14)).toBe("2027-07");
  });

  it("checks month strings", () => {
    expect(isMonthString("2026-09")).toBe(true);
    expect(isMonthString("2026-13")).toBe(false);
    expect(isMonthString("2026-9")).toBe(false);
    expect(isMonthString(null)).toBe(false);
  });
});

describe("addMonthsToDate", () => {
  it("adds months", () => {
    expect(addMonthsToDate("2026-09-29", 3)).toBe("2026-12-29");
    expect(addMonthsToDate("2026-11-15", 3)).toBe("2027-02-15");
  });

  it("stays in the right month at month ends", () => {
    expect(addMonthsToDate("2026-01-31", 1)).toBe("2026-02-28");
    expect(addMonthsToDate("2028-01-31", 1)).toBe("2028-02-29");
    expect(addMonthsToDate("2026-08-31", 1)).toBe("2026-09-30");
  });

  it("returns the same date for zero months", () => {
    expect(addMonthsToDate("2026-09-29", 0)).toBe("2026-09-29");
  });
});

describe("daysUntil", () => {
  const now = new Date("2026-09-29T06:00:00Z");
  it("counts whole days in India time", () => {
    expect(daysUntil("2026-09-29", now)).toBe(0);
    expect(daysUntil("2026-10-09", now)).toBe(10);
    expect(daysUntil("2026-09-20", now)).toBe(-9);
  });
});
