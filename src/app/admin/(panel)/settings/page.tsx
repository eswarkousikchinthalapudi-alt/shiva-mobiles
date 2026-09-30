import { requireAdmin } from "@/lib/auth/dal";
import { getShopSettings } from "@/lib/settings";
import { PageHeader } from "@/components/admin/ui";
import { SettingsForm } from "@/components/admin/settings-form";

export const metadata = { title: "Shop settings" };

export default async function SettingsPage() {
  await requireAdmin({ role: "owner" });
  const s = await getShopSettings();
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="Shop settings" subtitle="Details shown on the website, bills and WhatsApp posts." />
      <SettingsForm
        initial={{
          shopName: s.shopName,
          taglineEn: s.taglineEn,
          taglineTe: s.taglineTe,
          phone: s.phone,
          whatsapp: s.whatsapp,
          addressEn: s.addressEn,
          addressTe: s.addressTe,
          town: s.town,
          mapUrl: s.mapUrl,
          hoursEn: s.hoursEn,
          hoursTe: s.hoursTe,
          googleReviewUrl: s.googleReviewUrl,
          gstin: s.gstin,
          siteUrl: s.siteUrl,
          defaultWarrantyMonths: s.defaultWarrantyMonths,
          retentionDays: s.retentionDays,
        }}
      />
    </div>
  );
}
