import { BellRing } from "lucide-react";
import type { Metadata } from "next";
import { headers } from "next/headers";
import { getT } from "@/i18n/server";
import { turnstileSiteKey } from "@/lib/security/turnstile";
import { getShopSettings } from "@/lib/settings";
import { WantedForm } from "@/components/site/wanted-form";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getT();
  return { title: t.wanted.title, description: t.wanted.text };
}

export default async function WantedPage({ searchParams }: { searchParams: Promise<{ want?: string }> }) {
  const [{ t }, settings, h, params] = await Promise.all([getT(), getShopSettings(), headers(), searchParams]);
  const initialWant = String(params.want ?? "").slice(0, 100);
  return (
    <div className="mx-auto max-w-xl px-4 pb-16 pt-8 sm:pt-10">
      <BellRing className="h-10 w-10 text-brand-ink" aria-hidden />
      <h1 className="mt-3 font-display text-3xl font-bold sm:text-4xl">{t.wanted.title}</h1>
      <p className="mt-2 text-muted">{t.wanted.text}</p>

      <ol className="mt-6 grid gap-2 sm:grid-cols-3">
        {t.wanted.steps.map((step, i) => (
          <li key={step} className="flex gap-3 rounded-2xl bg-surface p-3.5 text-[0.95rem] sm:flex-col sm:gap-2">
            <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-brand text-sm font-bold text-brand-fg" aria-hidden>
              {i + 1}
            </span>
            {step}
          </li>
        ))}
      </ol>

      <div className="mt-6 rounded-[24px] border border-line bg-surface p-5">
        <WantedForm initialWant={initialWant} shopName={settings.shopName} siteKey={turnstileSiteKey()} nonce={h.get("x-nonce")} />
      </div>
    </div>
  );
}
