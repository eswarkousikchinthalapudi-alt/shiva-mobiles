import { BatteryMedium, Box, CheckCircle2, ClipboardCheck, ShieldCheck, Wrench, XCircle } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { after } from "next/server";
import { cache } from "react";
import { getT } from "@/i18n/server";
import { formatDate, formatInr, telLink, whatsappLink } from "@/lib/format";
import { withoutPriceTags } from "@/lib/tags";
import { listingBySlug, recordView, similarListings, type ListingDetail } from "@/lib/listings";
import { PHONE_TESTS } from "@/lib/phone-tests";
import { getShopSettings, getSiteUrl } from "@/lib/settings";
import type { Dictionary } from "@/i18n/dictionaries";
import { GradeBadge } from "@/components/ui/badges";
import { cn } from "@/components/ui/cn";
import { PriceTag } from "@/components/ui/price-tag";
import { CompareToggle } from "@/components/site/compare-toggle";
import { Gallery } from "@/components/site/gallery";
import { ContactButtons, ShareButton } from "@/components/site/phone-actions";
import { PhoneCard, variantLabel } from "@/components/site/phone-card";

type Props = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

const getListing = cache((slug: string) => listingBySlug(slug));

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const [item, settings] = await Promise.all([getListing(slug), getShopSettings()]);
  if (!item) return { title: "Phone not found" };
  const variant = variantLabel(item.ramGb, item.storageGb);
  const title = settings.showPrices ? `${item.name} ${variant} — ${formatInr(item.priceInr)}` : `${item.name} ${variant}`;
  const battery = item.batteryHealth ? `Battery ${item.batteryHealth}%. ` : "";
  const description = `Grade ${item.grade} second-hand ${item.name} (${variant}${item.color ? `, ${item.color}` : ""}). ${battery}IMEI verified, ${item.testsPassed}/${item.testsTotal} tests passed, ${item.warrantyMonths} months shop warranty.`;
  return {
    title,
    description,
    alternates: { canonical: `/phones/${item.slug}` },
    openGraph: {
      title,
      description,
      type: "website",
      images: [{ url: `/api/listings/${item.code}/poster`, width: 1080, height: 1350, alt: item.name }],
    },
    robots: item.status === "sold" ? { index: false } : undefined,
  };
}

function Row({ label, children, icon: Icon, tone }: { label: string; children: React.ReactNode; icon: React.ElementType; tone?: "ok" | "warn" }) {
  return (
    <div className="flex gap-3.5 border-b border-line py-3.5 last:border-b-0">
      <Icon className={cn("mt-0.5 h-5 w-5 shrink-0", tone === "warn" ? "text-warn" : "text-ok")} aria-hidden />
      <div className="min-w-0 flex-1">
        <dt className="text-sm text-muted">{label}</dt>
        <dd className="mt-0.5 font-medium">{children}</dd>
      </div>
    </div>
  );
}

