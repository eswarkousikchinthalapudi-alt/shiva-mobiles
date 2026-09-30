import { BatteryMedium, ClipboardCheck, MapPin, Phone, Search, ShieldCheck, Wrench } from "lucide-react";
import Link from "next/link";
import { getT } from "@/i18n/server";
import { browseHref } from "@/lib/filters";
import { formatInr, whatsappLink } from "@/lib/format";
import { countAvailable, latestListings, recentlySold, type ListingCardData } from "@/lib/listings";
import { getShopSettings } from "@/lib/settings";
import { GradeBadge } from "@/components/ui/badges";
import { buttonClass } from "@/components/ui/button";
import { PhoneImage } from "@/components/ui/phone-image";
import { PriceTag } from "@/components/ui/price-tag";
import { PhoneCard, variantLabel } from "@/components/site/phone-card";
import type { Dictionary } from "@/i18n/dictionaries";

export default async function HomePage() {
  const [{ t, lang }, settings, latest, sold, available] = await Promise.all([getT(), getShopSettings(), latestListings(9), recentlySold(4), countAvailable()]);
  const featured = latest[0] ?? null;
  const rest = featured ? latest.slice(1) : latest;
  const address = lang === "te" && settings.addressTe ? settings.addressTe : settings.addressEn;
  const hours = lang === "te" && settings.hoursTe ? settings.hoursTe : settings.hoursEn;

  const budgets = [
    { label: t.browse.priceUnder10, href: browseHref({ price: "under-10k" }) },
    { label: t.browse.price10to20, href: browseHref({ price: "10k-20k" }) },
    { label: t.browse.price20to30, href: browseHref({ price: "20k-30k" }) },
    { label: t.browse.priceAbove30, href: browseHref({ price: "above-30k" }) },
  ];

  return (
    <>
      {/* Hero */}
      <section className="mx-auto grid max-w-6xl gap-8 px-4 pb-10 pt-8 md:grid-cols-[1.15fr_1fr] md:items-center md:pt-14">
        <div>
          <p className="mb-4 text-sm font-medium text-muted">{t.home.stats(available)}</p>
          <h1 className="font-display text-[2.35rem] font-bold leading-[1.04] sm:text-[3.1rem] md:text-[3.5rem]">{t.home.heroTitle}</h1>
          <p className="mt-4 max-w-xl text-lg text-muted">{t.home.heroText}</p>
          <form action="/phones" method="get" role="search" className="mt-7 flex max-w-xl gap-2">
            <label htmlFor="home-search" className="sr-only">
              {t.action.search}
            </label>
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-faint" aria-hidden />
              <input
                id="home-search"
                name="q"
                type="search"
                inputMode="search"
                autoComplete="off"
                maxLength={60}
                placeholder={t.home.searchPlaceholder}
                className="h-13 w-full rounded-[14px] border border-line-strong bg-surface pl-12 pr-4 text-base placeholder:text-faint focus:border-brand focus:outline-none"
              />
            </div>
            <button type="submit" className={buttonClass("primary", "lg")}>
              {t.action.search}
            </button>
          </form>
          {settings.showPrices ? (
            <ul className="mt-4 flex flex-wrap gap-2" aria-label={t.home.budget}>
              {budgets.map((b) => (
                <li key={b.href}>
                  <Link
                    href={b.href}
                    className="inline-flex h-9 items-center rounded-full border border-line-strong bg-surface px-3.5 text-sm font-medium hover:border-brand hover:text-brand-ink"
                  >
                    {b.label}
                  </Link>
                </li>
              ))}
            </ul>
          ) : null}
        </div>

        {featured ? <FeaturedPhone item={featured} t={t} lang={lang} showPrices={settings.showPrices} /> : null}
      </section>

      {/* Trust */}
      <section className="mx-auto max-w-6xl px-4">
        <ul className="grid divide-y divide-line rounded-[22px] border border-line bg-surface sm:grid-cols-3 sm:divide-x sm:divide-y-0">
          {[
            { icon: ShieldCheck, title: t.trust.imei, text: t.trust.imeiText },
            { icon: ClipboardCheck, title: t.trust.tests, text: t.trust.testsText },
            { icon: Wrench, title: t.trust.warranty, text: t.trust.warrantyText },
          ].map(({ icon: Icon, title, text }) => (
            <li key={title} className="flex gap-3.5 p-5">
              <Icon className="mt-0.5 h-6 w-6 shrink-0 text-ok" aria-hidden />
              <div>
                <p className="font-semibold">{title}</p>
                <p className="mt-0.5 text-sm text-muted">{text}</p>
              </div>
            </li>
          ))}
        </ul>
      </section>

      {/* Latest */}
      <section className="mx-auto mt-14 max-w-6xl px-4" aria-labelledby="latest-heading">
        <div className="mb-5 flex items-end justify-between gap-4">
          <h2 id="latest-heading" className="font-display text-2xl font-bold sm:text-3xl">
            {t.home.latest}
          </h2>
          <Link href="/phones" className="shrink-0 text-sm font-semibold text-brand-ink hover:underline">
            {t.action.seeAll}
          </Link>
        </div>
        {rest.length === 0 && !featured ? (
          <p className="rounded-2xl border border-dashed border-line-strong p-8 text-center text-muted">{t.home.latestEmpty}</p>
        ) : (
          <div className="scroll-row -mx-4 flex gap-3 overflow-x-auto px-4 pb-2 sm:mx-0 sm:grid sm:grid-cols-3 sm:overflow-visible sm:px-0 lg:grid-cols-4">
            {rest.slice(0, 8).map((item, index) => (
              <PhoneCard key={item.id} item={item} lang={lang} priority={index < 2} className="w-[68vw] max-w-[260px] shrink-0 sm:w-auto sm:max-w-none" />
            ))}
          </div>
        )}
      </section>

      {/* Sell band */}
      <section className="mx-auto mt-14 max-w-6xl px-4">
        <div className="relative overflow-hidden rounded-[26px] bg-brand px-6 py-9 text-brand-fg sm:px-10 sm:py-12">
          <div className="max-w-xl">
            <h2 className="font-display text-[1.9rem] font-bold leading-tight sm:text-4xl">{t.home.sellTitle}</h2>
            <p className="mt-3 text-base opacity-90 sm:text-lg">{t.home.sellText}</p>
            <Link href="/sell" className={buttonClass("tag", "lg", "mt-6")}>
              {t.home.sellButton}
            </Link>
          </div>
          <svg viewBox="0 0 200 260" className="pointer-events-none absolute -bottom-10 right-4 hidden h-64 w-auto opacity-20 sm:block" aria-hidden>
            <rect x="20" y="10" width="160" height="240" rx="28" fill="none" stroke="currentColor" strokeWidth="10" />
            <circle cx="100" cy="205" r="14" fill="var(--tag)" />
          </svg>
        </div>
      </section>

      {/* Grading */}
      <section id="grading" className="mx-auto mt-14 max-w-6xl scroll-mt-20 px-4" aria-labelledby="grading-heading">
        <h2 id="grading-heading" className="font-display text-2xl font-bold sm:text-3xl">
          {t.home.gradingTitle}
        </h2>
        <dl className="mt-5 grid gap-3 sm:grid-cols-3">
          {(["A", "B", "C"] as const).map((grade) => (
            <div key={grade} className="rounded-[18px] border border-line bg-surface p-5">
              <dt>
                <GradeBadge grade={grade} label={t.grade[grade]} />
              </dt>
              <dd className="mt-3 text-[0.95rem] text-muted">{t.grade[`${grade}Text`]}</dd>
            </div>
          ))}
        </dl>
      </section>

      {/* Recently sold */}
      {sold.length > 0 ? (
        <section className="mx-auto mt-14 max-w-6xl px-4" aria-labelledby="sold-heading">
          <h2 id="sold-heading" className="font-display text-2xl font-bold sm:text-3xl">
            {t.home.sold}
          </h2>
          <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {sold.map((item) => (
              <PhoneCard key={item.id} item={item} lang={lang} showCompare={false} />
            ))}
          </div>
        </section>
      ) : null}

      {/* Visit */}
      <section id="visit" className="mx-auto mt-14 max-w-6xl scroll-mt-20 px-4" aria-labelledby="visit-heading">
        <div className="grid gap-6 rounded-[26px] border border-line bg-surface p-6 sm:grid-cols-[1.3fr_1fr] sm:p-8">
          <div>
            <h2 id="visit-heading" className="font-display text-2xl font-bold sm:text-3xl">
              {t.home.visitTitle}
            </h2>
            {address ? (
              <p className="mt-4 flex gap-2.5 text-[1.02rem]">
                <MapPin className="mt-1 h-5 w-5 shrink-0 text-brand-ink" aria-hidden />
                <span>{address}</span>
              </p>
            ) : null}
            {hours ? (
              <p className="mt-3 text-muted">
                <span className="font-medium text-fg">{t.home.hours}: </span>
                {hours}
              </p>
            ) : null}
          </div>
          <div className="flex flex-col gap-2.5 sm:justify-center">
            {settings.whatsapp ? (
              <a href={whatsappLink(settings.whatsapp)} className={buttonClass("chat", "lg")} target="_blank" rel="noopener noreferrer">
                {t.action.askOnWhatsapp}
              </a>
            ) : null}
            {settings.phone ? (
              <a href={`tel:${settings.phone.replace(/[^\d+]/g, "")}`} className={buttonClass("secondary", "lg")}>
                <Phone className="h-4 w-4" aria-hidden />
                {t.action.callShop}
              </a>
            ) : null}
            {settings.mapUrl ? (
              <a href={settings.mapUrl} className={buttonClass("ghost", "lg")} target="_blank" rel="noopener noreferrer">
                <MapPin className="h-4 w-4" aria-hidden />
                {t.action.directions}
              </a>
            ) : null}
          </div>
        </div>
      </section>
    </>
  );
}

