"use server";

import { and, eq, inArray, isNull, or } from "drizzle-orm";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getDb, schema } from "@/db";
import { nextCounter, pad } from "@/db/helpers";
import type { ListingStatus, PaymentMode } from "@/db/schema";
import { audit } from "@/lib/audit";
import { addMonthsToDate, istDateString } from "@/lib/dates";
import { createModel, findDuplicateModel, getModelOption, modelInputSchema, searchCatalog, type ModelInput, type ModelOption } from "@/lib/admin/catalog";
import { getAdminOrNull } from "@/lib/auth/dal";
import { fieldWithImei, IMEI_NOT_SAVED } from "@/lib/imei";
import { deleteMedia } from "@/lib/media";
import { PHONE_TESTS } from "@/lib/phone-tests";
import { fullModelName } from "@/lib/listings";
import { formatInr, normalizeIndianMobile, slugify } from "@/lib/format";
import { newBillToken, saleItemFrom } from "@/lib/sales";
import { rateLimit } from "@/lib/security/rate-limit";
import { getShopSettings, getSiteUrl } from "@/lib/settings";
import { looksLikeLink, lookupSpecs, type SpecsFound } from "@/lib/specs";
import { SHOP_TAGS } from "@/lib/tags";

export type ActionResult<T = undefined> = { ok: true; data?: T } | { ok: false; error: string };

const uuid = z.string().uuid();

// ---------------------------------------------------------------------------
// Catalog
// ---------------------------------------------------------------------------

export async function searchModelsAction(query: string): Promise<ModelOption[]> {
  const admin = await getAdminOrNull();
  if (!admin) return [];
  return searchCatalog(String(query ?? "").slice(0, 60), 8);
}

/** A pasted GSMArena link is read directly; a name or model number goes to the AI lookup (when it's switched on). */
export async function lookupSpecsAction(query: string): Promise<ActionResult<SpecsFound>> {
  const admin = await getAdminOrNull();
  if (!admin) return { ok: false, error: "Please log in again." };
  const text = String(query ?? "").slice(0, 500);
  const isLink = looksLikeLink(text);
  // AI lookups cost money, so they get a daily cap; GSMArena gets a gentle pace so we never hammer their site.
  const limit = isLink ? await rateLimit(`specs-link:${admin.id}`, 60, 24 * 3600) : await rateLimit(`specs:${admin.id}`, 40, 24 * 3600);
  if (!limit.allowed) return { ok: false, error: "Daily limit for specs lookups reached. Try again tomorrow or add the specs by hand." };
  if (isLink && !(await rateLimit("specs-link:all", 20, 10 * 60)).allowed) {
    return { ok: false, error: "Lots of GSMArena lookups in the last few minutes. Wait a little and try again." };
  }
  const result = await lookupSpecs(text);
  await audit(admin, result.ok ? "specs_lookup" : "specs_lookup_failed", {
    details: { query: text.slice(0, 120), source: isLink ? "gsmarena" : "ai" },
  });
  return result;
}

export async function createModelAction(input: ModelInput, source: "ai" | "gsmarena" | "manual"): Promise<ActionResult<ModelOption>> {
  const admin = await getAdminOrNull();
  if (!admin) return { ok: false, error: "Please log in again." };
  const parsed = modelInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Check the specs." };
  const duplicate = await findDuplicateModel(parsed.data.brand, parsed.data.name);
  if (duplicate) {
    const existing = await getModelOption(duplicate.id);
    if (existing) return { ok: true, data: existing };
  }
  const id = await createModel(parsed.data, source === "ai" || source === "gsmarena" ? source : "manual");
  await audit(admin, "model_created", { entity: "phone_model", entityId: id, details: { brand: parsed.data.brand, name: parsed.data.name, source } });
  const option = await getModelOption(id);
  return option ? { ok: true, data: option } : { ok: false, error: "Could not save the model." };
}

// ---------------------------------------------------------------------------
// Listings
// ---------------------------------------------------------------------------

