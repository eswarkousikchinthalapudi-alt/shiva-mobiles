"use server";

import { eq } from "drizzle-orm";
import { refresh } from "next/cache";
import { z } from "zod";
import { getDb, schema } from "@/db";
import type { WantedStatus } from "@/db/schema";
import { audit } from "@/lib/audit";
import { getAdminOrNull } from "@/lib/auth/dal";

type Result = { ok: true } | { ok: false; error: string };
const uuid = z.string().uuid();

export async function setWantedStatusAction(id: string, status: WantedStatus): Promise<Result> {
  const admin = await getAdminOrNull();
  if (!admin) return { ok: false, error: "Please log in again." };
  if (!uuid.safeParse(id).success || !["open", "notified", "closed"].includes(status)) return { ok: false, error: "Unknown request." };
  const db = await getDb();
  await db
    .update(schema.wantedRequests)
    .set({ status, notifiedAt: status === "notified" ? new Date() : undefined })
    .where(eq(schema.wantedRequests.id, id));
  await audit(admin, status === "notified" ? "wanted_notified" : "wanted_updated", { entity: "wanted", entityId: id, details: { status } });
  refresh();
  return { ok: true };
}

/** For when a customer asks to be removed (or it's spam). */
export async function deleteWantedAction(id: string): Promise<Result> {
  const admin = await getAdminOrNull();
  if (!admin) return { ok: false, error: "Please log in again." };
  if (!uuid.safeParse(id).success) return { ok: false, error: "Unknown request." };
  const db = await getDb();
  await db.delete(schema.wantedRequests).where(eq(schema.wantedRequests.id, id));
  await audit(admin, "wanted_deleted", { entity: "wanted", entityId: id });
  refresh();
  return { ok: true };
}
