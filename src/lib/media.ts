import "server-only";
import fs from "node:fs";
import path from "node:path";
import { eq, inArray } from "drizzle-orm";
import opentype from "opentype.js";
import sharp, { type Metadata } from "sharp";
import { getDb, schema } from "@/db";

export class MediaError extends Error {
  constructor(
    public code: "too_large" | "unsupported" | "too_small" | "broken",
    message: string,
  ) {
    super(message);
  }
}

export const MAX_UPLOAD_BYTES = 15 * 1024 * 1024;
/** Shop photos can be big camera shots; customers' photos are shrunk in their browser first. */
const PIXEL_LIMIT = { shop: 40_000_000, customer: 25_000_000 };
const ACCEPTED = new Set(["jpeg", "png", "webp", "avif", "heif"]);

// Keep memory use predictable on a small server.
sharp.cache({ memory: 32, files: 0, items: 20 });
sharp.concurrency(2);

/** Checks the first bytes of the file, so only real photo formats reach the image library. */
function looksLikePhoto(input: Uint8Array): boolean {
  const b = input;
  const ascii = (start: number, text: string) => [...text].every((c, i) => b[start + i] === c.charCodeAt(0));
  if (b.length < 16) return false;
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return true; // JPEG
  if (b[0] === 0x89 && ascii(1, "PNG")) return true; // PNG
  if (ascii(0, "RIFF") && ascii(8, "WEBP")) return true; // WebP
  if (ascii(4, "ftyp")) {
    const brand = String.fromCharCode(b[8], b[9], b[10], b[11]);
    return ["heic", "heix", "hevc", "heim", "heis", "mif1", "msf1", "avif", "avis"].includes(brand); // HEIF / AVIF
  }
  return false;
}

let cachedFont: opentype.Font | null = null;
function watermarkFont() {
  if (!cachedFont) {
    const buffer = fs.readFileSync(path.join(process.cwd(), "assets/fonts/inter-latin-600-normal.woff"));
    cachedFont = opentype.parse(buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength) as ArrayBuffer);
  }
  return cachedFont;
}

/** SVG path for text, laid out glyph by glyph (avoids shaping bugs in the parser). */
function textToPath(text: string, fontSize: number) {
  const font = watermarkFont();
  const scale = fontSize / font.unitsPerEm;
  let x = 0;
  let d = "";
  let previous: opentype.Glyph | null = null;
  for (const char of text) {
    const glyph = font.charToGlyph(char);
    if (previous) x += font.getKerningValue(previous, glyph) * scale;
    d += glyph.getPath(x, fontSize, fontSize).toPathData(1);
    x += (glyph.advanceWidth ?? 0) * scale;
    previous = glyph;
  }
  return { d, width: x };
}

function watermarkSvg(width: number, height: number, text: string) {
  const fontSize = Math.max(16, Math.round(Math.min(width, height) * 0.045));
  const { d, width: textWidth } = textToPath(text, fontSize);
  const margin = Math.round(Math.min(width, height) * 0.035);
  const x = Math.max(margin, width - textWidth - margin);
  const y = height - fontSize * 1.25 - margin;
  return Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">` +
      `<path d="${d}" transform="translate(${x.toFixed(1)} ${y.toFixed(1)})" fill="#ffffff" fill-opacity="0.78" ` +
      `stroke="#0f1733" stroke-opacity="0.35" stroke-width="${(fontSize * 0.07).toFixed(2)}" paint-order="stroke" stroke-linejoin="round"/>` +
      `</svg>`,
  );
}

