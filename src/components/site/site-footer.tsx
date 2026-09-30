import Link from "next/link";
import { getT } from "@/i18n/server";
import { getShopSettings } from "@/lib/settings";
import { Wordmark } from "@/components/ui/logo";

export async function SiteFooter() {
  const [{ t, lang }, settings] = await Promise.all([getT(), getShopSettings()]);
  const address = lang === "te" && settings.addressTe ? settings.addressTe : settings.addressEn;
  return (
    <footer className="no-print mt-16 border-t border-line bg-surface">
      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-10 sm:grid-cols-[1.4fr_1fr]">
        <div className="space-y-3">
          <Wordmark name={settings.shopName} />
          <p className="max-w-sm text-sm text-muted">{t.footer.about}</p>
          {address ? <p className="text-sm">{address}</p> : null}
          {settings.phone ? (
            <p className="text-sm">
              <a href={`tel:${settings.phone.replace(/[^\d+]/g, "")}`} className="font-medium text-brand-ink hover:underline">
                {settings.phone}
              </a>
            </p>
          ) : null}
        </div>
        <nav className="grid grid-cols-2 gap-2 text-sm" aria-label={t.a11y.footer}>
          <Link href="/phones" className="py-1 hover:text-brand-ink">
            {t.nav.phones}
          </Link>
          <Link href="/sell" className="py-1 hover:text-brand-ink">
            {t.nav.sell}
          </Link>
          <Link href="/warranty" className="py-1 hover:text-brand-ink">
            {t.footer.warranty}
          </Link>
          <Link href="/#grading" className="py-1 hover:text-brand-ink">
            {t.footer.grading}
          </Link>
          <Link href="/terms" className="py-1 hover:text-brand-ink">
            {t.footer.terms}
          </Link>
          <Link href="/privacy" className="py-1 hover:text-brand-ink">
            {t.footer.privacy}
          </Link>
        </nav>
      </div>
      <div className="border-t border-line">
        <p className="mx-auto max-w-6xl px-4 py-4 text-xs text-muted">{t.footer.copyright(new Date().getFullYear(), settings.shopName)}</p>
      </div>
    </footer>
  );
}