function HealthReport({ item, t, lang }: { item: ListingDetail; t: Dictionary; lang: "en" | "te" }) {
  const inBox = [item.hasBox && t.phone.box, item.hasCharger && t.phone.charger, item.hasBill && t.phone.bill].filter(Boolean) as string[];
  const brandWarranty = item.brandWarrantyUntil && new Date(item.brandWarrantyUntil) > new Date() ? item.brandWarrantyUntil : null;
  return (
    <section aria-labelledby="report-heading" className="rounded-[22px] border border-line bg-surface px-5 py-2">
      <h2 id="report-heading" className="pt-3 font-display text-xl font-semibold">
        {t.phone.healthReport}
      </h2>
      <dl>
        <Row label={t.phone.condition} icon={CheckCircle2}>
          <div className="flex flex-wrap items-center gap-2">
            <GradeBadge grade={item.grade} label={t.grade[item.grade]} />
          </div>
          <p className="mt-1 text-sm font-normal text-muted">{t.grade[`${item.grade}Text`]}</p>
        </Row>
        <Row label={t.phone.batteryHealth} icon={BatteryMedium} tone={item.batteryHealth && item.batteryHealth < 80 ? "warn" : "ok"}>
          {item.batteryHealth ? (
            <div>
              <span className="font-display text-lg font-bold tabular">{item.batteryHealth}%</span>
              <div className="mt-1.5 h-2 w-full max-w-60 overflow-hidden rounded-full bg-surface-3" aria-hidden>
                <div className="h-full rounded-full bg-ok" style={{ width: `${item.batteryHealth}%` }} />
              </div>
            </div>
          ) : (
            <span>{item.batteryNote || t.phone.batteryUnknown}</span>
          )}
          {item.batteryHealth && item.batteryNote ? <p className="mt-1 text-sm font-normal text-muted">{item.batteryNote}</p> : null}
        </Row>
        <Row label={t.phone.testsPassed} icon={ClipboardCheck} tone={item.failedTests.length ? "warn" : "ok"}>
          <details className="group">
            <summary className="cursor-pointer list-none">
              <span className="font-display text-lg font-bold tabular">{t.phone.testsValue(item.testsPassed, item.testsTotal)}</span>
              <span className="ml-3 text-sm font-medium text-brand-ink underline underline-offset-4 group-open:hidden">{t.phone.showTests}</span>
            </summary>
            <ul className="mt-2 grid grid-cols-1 gap-x-4 gap-y-1.5 text-sm font-normal sm:grid-cols-2">
              {PHONE_TESTS.filter((k) => item.tests[k] !== undefined).map((key) => (
                <li key={key} className="flex items-center gap-2">
                  {item.tests[key] ? <CheckCircle2 className="h-4 w-4 text-ok" aria-hidden /> : <XCircle className="h-4 w-4 text-bad" aria-hidden />}
                  <span className={item.tests[key] ? "" : "text-bad"}>{t.phone.tests[key]}</span>
                  <span className="sr-only">{item.tests[key] ? "✓" : "✗"}</span>
                </li>
              ))}
            </ul>
          </details>
        </Row>
        <Row label={t.phone.imei} icon={ShieldCheck} tone={item.imeiVerified ? "ok" : "warn"}>
          {item.imeiVerified ? (
            <>
              <span className="text-ok">{t.phone.imeiVerified}</span>
              {item.imeiCheckedAt ? <p className="text-sm font-normal text-muted">{t.phone.imeiVerifiedOn(formatDate(item.imeiCheckedAt, lang))}</p> : null}
            </>
          ) : (
            <span>{t.phone.imeiPending}</span>
          )}
        </Row>
        <Row label={t.phone.inTheBox} icon={Box}>
          {inBox.length ? inBox.join(", ") : t.phone.nothingElse}
        </Row>
        <Row label={t.phone.warranty} icon={Wrench}>
          {item.warrantyMonths > 0 ? t.phone.shopWarranty(item.warrantyMonths) : t.phone.noShopWarranty}
          {brandWarranty ? <p className="text-sm font-normal text-muted">{t.phone.brandWarrantyUntil(formatDate(brandWarranty, lang))}</p> : null}
        </Row>
      </dl>
    </section>
  );
}

