"use client";

import { useState, useTransition } from "react";
import { saveBuyPricesAction, savePricingRulesAction } from "@/app/admin/(panel)/pricing/actions";
import { formatInr, formatStorage } from "@/lib/format";
import { estimatePrice, type PricingRules } from "@/lib/pricing";
import { buttonClass } from "@/components/ui/button";
import { Alert, inputClass } from "./ui";

function digits(value: string): number | null {
  const d = value.replace(/\D/g, "");
  return d ? Number(d) : null;
}

export function BuyPriceRow({
  modelId,
  name,
  rows,
  canEdit,
}: {
  modelId: string;
  name: string;
  rows: { storageGb: number; basePriceInr: number | null; launchPriceInr: number | null }[];
  canEdit: boolean;
}) {
  const [values, setValues] = useState(rows.map((r) => (r.basePriceInr ? String(r.basePriceInr) : "")));
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();
  const dirty = values.some((v, i) => (digits(v) ?? null) !== rows[i].basePriceInr);

  return (
    <form
      className="rounded-[20px] border border-line bg-surface p-4"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          const res = await saveBuyPricesAction({ modelId, prices: rows.map((r, i) => ({ storageGb: r.storageGb, basePriceInr: digits(values[i]) })) });
          setMessage(res.ok ? { ok: true, text: "Saved." } : { ok: false, text: res.error });
        });
      }}
    >
      <p className="font-semibold">{name}</p>
      <div className="mt-2 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {rows.map((r, i) => (
          <div key={r.storageGb} className="space-y-1">
            <label htmlFor={`bp-${modelId}-${r.storageGb}`} className="block text-sm font-medium">
              {formatStorage(r.storageGb)}
            </label>
            <div className="relative">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted">₹</span>
              <input
                id={`bp-${modelId}-${r.storageGb}`}
                className={`${inputClass} h-11 pl-7 tabular`}
                inputMode="numeric"
                disabled={!canEdit}
                value={values[i]}
                placeholder="—"
                onChange={(e) => {
                  const next = [...values];
                  next[i] = e.target.value.replace(/[^\d,]/g, "");
                  setValues(next);
                  setMessage(null);
                }}
              />
            </div>
            {r.launchPriceInr ? <p className="text-xs text-muted">New: {formatInr(r.launchPriceInr)}</p> : null}
          </div>
        ))}
      </div>
      {canEdit ? (
        <div className="mt-3 flex items-center gap-3">
          <button type="submit" disabled={pending || !dirty} className={buttonClass("secondary", "sm")}>
            {pending ? "Saving…" : "Save"}
          </button>
          {message ? (
            <p role="status" className={`text-sm font-medium ${message.ok ? "text-ok" : "text-bad"}`}>
              {message.text}
            </p>
          ) : null}
        </div>
      ) : null}
    </form>
  );
}

type NumberPath =
  | ["screen", "scratches"]
  | ["screen", "cracked"]
  | ["body", "marks"]
  | ["body", "damaged"]
  | ["battery", "weak"]
  | ["battery", "bad"]
  | ["faultEach"]
  | ["missingBox"]
  | ["missingCharger"]
  | ["missingBill"]
  | ["warrantyBonus"]
  | ["maxCutPercent"]
  | ["rangeLow"]
  | ["rangeHigh"];

function read(rules: PricingRules, path: NumberPath): number {
  if (path.length === 2) return (rules[path[0]] as Record<string, number>)[path[1]];
  return rules[path[0]] as number;
}

function write(rules: PricingRules, path: NumberPath, value: number): PricingRules {
  if (path.length === 2) return { ...rules, [path[0]]: { ...(rules[path[0]] as Record<string, number>), [path[1]]: value } };
  return { ...rules, [path[0]]: value };
}

