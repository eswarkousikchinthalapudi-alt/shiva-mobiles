import { ShieldCheck } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { headers } from "next/headers";
import { getT } from "@/i18n/server";
import { turnstileSiteKey } from "@/lib/security/turnstile";
import { WarrantyForm } from "@/components/site/warranty-form";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getT();
  return { title: t.bill.checkTitle, description: t.bill.checkText };
}

export default async function WarrantyPage() {
  const [{ t }, h] = await Promise.all([getT(), headers()]);
  return (
    <div className="mx-auto max-w-md px-4 pb-16 pt-10">
      <ShieldCheck className="h-10 w-10 text-brand-ink" aria-hidden />
      <h1 className="mt-3 font-display text-3xl font-bold">{t.bill.checkTitle}</h1>
      <p className="mt-2 text-muted">{t.bill.checkText}</p>
      <div className="mt-6 rounded-[24px] border border-line bg-surface p-5">
        <WarrantyForm siteKey={turnstileSiteKey()} nonce={h.get("x-nonce")} />
      </div>
      <p className="mt-6 text-sm text-muted">
        {t.bill.terms}{" "}
        <Link href="/terms" className="font-medium text-brand-ink underline">
          {t.footer.terms}
        </Link>
      </p>
    </div>
  );
}
