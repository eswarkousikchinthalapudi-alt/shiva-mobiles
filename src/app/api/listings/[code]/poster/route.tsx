import fs from "node:fs/promises";
import path from "node:path";
import { ImageResponse } from "next/og";
import sharp from "sharp";
import { getAdminOrNull } from "@/lib/auth/dal";
import { formatInr } from "@/lib/format";
import { readMedia } from "@/lib/media";
import { rateLimit } from "@/lib/security/rate-limit";
import { ipFromHeaders } from "@/lib/security/request";
import { shareDataByCode } from "@/lib/share";

/**
 * WhatsApp poster: one image with the photo, price and health report,
 * sized 1080 × 1350 (fits WhatsApp status and chats). Also used as the
 * link preview image when a phone page is shared.
 */

let fontCache: Promise<{ name: string; data: ArrayBuffer; weight: 400 | 600 | 700 | 800; style: "normal" }[]> | null = null;
function fonts() {
  fontCache ??= (async () => {
    const dir = path.join(process.cwd(), "assets/fonts");
    const read = async (file: string) => {
      const buffer = await fs.readFile(path.join(dir, file));
      return buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength) as ArrayBuffer;
    };
    return [
      { name: "Inter", data: await read("inter-latin-400-normal.woff"), weight: 400 as const, style: "normal" as const },
      { name: "Inter", data: await read("inter-latin-600-normal.woff"), weight: 600 as const, style: "normal" as const },
      { name: "Bricolage", data: await read("bricolage-grotesque-latin-700-normal.woff"), weight: 700 as const, style: "normal" as const },
      { name: "Bricolage", data: await read("bricolage-grotesque-latin-800-normal.woff"), weight: 800 as const, style: "normal" as const },
      // Extended sets carry the ₹ sign.
      { name: "InterExt", data: await read("inter-latin-ext-400-normal.woff"), weight: 400 as const, style: "normal" as const },
      { name: "InterExt", data: await read("inter-latin-ext-600-normal.woff"), weight: 600 as const, style: "normal" as const },
      { name: "BricolageExt", data: await read("bricolage-grotesque-latin-ext-700-normal.woff"), weight: 700 as const, style: "normal" as const },
      { name: "BricolageExt", data: await read("bricolage-grotesque-latin-ext-800-normal.woff"), weight: 800 as const, style: "normal" as const },
    ];
  })();
  return fontCache;
}

/** Recently made posters, so repeat requests (link previews, shares) don't redraw them. */
const posterCache = new Map<string, Uint8Array>();
const CACHE_SIZE = 24;

function remember(key: string, bytes: Uint8Array) {
  posterCache.delete(key);
  posterCache.set(key, bytes);
  while (posterCache.size > CACHE_SIZE) posterCache.delete(posterCache.keys().next().value as string);
}

