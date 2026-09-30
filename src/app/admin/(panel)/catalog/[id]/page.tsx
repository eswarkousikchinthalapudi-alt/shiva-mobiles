import Link from "next/link";
import { notFound } from "next/navigation";
import { count, eq } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { requireAdmin } from "@/lib/auth/dal";
import { formatDate } from "@/lib/format";
import { fullModelName } from "@/lib/listings";
import { Alert, Card, PageHeader } from "@/components/admin/ui";
import { EditModelForm } from "@/components/admin/catalog-forms";

export const metadata = { title: "Edit model" };

const SOURCE: Record<string, string> = {
  seed: "sample data",
  ai: "the free AI's memory",
  wikipedia: "Wikipedia (read by the free AI)",
  gsmarena: "GSMArena",
  pasted: "text you pasted",
  manual: "typed by hand",
};

export default async function ModelPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ created?: string }> }) {
  const user = await requireAdmin();
  const [{ id }, { created }] = await Promise.all([params, searchParams]);
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const db = await getDb();
  const [model] = await db.select().from(schema.phoneModels).where(eq(schema.phoneModels.id, id)).limit(1);
  if (!model) notFound();
  const [[used], prices] = await Promise.all([
    db.select({ n: count() }).from(schema.listings).where(eq(schema.listings.modelId, id)),
    db.select({ n: count() }).from(schema.buyPrices).where(eq(schema.buyPrices.modelId, id)),
  ]);
  const listingsCount = Number(used?.n ?? 0);

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <PageHeader
        title={fullModelName(model.brand, model.name)}
        subtitle={`Specs from ${SOURCE[model.specSource]}${model.verifiedAt ? `, checked on ${formatDate(model.verifiedAt)}` : ", not checked yet"}.`}
      />
      {created ? <Alert tone="ok">{model.verifiedAt ? "Model added." : "Model added. Check the specs, then tick “I checked these specs”."}</Alert> : null}
      <Card>
        <EditModelForm
          id={model.id}
          canDelete={user.role === "owner" && listingsCount === 0}
          initiallyVerified={Boolean(model.verifiedAt)}
          initial={{
            brand: model.brand,
            name: model.name,
            aliases: model.aliases,
            os: model.os,
            launchYear: model.launchYear,
            chipset: model.chipset,
            performance: model.performance,
            displayInches: model.displayInches,
            displayType: model.displayType,
            refreshHz: model.refreshHz,
            mainCameraMp: model.mainCameraMp,
            cameraSummary: model.cameraSummary,
            frontCameraMp: model.frontCameraMp,
            batteryMah: model.batteryMah,
            chargingW: model.chargingW,
            has5g: model.has5g,
            variants: model.variants,
            sourceUrls: model.sourceUrls,
          }}
        />
      </Card>
      <p className="text-sm text-muted">
        Used by {listingsCount} {listingsCount === 1 ? "phone" : "phones"} in your records.{" "}
        {prices[0] && Number(prices[0].n) > 0 ? `${prices[0].n} buying price${Number(prices[0].n) === 1 ? "" : "s"} set.` : ""}{" "}
        <Link href={`/admin/pricing?model=${model.id}`} className="font-medium text-brand-ink underline">
          Buying prices
        </Link>
      </p>
    </div>
  );
}
