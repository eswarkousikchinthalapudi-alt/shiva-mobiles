"use server";

import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getDb, schema } from "@/db";
import type { SellStatus } from "@/db/schema";
import { audit } from "@/lib/audit";
import { getAdminOrNull } from "@/lib/auth/dal";
import { deleteMedia } from "@/lib/media";

const CLOSED: SellStatus[] = ["bought", "rejected", "cancelled"];

const updateSchema = z.object({
  id: z.string().uuid(),
  status: z.enum(["new", "contacted", "offer_sent", "pickup_scheduled", "bought", "rejected", "cancelled"]),
  offerPrice: z.number().int().min(0).max(500000).nullable(),
  pickupAt: z.string().max(40).nullable(),
  publicNote: z.string().trim().max(300).nullable(),
  adminNotes: z.string().trim().max(2000),
});

export type RequestUpdate = z.infer<typeof updateSchema>;

export async function updateSellRequestAction(input: RequestUpdate): Promise<{ ok: true } | { ok: false; error: string }> {
  const admin = await getAdminOrNull();
  if (!admin) return { ok: false, error: "Please log in again." };
  const parsed = updateSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Check the form." };
  const data = parsed.data;
  const db = await getDb();
  const [current] = await db.select().from(schema.sellRequests).where(eq(schema.sellRequests.id, data.id)).limit(1);
  if (!current) return { ok: false, error: "This request no longer exists." };

  let pickupAt: Date | null = null;
  if (data.pickupAt) {
    // <input type="datetime-local"> gives shop time (IST) without a zone.
    const parsedDate = new Date(`${data.pickupAt}:00+05:30`);
    if (Number.isNaN(parsedDate.getTime())) return { ok: false, error: "Pickup time is not valid." };
    pickupAt = parsedDate;
  }
  const now = new Date();
  await db
    .update(schema.sellRequests)
    .set({
      status: data.status,
      offerPrice: data.offerPrice,
      pickupAt,
      adminNotes: data.adminNotes,
      closedAt: CLOSED.includes(data.status) ? (current.closedAt ?? now) : null,
      updatedAt: now,
    })
    .where(eq(schema.sellRequests.id, data.id));

  if (data.status !== current.status || data.publicNote) {
    await db.insert(schema.sellRequestEvents).values({
      requestId: data.id,
      status: data.status,
      publicNote: data.publicNote || null,
      byUserId: admin.id,
    });
  }
  await audit(admin, "sell_request_updated", {
    entity: "sell_request",
    entityId: data.id,
    details: { code: current.code, status: `${current.status} → ${data.status}`, offer: data.offerPrice },
  });
  return { ok: true };
}

/** Owner only. For when a seller asks for their details to be removed. */
export async function deleteSellRequestAction(id: string): Promise<{ ok: false; error: string }> {
  const admin = await getAdminOrNull({ role: "owner" });
  if (!admin) return { ok: false, error: "Only the owner can delete requests." };
  if (!z.string().uuid().safeParse(id).success) return { ok: false, error: "Unknown request." };
  const db = await getDb();
  const [request] = await db.select({ code: schema.sellRequests.code }).from(schema.sellRequests).where(eq(schema.sellRequests.id, id)).limit(1);
  if (!request) return { ok: false, error: "This request no longer exists." };
  const photos = await db
    .select({ mediaId: schema.sellRequestPhotos.mediaId })
    .from(schema.sellRequestPhotos)
    .where(eq(schema.sellRequestPhotos.requestId, id));
  await db.delete(schema.sellRequests).where(eq(schema.sellRequests.id, id));
  await deleteMedia(photos.map((p) => p.mediaId));
  await audit(admin, "sell_request_deleted", { entity: "sell_request", entityId: id, details: { code: request.code } });
  redirect("/admin/requests?deleted=1");
}
