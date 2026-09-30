import type { Metadata } from "next";
import { headers } from "next/headers";
import { getT } from "@/i18n/server";
import { whatsappLink } from "@/lib/format";
import { turnstileSiteKey } from "@/lib/security/turnstile";
import { getShopSettings } from "@/lib/settings";
import { SellWizard } from "@/components/site/sell-wizard";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getT();
  return { title: t.sell.title, description: t.home.sellText };
}

export default async function SellPage() {
  const [{ t }, settings, h] = await Promise.all([getT(), getShopSettings(), headers()]);
  const nonce = h.get("x-nonce");
  return (
    <div className="mx-auto max-w-xl px-4 pb-16 pt-6 sm:pt-10">
      <h1 className="font-display text-3xl font-bold sm:text-4xl">{t.sell.title}</h1>
      <p className="mb-8 mt-2 text-muted">{t.sell.intro}</p>
      <SellWizard
        shopName={settings.shopName}
        siteKey={turnstileSiteKey()}
        nonce={nonce}
        whatsappHref={settings.whatsapp ? whatsappLink(settings.whatsapp) : null}
      />
    </div>
  );
}
