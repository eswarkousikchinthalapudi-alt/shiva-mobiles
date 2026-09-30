import "server-only";
import { and, asc, desc, eq, or, sql, type SQL } from "drizzle-orm";
import { z } from "zod";
import { getDb, schema } from "@/db";
import type { ModelVariant, SpecSource } from "@/db/schema";
import { slugify } from "@/lib/format";
import { fullModelName } from "@/lib/listings";

export type ModelOption = {
  id: string;
  brand: string;
  name: string;
  fullName: string;
  os: "iOS" | "Android";
  launchYear: number | null;
  chipset: string | null;
  variants: ModelVariant[];
  specSource: SpecSource;
  verified: boolean;
  summary: string;
};

function summaryOf(m: typeof schema.phoneModels.$inferSelect) {
  const parts = [
    m.chipset,
    m.displayInches ? `${m.displayInches}″${m.refreshHz && m.refreshHz > 60 ? ` ${m.refreshHz}Hz` : ""}` : null,
    m.batteryMah ? `${m.batteryMah} mAh` : null,
    m.has5g ? "5G" : "4G",
  ].filter(Boolean);
  return parts.join(", ");
}

function toOption(m: typeof schema.phoneModels.$inferSelect): ModelOption {
  return {
    id: m.id,
    brand: m.brand,
    name: m.name,
    fullName: fullModelName(m.brand, m.name),
    os: m.os,
    launchYear: m.launchYear,
    chipset: m.chipset,
    variants: m.variants,
    specSource: m.specSource,
    verified: Boolean(m.verifiedAt),
    summary: summaryOf(m),
  };
}

export async function searchCatalog(query: string, limit = 8): Promise<ModelOption[]> {
  const db = await getDb();
  const tokens = query
    .toLowerCase()
    .split(/\s+/)
    .map((t) => t.replace(/[^\p{L}\p{N}+()-]/gu, ""))
    .filter(Boolean)
    .slice(0, 6);
  const m = schema.phoneModels;
  if (tokens.length === 0) {
    const rows = await db.select().from(m).orderBy(desc(m.updatedAt)).limit(limit);
    return rows.map(toOption);
  }
  const haystack = sql`lower(${m.brand} || ' ' || ${m.name} || ' ' || array_to_string(${m.aliases}, ' '))`;
  const conditions: SQL[] = tokens.map((t) => sql`${haystack} LIKE ${"%" + t.replace(/[\\%_]/g, "\\$&") + "%"}`);
  const compact = tokens.join("").replace(/[\\%_]/g, "\\$&");
  const rows = await db
    .select()
    .from(m)
    .where(or(and(...conditions), sql`replace(${haystack}, ' ', '') LIKE ${"%" + compact + "%"}`))
    .orderBy(desc(m.launchYear), asc(m.brand), asc(m.name))
    .limit(limit);
  return rows.map(toOption);
}

export async function getModelOption(id: string): Promise<ModelOption | null> {
  const db = await getDb();
  const rows = await db.select().from(schema.phoneModels).where(eq(schema.phoneModels.id, id)).limit(1);
  return rows[0] ? toOption(rows[0]) : null;
}

export const modelInputSchema = z.object({
  brand: z.string().trim().min(1, "Brand is needed").max(40),
  name: z.string().trim().min(1, "Model name is needed").max(80),
  aliases: z.array(z.string().trim().min(1).max(40)).max(12).default([]),
  os: z.enum(["iOS", "Android"]),
  launchYear: z.number().int().min(2010).max(2035).nullable(),
  chipset: z.string().trim().max(80).nullable(),
  performance: z.number().int().min(1).max(4).nullable(),
  displayInches: z.number().min(3).max(9).nullable(),
  displayType: z.string().trim().max(40).nullable(),
  refreshHz: z.number().int().min(30).max(240).nullable(),
  mainCameraMp: z.number().int().min(1).max(400).nullable(),
  cameraSummary: z.string().trim().max(120).nullable(),
  frontCameraMp: z.number().int().min(1).max(200).nullable(),
  batteryMah: z.number().int().min(500).max(12000).nullable(),
  chargingW: z.number().int().min(1).max(300).nullable(),
  has5g: z.boolean(),
  variants: z
    .array(
      z.object({
        ramGb: z.number().int().min(1).max(32).nullable(),
        storageGb: z.number().int().min(8).max(2048),
        launchPriceInr: z.number().int().min(1000).max(500000).nullable(),
      }),
    )
    .max(10),
  // https only: these are shown as links in the admin panel.
  sourceUrls: z
    .array(
      z
        .string()
        .max(400)
        .regex(/^https:\/\/[^\s]+$/, "Source links must start with https://"),
    )
    .max(10)
    .default([]),
});

export type ModelInput = z.infer<typeof modelInputSchema>;

async function uniqueSlug(base: string, ignoreId?: string) {
  const db = await getDb();
  let slug = base || "phone";
  for (let i = 2; i < 50; i++) {
    const rows = await db.select({ id: schema.phoneModels.id }).from(schema.phoneModels).where(eq(schema.phoneModels.slug, slug)).limit(1);
    if (!rows[0] || rows[0].id === ignoreId) return slug;
    slug = `${base}-${i}`;
  }
  return `${base}-${Date.now()}`;
}

export async function findDuplicateModel(brand: string, name: string, ignoreId?: string) {
  const db = await getDb();
  const rows = await db
    .select({ id: schema.phoneModels.id })
    .from(schema.phoneModels)
    .where(and(sql`lower(${schema.phoneModels.brand}) = ${brand.toLowerCase()}`, sql`lower(${schema.phoneModels.name}) = ${name.toLowerCase()}`))
    .limit(2);
  return rows.find((r) => r.id !== ignoreId) ?? null;
}

export async function createModel(input: ModelInput, source: SpecSource): Promise<string> {
  const db = await getDb();
  const [row] = await db
    .insert(schema.phoneModels)
    .values({
      ...input,
      slug: await uniqueSlug(slugify(`${input.brand} ${input.name}`)),
      specSource: source,
      verifiedAt: source === "manual" ? new Date() : null,
    })
    .returning({ id: schema.phoneModels.id });
  return row.id;
}

export async function updateModel(id: string, input: ModelInput, markVerified: boolean) {
  const db = await getDb();
  await db
    .update(schema.phoneModels)
    .set({
      ...input,
      slug: await uniqueSlug(slugify(`${input.brand} ${input.name}`), id),
      updatedAt: new Date(),
      ...(markVerified ? { verifiedAt: new Date() } : {}),
    })
    .where(eq(schema.phoneModels.id, id));
}

export async function allModels() {
  const db = await getDb();
  const rows = await db
    .select()
    .from(schema.phoneModels)
    .orderBy(asc(schema.phoneModels.brand), desc(schema.phoneModels.launchYear), asc(schema.phoneModels.name));
  return rows;
}