const photoSchema = z.object({
  smId: uuid,
  mdId: uuid,
  lgId: uuid,
  width: z.number().int().min(1).max(10000),
  height: z.number().int().min(1).max(10000),
});

const testsSchema = z
  .record(z.string(), z.boolean())
  .refine((value) => Object.keys(value).every((k) => (PHONE_TESTS as readonly string[]).includes(k)), "Unknown test");

const listingSchema = z.object({
  id: uuid.nullable(),
  modelId: uuid,
  ramGb: z.number().int().min(1).max(32).nullable(),
  storageGb: z.number().int().min(8).max(2048),
  color: z.string().trim().max(40),
  launchPriceInr: z.number().int().min(0).max(500000).nullable(),
  grade: z.enum(["A", "B", "C"]),
  batteryHealth: z.number().int().min(40).max(100).nullable(),
  batteryNote: z.string().trim().max(120).nullable(),
  tests: testsSchema,
  hasBox: z.boolean(),
  hasCharger: z.boolean(),
  hasBill: z.boolean(),
  warrantyMonths: z.number().int().min(0).max(24),
  brandWarrantyUntil: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .nullable(),
  priceInr: z.number().int().min(100, "Enter the selling price").max(500000),
  costInr: z.number().int().min(0).max(500000).nullable(),
  shopTags: z.array(z.enum(SHOP_TAGS)).max(5),
  notesEn: z.string().trim().max(1000),
  notesTe: z.string().trim().max(1000),
  featured: z.boolean(),
  imeiStatus: z.enum(["pending", "clear", "blocked"]),
  imeiCheckRef: z.string().trim().max(60).nullable(),
  photos: z.array(photoSchema).max(12),
  publish: z.boolean(),
  sourceRequestId: uuid.nullable().optional(),
});

export type ListingInput = z.infer<typeof listingSchema>;