function Specs({ item, t }: { item: ListingDetail; t: Dictionary }) {
  const s = item.specs;
  const rows: [string, string | null][] = [
    [t.phone.processor, s.chipset],
    [t.phone.speed, s.performance ? (t.phone.speedTiers[s.performance] ?? null) : null],
    [
      t.phone.screen,
      s.displayInches ? `${s.displayInches}″ ${s.displayType ?? ""}${s.refreshHz && s.refreshHz > 60 ? `, ${s.refreshHz}Hz` : ""}`.trim() : null,
    ],
    [t.phone.camera, s.cameraSummary ?? (s.mainCameraMp ? `${s.mainCameraMp}MP` : null)],
    [t.phone.selfie, s.frontCameraMp ? `${s.frontCameraMp}MP` : null],
    [t.phone.batterySize, s.batteryMah ? `${s.batteryMah.toLocaleString("en-IN")} mAh` : null],
    [t.phone.charging, s.chargingW ? `${s.chargingW}W` : null],
    [t.phone.network, s.has5g ? "5G" : "4G"],
    [t.phone.launched, s.launchYear ? String(s.launchYear) : null],
    [t.phone.priceNew, item.launchPriceInr ? formatInr(item.launchPriceInr) : null],
  ];
  return (
    <section aria-labelledby="specs-heading" className="rounded-[22px] border border-line bg-surface p-5">
      <h2 id="specs-heading" className="font-display text-xl font-semibold">
        {t.phone.specs}
      </h2>
      <dl className="mt-3 divide-y divide-line">
        {rows
          .filter(([, value]) => value)
          .map(([label, value]) => (
            <div key={label} className="grid grid-cols-[8.5rem_1fr] gap-3 py-2.5 text-[0.95rem]">
              <dt className="text-muted">{label}</dt>
              <dd className="font-medium">{value}</dd>
            </div>
          ))}
      </dl>
    </section>
  );
}

