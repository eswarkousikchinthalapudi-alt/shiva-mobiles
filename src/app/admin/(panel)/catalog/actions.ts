"use server";

import { count, eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { refresh } from "next/cache";
import { z } from "zod";
import { getDb, schema } from "@/db";
import { audit } from "@/lib/audit";
import { findDuplicateModel, modelInputSchema, type ModelInput } from "@/lib/admin/catalog";
import { getAdminOrNull } from "@/lib/auth/dal";
import { slugify } from "@/lib/format";

type Result = { ok: true } | { ok: false; error: string };
const uuid = z.string().uuid();

export async function updateModelAction(id: string, input: ModelInput, verified: boolean): Promise<Result> {
  const admin = await getAdminOrNull();
  if (!admin) return { ok: false, error: "Please log in again." };
  if (!uuid.safeParse(id).success) return { ok: false, error: "Unknown model." };
  const parsed = modelInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Check the specs." };
  const db = await getDb();
  const [current] = await db.select().from(schema.phoneModels).where(eq(schema.phoneModels.id, id)).limit(1);
  if (!current) return { ok: false, error: "Unknown model." };
  if (await findDuplicateModel(parsed.data.brand, parsed.data.name, id)) return { ok: false, error: "Another model already has this brand and name." };

  // Keep the web address stable unless the name really changed.
  let slug = current.slug;
  const wanted = slugify(`${parsed.data.brand} ${parsed.data.name}`) || current.slug;
  if (wanted !== current.slug) {
    const [taken] = await db.select({ id: schema.phoneModels.id }).from(schema.phoneModels).where(eq(schema.phoneModels.slug, wanted)).limit(1);
    slug = taken && taken.id !== id ? `${wanted}-${id.slice(0, 6)}` : wanted;
  }
  await db
    .update(schema.phoneModels)
    .set({
      ...parsed.data,
      slug,
      verifiedAt: verified ? (current.verifiedAt ?? new Date()) : null,
      updatedAt: new Date(),
    })
    .where(eq(schema.phoneModels.id, id));
  await audit(admin, "model_updated", { entity: "phone_model", entityId: id, details: { name: `${parsed.data.brand} ${parsed.data.name}`, verified } });
  refresh();
  return { ok: true };
}

export async function deleteModelAction(id: string): Promise<Result> {
  const admin = await getAdminOrNull({ role: "owner" });
  if (!admin) return { ok: false, error: "Only the owner can delete models." };
  if (!uuid.safeParse(id).success) return { ok: false, error: "Unknown model." };
  const db = await getDb();
  const [used] = await db.select({ n: count() }).from(schema.listings).where(eq(schema.listings.modelId, id));
  if (Number(used?.n ?? 0) > 0) return { ok: false, error: "Phones in your stock or sales use this model, so it can't be deleted." };
  const [model] = await db
    .select({ brand: schema.phoneModels.brand, name: schema.phoneModels.name })
    .from(schema.phoneModels)
    .where(eq(schema.phoneModels.id, id))
    .limit(1);
  if (!model) return { ok: false, error: "Unknown model." };
  await db.delete(schema.phoneModels).where(eq(schema.phoneModels.id, id));
  await audit(admin, "model_deleted", { entity: "phone_model", entityId: id, details: { name: `${model.brand} ${model.name}` } });
  redirect("/admin/catalog?deleted=1");
}