export async function saveListingAction(input: ListingInput): Promise<ActionResult<{ id: string }>> {
  const admin = await getAdminOrNull();
  if (!admin) return { ok: false, error: "Please log in again." };
  const parsed = listingSchema.safeParse(input);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return { ok: false, error: issue ? `${issue.path.join(".") || "Form"}: ${issue.message}` : "Check the form." };
  }
  const data = parsed.data;
  const db = await getDb();

  const model = await getModelOption(data.modelId);
  if (!model) return { ok: false, error: "Pick the phone model again." };

  const existing = data.id ? (await db.select().from(schema.listings).where(eq(schema.listings.id, data.id)).limit(1))[0] : null;
  if (data.id && !existing) return { ok: false, error: "This phone no longer exists." };
  if (existing?.status === "sold")
    return { ok: false, error: "This phone is sold, so its details are locked and the bill stays correct. Cancel the sale first if something must change." };

  // IMEI check: only the result is saved, never the IMEI number.
  const imeiField = fieldWithImei({
    "Check reference": data.imeiCheckRef,
    "Notes for customers": data.notesEn,
    "Notes in Telugu": data.notesTe,
    "Battery note": data.batteryNote,
    Colour: data.color,
  });
  if (imeiField) return { ok: false, error: `${imeiField} ${IMEI_NOT_SAVED}` };
  if (data.imeiStatus === "blocked" && data.publish) {
    return { ok: false, error: "This phone's IMEI is blocked. It can't be listed for sale." };
  }
  if (data.publish) {
    if (data.imeiStatus !== "clear") return { ok: false, error: "Check the IMEI in the government database and mark it clear before publishing." };
    if (data.photos.length === 0) return { ok: false, error: "Add at least one photo before publishing." };
  }

  // Photos must exist, be public, and not belong to another phone.
  const lgIds = data.photos.flatMap((p) => [p.smId, p.mdId, p.lgId]);
  if (lgIds.length) {
    const found = await db.select({ id: schema.media.id, isPrivate: schema.media.isPrivate }).from(schema.media).where(inArray(schema.media.id, lgIds));
    if (found.length !== new Set(lgIds).size || found.some((m) => m.isPrivate)) return { ok: false, error: "A photo is missing. Upload it again." };
    const ids = new Set(lgIds);
    const inUse = await db
      .select({ listingId: schema.listingPhotos.listingId, smId: schema.listingPhotos.smId, mdId: schema.listingPhotos.mdId, lgId: schema.listingPhotos.lgId })
      .from(schema.listingPhotos)
      .where(or(inArray(schema.listingPhotos.smId, lgIds), inArray(schema.listingPhotos.mdId, lgIds), inArray(schema.listingPhotos.lgId, lgIds)));
    if (inUse.some((t) => t.listingId !== data.id && (ids.has(t.smId) || ids.has(t.mdId) || ids.has(t.lgId)))) {
      return { ok: false, error: "A photo belongs to another phone. Upload it again." };
    }
    // Each photo's three sizes must come from the same upload.
    const known = new Map(inUse.filter((t) => t.listingId === data.id).map((t) => [t.lgId, t]));
    for (const p of data.photos) {
      const saved = known.get(p.lgId);
      if (saved && (saved.smId !== p.smId || saved.mdId !== p.mdId)) return { ok: false, error: "A photo is mixed up. Remove it and upload it again." };
    }
  }

  const now = new Date();
  const isOwner = admin.role === "owner";
  // The check date moves when the result changes, and is cleared when it goes back to "not checked".
  const imeiCheckedAt = data.imeiStatus === "pending" ? null : data.imeiStatus !== existing?.imeiStatus ? now : (existing?.imeiCheckedAt ?? now);

  const common = {
    modelId: data.modelId,
    ramGb: data.ramGb,
    storageGb: data.storageGb,
    color: data.color,
    grade: data.grade,
    batteryHealth: data.batteryHealth,
    batteryNote: data.batteryNote || null,
    priceInr: data.priceInr,
    launchPriceInr: data.launchPriceInr,
    warrantyMonths: data.warrantyMonths,
    brandWarrantyUntil: data.brandWarrantyUntil,
    hasBox: data.hasBox,
    hasCharger: data.hasCharger,
    hasBill: data.hasBill,
    tests: data.tests,
    notesEn: data.notesEn,
    notesTe: data.notesTe,
    shopTags: data.shopTags,
    featured: data.featured,
    imeiStatus: data.imeiStatus,
    imeiCheckRef: data.imeiCheckRef || null,
    imeiCheckedAt,
    updatedAt: now,
  };

  let listingId: string;
  if (!existing) {
    const code = `SM-${pad(await nextCounter("listing"))}`;
    const storage = data.storageGb >= 1024 ? `${data.storageGb / 1024}tb` : `${data.storageGb}gb`;
    const [row] = await db
      .insert(schema.listings)
      .values({
        ...common,
        code,
        slug: `${slugify(model.fullName)}-${storage}-${code.toLowerCase()}`,
        costInr: isOwner ? data.costInr : null,
        status: data.publish ? "available" : "draft",
        publishedAt: data.publish ? now : null,
        sourceRequestId: data.sourceRequestId ?? null,
        createdBy: admin.id,
      })
      .returning({ id: schema.listings.id });
    listingId = row.id;
    await audit(admin, data.publish ? "listing_published" : "listing_created", {
      entity: "listing",
      entityId: listingId,
      details: { code, price: data.priceInr },
    });
  } else {
    listingId = existing.id;
    const priceChange =
      data.priceInr < existing.priceInr && existing.status !== "draft"
        ? { previousPriceInr: existing.priceInr, priceDroppedAt: now }
        : data.priceInr > existing.priceInr
          ? { previousPriceInr: null, priceDroppedAt: null }
          : {};
    let status: ListingStatus = existing.status;
    let publishedAt = existing.publishedAt;
    if (data.publish && (existing.status === "draft" || existing.status === "hidden")) {
      status = "available";
      publishedAt = publishedAt ?? now;
    }
    if (data.imeiStatus === "blocked") status = "hidden";
    let slug = existing.slug;
    if (existing.status === "draft" && !existing.publishedAt) {
      const storage = data.storageGb >= 1024 ? `${data.storageGb / 1024}tb` : `${data.storageGb}gb`;
      slug = `${slugify(model.fullName)}-${storage}-${existing.code.toLowerCase()}`;
    }
    await db
      .update(schema.listings)
      .set({
        ...common,
        ...priceChange,
        slug,
        status,
        publishedAt,
        costInr: isOwner ? data.costInr : existing.costInr,
      })
      .where(eq(schema.listings.id, listingId));
    const changes: Record<string, unknown> = {};
    if (existing.priceInr !== data.priceInr) changes.price = `${existing.priceInr} → ${data.priceInr}`;
    if (existing.status !== status) changes.status = `${existing.status} → ${status}`;
    if (existing.imeiStatus !== data.imeiStatus) changes.imei = `${existing.imeiStatus} → ${data.imeiStatus}`;
    await audit(admin, "listing_updated", { entity: "listing", entityId: listingId, details: { code: existing.code, ...changes } });
  }

  // Replace the photo list with the one from the form, in order.
  const current = await db.select().from(schema.listingPhotos).where(eq(schema.listingPhotos.listingId, listingId));
  const keep = new Set(data.photos.map((p) => p.lgId));
  const removed = current.filter((p) => !keep.has(p.lgId));
  if (removed.length) {
    await db.delete(schema.listingPhotos).where(
      inArray(
        schema.listingPhotos.id,
        removed.map((p) => p.id),
      ),
    );
    await deleteMedia(removed.flatMap((p) => [p.smId, p.mdId, p.lgId]));
  }
  for (const [position, photo] of data.photos.entries()) {
    const match = current.find((p) => p.lgId === photo.lgId);
    if (match) {
      if (match.position !== position) await db.update(schema.listingPhotos).set({ position }).where(eq(schema.listingPhotos.id, match.id));
    } else {
      await db.insert(schema.listingPhotos).values({ listingId, position, ...photo });
    }
  }

  // Linked sell request: mark it bought.
  if (!existing && data.sourceRequestId) {
    await db.update(schema.sellRequests).set({ status: "bought", closedAt: now, updatedAt: now }).where(eq(schema.sellRequests.id, data.sourceRequestId));
  }

  redirect(`/admin/phones/${listingId}?saved=${data.publish ? "published" : "1"}`);
}

