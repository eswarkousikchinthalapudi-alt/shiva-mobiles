import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import { getLang } from "@/i18n/server";
import { getShopSettings, getSiteUrl } from "@/lib/settings";
import "./globals.css";

const inter = localFont({
  src: "../fonts/inter-latin-wght-normal.woff2",
  variable: "--font-inter",
  weight: "100 900",
  display: "swap",
});

const bricolage = localFont({
  src: "../fonts/bricolage-grotesque-latin-wght-normal.woff2",
  variable: "--font-bricolage",
  weight: "200 800",
  display: "swap",
});

// Tiny fonts with only the ₹ sign, so prices use our typefaces everywhere.
const interRupee = localFont({
  src: "../fonts/inter-rupee-wght.woff2",
  variable: "--font-inter-rupee",
  weight: "100 900",
  display: "swap",
  adjustFontFallback: false,
  declarations: [{ prop: "unicode-range", value: "U+20B9" }],
});

const bricolageRupee = localFont({
  src: "../fonts/bricolage-rupee-wght.woff2",
  variable: "--font-bricolage-rupee",
  weight: "200 800",
  display: "swap",
  adjustFontFallback: false,
  declarations: [{ prop: "unicode-range", value: "U+20B9" }],
});

const telugu = localFont({
  src: [
    { path: "../fonts/noto-sans-telugu-telugu-400-normal.woff2", weight: "400", style: "normal" },
    { path: "../fonts/noto-sans-telugu-telugu-600-normal.woff2", weight: "600", style: "normal" },
  ],
  variable: "--font-telugu",
  display: "swap",
  preload: false,
  declarations: [{ prop: "unicode-range", value: "U+0951-0952, U+0964-0965, U+0C00-0C7F, U+1CDA, U+200C-200D, U+25CC" }],
});

export async function generateMetadata(): Promise<Metadata> {
  const [settings, base] = await Promise.all([getShopSettings(), getSiteUrl()]);
  return {
    metadataBase: new URL(base),
    title: { default: `${settings.shopName} — checked second-hand phones`, template: `%s · ${settings.shopName}` },
    description: settings.taglineEn || "IMEI-verified second-hand phones, tested on 12 points, with shop warranty. Sell your old phone for a fair price.",
    applicationName: settings.shopName,
    formatDetection: { telephone: false },
  };
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#eef1f7" },
    { media: "(prefers-color-scheme: dark)", color: "#0a0f22" },
  ],
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const lang = await getLang();
  return (
    <html lang={lang} className={`${inter.variable} ${bricolage.variable} ${interRupee.variable} ${bricolageRupee.variable} ${telugu.variable}`}>
      <body className="min-h-dvh antialiased">{children}</body>
    </html>
  );
}