export async function GET(request: Request, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const data = await shareDataByCode(code.toUpperCase());
  if (!data) return new Response("Not found", { status: 404 });
  const isPublic = ["available", "reserved", "sold"].includes(data.listing.status);
  if (!isPublic && !(await getAdminOrNull())) return new Response("Not found", { status: 404 });

  const headers = { "Content-Type": "image/png", "Cache-Control": isPublic ? "public, max-age=300" : "private, no-store" };
  const key = [data.listing.code, data.listing.updatedAt.getTime(), data.firstPhotoId, data.settings.updatedAt.getTime()].join(":");
  const cached = posterCache.get(key);
  if (cached) {
    remember(key, cached);
    return new Response(cached as BodyInit, { headers });
  }
  // Drawing a poster takes real work, so limit how often one visitor can ask for new ones.
  const limit = await rateLimit(`poster:${ipFromHeaders(request.headers)}`, 40, 600);
  if (!limit.allowed) return new Response("Too many requests", { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds) } });

  let photo: string | null = null;
  let photoBackground = "#FFFFFF";
  if (data.firstPhotoId) {
    const media = await readMedia(data.firstPhotoId);
    if (media) {
      const input = Buffer.from(media.bytes);
      // Fill the empty sides with the photo's own main colour so it looks seamless.
      const { dominant } = await sharp(input).stats();
      photoBackground = `rgb(${dominant.r}, ${dominant.g}, ${dominant.b})`;
      const jpeg = await sharp(input).resize({ width: 968, height: 760, fit: "contain", background: dominant }).jpeg({ quality: 84 }).toBuffer();
      photo = `data:image/jpeg;base64,${jpeg.toString("base64")}`;
    }
  }

  const { listing: l, settings } = data;
  const grade = { A: "Like new", B: "Good", C: "Fair" }[l.grade];
  const chips = [
    `Grade ${l.grade} · ${grade}`,
    l.batteryHealth ? `Battery ${l.batteryHealth}%` : "Battery checked",
    `${data.tests.passed}/${data.tests.tested} tests passed`,
    l.warrantyMonths > 0 ? `${l.warrantyMonths} month${l.warrantyMonths === 1 ? "" : "s"} warranty` : null,
  ].filter(Boolean) as string[];
  const saving = settings.showPrices && l.launchPriceInr && l.launchPriceInr > l.priceInr ? l.launchPriceInr - l.priceInr : null;

  const image = new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        background: "#EEF1F7",
        fontFamily: "Inter, InterExt",
        color: "#0F1733",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "44px 56px 28px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
          <div style={{ width: 64, height: 64, borderRadius: 20, background: "#1F2A7C", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <div
              style={{
                width: 26,
                height: 42,
                borderRadius: 8,
                border: "5px solid #FFFFFF",
                display: "flex",
                alignItems: "flex-end",
                justifyContent: "center",
                paddingBottom: 4,
              }}
            >
              <div style={{ width: 9, height: 9, borderRadius: 9, background: "#F5B301" }} />
            </div>
          </div>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ fontFamily: "Bricolage, BricolageExt", fontWeight: 800, fontSize: 44, letterSpacing: -1 }}>{settings.shopName}</div>
            <div style={{ fontSize: 24, color: "#54607E" }}>Checked second-hand phones</div>
          </div>
        </div>
        <div style={{ display: "flex", background: "#DFF2E8", color: "#0A7A50", fontWeight: 600, fontSize: 26, padding: "12px 22px", borderRadius: 999 }}>
          IMEI verified
        </div>
      </div>

      <div style={{ display: "flex", margin: "0 56px", height: 760, borderRadius: 40, overflow: "hidden", background: photoBackground, position: "relative" }}>
        {photo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={photo} width={968} height={760} style={{ width: 968, height: 760 }} alt="" />
        ) : (
          <div style={{ display: "flex", width: "100%", height: "100%", alignItems: "center", justifyContent: "center", color: "#8A93AD", fontSize: 36 }}>
            Photo coming soon
          </div>
        )}
        <div
          style={{
            position: "absolute",
            left: 32,
            bottom: 32,
            display: "flex",
            alignItems: "center",
            background: "#F5B301",
            color: "#2B1D00",
            fontFamily: "Bricolage, BricolageExt",
            fontWeight: 800,
            fontSize: settings.showPrices ? 72 : 48,
            padding: "14px 40px 14px 36px",
            borderRadius: 18,
          }}
        >
          {settings.showPrices ? formatInr(l.priceInr) : "Ask for price"}
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", padding: "34px 56px 0" }}>
        <div style={{ fontFamily: "Bricolage, BricolageExt", fontWeight: 800, fontSize: 64, lineHeight: 1.05, letterSpacing: -1.5 }}>{data.name}</div>
        <div style={{ display: "flex", fontSize: 32, color: "#54607E", marginTop: 8 }}>
          {`${data.variant}${l.color ? `, ${l.color}` : ""}${saving ? `  ·  ${formatInr(saving)} less than new` : ""}`}
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 14, marginTop: 26 }}>
          {chips.map((chip) => (
            <div
              key={chip}
              style={{
                display: "flex",
                background: "#FFFFFF",
                border: "2px solid #D7DCEA",
                borderRadius: 999,
                padding: "10px 22px",
                fontSize: 27,
                fontWeight: 600,
              }}
            >
              {chip}
            </div>
          ))}
        </div>
      </div>

      <div
        style={{
          marginTop: "auto",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          background: "#1F2A7C",
          color: "#FFFFFF",
          padding: "26px 56px",
          fontSize: 28,
        }}
      >
        <div style={{ display: "flex" }}>{settings.phone ? `Call / WhatsApp ${settings.phone}` : settings.shopName}</div>
        <div style={{ display: "flex", fontWeight: 600 }}>ID {l.code}</div>
      </div>
    </div>,
    {
      width: 1080,
      height: 1350,
      fonts: await fonts(),
    },
  );
  const bytes = new Uint8Array(await image.arrayBuffer());
  remember(key, bytes);
  return new Response(bytes as BodyInit, { headers });
}
