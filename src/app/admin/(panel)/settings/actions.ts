"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import { getDb, schema } from "@/db";
import { audit } from "@/lib/audit";
import { getAdminOrNull } from "@/lib/auth/dal";
import { getShopSettings } from "@/lib/settings";

const httpsUrl = (label: string) =>
  z
    .string()
    .trim()
    .max(500)
    .refine((v) => v === "" || /^https:\/\/[^\s]+$/i.test(v), `${label} must start with https://`);

const settingsSchema = z.object({
  shopName: z.string().trim().min(2, "Enter the shop name.").max(60),
  taglineEn: z.string().trim().max(120),
  taglineTe: z.string().trim().max(120),
  phone: z
    .string()
    .trim()
    .max(20)
    .refine((v) => v === "" || /^[+\d][\d\s-]{7,19}$/.test(v), "Phone number can only have digits, spaces, + and -."),
  whatsapp: z.string().trim().max(20),
  addressEn: z.string().trim().max(200),
  addressTe: z.string().trim().max(200),
  town: z.string().trim().max(60),
  mapUrl: httpsUrl("Map link"),
  hoursEn: z.string().trim().max(120),
  hoursTe: z.string().trim().max(120),
  googleReviewUrl: httpsUrl("Google review link"),
  gstin: z
    .string()
    .trim()
    .toUpperCase()
    .refine((v) => v === "" || /^\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/.test(v), "GSTIN should look like 37ABCDE1234F1Z5."),
  siteUrl: z
    .string()
    .trim()
    .max(200)
    .refine(
      (v) => v === "" || /^https:\/\/[a-z0-9.-]+(:\d+)?\/?$/i.test(v) || /^http:\/\/localhost(:\d+)?\/?$/.test(v),
      "Website address should look like https://shivamobiles.in",
    ),
  showPrices: z.boolean(),
  defaultWarrantyMonths: z.number().int().min(0).max(24),
  retentionDays: z.number().int().min(30, "Keep requests for at least 30 days.").max(3650),
});

export type SettingsInput = z.infer<typeof settingsSchema>;

/** Accepts "+91 98765 43210", "9876543210" or "919876543210"; returns digits with country code. */
function normalizeWhatsapp(input: string): string | null {
  const digits = input.replace(/\D/g, "");
  if (!digits) return "";
  if (/^[6-9]\d{9}$/.test(digits)) return `91${digits}`;
  if (/^0[6-9]\d{9}$/.test(digits)) return `91${digits.slice(1)}`;
  if (/^\d{11,15}$/.test(digits)) return digits;
  return null;
}

export async function saveSettingsAction(input: SettingsInput): Promise<{ ok: true } | { ok: false; error: string }> {
  const admin = await getAdminOrNull({ role: "owner" });
  if (!admin) return { ok: false, error: "Only the owner can change shop settings." };
  const parsed = settingsSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Check the form." };
  const whatsapp = normalizeWhatsapp(parsed.data.whatsapp);
  if (whatsapp === null) return { ok: false, error: "WhatsApp number should be a 10-digit mobile number." };
  const data = { ...parsed.data, whatsapp, siteUrl: parsed.data.siteUrl.replace(/\/+$/, "") };

  const before = await getShopSettings();
  const changed = (Object.keys(data) as (keyof typeof data)[]).filter((key) => before[key] !== data[key]);
  const db = await getDb();
  await db
    .insert(schema.shopSettings)
    .values({ id: 1, ...data, updatedAt: new Date() })
    .onConflictDoUpdate({ target: schema.shopSettings.id, set: { ...data, updatedAt: new Date() } });
  await audit(admin, "settings_changed", { entity: "settings", details: { changed } });
  refresh();
  return { ok: true };
}