async function inspect(input: Uint8Array, limitInputPixels: number) {
  if (input.byteLength > MAX_UPLOAD_BYTES) throw new MediaError("too_large", "Photo is larger than 15 MB.");
  if (!looksLikePhoto(input)) throw new MediaError("unsupported", "Use a JPG, PNG or WebP photo.");
  let meta: Metadata;
  try {
    meta = await sharp(input, { limitInputPixels, failOn: "error" }).metadata();
  } catch {
    throw new MediaError("broken", "This file is not a photo we can read.");
  }
  if ((meta.width ?? 0) * (meta.height ?? 0) > limitInputPixels) {
    throw new MediaError("too_large", "Photo is too big. Take it at normal camera size (not 50 MP or 200 MP mode).");
  }
  if (!meta.format || !ACCEPTED.has(meta.format)) {
    throw new MediaError("unsupported", "Use a JPG, PNG or WebP photo.");
  }
  if ((meta.width ?? 0) < 200 || (meta.height ?? 0) < 200) {
    throw new MediaError("too_small", "Photo is too small. Use a photo at least 200 pixels wide.");
  }
  return meta;
}

export type ProcessedPhoto = {
  lg: { data: Buffer; width: number; height: number };
  md: { data: Buffer; width: number; height: number };
  sm: { data: Buffer; width: number; height: number };
};

/**
 * Listing photo: auto-rotate, resize to 1600px, add the shop watermark, save
 * as WebP in three sizes. Re-encoding drops all EXIF data (including GPS).
 */
export async function processListingPhoto(input: Uint8Array, watermarkText: string): Promise<ProcessedPhoto> {
  await inspect(input, PIXEL_LIMIT.shop);
  const { data, info } = await sharp(input, { limitInputPixels: PIXEL_LIMIT.shop, failOn: "error" })
    .rotate()
    .resize({ width: 1600, height: 1600, fit: "inside", withoutEnlargement: true })
    .flatten({ background: "#ffffff" })
    .raw()
    .toBuffer({ resolveWithObject: true });

  const raw = { width: info.width, height: info.height, channels: info.channels };
  const layers = watermarkText.trim() ? [{ input: watermarkSvg(info.width, info.height, watermarkText.trim()) }] : [];
  const lgBuffer = await sharp(data, { raw }).composite(layers).webp({ quality: 82 }).toBuffer();

  const variant = async (size: number, quality: number) => {
    const out = await sharp(lgBuffer)
      .resize({ width: size, height: size, fit: "inside", withoutEnlargement: true })
      .webp({ quality })
      .toBuffer({ resolveWithObject: true });
    return { data: out.data, width: out.info.width, height: out.info.height };
  };

  return {
    lg: { data: lgBuffer, width: info.width, height: info.height },
    md: await variant(960, 80),
    sm: await variant(480, 76),
  };
}

/** Seller photo: private, smaller, no watermark. */
export async function processPrivatePhoto(input: Uint8Array) {
  await inspect(input, PIXEL_LIMIT.customer);
  const out = await sharp(input, { limitInputPixels: PIXEL_LIMIT.customer, failOn: "error" })
    .rotate()
    .resize({ width: 1280, height: 1280, fit: "inside", withoutEnlargement: true })
    .flatten({ background: "#ffffff" })
    .webp({ quality: 74 })
    .toBuffer({ resolveWithObject: true });
  return { data: out.data, width: out.info.width, height: out.info.height };
}

export async function storeMedia(file: { data: Buffer; width: number; height: number }, isPrivate: boolean): Promise<string> {
  const db = await getDb();
  const [row] = await db
    .insert(schema.media)
    .values({
      isPrivate,
      contentType: "image/webp",
      width: file.width,
      height: file.height,
      bytes: file.data,
      size: file.data.byteLength,
    })
    .returning({ id: schema.media.id });
  return row.id;
}

export async function storeListingPhoto(processed: ProcessedPhoto) {
  const [lgId, mdId, smId] = [await storeMedia(processed.lg, false), await storeMedia(processed.md, false), await storeMedia(processed.sm, false)];
  return { lgId, mdId, smId, width: processed.lg.width, height: processed.lg.height };
}

export async function readMedia(id: string) {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const db = await getDb();
  const rows = await db.select().from(schema.media).where(eq(schema.media.id, id)).limit(1);
  return rows[0] ?? null;
}

export async function deleteMedia(ids: string[]) {
  if (ids.length === 0) return;
  const db = await getDb();
  await db.delete(schema.media).where(inArray(schema.media.id, ids));
}
