"use client";

import { useState, useTransition } from "react";
import { saveSettingsAction, type SettingsInput } from "@/app/admin/(panel)/settings/actions";
import { buttonClass } from "@/components/ui/button";
import { cn } from "@/components/ui/cn";
import { Alert, Card, Field, inputClass } from "./ui";

type TextKey = Exclude<keyof SettingsInput, "defaultWarrantyMonths" | "retentionDays" | "showPrices">;

export function SettingsForm({ initial }: { initial: SettingsInput }) {
  const [v, setV] = useState<SettingsInput>(initial);
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();

  const text = (
    key: TextKey,
    label: string,
    options?: { hint?: string; placeholder?: string; lang?: "te"; area?: boolean; max?: number; inputMode?: "tel" | "url" },
  ) => {
    const id = `set-${key}`;
    const common = {
      id,
      value: v[key],
      maxLength: options?.max ?? 200,
      placeholder: options?.placeholder,
      lang: options?.lang,
      onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setV({ ...v, [key]: e.target.value }),
    };
    return (
      <Field label={label} htmlFor={id} hint={options?.hint}>
        {options?.area ? (
          <textarea {...common} className={cn(inputClass, "h-20 py-2")} />
        ) : (
          <input {...common} inputMode={options?.inputMode} className={inputClass} />
        )}
      </Field>
    );
  };

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          const res = await saveSettingsAction(v);
          setResult(res.ok ? { ok: true, text: "Saved. The website shows the new details now." } : { ok: false, text: res.error });
        });
      }}
    >
      <Card title="Shop">
        <div className="grid gap-3 sm:grid-cols-2">
          {text("shopName", "Shop name", { max: 60 })}
          {text("town", "Town", { max: 60, placeholder: "Narasaraopet" })}
          {text("taglineEn", "Short line about the shop (English)", { max: 120 })}
          {text("taglineTe", "Short line about the shop (Telugu)", { max: 120, lang: "te" })}
        </div>
      </Card>

      <Card title="Contact">
        <div className="grid gap-3 sm:grid-cols-2">
          {text("phone", "Phone number (for calls)", { max: 20, placeholder: "+91 98765 43210", inputMode: "tel" })}
          {text("whatsapp", "WhatsApp number", { max: 20, placeholder: "98765 43210", inputMode: "tel", hint: "Customers' messages come to this number." })}
          {text("addressEn", "Address (English)", { area: true })}
          {text("addressTe", "Address (Telugu)", { area: true, lang: "te" })}
          {text("hoursEn", "Opening hours (English)", { max: 120, placeholder: "Mon–Sat 9:30 am – 9 pm, Sun 10 am – 2 pm" })}
          {text("hoursTe", "Opening hours (Telugu)", { max: 120, lang: "te" })}
          {text("mapUrl", "Google Maps link", {
            inputMode: "url",
            placeholder: "https://maps.app.goo.gl/…",
            hint: "In Google Maps, open the shop, tap Share and copy the link.",
          })}
          {text("googleReviewUrl", "Google review link", {
            inputMode: "url",
            placeholder: "https://g.page/r/…/review",
            hint: "From your Google Business Profile: “Ask for reviews”. Sent to buyers after a sale.",
          })}
        </div>
      </Card>

      <Card title="Prices">
        <label className="flex cursor-pointer items-start gap-3 rounded-2xl border-2 border-line-strong bg-surface p-3 has-[:checked]:border-brand has-[:checked]:bg-brand-soft">
          <input
            type="checkbox"
            checked={v.showPrices}
            onChange={(e) => setV({ ...v, showPrices: e.target.checked })}
            className="mt-0.5 h-5 w-5 accent-[var(--brand)]"
          />
          <span>
            <span className="block font-semibold">Show selling prices on the website</span>
            <span className="block text-sm text-muted">
              When off, visitors see “Ask for price” on the website, WhatsApp posters and captions, and contact you instead. Prices, price filters and “you
              save” lines are hidden. Bills and the admin panel still show prices.
            </span>
          </span>
        </label>
      </Card>

      <Card title="Bills and website">
        <div className="grid gap-3 sm:grid-cols-2">
          {text("gstin", "GSTIN (if registered)", { max: 15, placeholder: "37ABCDE1234F1Z5", hint: "Printed on bills. Leave empty if not registered." })}
          {text("siteUrl", "Website address", {
            max: 200,
            inputMode: "url",
            placeholder: "https://shivamobiles.in",
            hint: "Used in WhatsApp posts and bill links.",
          })}
          <Field label="Default shop warranty (months)" htmlFor="set-warranty">
            <select
              id="set-warranty"
              className={inputClass}
              value={v.defaultWarrantyMonths}
              onChange={(e) => setV({ ...v, defaultWarrantyMonths: Number(e.target.value) })}
            >
              {[0, 1, 2, 3, 6, 12].map((m) => (
                <option key={m} value={m}>
                  {m === 0 ? "No warranty" : `${m} month${m === 1 ? "" : "s"}`}
                </option>
              ))}
            </select>
          </Field>
          <Field
            label="Delete old sell requests after (days)"
            htmlFor="set-retention"
            hint="Counted from the last update. The seller's details and photos are removed automatically. 365 is a good default."
          >
            <input
              id="set-retention"
              className={inputClass}
              inputMode="numeric"
              value={v.retentionDays || ""}
              onChange={(e) => setV({ ...v, retentionDays: Number(e.target.value.replace(/\D/g, "")) || 0 })}
            />
          </Field>
        </div>
      </Card>

      {result ? (
        <Alert live tone={result.ok ? "ok" : "bad"}>
          {result.text}
        </Alert>
      ) : null}
      <div className="sticky bottom-24 z-10 lg:bottom-4">
        <button type="submit" disabled={pending} className={buttonClass("primary", "lg", "w-full shadow-lg sm:w-auto")}>
          {pending ? "Saving…" : "Save settings"}
        </button>
      </div>
    </form>
  );
}
