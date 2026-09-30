"use server";

import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { getDb, schema } from "@/db";
import { nextCounter, pad } from "@/db/helpers";
import { isLang } from "@/i18n/dictionaries";
import { fullModelName } from "@/lib/listings";
import { MediaError, processPrivatePhoto, storeMedia } from "@/lib/media";
import { estimatePrice } from "@/lib/pricing";
import { cleanAnswers, isValidAnswers, type SellAnswers } from "@/lib/sell-quiz";
import { normalizeIndianMobile } from "@/lib/format";
import { maskImeis } from "@/lib/imei";
import { randomToken, sha256Hex } from "@/lib/security/crypto";
import { rateLimit } from "@/lib/security/rate-limit";
import { getRequestInfo } from "@/lib/security/request";
import { verifyTurnstile } from "@/lib/security/turnstile";
import { getShopSettings } from "@/lib/settings";
import { searchCatalog } from "@/lib/admin/catalog";

export type PublicModel = { id: string; name: string; storages: number[] };

/** Model search for the sell form. Only public catalog facts are returned. */
export async function searchSellModels(query: string): Promise<PublicModel[]> {
  const q = String(query ?? "")
    .trim()
    .slice(0, 60);
  if (q.length < 2) return [];
  const { ip } = await getRequestInfo();
  const limit = await rateLimit(`sell-search:${ip}`, 120, 600);
  if (!limit.allowed) return [];
  const models = await searchCatalog(q, 8);
  return models.map((m) => ({
    id: m.id,
    name: m.fullName,
    storages: [...new Set(m.variants.map((v) => v.storageGb))].sort((a, b) => a - b),
  }));
}

export type EstimateResult = { min: number; max: number } | null;

export async function estimateSellPrice(modelId: string | null, storageGb: number | null, answers: SellAnswers): Promise<EstimateResult> {
  if (!modelId || !z.string().uuid().safeParse(modelId).success || !storageGb || !isValidAnswers(answers)) return null;
  const { ip } = await getRequestInfo();
  const limit = await rateLimit(`sell-estimate:${ip}`, 60, 600);
  if (!limit.allowed) return null;
  const db = await getDb();
  const [row] = await db
    .select({ price: schema.buyPrices.basePriceInr })
    .from(schema.buyPrices)
    .where(and(eq(schema.buyPrices.modelId, modelId), eq(schema.buyPrices.storageGb, storageGb)))
    .limit(1);
  const settings = await getShopSettings();
  const estimate = estimatePrice(row?.price ?? null, cleanAnswers(answers), settings.pricing);
  return estimate ? { min: estimate.min, max: estimate.max } : null;
}

export type SubmitState =
  | { ok: true; trackUrl: string }
  | { ok: false; error: "invalid" | "mobile" | "consent" | "captcha" | "rate" | "photo" | "server"; field?: string; message?: string }
  | undefined;

const detailsSchema = z.object({
  modelId: z.string().uuid().nullable(),
  modelText: z.string().trim().min(2).max(80).transform(maskImeis),
  storageGb: z.number().int().min(8).max(2048).nullable(),
  name: z.string().trim().min(2).max(60),
  phone: z.string().trim().max(20),
  area: z.string().trim().min(2).max(80).transform(maskImeis),
  pincode: z
    .string()
    .trim()
    .regex(/^\d{6}$/)
    .nullable(),
  expectedPrice: z.number().int().min(100).max(500000).nullable(),
  preferredContact: z.enum(["whatsapp", "call"]),
  wantsExchange: z.boolean(),
  lang: z.string(),
});

const MAX_PHOTOS = 4;

