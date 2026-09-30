/**
 * IMEI numbers are never stored on the website. Staff check the IMEI on the
 * phone itself and record only the result. These helpers catch an IMEI typed
 * into a free-text box by mistake, so it doesn't end up saved anyway.
 */

function luhnValid(digits: string): boolean {
  let sum = 0;
  for (let i = 0; i < digits.length; i++) {
    let d = Number(digits[digits.length - 1 - i]);
    if (i % 2 === 1) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    sum += d;
  }
  return sum % 10 === 0;
}

/** A 15-digit IMEI (with a valid check digit) or a 16-digit IMEISV. */
function isImeiLike(digits: string): boolean {
  return (digits.length === 15 && luhnValid(digits)) || digits.length === 16;
}

/** Runs of digits, allowing single spaces, dots, slashes or dashes between them (e.g. 49-015420-323751-8). */
const NUMBER_SEGMENT = /\d(?:[ ./-]?\d)*/g;

function segmentHasImei(segment: string): boolean {
  if (isImeiLike(segment.replace(/\D/g, ""))) return true;
  return segment.split(/[ ./-]/).some(isImeiLike);
}

export function containsImei(text: string | null | undefined): boolean {
  if (!text) return false;
  for (const match of text.matchAll(NUMBER_SEGMENT)) {
    if (match[0].replace(/\D/g, "").length >= 15 && segmentHasImei(match[0])) return true;
  }
  return false;
}

/** Replaces anything that looks like an IMEI, for text typed by customers. */
export function maskImeis(text: string): string {
  return text.replace(NUMBER_SEGMENT, (segment) => (segment.replace(/\D/g, "").length >= 15 && segmentHasImei(segment) ? "[IMEI removed]" : segment));
}

/** Returns the label of the first field that contains an IMEI, or null. */
export function fieldWithImei(fields: Record<string, string | null | undefined>): string | null {
  for (const [label, value] of Object.entries(fields)) if (containsImei(value)) return label;
  return null;
}

export const IMEI_NOT_SAVED = "has what looks like an IMEI number. IMEI numbers are not saved on the website, so please remove it.";
