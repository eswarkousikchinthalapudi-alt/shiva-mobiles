import { eq } from "drizzle-orm";
import { z } from "zod";
import { getDb, schema } from "@/db";
import { recordClick } from "@/lib/listings";
import { readBodyLimited, sameOrigin } from "@/lib/security/body";
import { rateLimit } from "@/lib/security/rate-limit";
import { ipFromHeaders } from "@/lib/security/request";

const bodySchema = z.object({
  listingId: z.string().uuid(),
  kind: z.enum(["whatsapp", "call"]),
});

const done = () => new Response(null, { status: 204 });

/** Counts WhatsApp / call taps on phone pages. Best-effort; never errors to the client. */
export async function POST(request: Request) {
  try {
    if (!sameOrigin(request)) return done();
    const ip = ipFromHeaders(request.headers);
    const limit = await rateLimit(`track:${ip}`, 60, 3600);
    if (!limit.allowed) return done();
    const body = await readBodyLimited(request, 512);
    if (!body) return done();
    const parsed = bodySchema.safeParse(JSON.parse(new TextDecoder().decode(body)));
    if (!parsed.success) return done();
    const db = await getDb();
    const exists = await db.select({ id: schema.listings.id }).from(schema.listings).where(eq(schema.listings.id, parsed.data.listingId)).limit(1);
    if (exists.length) await recordClick(parsed.data.listingId, parsed.data.kind);
  } catch {
    // ignore
  }
  return done();
}
