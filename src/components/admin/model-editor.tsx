"use client";

import { useState } from "react";
import type { ModelInput } from "@/lib/admin/catalog";
import { buttonClass } from "@/components/ui/button";
import { cn } from "@/components/ui/cn";
import { Alert, Field, inputClass } from "./ui";

function num(value: string): number | null {
  const cleaned = value.replace(/[^\d.]/g, "");
  if (!cleaned) return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

export const EMPTY_MODEL: ModelInput = {
  brand: "",
  name: "",
  aliases: [],
  os: "Android",
  launchYear: null,
  chipset: null,
  performance: null,
  displayInches: null,
  displayType: null,
  refreshHz: null,
  mainCameraMp: null,
  cameraSummary: null,
  frontCameraMp: null,
  batteryMah: null,
  chargingW: null,
  has5g: false,
  variants: [],
  sourceUrls: [],
};

export function ModelEditor({
  value,
  onChange,
  onSave,
  onCancel,
  saving,
  source,
  saveLabel = "Save this model",
  extra,
}: {
  value: ModelInput;
  onChange: (next: ModelInput) => void;
  onSave: () => void;
  onCancel?: () => void;
  saving: boolean;
  source: "ai" | "gsmarena" | "manual" | "edit";
  saveLabel?: string;
  /** Extra controls shown above the save button (e.g. "mark as checked"). */
  extra?: React.ReactNode;
}) {
  const set = (patch: Partial<ModelInput>) => onChange({ ...value, ...patch });
  const variantsText = value.variants.map((v) => `${v.ramGb ?? ""}/${v.storageGb}${v.launchPriceInr ? ` ${v.launchPriceInr}` : ""}`).join("\n");
  const [variantsDraft, setVariantsDraft] = useState(variantsText);
  const [aliasesDraft, setAliasesDraft] = useState(value.aliases.join(", "));
  const parseVariants = (text: string) =>
    text
      .split(/\n+/)
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => {
        const match = /^(\d*)\s*\/\s*(\d+)\s*(?:gb)?\s*(\d+)?/i.exec(line.replace(/[₹,]/g, ""));
        if (!match) return null;
        return { ramGb: match[1] ? Number(match[1]) : null, storageGb: Number(match[2]), launchPriceInr: match[3] ? Number(match[3]) : null };
      })
      .filter((v): v is { ramGb: number | null; storageGb: number; launchPriceInr: number | null } => Boolean(v && v.storageGb >= 8));

  const text = (label: string, key: keyof ModelInput, placeholder?: string) => (
    <Field label={label} htmlFor={`model-${key}`}>
      <input
        id={`model-${key}`}
        className={inputClass}
        value={(value[key] as string | null) ?? ""}
        placeholder={placeholder}
        onChange={(e) => set({ [key]: e.target.value || null } as Partial<ModelInput>)}
      />
    </Field>
  );
  const number = (label: string, key: keyof ModelInput, placeholder?: string) => (
    <Field label={label} htmlFor={`model-${key}`}>
      <input
        id={`model-${key}`}
        className={inputClass}
        inputMode="decimal"
        value={(value[key] as number | null) ?? ""}
        placeholder={placeholder}
        onChange={(e) => set({ [key]: num(e.target.value) } as Partial<ModelInput>)}
      />
    </Field>
  );

  return (
    <div className={cn("space-y-4", source !== "edit" && "mt-4 rounded-2xl border border-line-strong bg-surface-2 p-4")}>
      {source === "ai" ? (
        <Alert live tone="warn">
          Filled by a free AI from what it remembers (it can&apos;t search the web). Check every number before saving, and add launch prices if you know them.
        </Alert>
      ) : source === "gsmarena" ? (
        <Alert live tone="ok">
          Filled from GSMArena. Check the details, remove variants not sold in India, and add the launch prices if you know them.
        </Alert>
      ) : source === "manual" ? (
        <p className="text-sm text-muted">Fill what you know. You can edit the specs later in the catalog.</p>
      ) : null}
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Brand" htmlFor="model-brand">
          <input id="model-brand" className={inputClass} value={value.brand} onChange={(e) => set({ brand: e.target.value })} placeholder="Samsung" />
        </Field>
        <Field label="Model name (without brand)" htmlFor="model-name">
          <input id="model-name" className={inputClass} value={value.name} onChange={(e) => set({ name: e.target.value })} placeholder="Galaxy A54 5G" />
        </Field>
        <Field label="Type" htmlFor="model-os">
          <select id="model-os" className={inputClass} value={value.os} onChange={(e) => set({ os: e.target.value as "iOS" | "Android" })}>
            <option value="Android">Android</option>
            <option value="iOS">iPhone (iOS)</option>
          </select>
        </Field>
        {number("Launch year", "launchYear", "2023")}
        {text("Processor", "chipset", "Snapdragon 695")}
        <Field label="Speed" htmlFor="model-performance">
          <select
            id="model-performance"
            className={inputClass}
            value={value.performance ?? ""}
            onChange={(e) => set({ performance: e.target.value ? Number(e.target.value) : null })}
          >
            <option value="">Not sure</option>
            <option value="1">1 · Everyday use</option>
            <option value="2">2 · Smooth</option>
            <option value="3">3 · Fast</option>
            <option value="4">4 · Top speed</option>
          </select>
        </Field>
        {number("Screen size (inches)", "displayInches", "6.5")}
        {text("Screen type", "displayType", "AMOLED")}
        {number("Refresh rate (Hz)", "refreshHz", "120")}
        {text("Cameras", "cameraSummary", "50MP + 8MP ultra-wide")}
        {number("Main camera (MP)", "mainCameraMp", "50")}
        {number("Selfie camera (MP)", "frontCameraMp", "16")}
        {number("Battery (mAh)", "batteryMah", "5000")}
        {number("Charging (W)", "chargingW", "33")}
        <label className="flex min-h-12 items-center gap-3 text-[0.95rem] font-medium">
          <input type="checkbox" className="h-5 w-5 accent-[var(--brand)]" checked={value.has5g} onChange={(e) => set({ has5g: e.target.checked })} /> 5G phone
        </label>
      </div>
      <Field label="Other names and model numbers" htmlFor="model-aliases" hint="Separate with commas. Helps search, e.g. SM-A546E, A54">
        <input
          id="model-aliases"
          className={inputClass}
          value={aliasesDraft}
          onChange={(e) => {
            setAliasesDraft(e.target.value);
            set({
              aliases: [
                ...new Set(
                  e.target.value
                    .split(",")
                    .map((a) => a.trim())
                    .filter(Boolean),
                ),
              ]
                .slice(0, 12)
                .map((a) => a.slice(0, 40)),
            });
          }}
        />
      </Field>
      <Field label="Variants" htmlFor="model-variants" hint="One per line: RAM/Storage and the launch price. Example: 8/128 23999 (for iPhones: /128 79900)">
        <textarea
          id="model-variants"
          className={cn(inputClass, "h-28 py-2 font-mono")}
          value={variantsDraft}
          onChange={(e) => {
            setVariantsDraft(e.target.value);
            set({ variants: parseVariants(e.target.value) });
          }}
        />
      </Field>
      {value.sourceUrls.length ? (
        <div className="text-sm">
          <p className="font-semibold">Sources</p>
          <ul className="mt-1 space-y-1">
            {value.sourceUrls.map((url) => (
              <li key={url} className="truncate">
                <a href={url} target="_blank" rel="noopener noreferrer" className="text-brand-ink underline">
                  {url}
                </a>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      {extra}
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={onSave} disabled={saving || !value.brand || !value.name} className={buttonClass("primary", "md")}>
          {saving ? "Saving…" : saveLabel}
        </button>
        {onCancel ? (
          <button type="button" onClick={onCancel} className={buttonClass("ghost", "md")}>
            Cancel
          </button>
        ) : null}
      </div>
    </div>
  );
}
