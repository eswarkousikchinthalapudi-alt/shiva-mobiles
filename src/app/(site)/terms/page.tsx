import type { Metadata } from "next";
import { LEGAL_UPDATED, termsDoc } from "@/content/legal";
import { getT } from "@/i18n/server";
import { getShopSettings } from "@/lib/settings";
import { LegalPage } from "@/components/site/legal-page";

async function load() {
  const [{ t, lang }, s] = await Promise.all([getT(), getShopSettings()]);
  const address = lang === "te" && s.addressTe ? s.addressTe : s.addressEn;
  return { t, lang, doc: termsDoc(lang, { shop: s.shopName, phone: s.phone, address, retentionDays: s.retentionDays }) };
}

export async function generateMetadata(): Promise<Metadata> {
  const { doc } = await load();
  return { title: doc.title, description: doc.intro };
}

export default async function TermsPage() {
  const { t, lang, doc } = await load();
  return <LegalPage doc={doc} updated={LEGAL_UPDATED} lang={lang} updatedLabel={t.legal.updated} />;
}
