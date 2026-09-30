import { readMedia } from "@/lib/media";

/** Public listing photos. Content never changes for an id, so cache for a year. */
export async function GET(_request: Request, { params }: { params: Promise<{ file: string }> }) {
  const { file } = await params;
  const match = /^([0-9a-f-]{36})\.webp$/i.exec(file);
  if (!match) return new Response("Not found", { status: 404 });
  const media = await readMedia(match[1]);
  if (!media || media.isPrivate) return new Response("Not found", { status: 404 });
  return new Response(Buffer.from(media.bytes), {
    headers: {
      "Content-Type": media.contentType,
      "Content-Length": String(media.size),
      "Cache-Control": "public, max-age=31536000, immutable",
      ETag: `"${media.id}"`,
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'; img-src 'self'; style-src 'unsafe-inline'",
    },
  });
}