function FeaturedPhone({ item, t, lang, showPrices }: { item: ListingCardData; t: Dictionary; lang: "en" | "te"; showPrices: boolean }) {
  const saving = showPrices && item.launchPriceInr && item.launchPriceInr > item.priceInr ? item.launchPriceInr - item.priceInr : null;
  return (
    <Link
      href={`/phones/${item.slug}`}
      className="group relative block overflow-hidden rounded-[28px] border border-line bg-surface p-4 transition-[border-color] hover:border-line-strong sm:p-5"
      lang={lang}
    >
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm font-medium text-muted">{t.home.featuredLabel}</span>
        <GradeBadge grade={item.grade} label={t.grade[item.grade]} />
      </div>
      <div className="relative mt-3 aspect-[5/4] overflow-hidden rounded-[20px] bg-surface-2">
        <PhoneImage photo={item.photo} alt={item.name} priority fit="cover" sizes="(min-width: 768px) 40vw, 90vw" className="h-full w-full" />
        <PriceTag value={showPrices ? item.priceInr : null} askLabel={t.card.askPrice} size="lg" className="absolute bottom-4 left-4" />
      </div>
      <div className="mt-4 flex items-start justify-between gap-3">
        <div>
          <p className="font-display text-xl font-semibold leading-tight">{item.name}</p>
          <p className="text-sm text-muted">
            {variantLabel(item.ramGb, item.storageGb)}
            {item.color ? `, ${item.color}` : ""}
          </p>
        </div>
        {saving ? <p className="text-right text-sm font-medium text-ok">{t.card.save(formatInr(saving))}</p> : null}
      </div>
      <dl className="mt-4 grid grid-cols-3 divide-x divide-line rounded-2xl bg-surface-2 text-center">
        <div className="px-2 py-3">
          <dt className="text-xs text-muted">{t.phone.batteryHealth}</dt>
          <dd className="mt-0.5 flex items-center justify-center gap-1 font-display text-lg font-bold">
            <BatteryMedium className="h-4 w-4 text-ok" aria-hidden />
            {item.batteryHealth ? `${item.batteryHealth}%` : "✓"}
          </dd>
        </div>
        <div className="px-2 py-3">
          <dt className="text-xs text-muted">{t.phone.testsPassed}</dt>
          <dd className="mt-0.5 font-display text-lg font-bold tabular">
            {item.testsPassed}/{item.testsTotal || 12}
          </dd>
        </div>
        <div className="px-2 py-3">
          <dt className="text-xs text-muted">{t.phone.imei}</dt>
          <dd className="mt-0.5 font-display text-lg font-bold text-ok">{item.imeiVerified ? t.phone.imeiVerified : "…"}</dd>
        </div>
      </dl>
    </Link>
  );
}
