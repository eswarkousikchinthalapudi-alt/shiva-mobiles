/** Date helpers that work in shop time (India, UTC+05:30) whatever the server's time zone. */

const IST = "Asia/Kolkata";

/** "2026-09-29" for the given moment, in India time. */
export function istDateString(date: Date = new Date()): string {
  return date.toLocaleDateString("en-CA", { timeZone: IST });
}

/** "2026-09" for the given moment, in India time. */
export function istMonthString(date: Date = new Date()): string {
  return istDateString(date).slice(0, 7);
}

export function isMonthString(value: unknown): value is string {
  return typeof value === "string" && /^\d{4}-(0[1-9]|1[0-2])$/.test(value);
}

/** Moves "2026-09" by whole months: shiftMonth("2026-01", -1) = "2025-12". */
export function shiftMonth(month: string, by: number): string {
  const [y, m] = month.split("-").map(Number);
  const index = y * 12 + (m - 1) + by;
  return `${Math.floor(index / 12)}-${String((index % 12) + 1).padStart(2, "0")}`;
}

/** The exact start and end moments of a month in India time. */
export function istMonthRange(month: string): { start: Date; end: Date } {
  return {
    start: new Date(`${month}-01T00:00:00+05:30`),
    end: new Date(`${shiftMonth(month, 1)}-01T00:00:00+05:30`),
  };
}

/** "September 2026" */
export function monthLabel(month: string, lang: "en" | "te" = "en"): string {
  return new Intl.DateTimeFormat(lang === "te" ? "te-IN" : "en-IN", { month: "long", year: "numeric", timeZone: "UTC" }).format(
    new Date(`${month}-15T00:00:00Z`),
  );
}

/**
 * Adds months to a "YYYY-MM-DD" date, keeping the day where possible:
 * 31 Jan + 1 month = 28 (or 29) Feb, not 3 March.
 */
export function addMonthsToDate(isoDate: string, months: number): string {
  const [y, m, d] = isoDate.split("-").map(Number);
  const index = y * 12 + (m - 1) + months;
  const year = Math.floor(index / 12);
  const month = (index % 12) + 1;
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return `${year}-${String(month).padStart(2, "0")}-${String(Math.min(d, lastDay)).padStart(2, "0")}`;
}

/** Whole days from today (India time) until a "YYYY-MM-DD" date; negative once it has passed. */
export function daysUntil(isoDate: string, now: Date = new Date()): number {
  const today = Date.parse(`${istDateString(now)}T00:00:00Z`);
  return Math.round((Date.parse(`${isoDate}T00:00:00Z`) - today) / 86400000);
}
