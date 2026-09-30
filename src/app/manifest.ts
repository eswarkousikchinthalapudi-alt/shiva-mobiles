import type { MetadataRoute } from "next";
import { getShopSettings } from "@/lib/settings";

export const dynamic = "force-dynamic";

/** Lets people (and the shop staff) add the site to their phone's home screen. */
export default async function manifest(): Promise<MetadataRoute.Manifest> {
  const settings = await getShopSettings();
  return {
    name: settings.shopName,
    short_name: settings.shopName.length > 12 ? settings.shopName.split(" ")[0] : settings.shopName,
    description: settings.taglineEn || "Checked second-hand phones with shop warranty.",
    start_url: "/",
    display: "standalone",
    background_color: "#eef1f7",
    theme_color: "#1f2a7c",
    icons: [
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml" },
      { src: "/apple-icon", sizes: "180x180", type: "image/png" },
    ],
  };
}
