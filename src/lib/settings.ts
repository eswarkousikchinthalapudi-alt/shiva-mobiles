import "server-only";
import { eq } from "drizzle-orm";
import { headers } from "next/headers";
import { cache } from "react";
import { getDb, schema } from "@/db";
import { withDefaults } from "@/lib/pricing";

export type ShopSettings = typeof schema.shopSettings.$inferSelect;

const DEFAULTS: ShopSettings = {
  id: 1,
  shopName: "Shiva Mobiles",
  taglineEn: "Checked second-hand phones with shop warranty.",
  taglineTe: "పరీక్షించిన సెకండ్ హ్యాండ్ ఫోన్లు, షాప్ వారంటీతో.",
  phone: "",
  whatsapp: "",
  addressEn: "",
  addressTe: "",
  town: "",
  mapUrl: "",
  hoursEn: "",
  hoursTe: "",
  googleReviewUrl: "",
  gstin: "",
  siteUrl: "",
  defaultWarrantyMonths: 3,
  retentionDays: 365,
  pricing: null,
  updatedAt: new Date(0),
};

export const getShopSettings = cache(async (): Promise<ShopSettings> => {
  const db = await getDb();
  const rows = await db.select().from(schema.shopSettings).where(eq(schema.shopSettings.id, 1)).limit(1);
  const row = rows[0];
  if (!row) return DEFAULTS;
  return { ...row, pricing: withDefaults(row.pricing) };
});

let warnedSiteUrl = false;

/**
 * Public base URL used in WhatsApp posts, bills and sitemap links. Set it in
 * Shop settings or with SITE_URL. Until then, the address of the current
 * request is used.
 */
export async function getSiteUrl(): Promise<string> {
  const settings = await getShopSettings();
  // RENDER_EXTERNAL_URL is set automatically on Render (https://<name>.onrender.com).
  const configured = settings.siteUrl || process.env.SITE_URL || process.env.RENDER_EXTERNAL_URL;
  if (configured) return configured.replace(/\/+$/, "");
  if (process.env.NODE_ENV === "production" && !warnedSiteUrl) {
    warnedSiteUrl = true;
    console.warn("[settings] Website address is not set. Set SITE_URL or fill it in Shop settings.");
  }
  try {
    const h = await headers();
    const host = h.get("x-forwarded-host") ?? h.get("host");
    if (host && /^[a-z0-9.-]+(:\d{1,5})?$/i.test(host)) {
      const proto =
        h.get("x-forwarded-proto") === "https" || (process.env.NODE_ENV === "production" && h.get("x-forwarded-proto") !== "http") ? "https" : "http";
      return `${proto}://${host}`;
    }
  } catch {
    // Outside a request (scripts): fall through.
  }
  return "http://localhost:3000";
}
