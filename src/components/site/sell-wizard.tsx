"use client";

import { ArrowLeft, Camera, Check, Loader2, Search, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import { estimateSellPrice, searchSellModels, submitSellRequest, type EstimateResult, type PublicModel, type SubmitState } from "@/app/(site)/sell/actions";
import { useLang, useT } from "@/i18n/client";
import { formatInr, normalizeIndianMobile } from "@/lib/format";
import { EXTRA_KEYS, FAULT_KEYS, SINGLE_CHOICE, type ExtraKey, type FaultKey, type SellAnswers, type SingleKey } from "@/lib/sell-quiz";
import { buttonClass } from "@/components/ui/button";
import { cn } from "@/components/ui/cn";
import { Turnstile } from "./turnstile";

type Step = "phone" | SingleKey | "faults" | "extras" | "estimate" | "details";
const ORDER: Step[] = ["phone", "power", "screen", "body", "battery", "faults", "extras", "estimate", "details"];

function macroIndex(step: Step) {
  if (step === "phone") return 0;
  if (step === "estimate") return 2;
  if (step === "details") return 3;
  return 1;
}

async function shrink(file: File, max = 1600): Promise<Blob> {
  try {
    const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
    const scale = Math.min(1, max / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext("2d")?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();
    return await new Promise<Blob>((resolve) => canvas.toBlob((b) => resolve(b ?? file), "image/jpeg", 0.85));
  } catch {
    return file;
  }
}

function Option({
  selected,
  onClick,
  children,
  multi = false,
  plain = false,
}: {
  selected: boolean;
  onClick: () => void;
  children: React.ReactNode;
  multi?: boolean;
  /** A normal button (used for search results), not part of a choice group. */
  plain?: boolean;
}) {
  return (
    <button
      type="button"
      role={plain ? undefined : multi ? "checkbox" : "radio"}
      aria-checked={plain ? undefined : selected}
      onClick={onClick}
      className={cn(
        "flex min-h-14 w-full items-center gap-3 rounded-2xl border-2 px-4 py-3 text-left text-[1.02rem] font-medium transition-colors",
        selected ? "border-brand bg-brand-soft text-brand-ink" : "border-line bg-surface hover:border-line-strong",
      )}
    >
      <span
        className={cn(
          "grid h-6 w-6 shrink-0 place-items-center border-2",
          multi ? "rounded-md" : "rounded-full",
          selected ? "border-brand bg-brand text-brand-fg" : "border-line-strong",
        )}
        aria-hidden
      >
        {selected ? <Check className="h-4 w-4" /> : null}
      </span>
      {children}
    </button>
  );
}

export function SellWizard({
  shopName,
  siteKey,
  nonce,
  whatsappHref,
}: {
  shopName: string;
  siteKey: string | null;
  nonce: string | null;
  whatsappHref: string | null;
}) {
  const t = useT();
  const lang = useLang();
  const router = useRouter();
  const [step, setStep] = useState<Step>("phone");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<PublicModel[]>([]);
  const [searching, setSearching] = useState(false);
  const [model, setModel] = useState<PublicModel | null>(null);
  const [customModel, setCustomModel] = useState<string | null>(null);
  const [storage, setStorage] = useState<number | null>(null);
  const [answers, setAnswers] = useState<Partial<SellAnswers>>({ faults: [], extras: [] });
  const [estimate, setEstimate] = useState<EstimateResult | "loading">("loading");
  const [photos, setPhotos] = useState<{ blob: Blob; url: string }[]>([]);
  const [clientError, setClientError] = useState<Record<string, string>>({});
  const [note, setNote] = useState<string | null>(null);
  const [, startEstimate] = useTransition();
  const [, startSubmit] = useTransition();
  const topRef = useRef<HTMLDivElement>(null);
  const photoInput = useRef<HTMLInputElement>(null);

  const [state, formAction, submitting] = useActionState<SubmitState, FormData>(submitSellRequest, undefined);

  useEffect(() => {
    if (state?.ok) router.push(state.trackUrl);
  }, [state, router]);

  useEffect(() => {
    if (model || customModel) return;
    const q = query.trim();
    if (q.length < 2) return;
    const handle = window.setTimeout(async () => {
      setSearching(true);
      try {
        setResults(await searchSellModels(q));
      } finally {
        setSearching(false);
      }
    }, 250);
    return () => window.clearTimeout(handle);
  }, [query, model, customModel]);

  const go = (next: Step) => {
    setNote(null);
    setStep(next);
    if (next === "estimate") {
      setEstimate("loading");
      startEstimate(async () => {
        setEstimate(model ? await estimateSellPrice(model.id, storage, answers as SellAnswers) : null);
      });
    }
    topRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };
  const back = () => go(ORDER[Math.max(0, ORDER.indexOf(step) - 1)]);
  const clearError = (field: string) =>
    setClientError((current) => {
      if (!current[field]) return current;
      const rest = { ...current };
      delete rest[field];
      return rest;
    });
  const nextOf = (s: Step) => ORDER[ORDER.indexOf(s) + 1];

  const modelLabel = model?.name ?? customModel ?? "";
  const macro = macroIndex(step);

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
              : state.error === "photo"
                ? (state.message ?? t.form.error)
                : state.error === "invalid" && state.field === "pincode"
                  ? t.form.invalidPincode
                  : t.form.error
      : null;

  return (
    <div ref={topRef} className="scroll-mt-24">
      {/* Progress */}
      <ol className="mb-6 grid grid-cols-4 gap-1.5" aria-label={t.sell.stepOf(macro + 1, 4)}>
        {t.sell.steps.map((label, i) => (
          <li key={label} className="min-w-0">
            <div className={cn("h-1.5 rounded-full", i <= macro ? "bg-brand" : "bg-surface-3")} />
            <p className={cn("mt-1.5 truncate text-xs font-medium", i === macro ? "text-fg" : "text-muted")} aria-current={i === macro ? "step" : undefined}>
              {label}
            </p>
          </li>
        ))}
      </ol>

      {step !== "phone" ? (
        <button type="button" onClick={back} className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-muted hover:text-fg">
          <ArrowLeft className="h-4 w-4" aria-hidden /> {t.action.back}
        </button>
      ) : null}

      {step === "phone" ? (
        <section>
          <h2 className="font-display text-2xl font-bold">{t.sell.whichPhone}</h2>
          {model || customModel ? (
            <div className="mt-4 flex items-center justify-between gap-3 rounded-2xl border-2 border-brand bg-brand-soft p-4">
              <span className="font-display text-lg font-semibold text-brand-ink">{modelLabel}</span>
              <button
                type="button"
                onClick={() => {
                  setModel(null);
                  setCustomModel(null);
                  setStorage(null);
                }}
                className="grid h-10 w-10 place-items-center rounded-full hover:bg-surface"
                aria-label={t.action.clear}
              >
                <X className="h-5 w-5" aria-hidden />
              </button>
            </div>
          ) : (
            <>
              <div className="relative mt-4">
                <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-faint" aria-hidden />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder={t.sell.modelPlaceholder}
                  aria-label={t.sell.whichPhone}
                  maxLength={60}
                  autoComplete="off"
                  className="h-14 w-full rounded-2xl border-2 border-line-strong bg-surface pl-12 pr-4 text-base focus:border-brand focus:outline-none"
                />
                {searching ? <Loader2 className="absolute right-4 top-1/2 h-5 w-5 -translate-y-1/2 animate-spin text-faint" aria-hidden /> : null}
              </div>
              {query.trim().length >= 2 ? (
                <ul className="mt-2 space-y-2" aria-label={t.sell.whichPhone}>
                  {(query.trim().length >= 2 ? results : []).map((r) => (
                    <li key={r.id}>
                      <Option
                        plain
                        selected={false}
                        onClick={() => {
                          setModel(r);
                          setStorage(r.storages.length === 1 ? r.storages[0] : null);
                        }}
                      >
                        {r.name}
                      </Option>
                    </li>
                  ))}
                  <li>
                    <button
                      type="button"
                      onClick={() => setCustomModel(query.trim())}
                      className="w-full rounded-2xl border-2 border-dashed border-line-strong px-4 py-3 text-left text-[0.98rem] font-medium text-muted hover:border-brand hover:text-fg"
                    >
                      {t.sell.notListed(query.trim())}
                    </button>
                  </li>
                </ul>
              ) : null}
              <p className="mt-3 text-sm text-muted">{t.sell.notListedHelp}</p>
            </>
          )}

          {model && model.storages.length > 0 ? (
            <div className="mt-6">
              <h3 className="text-sm font-semibold">{t.sell.storage}</h3>
              <div className="mt-2 flex flex-wrap gap-2">
                {model.storages.map((s) => (
                  <button
                    key={s}
                    type="button"
                    aria-pressed={storage === s}
                    onClick={() => setStorage(s)}
                    className={cn(
                      "h-12 rounded-xl border-2 px-4 font-semibold",
                      storage === s ? "border-brand bg-brand text-brand-fg" : "border-line-strong bg-surface",
                    )}
                  >
                    {s >= 1024 ? `${s / 1024} TB` : `${s} GB`}
                  </button>
                ))}
                <button
                  type="button"
                  aria-pressed={storage === 0}
                  onClick={() => setStorage(0)}
                  className={cn(
                    "h-12 rounded-xl border-2 px-4 font-semibold",
                    storage === 0 ? "border-brand bg-brand text-brand-fg" : "border-line-strong bg-surface",
                  )}
                >
                  {t.sell.storageOther}
                </button>
              </div>
            </div>
          ) : null}

          {note ? <p className="mt-4 text-sm font-medium text-bad">{note}</p> : null}
          <button
            type="button"
            className={buttonClass("primary", "lg", "mt-8 w-full")}
            onClick={() => {
              if (!model && !customModel) return setNote(t.sell.pickPhone);
              if (model && model.storages.length > 0 && storage === null) return setNote(t.sell.chooseOne);
              go("power");
            }}
          >
            {t.action.next}
          </button>
        </section>
      ) : null}

      {(Object.keys(SINGLE_CHOICE) as SingleKey[]).map((key) =>
        step === key ? (
          <section key={key} role="radiogroup" aria-labelledby={`q-${key}`}>
            <p className="text-sm font-medium text-muted">{modelLabel}</p>
            <h2 id={`q-${key}`} className="mt-1 font-display text-2xl font-bold">
              {t.sell.q[key]}
            </h2>
            <div className="mt-5 space-y-2.5">
              {SINGLE_CHOICE[key].map((option) => (
                <Option
                  key={option}
                  selected={answers[key] === option}
                  onClick={() => {
                    setAnswers({ ...answers, [key]: option });
                    window.setTimeout(() => go(nextOf(key)), 160);
                  }}
                >
                  {(t.sell.a[key] as Record<string, string>)[option]}
                </Option>
              ))}
            </div>
          </section>
        ) : null,
      )}

      {step === "faults" ? (
        <section aria-labelledby="q-faults">
          <p className="text-sm font-medium text-muted">{modelLabel}</p>
          <h2 id="q-faults" className="mt-1 font-display text-2xl font-bold">
            {t.sell.q.faults}
          </h2>
          <div className="mt-5 space-y-2.5">
            <Option multi selected={(answers.faults ?? []).length === 0} onClick={() => setAnswers({ ...answers, faults: [] })}>
              {t.sell.allWorking}
            </Option>
            {FAULT_KEYS.map((f) => {
              const list = answers.faults ?? [];
              return (
                <Option
                  key={f}
                  multi
                  selected={list.includes(f)}
                  onClick={() => setAnswers({ ...answers, faults: list.includes(f) ? list.filter((x) => x !== f) : ([...list, f] as FaultKey[]) })}
                >
                  {t.sell.a.faults[f]}
                </Option>
              );
            })}
          </div>
          <button type="button" className={buttonClass("primary", "lg", "mt-8 w-full")} onClick={() => go("extras")}>
            {t.action.next}
          </button>
        </section>
      ) : null}

      {step === "extras" ? (
        <section aria-labelledby="q-extras">
          <p className="text-sm font-medium text-muted">{modelLabel}</p>
          <h2 id="q-extras" className="mt-1 font-display text-2xl font-bold">
            {t.sell.q.extras}
          </h2>
          <div className="mt-5 space-y-2.5">
            {EXTRA_KEYS.map((x) => {
              const list = answers.extras ?? [];
              return (
                <Option
                  key={x}
                  multi
                  selected={list.includes(x)}
                  onClick={() => setAnswers({ ...answers, extras: list.includes(x) ? list.filter((y) => y !== x) : ([...list, x] as ExtraKey[]) })}
                >
                  {t.sell.a.extras[x]}
                </Option>
              );
            })}
            <Option multi selected={(answers.extras ?? []).length === 0} onClick={() => setAnswers({ ...answers, extras: [] })}>
              {t.sell.noneOfThese}
            </Option>
          </div>
          <button type="button" className={buttonClass("primary", "lg", "mt-8 w-full")} onClick={() => go("estimate")}>
            {t.action.next}
          </button>
        </section>
      ) : null}

      {step === "estimate" ? (
        <section aria-live="polite">
          <p className="text-sm font-medium text-muted">{modelLabel}</p>
          <h2 className="mt-1 font-display text-2xl font-bold">{t.sell.estimateTitle}</h2>
          <div className="mt-5 rounded-[24px] border border-line bg-surface p-6 text-center">
            {estimate === "loading" ? (
              <Loader2 className="mx-auto h-8 w-8 animate-spin text-muted" aria-label="…" />
            ) : estimate ? (
              <>
                <p className="font-display text-[clamp(1.5rem,7.5vw,2.4rem)] font-bold leading-tight tabular">
                  <span className="whitespace-nowrap">{formatInr(estimate.min)}</span> – <span className="whitespace-nowrap">{formatInr(estimate.max)}</span>
                </p>
                <p className="mt-2 text-muted">{t.sell.estimateNote}</p>
              </>
            ) : (
              <p className="text-lg font-medium">{t.sell.noEstimate}</p>
            )}
          </div>
          <button type="button" className={buttonClass("primary", "lg", "mt-8 w-full")} onClick={() => go("details")}>
            {t.action.next}
          </button>
          {whatsappHref ? (
            <a href={whatsappHref} target="_blank" rel="noopener noreferrer" className={buttonClass("ghost", "md", "mt-3 w-full")}>
              {t.action.askOnWhatsapp}
            </a>
          ) : null}
        </section>
      ) : null}

      {step === "details" ? (
        <section>
          <h2 className="font-display text-2xl font-bold">{t.sell.detailsTitle}</h2>
          <form
            className="mt-5 space-y-4"
            noValidate
            onSubmit={(e) => {
              // Handled here (not via the form `action` prop) so React does not
              // clear what the person typed when a check fails.
              e.preventDefault();
              const formData = new FormData(e.currentTarget);
              const errors: Record<string, string> = {};
              if (String(formData.get("name") ?? "").trim().length < 2) errors.name = t.form.required;
              if (!normalizeIndianMobile(String(formData.get("phone") ?? ""))) errors.phone = t.form.invalidMobile;
              if (String(formData.get("area") ?? "").trim().length < 2) errors.area = t.form.required;
              const pin = String(formData.get("pincode") ?? "").trim();
              if (pin && !/^\d{6}$/.test(pin)) errors.pincode = t.form.invalidPincode;
              if (formData.get("consent") !== "on") errors.consent = t.form.consentNeeded;
              setClientError(errors);
              if (Object.keys(errors).length) return;
              formData.set("answers", JSON.stringify({ faults: [], extras: [], ...answers }));
              formData.set("modelId", model?.id ?? "");
              formData.set("modelText", modelLabel);
              formData.set("storageGb", storage ? String(storage) : "");
              formData.set("lang", lang);
              formData.delete("photos");
              for (const [i, p] of photos.entries()) formData.append("photos", p.blob, `photo-${i + 1}.jpg`);
              startSubmit(() => formAction(formData));
            }}
          >
            <input type="text" name="website" tabIndex={-1} autoComplete="off" className="absolute -left-[9999px] h-px w-px opacity-0" aria-hidden />
            {(
              [
                ["name", t.sell.name, "text", "name", 60],
                ["phone", t.sell.mobile, "tel", "tel", 16],
                ["area", t.sell.area, "text", "address-level2", 80],
                ["pincode", t.sell.pincode, "text", "postal-code", 6],
                ["expectedPrice", t.sell.expected, "text", "off", 8],
              ] as const
            ).map(([name, label, type, autoComplete, max]) => (
              <div key={name} className="space-y-1.5">
                <label htmlFor={`sell-${name}`} className="block text-sm font-semibold">
                  {label}
                </label>
                <input
                  id={`sell-${name}`}
                  name={name}
                  type={type}
                  inputMode={name === "phone" ? "tel" : name === "pincode" || name === "expectedPrice" ? "numeric" : undefined}
                  autoComplete={autoComplete}
                  maxLength={max}
                  aria-invalid={Boolean(clientError[name])}
                  aria-describedby={clientError[name] ? `sell-${name}-error` : undefined}
                  onInput={() => clearError(name)}
                  className={cn(
                    "h-13 w-full rounded-2xl border-2 bg-surface px-4 text-base focus:border-brand focus:outline-none",
                    clientError[name] ? "border-bad" : "border-line-strong",
                  )}
                />
                {clientError[name] ? (
                  <p id={`sell-${name}-error`} className="text-sm font-medium text-bad">
                    {clientError[name]}
                  </p>
                ) : null}
              </div>
            ))}

            <fieldset>
              <legend className="mb-2 text-sm font-semibold">{t.sell.contactBy}</legend>
              <div className="grid grid-cols-2 gap-2">
                {(["whatsapp", "call"] as const).map((value) => (
                  <label
                    key={value}
                    className="flex min-h-13 cursor-pointer items-center gap-3 rounded-2xl border-2 border-line-strong bg-surface px-4 has-[:checked]:border-brand has-[:checked]:bg-brand-soft"
                  >
                    <input type="radio" name="preferredContact" value={value} defaultChecked={value === "whatsapp"} className="h-5 w-5 accent-[var(--brand)]" />
                    <span className="font-medium">{value === "whatsapp" ? t.sell.byWhatsapp : t.sell.byCall}</span>
                  </label>
                ))}
              </div>
            </fieldset>

            <label className="flex cursor-pointer items-start gap-3 text-[0.97rem]">
              <input type="checkbox" name="wantsExchange" className="mt-0.5 h-5 w-5 shrink-0 accent-[var(--brand)]" />
              {t.sell.exchange}
            </label>

            <div>
              <p className="text-sm font-semibold">{t.sell.photos}</p>
              <p className="text-sm text-muted">{t.sell.photosHelp}</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {photos.map((p, i) => (
                  <div key={p.url} className="relative h-24 w-20 overflow-hidden rounded-xl bg-surface-2">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={p.url} alt="" className="h-full w-full object-cover" />
                    <button
                      type="button"
                      onClick={() => setPhotos(photos.filter((_, j) => j !== i))}
                      className="absolute right-1 top-1 grid h-7 w-7 place-items-center rounded-full bg-surface/90"
                      aria-label={t.sell.removePhoto}
                    >
                      <X className="h-4 w-4" aria-hidden />
                    </button>
                  </div>
                ))}
                {photos.length < 4 ? (
                  <button
                    type="button"
                    onClick={() => photoInput.current?.click()}
                    className="grid h-24 w-20 place-items-center rounded-xl border-2 border-dashed border-line-strong text-muted hover:border-brand hover:text-brand-ink"
                    aria-label={t.sell.addPhoto}
                  >
                    <Camera className="h-6 w-6" aria-hidden />
                  </button>
                ) : null}
              </div>
              <input
                ref={photoInput}
                type="file"
                accept="image/*"
                multiple
                hidden
                onChange={async (e) => {
                  const files = [...(e.target.files ?? [])].slice(0, 4 - photos.length);
                  e.target.value = "";
                  const next: { blob: Blob; url: string }[] = [];
                  for (const f of files) {
                    const blob = await shrink(f);
                    next.push({ blob, url: URL.createObjectURL(blob) });
                  }
                  setPhotos((current) => [...current, ...next].slice(0, 4));
                }}
              />
            </div>

            <label className="flex cursor-pointer items-start gap-3 text-[0.97rem]">
              <input
                type="checkbox"
                name="consent"
                className="mt-0.5 h-5 w-5 shrink-0 accent-[var(--brand)]"
                aria-invalid={Boolean(clientError.consent)}
                onChange={() => clearError("consent")}
              />
              <span>
                {t.sell.consent(shopName)}{" "}
                <Link href="/privacy" target="_blank" className="font-medium text-brand-ink underline">
                  {t.sell.privacyLink}
                </Link>
              </span>
            </label>
            {clientError.consent ? <p className="text-sm font-medium text-bad">{clientError.consent}</p> : null}

            <Turnstile siteKey={siteKey} nonce={nonce} resetSignal={state && !state.ok ? state : undefined} />

            {serverError ? (
              <p role="alert" className="rounded-2xl bg-bad-soft px-4 py-3 text-[0.95rem] font-medium text-bad">
                {serverError}
              </p>
            ) : null}

            <button type="submit" disabled={submitting} className={buttonClass("primary", "lg", "w-full")}>
              {submitting ? t.sell.sending : t.sell.submit}
            </button>
          </form>
        </section>
      ) : null}
    </div>
  );
}
