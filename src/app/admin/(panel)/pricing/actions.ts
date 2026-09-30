"use server";

import { and, eq, notInArray } from "drizzle-orm";
import { refresh } from "next/cache";
import { z } from "zod";
import { getDb, schema } from "@/db";
import { audit } from "@/lib/audit";
import { getAdminOrNull } from "@/lib/auth/dal";
import type { PricingRules } from "@/lib/pricing";

type Result = { ok: true } | { ok: false; error: string };

const pricesSchema = z.object({
  modelId: z.string().uuid(),
  prices: z.array(z.object({ storageGb: z.number().int().min(8).max(2048), basePriceInr: z.number().int().min(100).max(500000).nullable() })).max(12),
});

export async function saveBuyPricesAction(input: z.infer<typeof pricesSchema>): Promise<Result> {
  const admin = await getAdminOrNull({ role: "owner" });
  if (!admin) return { ok: false, error: "Only the owner can change buying prices." };
  const parsed = pricesSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Prices must be between ₹100 and ₹5,00,000." };
  const { modelId, prices } = parsed.data;
  const db = await getDb();
  const [model] = await db
    .select({ id: schema.phoneModels.id, brand: schema.phoneModels.brand, name: schema.phoneModels.name })
    .from(schema.phoneModels)
    .where(eq(schema.phoneModels.id, modelId))
    .limit(1);
  if (!model) return { ok: false, error: "Unknown model." };

  const keep = prices.filter((p) => p.basePriceInr !== null);
  await db.transaction(async (tx) => {
    for (const p of keep) {
      await tx
        .insert(schema.buyPrices)
        .values({ modelId, storageGb: p.storageGb, basePriceInr: p.basePriceInr as number })
        .onConflictDoUpdate({
          target: [schema.buyPrices.modelId, schema.buyPrices.storageGb],
          set: { basePriceInr: p.basePriceInr as number, updatedAt: new Date() },
        });
    }
    const keptStorages = keep.map((p) => p.storageGb);
    await tx
      .delete(schema.buyPrices)
      .where(
        keptStorages.length
          ? and(eq(schema.buyPrices.modelId, modelId), notInArray(schema.buyPrices.storageGb, keptStorages))
          : eq(schema.buyPrices.modelId, modelId),
      );
  });
  await audit(admin, "buy_prices_changed", {
    entity: "phone_model",
    entityId: modelId,
    details: { name: `${model.brand} ${model.name}`, note: keep.map((p) => `${p.storageGb}GB ₹${p.basePriceInr}`).join(", ") },
  });
  refresh();
  return { ok: true };
}

const percent = z.number().min(0).max(100);
const rupees = z.number().int().min(0).max(20000);

const rulesSchema = z.object({
  screen: z.object({ scratches: percent, cracked: percent }),
  body: z.object({ marks: percent, damaged: percent }),
  battery: z.object({ weak: percent, bad: percent }),
  faultEach: percent,
  missingBox: rupees,
  missingCharger: rupees,
  missingBill: rupees,
  warrantyBonus: z.number().min(0).max(30),
  maxCutPercent: z.number().min(10).max(95),
  rangeLow: z.number().min(0).max(40),
  rangeHigh: z.number().min(0).max(40),
}) satisfies z.ZodType<PricingRules>;

export async function savePricingRulesAction(input: PricingRules): Promise<Result> {
  const admin = await getAdminOrNull({ role: "owner" });
  if (!admin) return { ok: false, error: "Only the owner can change price rules." };
  const parsed = rulesSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Check the numbers: percent cuts are 0–100, rupee cuts up to ₹20,000." };
  const db = await getDb();
  await db
    .insert(schema.shopSettings)
    .values({ id: 1, pricing: parsed.data, updatedAt: new Date() })
    .onConflictDoUpdate({ target: schema.shopSettings.id, set: { pricing: parsed.data, updatedAt: new Date() } });
  await audit(admin, "pricing_changed", { entity: "settings" });
  refresh();
  return { ok: true };
}
