"use client";

import { useActionState } from "react";
import { findBillAction, type WarrantyState } from "@/app/(site)/warranty/actions";
import { useT } from "@/i18n/client";
import { buttonClass } from "@/components/ui/button";
import { Turnstile } from "./turnstile";

const inputClass = "h-13 w-full rounded-2xl border-2 border-line-strong bg-surface px-4 text-base focus:border-brand focus:outline-none";

export function WarrantyForm({ siteKey, nonce }: { siteKey: string | null; nonce: string | null }) {
  const t = useT();
  const [state, action, pending] = useActionState<WarrantyState, FormData>(findBillAction, undefined);
  const error =
    state?.error === "notFound"
      ? t.bill.notFound
      : state?.error === "rate"
        ? t.form.tooMany
        : state?.error === "mobile"
          ? t.form.invalidMobile
          : state?.error === "billNo"
            ? t.bill.billNoFormat
            : state?.error === "captcha"
              ? t.form.captcha
              : null;
  return (
    <form action={action} className="space-y-4">
      <div className="space-y-1.5">
        <label htmlFor="billNo" className="block text-sm font-semibold">
          {t.bill.billNo}
        </label>
        <input
          id="billNo"
          name="billNo"
          required
          maxLength={30}
          autoCapitalize="characters"
          autoComplete="off"
          placeholder={t.bill.billNoPlaceholder}
          defaultValue={state?.billNo}
          aria-invalid={state?.error === "billNo"}
          className={inputClass}
        />
      </div>
      <div className="space-y-1.5">
        <label htmlFor="mobile" className="block text-sm font-semibold">
          {t.sell.mobile}
        </label>
        <input
          id="mobile"
          name="mobile"
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          required
          maxLength={16}
          defaultValue={state?.mobile}
          aria-invalid={state?.error === "mobile"}
          className={inputClass}
        />
      </div>
      <Turnstile siteKey={siteKey} nonce={nonce} resetSignal={state} />
      {error ? (
        <p role="alert" className="rounded-2xl bg-bad-soft px-4 py-3 text-[0.95rem] font-medium text-bad">
          {error}
        </p>
      ) : null}
      <button type="submit" disabled={pending} className={buttonClass("primary", "lg", "w-full")}>
        {pending ? "…" : t.bill.open}
      </button>
    </form>
  );
}
