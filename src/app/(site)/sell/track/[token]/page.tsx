import { CheckCircle2, Circle } from "lucide-react";
import type { Metadata } from "next";
import { asc, eq } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { getT } from "@/i18n/server";
import { formatDateTime, formatInr, telLink, whatsappLink } from "@/lib/format";
import { sha256Hex } from "@/lib/security/crypto";
import { getShopSettings } from "@/lib/settings";
import { buttonClass } from "@/components/ui/button";
import { cn } from "@/components/ui/cn";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getT();
  return { title: t.meta.track, robots: { index: false, follow: false }, referrer: "no-referrer" };
}

export default async function TrackPage({ params, searchParams }: { params: Promise<{ token: string }>; searchParams: Promise<{ new?: string }> }) {
  const [{ token }, { new: isNew }] = await Promise.all([params, searchParams]);
  const [{ t, lang }, settings] = await Promise.all([getT(), getShopSettings()]);
  const valid = /^[A-Za-z0-9_-]{20,64}$/.test(token);
  const db = await getDb();
  const request = valid
    ? (
        await db
          .select()
          .from(schema.sellRequests)
          .where(eq(schema.sellRequests.tokenHash, await sha256Hex(token)))
          .limit(1)
      )[0]
    : undefined;

  if (!request) {
    return (
      <div className="mx-auto max-w-xl px-4 py-16 text-center">
        <p className="text-lg">{t.track.notFound}</p>
      </div>
    );
  }

  const events = await db
    .select()
    .from(schema.sellRequestEvents)
    .where(eq(schema.sellRequestEvents.requestId, request.id))
    .orderBy(asc(schema.sellRequestEvents.at));
  const firstName = request.name.split(/\s+/)[0];
  const message = `${request.code}: ${request.modelText}`;

  return (
    <div className="mx-auto max-w-xl px-4 pb-16 pt-8">
      {isNew ? (
        <div className="mb-6 flex gap-3 rounded-[22px] bg-ok-soft p-5 text-ok">
          <CheckCircle2 className="mt-0.5 h-6 w-6 shrink-0" aria-hidden />
          <div>
            <p className="font-display text-xl font-bold">{t.track.submitted}</p>
            <p className="mt-1 text-[0.97rem]">{t.track.submittedText}</p>
          </div>
        </div>
      ) : null}
      <h1 className="font-display text-3xl font-bold">{t.track.title(request.code)}</h1>
      <p className="mt-1 text-muted">
        {lang === "te" ? `నమస్తే ${firstName}` : `Hi ${firstName}`} · {t.track.saveNote}
      </p>

      <dl className="mt-6 divide-y divide-line rounded-[22px] border border-line bg-surface px-5">
        <div className="flex justify-between gap-4 py-3.5">
          <dt className="text-muted">{t.track.phone}</dt>
          <dd className="text-right font-semibold">
            {request.modelText}
            {request.storageGb ? ` ${request.storageGb} GB` : ""}
          </dd>
        </div>
        {request.estimateMin ? (
          <div className="flex justify-between gap-4 py-3.5">
            <dt className="text-muted">{t.track.estimate}</dt>
            <dd className="font-semibold tabular">
              {formatInr(request.estimateMin)} – {formatInr(request.estimateMax)}
            </dd>
          </div>
        ) : null}
        {request.offerPrice ? (
          <div className="flex justify-between gap-4 py-3.5">
            <dt className="text-muted">{t.track.offer}</dt>
            <dd className="font-display text-xl font-bold text-ok tabular">{formatInr(request.offerPrice)}</dd>
          </div>
        ) : null}
        {request.pickupAt ? (
          <div className="flex justify-between gap-4 py-3.5">
            <dt className="text-muted">{t.track.pickup}</dt>
            <dd className="font-semibold">{formatDateTime(request.pickupAt, lang)}</dd>
          </div>
        ) : null}
      </dl>

      <h2 className="mt-8 font-display text-xl font-bold">{t.track.timeline}</h2>
      <ol className="mt-3 space-y-0">
        {events.map((event, i) => {
          const last = i === events.length - 1;
          return (
            <li key={event.id} className="relative flex gap-3 pb-5">
              {!last ? <span className="absolute left-[11px] top-7 h-[calc(100%-1.25rem)] w-0.5 bg-line" aria-hidden /> : null}
              {last ? <CheckCircle2 className="h-6 w-6 shrink-0 text-brand-ink" aria-hidden /> : <Circle className="h-6 w-6 shrink-0 text-faint" aria-hidden />}
              <div>
                <p className={cn("font-semibold", last && "text-brand-ink")}>{t.track.status[event.status] ?? event.status}</p>
                <p className="text-sm text-muted">{formatDateTime(event.at, lang)}</p>
                {event.publicNote ? <p className="mt-1 text-[0.97rem]">{event.publicNote}</p> : null}
              </div>
            </li>
          );
        })}
      </ol>

      <div className="mt-4 flex flex-col gap-2 sm:flex-row">
        {settings.whatsapp ? (
          <a href={whatsappLink(settings.whatsapp, message)} target="_blank" rel="noopener noreferrer" className={buttonClass("chat", "lg", "flex-1")}>
            {t.action.askOnWhatsapp}
          </a>
        ) : null}
        {settings.phone ? (
          <a href={telLink(settings.phone)} className={buttonClass("secondary", "lg", "flex-1")}>
            {t.action.callShop}
          </a>
        ) : null}
      </div>
    </div>
  );
}