export default async function PhonePage({ params, searchParams }: Props) {
  const { slug } = await params;
  const item = await getListing(slug);
  if (!item) notFound();
  const query = await searchParams;
  const [{ t, lang }, settings, siteUrl, similar] = await Promise.all([
    getT(),
    getShopSettings(),
    getSiteUrl(),
    similarListings({ id: item.id, brand: item.brand, priceInr: item.priceInr }),
  ]);

  const fromWhatsapp = query.src === "wa";
  after(() => recordView(item.id, fromWhatsapp).catch(() => {}));

  const url = `${siteUrl}/phones/${item.slug}`;
  const variant = variantLabel(item.ramGb, item.storageGb);
  const fullTitle = `${item.name} ${variant}`;
  const message = t.phone.enquiryMessage(settings.shopName, fullTitle, item.code, url);
  const whatsappHref = settings.whatsapp && item.status !== "sold" ? whatsappLink(settings.whatsapp, message) : null;
  const telHref = settings.phone ? telLink(settings.phone) : null;
  const showPrices = settings.showPrices;
  const saving = showPrices && item.launchPriceInr && item.launchPriceInr > item.priceInr ? item.launchPriceInr - item.priceInr : null;
  const tags = showPrices ? item.tags : withoutPriceTags(item.tags);
  const notes = lang === "te" && item.notesTe ? item.notesTe : item.notesEn;

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: fullTitle,
    brand: { "@type": "Brand", name: item.brand },
    sku: item.code,
    image: item.photos.map((p) => `${siteUrl}${p.lg}`),
    description: `Grade ${item.grade} second-hand ${fullTitle}`,
    offers: {
      "@type": "Offer",
      url,
      ...(showPrices ? { priceCurrency: "INR", price: item.priceInr } : {}),
      itemCondition: "https://schema.org/UsedCondition",
      availability:
        item.status === "available"
          ? "https://schema.org/InStock"
          : item.status === "reserved"
            ? "https://schema.org/LimitedAvailability"
            : "https://schema.org/SoldOut",
      seller: { "@type": "Organization", name: settings.shopName },
    },
  };

  return (
    <div className="mx-auto max-w-6xl px-4 pb-28 pt-5 sm:pt-8 lg:pb-12">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />
      <div className="grid gap-6 lg:grid-cols-[1.05fr_1fr] lg:gap-10">
        <div className="lg:sticky lg:top-20 lg:self-start">
          <Gallery photos={item.photos} alt={fullTitle} />
        </div>

        <div className="space-y-5">
          <div>
            <h1 className="font-display text-[1.85rem] font-bold leading-tight sm:text-4xl">{item.name}</h1>
            <p className="mt-1 text-lg text-muted">
              {variant}
              {item.color ? `, ${item.color}` : ""}
            </p>
            <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2">
              <PriceTag value={showPrices ? item.priceInr : null} askLabel={t.card.askPrice} size="lg" />
              {saving ? <p className="text-[0.95rem] font-medium text-ok">{t.phone.youSave(formatInr(saving))}</p> : null}
            </div>
            {tags.length ? (
              <ul className="mt-4 flex flex-wrap gap-1.5">
                {tags.slice(0, 5).map((tag) => (
                  <li key={tag} className="rounded-md bg-surface-3 px-2 py-1 text-xs font-medium">
                    {t.tag[tag]}
                  </li>
                ))}
              </ul>
            ) : null}
          </div>

          {item.status !== "available" ? (
            <div className={cn("rounded-2xl px-4 py-3 text-[0.95rem] font-medium", item.status === "sold" ? "bg-bad-soft text-bad" : "bg-warn-soft text-warn")}>
              <p>{item.status === "sold" ? t.phone.soldBanner : t.phone.reservedBanner}</p>
              <Link href={`/wanted?want=${encodeURIComponent(item.name)}`} className="mt-1 inline-block font-semibold text-fg underline">
                {t.browse.notifyMe}
              </Link>
            </div>
          ) : null}

          <ContactButtons listingId={item.id} whatsappHref={whatsappHref} telHref={telHref} className="hidden sm:flex" />
          <div className="flex flex-wrap gap-2">
            {item.status !== "sold" ? <CompareToggle code={item.code} size="md" /> : null}
            <ShareButton url={url} title={fullTitle} text={showPrices ? `${fullTitle} — ${formatInr(item.priceInr)}` : fullTitle} />
          </div>

          <HealthReport item={item} t={t} lang={lang} />

          {notes ? (
            <section className="rounded-[22px] border border-line bg-surface p-5">
              <h2 className="font-display text-xl font-semibold">{t.phone.notes}</h2>
              <p className="mt-2 whitespace-pre-line text-[0.97rem]">{notes}</p>
            </section>
          ) : null}

          <Specs item={item} t={t} />

          <p className="text-sm text-muted">
            {t.phone.code}: <span className="font-medium text-fg tabular">{item.code}</span>
          </p>
        </div>
      </div>

      {similar.length ? (
        <section className="mt-12" aria-labelledby="similar-heading">
          <h2 id="similar-heading" className="font-display text-2xl font-bold">
            {t.phone.similar}
          </h2>
          <div className="scroll-row -mx-4 mt-4 flex gap-3 overflow-x-auto px-4 pb-2 sm:mx-0 sm:grid sm:grid-cols-3 sm:overflow-visible sm:px-0 lg:grid-cols-4">
            {similar.slice(0, 4).map((s) => (
              <PhoneCard key={s.id} item={s} lang={lang} className="w-[64vw] max-w-[240px] shrink-0 sm:w-auto sm:max-w-none" />
            ))}
          </div>
        </section>
      ) : null}

      {/* Mobile: price and contact always within thumb reach */}
      {item.status !== "sold" ? (
        <div className="no-print fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface/95 px-3 pb-[max(0.6rem,env(safe-area-inset-bottom))] pt-2.5 backdrop-blur sm:hidden">
          <div className="flex items-center gap-2">
            <div className="min-w-0 pr-1">
              <p className="truncate text-xs text-muted">{item.name}</p>
              <p className="font-display text-lg font-bold tabular">{showPrices ? formatInr(item.priceInr) : t.card.askPrice}</p>
            </div>
            <ContactButtons listingId={item.id} whatsappHref={whatsappHref} telHref={telHref} size="md" compact className="flex-1 justify-end" />
          </div>
        </div>
      ) : null}
    </div>
  );
}
