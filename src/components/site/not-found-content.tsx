import { Search } from "lucide-react";
import Link from "next/link";
import { getT } from "@/i18n/server";
import { buttonClass } from "@/components/ui/button";

export async function NotFoundContent() {
  const { t } = await getT();
  return (
    <div className="mx-auto max-w-lg px-4 py-16 text-center">
      <p className="font-display text-6xl font-bold text-brand-ink">404</p>
      <h1 className="mt-3 font-display text-2xl font-bold">{t.notFound.title}</h1>
      <p className="mt-2 text-muted">{t.notFound.text}</p>
      <form action="/phones" method="get" role="search" className="mx-auto mt-6 flex max-w-sm gap-2">
        <label htmlFor="nf-q" className="sr-only">
          {t.action.search}
        </label>
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-faint" aria-hidden />
          <input
            id="nf-q"
            name="q"
            placeholder={t.home.searchPlaceholder}
            className="h-12 w-full rounded-2xl border-2 border-line-strong bg-surface pl-11 pr-3 focus:border-brand focus:outline-none"
          />
        </div>
        <button type="submit" className={buttonClass("primary", "md", "h-12")}>
          {t.action.search}
        </button>
      </form>
      <div className="mt-6 flex justify-center gap-2">
        <Link href="/phones" className={buttonClass("secondary", "md")}>
          {t.action.seeAll}
        </Link>
        <Link href="/sell" className={buttonClass("ghost", "md")}>
          {t.nav.sell}
        </Link>
      </div>
    </div>
  );
}