export async function submitSellRequest(_prev: SubmitState, formData: FormData): Promise<SubmitState> {
  // Bots fill every field; people never see this one.
  if (String(formData.get("website") ?? "").length > 0) return { ok: true, trackUrl: "/sell" };

  const { ip } = await getRequestInfo();
  const ipLimit = await rateLimit(`sell-submit:${ip}`, 6, 3600);
  if (!ipLimit.allowed) return { ok: false, error: "rate" };

  const human = await verifyTurnstile(String(formData.get("cf-turnstile-response") ?? ""), ip);
  if (!human) return { ok: false, error: "captcha" };
  if (formData.get("consent") !== "on") return { ok: false, error: "consent" };

  const rawAnswers = String(formData.get("answers") ?? "");
  if (rawAnswers.length > 1000) return { ok: false, error: "invalid" };
  let parsedAnswers: unknown;
  try {
    parsedAnswers = JSON.parse(rawAnswers || "null");
  } catch {
    return { ok: false, error: "invalid" };
  }
  if (!isValidAnswers(parsedAnswers)) return { ok: false, error: "invalid" };
  const answers = cleanAnswers(parsedAnswers);

  const toNumber = (v: FormDataEntryValue | null) => {
    const s = String(v ?? "").replace(/[^\d]/g, "");
    return s ? Number(s) : null;
  };
  const parsed = detailsSchema.safeParse({
    modelId: String(formData.get("modelId") ?? "") || null,
    modelText: String(formData.get("modelText") ?? ""),
    storageGb: toNumber(formData.get("storageGb")),
    name: String(formData.get("name") ?? ""),
    phone: String(formData.get("phone") ?? ""),
    area: String(formData.get("area") ?? ""),
    pincode: String(formData.get("pincode") ?? "").trim() || null,
    expectedPrice: toNumber(formData.get("expectedPrice")),
    preferredContact: String(formData.get("preferredContact") ?? "whatsapp"),
    wantsExchange: formData.get("wantsExchange") === "on",
    lang: String(formData.get("lang") ?? "en"),
  });
  if (!parsed.success) {
    const field = String(parsed.error.issues[0]?.path[0] ?? "");
    return { ok: false, error: "invalid", field };
  }
  const data = parsed.data;
  const mobile = normalizeIndianMobile(data.phone);
  if (!mobile) return { ok: false, error: "mobile", field: "phone" };
  const phoneLimit = await rateLimit(`sell-phone:${mobile}`, 3, 24 * 3600);
  if (!phoneLimit.allowed) return { ok: false, error: "rate" };

  const db = await getDb();
  let modelText = data.modelText;
  let modelId: string | null = null;
  if (data.modelId) {
    const [model] = await db.select().from(schema.phoneModels).where(eq(schema.phoneModels.id, data.modelId)).limit(1);
    if (model) {
      modelId = model.id;
      modelText = fullModelName(model.brand, model.name);
    }
  }

  // Photos are optional. Each is shrunk, cleaned of location data and kept private.
  const files = formData
    .getAll("photos")
    .filter((f): f is File => f instanceof File && f.size > 0)
    .slice(0, MAX_PHOTOS);
  const mediaIds: string[] = [];
  try {
    for (const file of files) {
      const processed = await processPrivatePhoto(new Uint8Array(await file.arrayBuffer()));
      mediaIds.push(await storeMedia(processed, true));
    }
  } catch (error) {
    if (error instanceof MediaError) return { ok: false, error: "photo", message: error.message };
    console.error("[sell] photo failed", error);
    return { ok: false, error: "photo" };
  }

  const estimate = modelId ? await estimateSellPrice(modelId, data.storageGb, answers) : null;
  const token = randomToken(24);
  const now = new Date();
  try {
    const [request] = await db
      .insert(schema.sellRequests)
      .values({
        code: `SR-${pad(await nextCounter("sell"))}`,
        tokenHash: await sha256Hex(token),
        modelId,
        modelText,
        storageGb: data.storageGb,
        answers,
        estimateMin: estimate?.min ?? null,
        estimateMax: estimate?.max ?? null,
        expectedPrice: data.expectedPrice,
        name: data.name,
        phone: mobile,
        area: data.area,
        pincode: data.pincode,
        preferredContact: data.preferredContact,
        wantsExchange: data.wantsExchange,
        lang: isLang(data.lang) ? data.lang : "en",
        consentAt: now,
      })
      .returning({ id: schema.sellRequests.id });
    await db.insert(schema.sellRequestEvents).values({ requestId: request.id, status: "new" });
    for (const mediaId of mediaIds) await db.insert(schema.sellRequestPhotos).values({ requestId: request.id, mediaId });
  } catch (error) {
    console.error("[sell] save failed", error);
    return { ok: false, error: "server" };
  }
  return { ok: true, trackUrl: `/sell/track/${token}?new=1` };
}