const statusSchema = z.enum(["available", "reserved", "hidden", "draft"]);

export async function setListingStatusAction(id: string, status: "available" | "reserved" | "hidden" | "draft"): Promise<ActionResult> {
  const admin = await getAdminOrNull();
  if (!admin) return { ok: false, error: "Please log in again." };
  if (!uuid.safeParse(id).success || !statusSchema.safeParse(status).success) return { ok: false, error: "Unknown phone or status." };
  const db = await getDb();
  const [row] = await db.select().from(schema.listings).where(eq(schema.listings.id, id)).limit(1);
  if (!row) return { ok: false, error: "Unknown phone." };
  if (row.status === "sold") return { ok: false, error: "This phone is sold. Cancel the sale first." };
  if (status === "reserved" && row.status !== "available") return { ok: false, error: "Only a phone that is for sale can be reserved." };
  if (status === "available" || status === "reserved") {
    if (row.imeiStatus !== "clear") return { ok: false, error: "Mark the IMEI as checked and clear first." };
    const photos = await db.select({ id: schema.listingPhotos.id }).from(schema.listingPhotos).where(eq(schema.listingPhotos.listingId, id)).limit(1);
    if (!photos.length) return { ok: false, error: "Add at least one photo first." };
  }
  const now = new Date();
  await db
    .update(schema.listings)
    .set({
      status,
      updatedAt: now,
      ...(status === "reserved" ? { reservedAt: now } : {}),
      ...(status === "available" && !row.publishedAt ? { publishedAt: now } : {}),
    })
    .where(eq(schema.listings.id, id));
  await audit(admin, "listing_status", { entity: "listing", entityId: id, details: { code: row.code, status: `${row.status} → ${status}` } });
  return { ok: true };
}

