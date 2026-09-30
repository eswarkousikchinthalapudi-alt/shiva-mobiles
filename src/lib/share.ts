import "server-only";
import { asc, eq } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { formatInr } from "@/lib/format";
import { fullModelName, mediaUrl } from "@/lib/listings";
import { testSummary } from "@/lib/phone-tests";
import { getShopSettings, getSiteUrl } from "@/lib/settings";

export async function shareDataByCode(code: string) {
  if (!/^[A-Z]{2}-\d{3,6}$/.test(code)) return null;
  const db = await getDb();
  const rows = await db
    .select({ listing: schema.listings, model: schema.phoneModels })
    .from(schema.listings)
    .innerJoin(schema.phoneModels, eq(schema.phoneModels.id, schema.listings.modelId))
    .where(eq(schema.listings.code, code))
    .limit(1);
  const row = rows[0];
  if (!row) return null;
  const photos = await db
    .select()
    .from(schema.listingPhotos)
    .where(eq(schema.listingPhotos.listingId, row.listing.id))
    .orderBy(asc(schema.listingPhotos.position));
  const [settings, siteUrl] = await Promise.all([getShopSettings(), getSiteUrl()]);
  const l = row.listing;
  const name = fullModelName(row.model.brand, row.model.name);
  const storage = l.storageGb >= 1024 ? `${l.storageGb / 1024} TB` : `${l.storageGb} GB`;
  const variant = l.ramGb ? `${l.ramGb}/${storage}` : storage;
  const tests = testSummary(l.tests);
  const pageUrl = `${siteUrl}/phones/${l.slug}?src=wa`;
  const gradeEn = { A: "Like new", B: "Good", C: "Fair" }[l.grade];
  const gradeTe = { A: "కొత్తదానిలా", B: "బాగుంది", C: "పర్వాలేదు" }[l.grade];
  const boxEn = [l.hasBox && "Box", l.hasCharger && "Charger", l.hasBill && "Bill"].filter(Boolean).join(" + ");
  const boxTe = [l.hasBox && "బాక్స్", l.hasCharger && "ఛార్జర్", l.hasBill && "బిల్"].filter(Boolean).join(" + ");
  const contact = settings.phone ? ` · Call/WhatsApp ${settings.phone}` : "";
  const contactTe = settings.phone ? ` · కాల్/వాట్సాప్ ${settings.phone}` : "";

  const lines = (list: (string | false | null)[]) => list.filter(Boolean).join("\n");

  const captionEn = lines([
    `📱 ${name} · ${variant}${l.color ? ` · ${l.color}` : ""}`,
    `💰 ${formatInr(l.priceInr)}${l.launchPriceInr && l.launchPriceInr > l.priceInr ? ` (new price ${formatInr(l.launchPriceInr)})` : ""}`,
    `✅ IMEI verified · ${tests.passed}/${tests.tested} tests passed`,
    `🔋 ${l.batteryHealth ? `Battery ${l.batteryHealth}%` : "Battery checked"} · Grade ${l.grade} (${gradeEn})`,
    l.warrantyMonths > 0 && `🛡️ ${l.warrantyMonths} month${l.warrantyMonths === 1 ? "" : "s"} shop warranty`,
    boxEn && `📦 ${boxEn}`,
    `👉 Photos and details: ${pageUrl}`,
    `📍 ${settings.shopName}${settings.town ? `, ${settings.town}` : ""}${contact}`,
  ]);

  const captionTe = lines([
    `📱 ${name} · ${variant}${l.color ? ` · ${l.color}` : ""}`,
    `💰 ${formatInr(l.priceInr)}${l.launchPriceInr && l.launchPriceInr > l.priceInr ? ` (కొత్త ధర ${formatInr(l.launchPriceInr)})` : ""}`,
    `✅ IMEI వెరిఫైడ్ · ${tests.tested}లో ${tests.passed} పరీక్షలు పాస్`,
    `🔋 ${l.batteryHealth ? `బ్యాటరీ ${l.batteryHealth}%` : "బ్యాటరీ చెక్ చేశాం"} · గ్రేడ్ ${l.grade} (${gradeTe})`,
    l.warrantyMonths > 0 && `🛡️ ${l.warrantyMonths} నెలల షాప్ వారంటీ`,
    boxTe && `📦 ${boxTe}`,
    `👉 ఫోటోలు, వివరాలు: ${pageUrl}`,
    `📍 ${settings.shopName}${settings.town ? `, ${settings.town}` : ""}${contactTe}`,
  ]);

  return {
    listing: l,
    model: row.model,
    name,
    variant,
    tests,
    settings,
    pageUrl,
    captionEn,
    captionTe,
    posterUrl: `/api/listings/${l.code}/poster`,
    photoUrls: photos.map((p) => mediaUrl(p.lgId)),
    firstPhotoId: photos[0]?.lgId ?? null,
  };
}
