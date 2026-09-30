import Link from "next/link";
import { getT } from "@/i18n/server";
import { getShopSettings } from "@/lib/settings";
import { Wordmark } from "@/components/ui/logo";
import { LangToggle } from "./lang-toggle";
import { MobileMenu } from "./mobile-menu";

export async function SiteHeader() {
  const [{ t }, settings] = await Promise.all([getT(), getShopSettings()]);
  return (
    <header className="no-print sticky top-0 z-30 border-b border-line bg-bg/90 backdrop-blur supports-[backdrop-filter]:bg-bg/75">
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-3 focus:top-3 focus:rounded-lg focus:bg-surface focus:px-3 focus:py-2">
        {t.nav.skip}
      </a>
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-3 px-4">
        <Link href="/" className="mr-auto rounded-lg" aria-label={`${settings.shopName} — ${t.nav.home}`}>
          <Wordmark name={settings.shopName} />
        </Link>
        <nav className="hidden items-center gap-1 md:flex" aria-label={t.a11y.main}>
          <Link href="/phones" className="rounded-full px-3.5 py-2 text-[0.95rem] font-medium hover:bg-surface-3">
            {t.nav.phones}
          </Link>
          <Link href="/sell" className="rounded-full px-3.5 py-2 text-[0.95rem] font-medium hover:bg-surface-3">
            {t.nav.sell}
          </Link>
          <Link href="/compare" className="rounded-full px-3.5 py-2 text-[0.95rem] font-medium hover:bg-surface-3">
            {t.nav.compare}
          </Link>
          <Link href="/#visit" className="rounded-full px-3.5 py-2 text-[0.95rem] font-medium hover:bg-surface-3">
            {t.nav.visit}
          </Link>
        </nav>
        <LangToggle className="hidden md:inline-flex" />
        <MobileMenu phone={settings.phone} whatsapp={settings.whatsapp} />
      </div>
    </header>
  );
}