const saleSchema = z.object({
  listingId: uuid,
  buyerName: z.string().trim().min(2, "Enter the buyer's name").max(60),
  buyerPhone: z.string().trim().max(20),
  soldPriceInr: z.number().int().min(100).max(500000),
  paymentMode: z.enum(["cash", "upi", "card", "other"]),
  warrantyMonths: z.number().int().min(0).max(24),
});

export type SaleResult = { saleId: string; billNo: string; billUrl: string; buyerPhone: string; message: string; reviewMessage: string | null };

export async function markSoldAction(input: z.infer<typeof saleSchema>): Promise<ActionResult<SaleResult>> {
  const admin = await getAdminOrNull();
  if (!admin) return { ok: false, error: "Please log in again." };
  const parsed = saleSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Check the form." };
  const data = parsed.data;
  const phone = normalizeIndianMobile(data.buyerPhone);
  if (!phone) return { ok: false, error: "Enter the buyer's 10-digit mobile number." };
  const db = await getDb();
  const [row] = await db
    .select({ listing: schema.listings, brand: schema.phoneModels.brand, modelName: schema.phoneModels.name })
    .from(schema.listings)
    .innerJoin(schema.phoneModels, eq(schema.phoneModels.id, schema.listings.modelId))
    .where(eq(schema.listings.id, data.listingId))
    .limit(1);
  if (!row) return { ok: false, error: "Unknown phone." };
  if (row.listing.status === "sold") return { ok: false, error: "This phone is already marked sold." };
  if (row.listing.imeiStatus === "blocked") return { ok: false, error: "This phone's IMEI is blocked. It can't be sold." };

  if (row.listing.status !== "available" && row.listing.status !== "reserved")
    return { ok: false, error: "Only phones that are for sale or reserved can be sold." };

  const now = new Date();
  const today = istDateString(now);
  const year = Number(today.slice(0, 4));
  const billNo = `SB-${year}-${pad(await nextCounter(`bill-${year}`))}`;
  const warrantyUntil = addMonthsToDate(today, data.warrantyMonths);
  const { token, tokenHash, tokenEnc } = await newBillToken();

  let saleId = "";
  try {
    await db.transaction(async (tx) => {
      const [created] = await tx
        .insert(schema.sales)
        .values({
          listingId: data.listingId,
          billNo,
          tokenHash,
          tokenEnc,
          buyerName: data.buyerName,
          buyerPhone: phone,
          soldPriceInr: data.soldPriceInr,
          paymentMode: data.paymentMode as PaymentMode,
          warrantyMonths: data.warrantyMonths,
          warrantyUntil,
          item: saleItemFrom(row.listing, row.brand, row.modelName),
          createdBy: admin.id,
        })
        .returning({ id: schema.sales.id });
      saleId = created.id;
      await tx.update(schema.listings).set({ status: "sold", soldAt: now, updatedAt: now }).where(eq(schema.listings.id, data.listingId));
    });
  } catch (error) {
    // The unique index allows only one active sale per phone (e.g. two people pressing "Sold" at once).
    console.error("[sale] failed", error);
    return { ok: false, error: "This phone was just sold by someone else, or the sale could not be saved. Refresh the page." };
  }
  await audit(admin, "listing_sold", { entity: "listing", entityId: data.listingId, details: { code: row.listing.code, billNo, price: data.soldPriceInr } });

  const settings = await getShopSettings();
  const siteUrl = await getSiteUrl();
  const billUrl = `${siteUrl}/bill/${token}`;
  const phoneName = fullModelName(row.brand, row.modelName);
  const message =
    `Thank you for buying from ${settings.shopName}!\n` +
    `Phone: ${phoneName} (${row.listing.code})\nAmount: ${formatInr(data.soldPriceInr)}\nBill no: ${billNo}\n` +
    (data.warrantyMonths > 0 ? `Shop warranty: ${data.warrantyMonths} months\n` : "") +
    `Your bill and warranty card: ${billUrl}`;
  const reviewMessage = settings.googleReviewUrl
    ? `Hope you are happy with your ${phoneName}! If you have a minute, please leave us a Google review. It really helps our shop: ${settings.googleReviewUrl}`
    : null;
  return { ok: true, data: { saleId, billNo, billUrl, buyerPhone: phone, message, reviewMessage } };
}

