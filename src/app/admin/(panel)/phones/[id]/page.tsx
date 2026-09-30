import { ExternalLink } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getModelOption } from "@/lib/admin/catalog";
import { adminGetListing } from "@/lib/admin/listings";
import { findWantedMatches } from "@/lib/admin/wanted";
import { requireAdmin } from "@/lib/auth/dal";
import { displayMobile, formatDate, formatInr } from "@/lib/format";
import { getShopSettings, getSiteUrl } from "@/lib/settings";
import { shareDataByCode } from "@/lib/share";
import { aiLookupEnabled } from "@/lib/specs";
import { Alert, Card, PageHeader, StatusPill } from "@/components/admin/ui";
import { ListingStatusActions, SaleFollowUp } from "@/components/admin/listing-actions";
import { PhoneForm, type PhoneFormValues } from "@/components/admin/phone-form";
import { WantedMatchList } from "@/components/admin/wanted-matches";
import { WhatsAppShare } from "@/components/admin/whatsapp-share";

export const metadata = { title: "Phone" };

export default async function EditPhonePage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ saved?: string }> }) {
  const user = await requireAdmin();
  const { id } = await params;
  const { saved } = await searchParams;
  const data = await adminGetListing(id);
  if (!data) notFound();
  const { listing, model, photos, sale, stats } = data;
  const [settings, siteUrl, share, modelOption] = await Promise.all([getShopSettings(), getSiteUrl(), shareDataByCode(listing.code), getModelOption(model.id)]);
  const isPublic = ["available", "reserved", "sold"].includes(listing.status);
  const matches =
    listing.status === "available" || listing.status === "reserved"
      ? await findWantedMatches({
          brand: model.brand,
          name: model.name,
          priceInr: listing.priceInr,
          has5g: model.has5g,
          batteryMah: model.batteryMah,
        })
      : [];

  const initial: PhoneFormValues = {
    ramGb: listing.ramGb,
    storageGb: listing.storageGb,
    color: listing.color,
    launchPriceInr: listing.launchPriceInr,
    grade: listing.grade,
    batteryHealth: listing.batteryHealth,
    batteryNote: listing.batteryNote,
    tests: listing.tests,
    hasBox: listing.hasBox,
    hasCharger: listing.hasCharger,
    hasBill: listing.hasBill,
    warrantyMonths: listing.warrantyMonths,
    brandWarrantyUntil: listing.brandWarrantyUntil,
    priceInr: listing.priceInr,
    costInr: user.role === "owner" ? listing.costInr : null,
    shopTags: listing.shopTags.filter((t): t is PhoneFormValues["shopTags"][number] => ["gaming", "camera", "parents", "students", "office"].includes(t)),
    notesEn: listing.notesEn,
    notesTe: listing.notesTe,
    featured: listing.featured,
    imeiStatus: listing.imeiStatus,
    imeiCheckRef: listing.imeiCheckRef,
    photos,
  };

  const billMessage = sale?.billPath ? `Your bill and warranty card from ${settings.shopName}: ${siteUrl}${sale.billPath}` : "";
  const reviewMessage = settings.googleReviewUrl
    ? `Hope you are happy with your ${data.name}! If you have a minute, please leave us a Google review. It really helps our shop: ${settings.googleReviewUrl}`
    : null;

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <PageHeader
        title={data.name}
        subtitle={
          <span className="inline-flex flex-wrap items-center gap-2">
            <span className="tabular">{listing.code}</span>
            <StatusPill status={listing.status} />
            <span>{formatInr(listing.priceInr)}</span>
          </span>
        }
        action={
          isPublic ? (
            <Link
              href={`/phones/${listing.slug}`}
              target="_blank"
              className="inline-flex items-center gap-1.5 text-sm font-semibold text-brand-ink hover:underline"
            >
              View on website <ExternalLink className="h-4 w-4" aria-hidden />
            </Link>
          ) : null
        }
      />

      {saved === "published" ? <Alert tone="ok">Published. It is live on the website now. Share it to WhatsApp below.</Alert> : null}
      {saved === "1" ? <Alert tone="ok">Saved.</Alert> : null}

      <Card>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="grid grid-cols-4 gap-4 text-center">
            {[
              ["Views", stats.views],
              ["From WhatsApp", stats.whatsappViews],
              ["WhatsApp taps", stats.whatsappClicks],
              ["Calls", stats.calls],
            ].map(([label, value]) => (
              <div key={label as string}>
                <p className="font-display text-2xl font-bold tabular">{value}</p>
                <p className="text-xs text-muted">{label}</p>
              </div>
            ))}
          </div>
          {share && isPublic && listing.status !== "sold" && photos.length > 0 ? (
            <WhatsAppShare
              code={listing.code}
              captionEn={share.captionEn}
              captionTe={share.captionTe}
              posterUrl={share.posterUrl}
              photoUrls={share.photoUrls}
            />
          ) : null}
        </div>
        <div className="mt-4 border-t border-line pt-4">
          <ListingStatusActions
            id={listing.id}
            status={listing.status}
            isOwner={user.role === "owner"}
            priceInr={listing.priceInr}
            warrantyMonths={listing.warrantyMonths}
          />
        </div>
      </Card>

      {sale ? (
        <Card title="Sale">
          <dl className="grid grid-cols-2 gap-3 text-[0.95rem] sm:grid-cols-4">
            <div>
              <dt className="text-sm text-muted">Bill</dt>
              <dd className="font-semibold">
                {sale.billPath ? (
                  <Link href={sale.billPath} target="_blank" className="text-brand-ink underline">
                    {sale.billNo}
                  </Link>
                ) : (
                  sale.billNo
                )}
              </dd>
            </div>
            <div>
              <dt className="text-sm text-muted">Customer</dt>
              <dd className="font-semibold">{sale.buyerName}</dd>
              <dd className="text-sm">{displayMobile(sale.buyerPhone)}</dd>
            </div>
            <div>
              <dt className="text-sm text-muted">Sold for</dt>
              <dd className="font-semibold">{formatInr(sale.soldPriceInr)}</dd>
            </div>
            <div>
              <dt className="text-sm text-muted">Warranty until</dt>
              <dd className="font-semibold">{sale.warrantyMonths ? formatDate(sale.warrantyUntil) : "None"}</dd>
            </div>
          </dl>
          <div className="mt-4">
            <SaleFollowUp
              saleId={sale.id}
              buyerPhone={sale.buyerPhone}
              billMessage={billMessage}
              reviewMessage={reviewMessage}
              reviewRequestedAt={sale.reviewRequestedAt?.toISOString() ?? null}
            />
          </div>
        </Card>
      ) : null}

      {matches.length ? (
        <Card title={`${matches.length} ${matches.length === 1 ? "person is" : "people are"} waiting for a phone like this`}>
          <WantedMatchList
            matches={matches}
            phoneName={`${data.name} ${listing.storageGb} GB`}
            priceInr={listing.priceInr}
            url={`${siteUrl}/phones/${listing.slug}`}
            shopName={settings.shopName}
          />
        </Card>
      ) : null}

      {listing.status === "sold" ? (
        <Alert tone="info">
          This phone is sold, so its details are locked and the customer’s bill stays correct. The owner can cancel the sale above if something must change.
        </Alert>
      ) : (
        <>
          <h2 className="pt-2 font-display text-xl font-bold">Edit details</h2>
          <PhoneForm
            listingId={listing.id}
            initial={initial}
            initialModel={modelOption}
            isOwner={user.role === "owner"}
            aiEnabled={aiLookupEnabled()}
            defaultWarranty={settings.defaultWarrantyMonths}
            status={listing.status}
          />
        </>
      )}
    </div>
  );
}
