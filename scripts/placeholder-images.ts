/**
 * Draws simple placeholder phone photos for the demo listings, so the site
 * looks complete before real photos are uploaded. Replace them with real
 * photos of each phone before going live.
 */

function hexToRgb(hex: string) {
  const value = hex.replace("#", "");
  return [0, 2, 4].map((i) => parseInt(value.slice(i, i + 2), 16)) as [number, number, number];
}

function shade(hex: string, amount: number) {
  const [r, g, b] = hexToRgb(hex);
  const f = (c: number) => Math.max(0, Math.min(255, Math.round(amount >= 0 ? c + (255 - c) * amount : c * (1 + amount))));
  return `#${[f(r), f(g), f(b)].map((c) => c.toString(16).padStart(2, "0")).join("")}`;
}

function luminance(hex: string) {
  const [r, g, b] = hexToRgb(hex).map((c) => c / 255);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

const W = 1200;
const H = 1500;
const PX = 320;
const PY = 150;
const PW = 560;
const PH = 1180;

function frame(inner: string, background: string) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <defs>
    <filter id="soft" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="28"/></filter>
    <linearGradient id="sheen" x1="0" x2="1" y1="0" y2="0">
      <stop offset="0" stop-color="#ffffff" stop-opacity="0.16"/>
      <stop offset="0.45" stop-color="#ffffff" stop-opacity="0"/>
      <stop offset="1" stop-color="#000000" stop-opacity="0.10"/>
    </linearGradient>
  </defs>
  <rect width="${W}" height="${H}" fill="${background}"/>
  <ellipse cx="${W / 2}" cy="${PY + PH + 38}" rx="330" ry="34" fill="#0f1733" opacity="0.16" filter="url(#soft)"/>
  ${inner}
</svg>`;
}

function lens(cx: number, cy: number, r: number) {
  return `<circle cx="${cx}" cy="${cy}" r="${r + 10}" fill="#101216" opacity="0.9"/>
  <circle cx="${cx}" cy="${cy}" r="${r}" fill="#1b1f27"/>
  <circle cx="${cx}" cy="${cy}" r="${r * 0.55}" fill="#0b0d12"/>
  <circle cx="${cx - r * 0.28}" cy="${cy - r * 0.3}" r="${r * 0.16}" fill="#6b7fb0" opacity="0.7"/>`;
}

export type CameraStyle = "square" | "pill" | "bar" | "island";

export function backSvg(hex: string, camera: CameraStyle) {
  const light = luminance(hex) > 0.6;
  const edge = light ? shade(hex, -0.18) : shade(hex, 0.18);
  const moduleColor = light ? shade(hex, -0.08) : shade(hex, 0.1);
  let cameraArt = "";
  if (camera === "square") {
    cameraArt = `<rect x="${PX + 40}" y="${PY + 40}" width="236" height="236" rx="60" fill="${moduleColor}" stroke="${edge}" stroke-width="4"/>
      ${lens(PX + 108, PY + 108, 44)}${lens(PX + 208, PY + 208, 44)}
      <circle cx="${PX + 214}" cy="${PY + 102}" r="16" fill="#f4e9c9"/>`;
  } else if (camera === "pill") {
    cameraArt = `<rect x="${PX + 50}" y="${PY + 50}" width="140" height="360" rx="70" fill="${moduleColor}" stroke="${edge}" stroke-width="4"/>
      ${lens(PX + 120, PY + 124, 46)}${lens(PX + 120, PY + 236, 38)}${lens(PX + 120, PY + 336, 26)}
      <circle cx="${PX + 236}" cy="${PY + 100}" r="15" fill="#f4e9c9"/>`;
  } else if (camera === "bar") {
    cameraArt = `<rect x="${PX}" y="${PY + 150}" width="${PW}" height="150" fill="${moduleColor}" stroke="${edge}" stroke-width="4"/>
      ${lens(PX + 150, PY + 225, 44)}${lens(PX + 270, PY + 225, 44)}
      <circle cx="${PX + 420}" cy="${PY + 225}" r="14" fill="#f4e9c9"/>`;
  } else {
    cameraArt = `<circle cx="${PX + PW / 2}" cy="${PY + 250}" r="170" fill="${moduleColor}" stroke="${edge}" stroke-width="5"/>
      ${lens(PX + PW / 2 - 70, PY + 210, 44)}${lens(PX + PW / 2 + 70, PY + 210, 44)}${lens(PX + PW / 2, PY + 320, 38)}`;
  }
  const inner = `<rect x="${PX}" y="${PY}" width="${PW}" height="${PH}" rx="88" fill="${hex}" stroke="${edge}" stroke-width="8"/>
    <rect x="${PX}" y="${PY}" width="${PW}" height="${PH}" rx="88" fill="url(#sheen)"/>
    ${cameraArt}`;
  return frame(inner, "#eceff5");
}

export function frontSvg(hex: string, style: CameraStyle) {
  const deep = shade(hex, -0.55);
  const glow = shade(hex, 0.35);
  const accent = luminance(hex) > 0.6 ? shade(hex, -0.35) : shade(hex, 0.55);
  const cut =
    style === "square"
      ? `<rect x="${PX + PW / 2 - 70}" y="${PY + 44}" width="140" height="38" rx="19" fill="#050608"/>`
      : `<circle cx="${PX + PW / 2}" cy="${PY + 62}" r="17" fill="#050608"/>`;
  const inner = `<rect x="${PX}" y="${PY}" width="${PW}" height="${PH}" rx="88" fill="#0c0e13" stroke="${shade(hex, -0.2)}" stroke-width="8"/>
    <clipPath id="screen"><rect x="${PX + 22}" y="${PY + 22}" width="${PW - 44}" height="${PH - 44}" rx="68"/></clipPath>
    <g clip-path="url(#screen)">
      <rect x="${PX}" y="${PY}" width="${PW}" height="${PH}" fill="${deep}"/>
      <circle cx="${PX + 120}" cy="${PY + 360}" r="300" fill="${glow}" opacity="0.75" filter="url(#soft)"/>
      <circle cx="${PX + 470}" cy="${PY + 900}" r="330" fill="${accent}" opacity="0.6" filter="url(#soft)"/>
      <rect x="${PX + 60}" y="${PY + 230}" width="220" height="64" rx="18" fill="#ffffff" opacity="0.22"/>
      <rect x="${PX + 60}" y="${PY + 310}" width="140" height="22" rx="11" fill="#ffffff" opacity="0.18"/>
      <rect x="${PX + 140}" y="${PY + PH - 70}" width="${PW - 280}" height="10" rx="5" fill="#ffffff" opacity="0.55"/>
    </g>
    ${cut}`;
  return frame(inner, "#e8ecf3");
}
