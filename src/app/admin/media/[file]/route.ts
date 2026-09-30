import { getAdminOrNull } from "@/lib/auth/dal";
import { readMedia } from "@/lib/media";

/** Private photos (seller uploads). Only signed-in admins can see them. */
export async function GET(_request: Request, { params }: { params: Promise<{ file: string }> }) {
  const admin = await getAdminOrNull();
  if (!admin) return new Response("Not found", { status: 404 });
  const { file } = await params;
  const match = /^([0-9a-f-]{36})\.webp$/i.exec(file);
  if (!match) return new Response("Not found", { status: 404 });
  const media = await readMedia(match[1]);
  if (!media) return new Response("Not found", { status: 404 });
  return new Response(Buffer.from(media.bytes), {
    headers: {
      "Content-Type": media.contentType,
      "Content-Length": String(media.size),
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
