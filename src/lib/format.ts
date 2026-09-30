/** Small formatting helpers shared by server and client code. */

const inrFormatter = new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 });

/** ₹32,999 / ₹1,24,999 (Indian digit grouping) */
export function formatInr(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  return `₹${inrFormatter.format(Math.round(value))}`;
}

export function formatNumber(value: number): string {
  return inrFormatter.format(value);
}

export function formatStorage(gb: number | null | undefined): string {
  if (!gb) return "";
  return gb >= 1024 ? `${gb / 1024} TB` : `${gb} GB`;
}

export function formatVariant(ramGb: number | null | undefined, storageGb: number | null | undefined): string {
  const storage = formatStorage(storageGb);
  if (ramGb && storage) return `${ramGb} GB RAM, ${storage}`;
  return storage;
}

export function formatDate(value: Date | string | null | undefined, lang: "en" | "te" = "en"): string {
  if (!value) return "";
  const date = typeof value === "string" ? new Date(value) : value;
  return new Intl.DateTimeFormat(lang === "te" ? "te-IN" : "en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "Asia/Kolkata",
  }).format(date);
}

export function formatDateTime(value: Date | string | null | undefined, lang: "en" | "te" = "en"): string {
  if (!value) return "";
  const date = typeof value === "string" ? new Date(value) : value;
  return new Intl.DateTimeFormat(lang === "te" ? "te-IN" : "en-IN", {
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "Asia/Kolkata",
  }).format(date);
}

/** Relative "3 days ago" style text in English; used in admin only. */
export function timeAgo(value: Date | string | null | undefined): string {
  if (!value) return "";
  const date = typeof value === "string" ? new Date(value) : value;
  const seconds = Math.round((Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  const days = Math.round(hours / 24);
  if (days < 30) return `${days} day${days === 1 ? "" : "s"} ago`;
  return formatDate(date);
}

export function slugify(input: string): string {
  return input
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);
}

/**
 * Normalises an Indian mobile number to 10 digits. Returns null when the
 * input is not a valid Indian mobile number.
 */
export function normalizeIndianMobile(input: string): string | null {
  const digits = input.replace(/\D/g, "");
  const ten = digits.length === 12 && digits.startsWith("91") ? digits.slice(2) : digits.length === 11 && digits.startsWith("0") ? digits.slice(1) : digits;
  if (!/^[6-9]\d{9}$/.test(ten)) return null;
  return ten;
}

export function displayMobile(ten: string): string {
  if (!/^\d{10}$/.test(ten)) return ten;
  return `+91 ${ten.slice(0, 5)} ${ten.slice(5)}`;
}

/** wa.me link. `phone` must be digits with country code. */
export function whatsappLink(phone: string, text?: string): string {
  const digits = phone.replace(/\D/g, "");
  const base = digits ? `https://wa.me/${digits}` : "https://wa.me/";
  return text ? `${base}?text=${encodeURIComponent(text)}` : base;
}

export function telLink(phone: string): string {
  return `tel:${phone.replace(/[^\d+]/g, "")}`;
}

export function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}