const GROUPS: { title: string; rows: { label: string; path: NumberPath; unit: "%" | "₹" }[] }[] = [
  {
    title: "Condition",
    rows: [
      { label: "Screen: small scratches", path: ["screen", "scratches"], unit: "%" },
      { label: "Screen: cracked, lines or spots", path: ["screen", "cracked"], unit: "%" },
      { label: "Body: small marks", path: ["body", "marks"], unit: "%" },
      { label: "Body: dents or cracked back", path: ["body", "damaged"], unit: "%" },
      { label: "Battery: needs charging twice a day", path: ["battery", "weak"], unit: "%" },
      { label: "Battery: very weak or swollen", path: ["battery", "bad"], unit: "%" },
      { label: "Each part that doesn’t work", path: ["faultEach"], unit: "%" },
    ],
  },
  {
    title: "Missing items",
    rows: [
      { label: "No box", path: ["missingBox"], unit: "₹" },
      { label: "No charger", path: ["missingCharger"], unit: "₹" },
      { label: "No bill", path: ["missingBill"], unit: "₹" },
    ],
  },
  {
    title: "Limits",
    rows: [
      { label: "Extra when brand warranty is left", path: ["warrantyBonus"], unit: "%" },
      { label: "Largest total cut", path: ["maxCutPercent"], unit: "%" },
      { label: "Range shown: below the estimate", path: ["rangeLow"], unit: "%" },
      { label: "Range shown: above the estimate", path: ["rangeHigh"], unit: "%" },
    ],
  },
];

export function PricingRulesForm({ initial, canEdit }: { initial: PricingRules; canEdit: boolean }) {
  const [rules, setRules] = useState<PricingRules>(initial);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();
  const example = estimatePrice(20000, { power: "yes", screen: "scratches", body: "perfect", battery: "weak", faults: [], extras: ["charger"] }, rules);

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          const res = await savePricingRulesAction(rules);
          setMessage(res.ok ? { ok: true, text: "Saved. New estimates use these rules." } : { ok: false, text: res.error });
        });
      }}
    >
      <div className="grid gap-4 md:grid-cols-3">
        {GROUPS.map((group) => (
          <fieldset key={group.title} className="space-y-2">
            <legend className="mb-1 text-sm font-semibold">{group.title}</legend>
            {group.rows.map((row) => {
              const id = `rule-${row.path.join("-")}`;
              return (
                <div key={id} className="flex items-center justify-between gap-3">
                  <label htmlFor={id} className="text-[0.95rem]">
                    {row.label}
                  </label>
                  <div className="relative w-28 shrink-0">
                    {row.unit === "₹" ? <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted">₹</span> : null}
                    <input
                      id={id}
                      inputMode="numeric"
                      disabled={!canEdit}
                      className={`${inputClass} h-11 text-right tabular ${row.unit === "₹" ? "pl-7" : "pr-8"}`}
                      value={String(read(rules, row.path))}
                      onChange={(e) => {
                        setRules(write(rules, row.path, digits(e.target.value) ?? 0));
                        setMessage(null);
                      }}
                    />
                    {row.unit === "%" ? <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-muted">%</span> : null}
                  </div>
                </div>
              );
            })}
          </fieldset>
        ))}
      </div>
      <div className="rounded-2xl bg-surface-2 p-4 text-[0.95rem]">
        <p className="font-semibold">Example</p>
        <p className="text-muted">
          Buying price ₹20,000 for a good phone. The seller says: small scratches on the screen, battery needs charging twice a day, has the charger but no box
          or bill.
        </p>
        <p className="mt-1 font-display text-lg font-bold tabular">
          Website shows: {example ? `${formatInr(example.min)} – ${formatInr(example.max)}` : "no estimate"}
        </p>
      </div>
      {message ? (
        <Alert live tone={message.ok ? "ok" : "bad"}>
          {message.text}
        </Alert>
      ) : null}
      {canEdit ? (
        <button type="submit" disabled={pending} className={buttonClass("primary", "md")}>
          {pending ? "Saving…" : "Save rules"}
        </button>
      ) : null}
    </form>
  );
}
