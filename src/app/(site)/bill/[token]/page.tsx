import { BadgeCheck, MessageCircle, Phone, ShieldAlert } from "lucide-react";
import type { Metadata } from "next";
import QRCode from "qrcode";
import { getT } from "@/i18n/server";
import { billByToken } from "@/lib/bills";
import { daysUntil } from "@/lib/dates";
import { formatDate, formatInr, formatVariant, telLink, whatsappLink } from "@/lib/format";
import { getShopSettings, getSiteUrl } from "@/lib/settings";
import { buttonClass } from "@/components/ui/button";
import { cn } from "@/components/ui/cn";
import { LogoMark } from "@/components/ui/logo";
import { PrintButton } from "@/components/ui/print-button";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getT();
  return { title: t.bill.title, robots: { index: false, follow: false }, referrer: "no-referrer" };
}

function Row({ label, children, strong = false }: { label: string; children: React.ReactNode; strong?: boolean }) {
  return (
    <div className="flex justify-between gap-4 py-2.5">
      <dt className="text-muted">{label}</dt>
      <dd className={cn("text-right", strong ? "font-display text-xl font-bold tabular" : "font-medium")}>{children}</dd>
    </div>
  );
}

export default async function BillPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const [{ t, lang }, settings, siteUrl, bill] = await Promise.all([getT(), getShopSettings(), getSiteUrl(), billByToken(token)]);

  if (!bill) {
    return (
      <div className="mx-auto max-w-xl px-4 py-16 text-center">
        <p className="text-lg">{t.bill.notFound}</p>
      </div>
    );
  }

  const item = bill.item;
  const cancelled = Boolean(bill.voidedAt);
  const left = daysUntil(bill.warrantyUntil);
  const active = !cancelled && bill.warrantyMonths > 0 && left >= 0;
  const brandLeft = item.brandWarrantyUntil ? daysUntil(item.brandWarrantyUntil) : -1;
  const address = lang === "te" && settings.addressTe ? settings.addressTe : settings.addressEn;
  const extras = [item.hasBox && t.phone.box, item.hasCharger && t.phone.charger, item.hasBill && t.phone.bill].filter(Boolean) as string[];
  const qr = await QRCode.toString(`${siteUrl}/bill/${bill.token}`, { type: "svg", margin: 0, errorCorrectionLevel: "M" });
  const qrSrc = `data:image/svg+xml;base64,${Buffer.from(qr).toString("base64")}`;

  return (
    <div className="mx-auto max-w-2xl px-4 pb-16 pt-6 print:max-w-none print:p-0">
      {cancelled ? (
        <div role="status" className="mb-4 rounded-2xl bg-bad-soft px-4 py-3 text-[0.95rem] font-semibold text-bad">
          {t.bill.cancelled(formatDate(bill.voidedAt, lang))}
        </div>
      ) : (
        <div className="no-print mb-4 rounded-2xl bg-brand-soft px-4 py-3 text-[0.95rem] font-medium text-brand-ink">{t.bill.keep}</div>
      )}

      <article className="overflow-hidden rounded-[24px] border border-line bg-surface print:rounded-none print:border-black/30">
        {/* Shop */}
        <header className="flex flex-wrap items-start justify-between gap-4 border-b border-line p-5 sm:p-6">
          <div className="flex gap-3">
            <LogoMark className="h-11 w-11 shrink-0" />
            <div>
              <p className="font-display text-xl font-bold">{settings.shopName}</p>
              {address ? <p className="max-w-xs text-sm text-muted">{address}</p> : null}
              {settings.phone ? <p className="text-sm text-muted">{settings.phone}</p> : null}
              {settings.gstin ? (
                <p className="text-sm text-muted">
                  {t.bill.gstin}: {settings.gstin}
                </p>
              ) : null}
            </div>
          </div>
          <div className="w-full sm:w-auto sm:text-right print:w-auto print:text-right">
            <h1 className="font-display text-lg font-bold">{t.bill.title}</h1>
            <p className="text-sm">
              {t.bill.billNo} <span className="font-semibold tabular">{bill.billNo}</span>
            </p>
            <p className="text-sm text-muted">
              {t.bill.date}: {formatDate(bill.date, lang)}
            </p>
          </div>
        </header>

        {/* Sale */}
        <div className="p-5 sm:p-6">
          <dl className="divide-y divide-line">
            <Row label={t.bill.customer}>
              {bill.buyerName}
              <span className="block text-sm font-normal text-muted">{t.bill.mobileEnding(bill.buyerPhone.slice(-4))}</span>
            </Row>
            <Row label={t.bill.item}>
              {item.name}
              <span className="block text-sm font-normal text-muted">
                {[formatVariant(item.ramGb, item.storageGb), item.color, `${t.grade.label}: ${item.grade} (${t.grade[item.grade]})`]
                  .filter(Boolean)
                  .join(" · ")}
              </span>
            </Row>
            {item.imeiLast4 ? (
              <Row label={t.bill.imei}>
                <span className="tabular">{t.bill.imeiEnding(item.imeiLast4)}</span>
              </Row>
            ) : null}
            {item.batteryHealth ? <Row label={t.phone.batteryHealth}>{item.batteryHealth}%</Row> : null}
            <Row label={t.bill.comesWith}>{extras.length ? extras.join(", ") : t.phone.nothingElse}</Row>
            <Row label={t.phone.code}>{item.code}</Row>
            <Row label={t.bill.paidBy}>{t.bill.payment[bill.paymentMode] ?? bill.paymentMode}</Row>
            <Row label={t.bill.total} strong>
              {formatInr(bill.soldPriceInr)}
            </Row>
          </dl>
        </div>

        {/* Warranty card */}
        <section aria-labelledby="warranty-title" className="border-t border-dashed border-line-strong bg-surface-2 p-5 sm:p-6 print:bg-transparent">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0 flex-1">
              <h2 id="warranty-title" className="font-display text-lg font-bold">
                {t.bill.warrantyTitle}
              </h2>
              {cancelled ? (
                <p className="mt-2 font-medium text-bad">{t.bill.cancelledShort}</p>
              ) : bill.warrantyMonths > 0 ? (
                <div className="mt-2 flex items-start gap-2.5">
                  {active ? (
                    <BadgeCheck className="mt-0.5 h-6 w-6 shrink-0 text-ok" aria-hidden />
                  ) : (
                    <ShieldAlert className="mt-0.5 h-6 w-6 shrink-0 text-muted" aria-hidden />
                  )}
                  <div>
                    <p className="font-semibold">{t.bill.warrantyUntil(formatDate(bill.warrantyUntil, lang))}</p>
                    <p className={cn("text-sm font-semibold", active ? "text-ok" : "text-muted")}>
                      {active ? `${t.bill.active} · ${t.bill.daysLeft(left)}` : t.bill.expired}
                    </p>
                  </div>
                </div>
              ) : (
                <p className="mt-2 font-medium">{t.bill.noWarranty}</p>
              )}
              {item.brandWarrantyUntil && brandLeft >= 0 ? (
                <p className="mt-2 text-sm">{t.phone.brandWarrantyUntil(formatDate(item.brandWarrantyUntil, lang))}</p>
              ) : null}
              <p className="mt-3 text-sm text-muted">{t.bill.terms}</p>
            </div>
            <figure className="w-28 shrink-0 text-center">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={qrSrc} alt="" width={112} height={112} className="h-28 w-28 rounded-lg bg-white p-1.5" />
              <figcaption className="mt-1 text-[0.7rem] leading-tight text-muted">{t.bill.scan}</figcaption>
            </figure>
          </div>
        </section>
        <p className="border-t border-line px-5 py-3 text-center text-sm font-medium sm:px-6">{t.bill.thanks}</p>
      </article>

      <div className="no-print mt-5 flex flex-col gap-2 sm:flex-row">
        <PrintButton label={t.bill.print} className="sm:flex-1" />
        {settings.whatsapp ? (
          <a
            href={whatsappLink(settings.whatsapp, t.bill.whatsappText(bill.billNo))}
            target="_blank"
            rel="noopener noreferrer"
            className={buttonClass("chat", "lg", "sm:flex-1")}
          >
            <MessageCircle className="h-5 w-5" aria-hidden /> {t.bill.question}
          </a>
        ) : null}
        {settings.phone ? (
          <a href={telLink(settings.phone)} className={buttonClass("secondary", "lg", "sm:flex-1")}>
            <Phone className="h-5 w-5" aria-hidden /> {t.action.callShop}
          </a>
        ) : null}
      </div>
    </div>
  );
}
