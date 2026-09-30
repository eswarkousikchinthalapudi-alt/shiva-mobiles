import { LangProvider } from "@/i18n/client";
import { getLang } from "@/i18n/server";
import { CompareTray } from "@/components/site/compare-tray";
import { SiteFooter } from "@/components/site/site-footer";
import { SiteHeader } from "@/components/site/site-header";

export default async function SiteLayout({ children }: { children: React.ReactNode }) {
  const lang = await getLang();
  return (
    <LangProvider lang={lang}>
      <SiteHeader />
      <main id="main" className="min-h-[60dvh]">
        {children}
      </main>
      <SiteFooter />
      <CompareTray />
    </LangProvider>
  );
}
