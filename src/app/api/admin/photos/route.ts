import { NextResponse } from "next/server";
import { audit } from "@/lib/audit";
import { getAdminOrNull } from "@/lib/auth/dal";
import { MAX_UPLOAD_BYTES, MediaError, processListingPhoto, storeListingPhoto } from "@/lib/media";
import { readBodyLimited, sameOrigin } from "@/lib/security/body";
import { rateLimit } from "@/lib/security/rate-limit";
import { getShopSettings } from "@/lib/settings";

/**
 * Uploads one listing photo. Admin only. The photo is checked, rotated,
 * watermarked and saved in three sizes; the ids are returned so the phone
 * form can attach them when it is saved.
 */
export async function POST(request: Request) {
  if (!sameOrigin(request)) return NextResponse.json({ error: "Bad request" }, { status: 403 });
  const admin = await getAdminOrNull();
  if (!admin) return NextResponse.json({ error: "Please log in again." }, { status: 401 });

  const limit = await rateLimit(`upload:${admin.id}`, 200, 3600);
  if (!limit.allowed) return NextResponse.json({ error: "Too many uploads. Wait a few minutes." }, { status: 429 });

  const body = await readBodyLimited(request, MAX_UPLOAD_BYTES + 64 * 1024);
  if (!body) return NextResponse.json({ error: "Photo is larger than 15 MB." }, { status: 413 });

  let file: File | null = null;
  try {
    const form = await new Response(body as BodyInit, { headers: { "content-type": request.headers.get("content-type") ?? "" } }).formData();
    const value = form.get("file");
    file = value instanceof File ? value : null;
  } catch {
    return NextResponse.json({ error: "Upload failed. Try again." }, { status: 400 });
  }
  if (!file) return NextResponse.json({ error: "No photo received." }, { status: 400 });
  if (file.size > MAX_UPLOAD_BYTES) return NextResponse.json({ error: "Photo is larger than 15 MB." }, { status: 413 });

  try {
    const settings = await getShopSettings();
    const processed = await processListingPhoto(new Uint8Array(await file.arrayBuffer()), settings.shopName);
    const stored = await storeListingPhoto(processed);
    await audit(admin, "photo_uploaded", { entity: "media", entityId: stored.lgId });
    return NextResponse.json({
      smId: stored.smId,
      mdId: stored.mdId,
      lgId: stored.lgId,
      width: stored.width,
      height: stored.height,
    });
  } catch (error) {
    if (error instanceof MediaError) return NextResponse.json({ error: error.message }, { status: 400 });
    console.error("[upload] failed", error);
    return NextResponse.json({ error: "Could not process this photo. Try another one." }, { status: 500 });
  }
}
