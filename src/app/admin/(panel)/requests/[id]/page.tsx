import { MessageCircle, Phone, Plus } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { asc, eq } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { en } from "@/i18n/en";
import { requireAdmin } from "@/lib/auth/dal";
import { displayMobile, formatDateTime, formatInr, telLink, whatsappLink } from "@/lib/format";
import { getShopSettings } from "@/lib/settings";
import { buttonClass } from "@/components/ui/button";
import { Card, PageHeader, StatusPill } from "@/components/admin/ui";
import { RequestUpdateForm } from "@/components/admin/request-form";
import { DeleteRequestButton } from "@/components/admin/delete-request-button";

export const metadata = { title: "Sell request" };

function toLocalInput(date: Date | null) {
  if (!date) return null;
  const ist = new Date(date.getTime() + 5.5 * 3600000);
  return ist.toISOString().slice(0, 16);
}

export default async function RequestDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireAdmin();
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const db = await getDb();
  const [request] = await db.select().from(schema.sellRequests).where(eq(schema.sellRequests.id, id)).limit(1);
  if (!request) notFound();
  const [photos, events, settings] = await Promise.all([
    db.select().from(schema.sellRequestPhotos).where(eq(schema.sellRequestPhotos.requestId, id)),
    db.select().from(schema.sellRequestEvents).where(eq(schema.sellRequestEvents.requestId, id)).orderBy(asc(schema.sellRequestEvents.at)),
    getShopSettings(),
  ]);

  const a = request.answers;
  const answerRows: [string, string][] = [
    [en.sell.q.power, en.sell.a.power[a.power]],
    [en.sell.q.screen, en.sell.a.screen[a.screen]],
    [en.sell.q.body, en.sell.a.body[a.body]],
    [en.sell.q.battery, en.sell.a.battery[a.battery]],
    [en.sell.q.faults, a.faults.length ? a.faults.map((f) => en.sell.a.faults[f]).join(", ") : en.sell.allWorking],
    [en.sell.q.extras, a.extras.length ? a.extras.map((x) => en.sell.a.extras[x]).join(", ") : en.sell.noneOfThese],
  ];

  const phoneName = `${request.modelText}${request.storageGb ? ` ${request.storageGb} GB` : ""}`;
  const offer = request.offerPrice ? formatInr(request.offerPrice) : null;
  const greeting =
    request.lang === "te"
      ? `నమస్తే ${request.name}, ${settings.shopName} నుంచి. మీ ${phoneName} (${request.code}) గురించి.`
      : `Hi ${request.name}, this is ${settings.shopName} about your ${phoneName} (${request.code}).`;
  const offerText = offer
    ? request.lang === "te"
      ? `${greeting} మేము ${offer} ఇవ్వగలం. ${request.area} నుంచి మేమే తీసుకుంటాం. సరే అంటే "OK" అని రిప్లై చేయండి.`
      : `${greeting} We can offer ${offer}. We can pick it up from ${request.area}. Reply OK to book a pickup.`
    : greeting;

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <PageHeader
        title={phoneName}
        subtitle={
          <span className="inline-flex flex-wrap items-center gap-2">
            {request.code} <StatusPill status={request.status} /> {formatDateTime(request.createdAt)}
          </span>
        }
      />

      <Card>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <p className="text-sm text-muted">Seller</p>
            <p className="text-lg font-semibold">{request.name}</p>
            <p>{displayMobile(request.phone)}</p>
            <p className="text-sm text-muted">
              {request.area}
              {request.pincode ? ` · ${request.pincode}` : ""} · prefers {request.preferredContact === "call" ? "a call" : "WhatsApp"}
              {request.lang === "te" ? " · Telugu" : ""}
            </p>
            {request.wantsExchange ? <p className="mt-1 text-sm font-semibold text-brand-ink">Wants to exchange for another phone</p> : null}
          </div>
          <div className="space-y-1">
            <p className="text-sm text-muted">Website estimate</p>
            <p className="font-display text-xl font-bold tabular">
              {request.estimateMin ? `${formatInr(request.estimateMin)} – ${formatInr(request.estimateMax)}` : "No estimate"}
            </p>
            {request.expectedPrice ? <p className="text-sm">Seller expects {formatInr(request.expectedPrice)}</p> : null}
          </div>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <a href={whatsappLink(`91${request.phone}`, offerText)} target="_blank" rel="noopener noreferrer" className={buttonClass("chat", "md")}>
            <MessageCircle className="h-4 w-4" aria-hidden /> {offer ? "Send offer on WhatsApp" : "Message on WhatsApp"}
          </a>
          <a href={telLink(`+91${request.phone}`)} className={buttonClass("secondary", "md")}>
            <Phone className="h-4 w-4" aria-hidden /> Call
          </a>
          {request.status === "bought" || request.status === "pickup_scheduled" ? (
            <Link href={`/admin/phones/new?from=${request.id}`} className={buttonClass("primary", "md")}>
              <Plus className="h-4 w-4" aria-hidden /> Add to stock
            </Link>
          ) : null}
        </div>
      </Card>

      <Card title="Condition (from the seller)">
        <dl className="divide-y divide-line">
          {answerRows.map(([q, answer]) => (
            <div key={q} className="grid gap-1 py-2.5 sm:grid-cols-[1fr_1fr]">
              <dt className="text-sm text-muted">{q}</dt>
              <dd className="font-medium">{answer}</dd>
            </div>
          ))}
        </dl>
      </Card>

      {photos.length ? (
        <Card title="Photos from the seller">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {photos.map((p) => (
              <a
                key={p.id}
                href={`/admin/media/${p.mediaId}.webp`}
                target="_blank"
                rel="noopener"
                className="block aspect-[3/4] overflow-hidden rounded-xl bg-surface-2"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={`/admin/media/${p.mediaId}.webp`} alt="Seller photo" className="h-full w-full object-cover" />
              </a>
            ))}
          </div>
        </Card>
      ) : null}

      <Card title="Update">
        <RequestUpdateForm
          id={request.id}
          status={request.status}
          offerPrice={request.offerPrice}
          pickupAt={toLocalInput(request.pickupAt)}
          adminNotes={request.adminNotes}
        />
      </Card>

      <Card title="History">
        <ol className="space-y-2 text-[0.95rem]">
          {events.map((e) => (
            <li key={e.id} className="flex flex-wrap gap-x-2">
              <span className="text-muted">{formatDateTime(e.at)}</span>
              <StatusPill status={e.status} />
              {e.publicNote ? <span>“{e.publicNote}”</span> : null}
            </li>
          ))}
        </ol>
      </Card>

      {user.role === "owner" ? <DeleteRequestButton id={request.id} /> : null}
    </div>
  );
}