/** Owner only. Cancels a sale: the bill stays (marked cancelled) and the phone is for sale again. */
export async function undoSaleAction(listingId: string): Promise<ActionResult> {
  const admin = await getAdminOrNull({ role: "owner" });
  if (!admin) return { ok: false, error: "Only the owner can cancel a sale." };
  if (!uuid.safeParse(listingId).success) return { ok: false, error: "Unknown phone." };
  const db = await getDb();
  const [sale] = await db
    .select()
    .from(schema.sales)
    .where(and(eq(schema.sales.listingId, listingId), isNull(schema.sales.voidedAt)))
    .limit(1);
  const now = new Date();
  await db.transaction(async (tx) => {
    if (sale) await tx.update(schema.sales).set({ voidedAt: now, voidedBy: admin.id }).where(eq(schema.sales.id, sale.id));
    await tx.update(schema.listings).set({ status: "available", soldAt: null, updatedAt: now }).where(eq(schema.listings.id, listingId));
  });
  await audit(admin, "sale_undone", { entity: "listing", entityId: listingId, details: { billNo: sale?.billNo } });
  return { ok: true };
}

export async function markReviewRequestedAction(saleId: string): Promise<ActionResult> {
  const admin = await getAdminOrNull();
  if (!admin) return { ok: false, error: "Please log in again." };
  if (!uuid.safeParse(saleId).success) return { ok: false, error: "Unknown sale." };
  const db = await getDb();
  await db.update(schema.sales).set({ reviewRequestedAt: new Date() }).where(eq(schema.sales.id, saleId));
  return { ok: true };
}

export async function deleteListingAction(listingId: string): Promise<ActionResult> {
  const admin = await getAdminOrNull({ role: "owner" });
  if (!admin) return { ok: false, error: "Only the owner can delete phones." };
  if (!uuid.safeParse(listingId).success) return { ok: false, error: "Unknown phone." };
  const db = await getDb();
  const [row] = await db.select().from(schema.listings).where(eq(schema.listings.id, listingId)).limit(1);
  if (!row) return { ok: false, error: "Unknown phone." };
  if (row.status === "sold") return { ok: false, error: "Sold phones are kept for your records and can't be deleted." };
  const photos = await db.select().from(schema.listingPhotos).where(eq(schema.listingPhotos.listingId, listingId));
  await db.delete(schema.listings).where(eq(schema.listings.id, listingId));
  await deleteMedia(photos.flatMap((p) => [p.smId, p.mdId, p.lgId]));
  await audit(admin, "listing_deleted", { entity: "listing", entityId: listingId, details: { code: row.code } });
  redirect("/admin/phones?deleted=1");
}

export async function markWantedNotifiedAction(wantedId: string): Promise<ActionResult> {
  const admin = await getAdminOrNull();
  if (!admin) return { ok: false, error: "Please log in again." };
  if (!uuid.safeParse(wantedId).success) return { ok: false, error: "Unknown request." };
  const db = await getDb();
  await db.update(schema.wantedRequests).set({ status: "notified", notifiedAt: new Date() }).where(eq(schema.wantedRequests.id, wantedId));
  await audit(admin, "wanted_notified", { entity: "wanted", entityId: wantedId });
  return { ok: true };
}
