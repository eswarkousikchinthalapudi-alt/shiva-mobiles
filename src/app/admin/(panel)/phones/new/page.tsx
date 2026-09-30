import { eq } from "drizzle-orm";
import Link from "next/link";
import { getDb, schema } from "@/db";
import { getModelOption } from "@/lib/admin/catalog";
import { requireAdmin } from "@/lib/auth/dal";
import { getShopSettings } from "@/lib/settings";
import { aiLookupEnabled } from "@/lib/specs";
import { allPassed } from "@/lib/phone-tests";
import { Alert, PageHeader } from "@/components/admin/ui";
import { PhoneForm, type PhoneFormValues } from "@/components/admin/phone-form";

export const metadata = { title: "Add a phone" };

export default async function NewPhonePage({ searchParams }: { searchParams: Promise<{ from?: string }> }) {
  const user = await requireAdmin();
  const settings = await getShopSettings();
  const { from } = await searchParams;

  // Coming from a sell request: start with that phone's model and storage.
  let initialModel = null;
  let initial: PhoneFormValues | null = null;
  let sourceRequestId: string | null = null;
  let requestNote: string | null = null;
  if (from && /^[0-9a-f-]{36}$/i.test(from)) {
    const db = await getDb();
    const [request] = await db.select().from(schema.sellRequests).where(eq(schema.sellRequests.id, from)).limit(1);
    if (request) {
      sourceRequestId = request.id;
      requestNote = `${request.code}: ${request.modelText} from ${request.name}`;
      if (request.modelId) initialModel = await getModelOption(request.modelId);
      const variant = initialModel?.variants.find((v) => v.storageGb === request.storageGb) ?? initialModel?.variants[0];
      initial = {
        ramGb: variant?.ramGb ?? null,
        storageGb: request.storageGb ?? variant?.storageGb ?? 0,
        color: "",
        launchPriceInr: variant?.launchPriceInr ?? null,
        grade:
          request.answers.screen === "perfect" && request.answers.body === "perfect"
            ? "A"
            : request.answers.screen === "cracked" || request.answers.body === "damaged"
              ? "C"
              : "B",
        batteryHealth: null,
        batteryNote: null,
        tests: allPassed(),
        hasBox: request.answers.extras.includes("box"),
        hasCharger: request.answers.extras.includes("charger"),
        hasBill: request.answers.extras.includes("bill"),
        warrantyMonths: settings.defaultWarrantyMonths,
        brandWarrantyUntil: null,
        priceInr: 0,
        costInr: request.offerPrice ?? null,
        shopTags: [],
        notesEn: "",
        notesTe: "",
        featured: false,
        imeiStatus: "pending",
        imeiCheckRef: null,
        photos: [],
      };
    }
  }

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        title="Add a phone"
        subtitle="Takes about two minutes. You can save a draft and finish later."
        action={
          <Link href="/admin/phones" className="text-sm font-semibold text-muted hover:underline">
            Cancel
          </Link>
        }
      />
      {requestNote ? (
        <Alert tone="info" className="mb-4">
          Bought from sell request {requestNote}. Saving will mark the request as bought.
        </Alert>
      ) : null}
      <PhoneForm
        listingId={null}
        initial={initial}
        initialModel={initialModel}
        isOwner={user.role === "owner"}
        aiEnabled={aiLookupEnabled()}
        defaultWarranty={settings.defaultWarrantyMonths}
        status={null}
        sourceRequestId={sourceRequestId}
      />
    </div>
  );
}
