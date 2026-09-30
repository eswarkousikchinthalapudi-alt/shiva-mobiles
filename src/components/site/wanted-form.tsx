"use client";

import { CheckCircle2 } from "lucide-react";
import Link from "next/link";
import { startTransition, useActionState, useState } from "react";
import { submitWantedRequest, type WantedState } from "@/app/(site)/wanted/actions";
import { useLang, useT } from "@/i18n/client";
import { normalizeIndianMobile } from "@/lib/format";
import { buttonClass } from "@/components/ui/button";
import { cn } from "@/components/ui/cn";
import { Turnstile } from "./turnstile";

const inputClass = "h-13 w-full rounded-2xl border-2 bg-surface px-4 text-base focus:border-brand focus:outline-none";

export function WantedForm({ initialWant, shopName, siteKey, nonce }: { initialWant: string; shopName: string; siteKey: string | null; nonce: string | null }) {
  const t = useT();
  const lang = useLang();
  const [want, setWant] = useState(initialWant);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formKey, setFormKey] = useState(0);
  const [state, formAction, pending] = useActionState<WantedState, FormData>(submitWantedRequest, undefined);
  // Lets "ask for another phone" hide the success message without a new request.
  const [dismissed, setDismissed] = useState<WantedState>(undefined);

  if (state?.ok && state !== dismissed) {
    return (
      <div className="rounded-[24px] bg-ok-soft p-6 text-ok" role="status">
        <CheckCircle2 className="h-8 w-8" aria-hidden />
        <p className="mt-3 font-display text-xl font-bold">{t.wanted.done}</p>
        <div className="mt-5 flex flex-col gap-2 sm:flex-row">
          <button
            type="button"
            onClick={() => {
              setDismissed(state);
              setWant("");
              setFormKey((k) => k + 1);
            }}
            className={buttonClass("secondary", "md")}
          >
            {t.wanted.again}
          </button>
          <Link href="/phones" className={buttonClass("primary", "md")}>
            {t.action.seeAll}
          </Link>
        </div>
      </div>
    );
  }

  const serverError =
    state && !state.ok
      ? state.error === "mobile"
        ? t.form.invalidMobile
        : state.error === "consent"
          ? t.form.consentNeeded
          : state.error === "captcha"
            ? t.form.captcha
            : state.error === "rate"
              ? t.form.tooMany
              : t.form.error
      : null;

  const clear = (field: string) =>
    setErrors((current) => {
      if (!current[field]) return current;
      const next = { ...current };
      delete next[field];
      return next;
    });

  const field = (name: string, label: string, props: React.InputHTMLAttributes<HTMLInputElement>) => (
    <div className="space-y-1.5">
      <label htmlFor={`wanted-${name}`} className="block text-sm font-semibold">
        {label}
      </label>
      <input
        id={`wanted-${name}`}
        name={name}
        aria-invalid={Boolean(errors[name])}
        aria-describedby={errors[name] ? `wanted-${name}-error` : undefined}
        onInput={() => clear(name)}
        className={cn(inputClass, errors[name] ? "border-bad" : "border-line-strong")}
        {...props}
      />
      {errors[name] ? (
        <p id={`wanted-${name}-error`} className="text-sm font-medium text-bad">
          {errors[name]}
        </p>
      ) : null}
    </div>
  );

  return (
    <form
      key={formKey}
      noValidate
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        const formData = new FormData(e.currentTarget);
        const next: Record<string, string> = {};
        if (String(formData.get("want") ?? "").trim().length < 2) next.want = t.form.required;
        if (String(formData.get("name") ?? "").trim().length < 2) next.name = t.form.required;
        if (!normalizeIndianMobile(String(formData.get("phone") ?? ""))) next.phone = t.form.invalidMobile;
        if (formData.get("consent") !== "on") next.consent = t.form.consentNeeded;
        setErrors(next);
        if (Object.keys(next).length) return;
        formData.set("lang", lang);
        startTransition(() => formAction(formData));
      }}
    >
      <input type="text" name="website" tabIndex={-1} autoComplete="off" className="absolute -left-[9999px] h-px w-px opacity-0" aria-hidden />
      <div className="space-y-1.5">
        <label htmlFor="wanted-want" className="block text-sm font-semibold">
          {t.wanted.want}
        </label>
        <input
          id="wanted-want"
          name="want"
          value={want}
          onChange={(e) => {
            setWant(e.target.value);
            clear("want");
          }}
          maxLength={100}
          placeholder={t.wanted.wantPlaceholder}
          aria-invalid={Boolean(errors.want)}
          aria-describedby={errors.want ? "wanted-want-error" : "wanted-examples"}
          className={cn(inputClass, errors.want ? "border-bad" : "border-line-strong")}
        />
        {errors.want ? (
          <p id="wanted-want-error" className="text-sm font-medium text-bad">
            {errors.want}
          </p>
        ) : null}
        <div id="wanted-examples" className="flex flex-wrap items-center gap-2 pt-1 text-sm">
          <span className="text-muted">{t.wanted.examplesLabel}:</span>
          {t.wanted.examples.map((example) => (
            <button
              key={example}
              type="button"
              onClick={() => {
                setWant(example);
                clear("want");
              }}
              className="rounded-full border border-line-strong bg-surface px-3 py-1 font-medium hover:border-brand"
            >
              {example}
            </button>
          ))}
        </div>
      </div>
      {field("maxBudget", t.wanted.budget, { inputMode: "numeric", maxLength: 8, placeholder: "15000", autoComplete: "off" })}
      {field("name", t.wanted.name, { maxLength: 60, autoComplete: "name" })}
      {field("phone", t.wanted.mobile, { type: "tel", inputMode: "tel", maxLength: 16, autoComplete: "tel" })}

      <label className="flex cursor-pointer items-start gap-3 text-[0.97rem]">
        <input
          type="checkbox"
          name="consent"
          className="mt-0.5 h-5 w-5 shrink-0 accent-[var(--brand)]"
          aria-invalid={Boolean(errors.consent)}
          onChange={() => clear("consent")}
        />
        <span>
          {t.wanted.consent(shopName)}{" "}
          <Link href="/privacy" target="_blank" className="font-medium text-brand-ink underline">
            {t.sell.privacyLink}
          </Link>
        </span>
      </label>
      {errors.consent ? <p className="text-sm font-medium text-bad">{errors.consent}</p> : null}

      <Turnstile siteKey={siteKey} nonce={nonce} resetSignal={state && !state.ok ? state : undefined} />

      {serverError ? (
        <p role="alert" className="rounded-2xl bg-bad-soft px-4 py-3 text-[0.95rem] font-medium text-bad">
          {serverError}
        </p>
      ) : null}
      <button type="submit" disabled={pending} className={buttonClass("primary", "lg", "w-full")}>
        {pending ? t.wanted.sending : t.wanted.submit}
      </button>
    </form>
  );
}
