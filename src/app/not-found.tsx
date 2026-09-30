import { LangProvider } from "@/i18n/client";
import { getLang } from "@/i18n/server";
import { NotFoundContent } from "@/components/site/not-found-content";
import { SiteFooter } from "@/components/site/site-footer";
import { SiteHeader } from "@/components/site/site-header";

/** For addresses that match no page at all. Looks like the rest of the site. */
export default async function NotFound() {
  const lang = await getLang();
  return (
    <LangProvider lang={lang}>
      <SiteHeader />
      <main id="main" className="min-h-[60dvh]">
        <NotFoundContent />
      </main>
      <SiteFooter />
    </LangProvider>
  );
}
