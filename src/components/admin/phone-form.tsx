"use client";

import { ArrowLeft, ArrowRight, Camera, ImagePlus, Loader2, Search, Trash2 } from "lucide-react";
import { useEffect, useRef, useState, useTransition } from "react";
import { createModelAction, saveListingAction, searchModelsAction, type ListingInput } from "@/app/admin/(panel)/phones/actions";
import type { ModelOption, ModelInput } from "@/lib/admin/catalog";
import { formatInr } from "@/lib/format";
import { looksLikeLink } from "@/lib/specs/link";
import { PHONE_TESTS, allPassed, type TestKey, type TestResults } from "@/lib/phone-tests";
import { SHOP_TAGS, type ShopTag } from "@/lib/tags";
import { buttonClass } from "@/components/ui/button";
import { cn } from "@/components/ui/cn";
import { Alert, Card, Field, Group, inputClass } from "./ui";
import { EMPTY_MODEL, ModelEditor } from "./model-editor";
import { SpecsLookup, type LookupSource } from "./specs-lookup";

type Photo = { smId: string; mdId: string; lgId: string; width: number; height: number };

export type PhoneFormValues = Omit<ListingInput, "id" | "modelId" | "publish" | "sourceRequestId">;

const TEST_LABELS: Record<TestKey, string> = {
  display: "Display",
  touch: "Touch",
  front_camera: "Front camera",
  back_camera: "Back camera",
  speaker: "Speaker",
  microphone: "Microphone",
  charging: "Charging",
  wifi_bt: "Wi-Fi & Bluetooth",
  network: "SIM & network",
  buttons: "Buttons",
  biometric: "Fingerprint / Face ID",
  vibration: "Vibration",
};

const TAG_LABELS: Record<ShopTag, string> = {
  gaming: "Good for games",
  camera: "Great camera",
  parents: "Easy for parents",
  students: "Student budget",
  office: "Good for work",
};

const GRADES = [
  { value: "A", title: "A · Like new", text: "No visible marks" },
  { value: "B", title: "B · Good", text: "Light marks up close" },
  { value: "C", title: "C · Fair", text: "Visible scratches or dents" },
] as const;

function num(value: string): number | null {
  const cleaned = value.replace(/[^\d.]/g, "");
  if (!cleaned) return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

function emptyValues(defaultWarranty: number): PhoneFormValues {
  return {
    ramGb: null,
    storageGb: 0,
    color: "",
    launchPriceInr: null,
    grade: "A",
    batteryHealth: null,
    batteryNote: null,
    tests: allPassed(),
    hasBox: false,
    hasCharger: false,
    hasBill: false,
    warrantyMonths: defaultWarranty,
    brandWarrantyUntil: null,
    priceInr: 0,
    costInr: null,
    shopTags: [],
    notesEn: "",
    notesTe: "",
    featured: false,
    imeiStatus: "pending",
    imeiCheckRef: null,
    photos: [],
  };
}

// ---------------------------------------------------------------------------
// Photo upload: shrink in the browser (removes location data), then upload.
// ---------------------------------------------------------------------------

async function shrink(file: File, max = 2400): Promise<Blob> {
  try {
    const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
    const scale = Math.min(1, max / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();
    return await new Promise<Blob>((resolve) => canvas.toBlob((blob) => resolve(blob ?? file), "image/jpeg", 0.9));
  } catch {
    return file;
  }
}

async function uploadPhoto(file: File): Promise<Photo> {
  const blob = await shrink(file);
  const body = new FormData();
  body.set("file", blob, "photo.jpg");
  const response = await fetch("/api/admin/photos", { method: "POST", body });
  const data = (await response.json().catch(() => ({}))) as Partial<Photo> & { error?: string };
  if (!response.ok || !data.lgId) throw new Error(data.error ?? "Upload failed. Try again.");
  return data as Photo;
}

const MAX_PHOTOS = 12;

/** onChange takes an update function, so photos that finish uploading one by one never overwrite each other. */
function PhotoManager({ photos, onChange }: { photos: Photo[]; onChange: (update: (prev: Photo[]) => Photo[]) => void }) {
  const [uploading, setUploading] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);

  const addFiles = async (files: FileList | null) => {
    if (!files?.length) return;
    setError(null);
    const list = [...files].slice(0, Math.max(0, MAX_PHOTOS - photos.length));
    setUploading((n) => n + list.length);
    for (const file of list) {
      try {
        const photo = await uploadPhoto(file);
        onChange((prev) => (prev.length >= MAX_PHOTOS ? prev : [...prev, photo]));
      } catch (e) {
        setError(e instanceof Error ? e.message : "Upload failed.");
      } finally {
        setUploading((n) => n - 1);
      }
    }
  };

  const move = (index: number, delta: number) =>
    onChange((prev) => {
      const next = [...prev];
      const [item] = next.splice(index, 1);
      next.splice(index + delta, 0, item);
      return next;
    });

  return (
    <div>
      <p className="mb-3 text-sm text-muted">
        Take 4 or more photos on a plain background: front, back, both sides and any marks. The first photo is the cover.
      </p>
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
        {photos.map((photo, index) => (
          <div key={photo.lgId} className="relative aspect-[4/5] overflow-hidden rounded-xl bg-surface-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={`/media/${photo.smId}.webp`} alt={`Photo ${index + 1}`} className="h-full w-full object-cover" />
            {index === 0 ? <span className="absolute left-1.5 top-1.5 rounded-md bg-tag px-1.5 py-0.5 text-[0.7rem] font-bold text-tag-fg">Cover</span> : null}
            <div className="absolute inset-x-1 bottom-1 flex justify-between gap-1">
              <button
                type="button"
                onClick={() => move(index, -1)}
                disabled={index === 0}
                className="grid h-8 w-8 place-items-center rounded-lg bg-surface/90 disabled:opacity-30"
                aria-label="Move left"
              >
                <ArrowLeft className="h-4 w-4" aria-hidden />
              </button>
              <button
                type="button"
                onClick={() => onChange((prev) => prev.filter((p) => p.lgId !== photo.lgId))}
                className="grid h-8 w-8 place-items-center rounded-lg bg-surface/90 text-bad"
                aria-label="Remove photo"
              >
                <Trash2 className="h-4 w-4" aria-hidden />
              </button>
              <button
                type="button"
                onClick={() => move(index, 1)}
                disabled={index === photos.length - 1}
                className="grid h-8 w-8 place-items-center rounded-lg bg-surface/90 disabled:opacity-30"
                aria-label="Move right"
              >
                <ArrowRight className="h-4 w-4" aria-hidden />
              </button>
            </div>
          </div>
        ))}
        {Array.from({ length: uploading }).map((_, i) => (
          <div key={`up-${i}`} className="grid aspect-[4/5] place-items-center rounded-xl border border-dashed border-line-strong bg-surface-2">
            <Loader2 className="h-6 w-6 animate-spin text-muted" aria-label="Uploading" />
          </div>
        ))}
      </div>
      {error ? (
        <Alert live tone="bad" className="mt-3">
          {error}
        </Alert>
      ) : null}
      <div className="mt-3 flex flex-wrap gap-2">
        <button type="button" onClick={() => cameraRef.current?.click()} className={buttonClass("secondary", "md")}>
          <Camera className="h-4 w-4" aria-hidden /> Take photo
        </button>
        <button type="button" onClick={() => fileRef.current?.click()} className={buttonClass("secondary", "md")}>
          <ImagePlus className="h-4 w-4" aria-hidden /> Choose photos
        </button>
      </div>
      <input ref={cameraRef} type="file" accept="image/*" capture="environment" hidden onChange={(e) => (addFiles(e.target.files), (e.target.value = ""))} />
      <input
        ref={fileRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
        multiple
        hidden
        onChange={(e) => (addFiles(e.target.files), (e.target.value = ""))}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Model picker: your catalog first, then specs from a GSMArena link, the AI lookup, or by hand
// ---------------------------------------------------------------------------

function ModelPicker({ model, onPick, aiEnabled }: { model: ModelOption | null; onPick: (model: ModelOption | null) => void; aiEnabled: boolean }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<ModelOption[]>([]);
  const [searching, setSearching] = useState(false);
  const [editor, setEditor] = useState<{ value: ModelInput; source: LookupSource | "manual"; note?: string } | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saving, startSave] = useTransition();
  const isLink = looksLikeLink(query);

  useEffect(() => {
    if (model) return;
    const q = query.trim();
    const handle = window.setTimeout(async () => {
      if (looksLikeLink(q)) return setResults([]);
      setSearching(true);
      try {
        setResults(await searchModelsAction(q));
      } finally {
        setSearching(false);
      }
    }, 220);
    return () => window.clearTimeout(handle);
  }, [query, model]);

  if (model) {
    return (
      <div className="flex items-start justify-between gap-3 rounded-2xl bg-surface-2 p-4">
        <div className="min-w-0">
          <p className="font-display text-lg font-semibold">{model.fullName}</p>
          <p className="text-sm text-muted">{[model.launchYear, model.summary].filter(Boolean).join(" · ")}</p>
          {!model.verified ? <p className="mt-1 text-xs font-medium text-warn">Specs not yet checked. Check them in the catalog before publishing.</p> : null}
        </div>
        <button type="button" onClick={() => onPick(null)} className={buttonClass("secondary", "sm")}>
          Change
        </button>
      </div>
    );
  }

  return (
    <div>
      <label htmlFor="model-search" className="sr-only">
        Search phone model
      </label>
      <div className="relative">
        <Search className="pointer-events-none absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-faint" aria-hidden />
        <input
          id="model-search"
          className={cn(inputClass, "pl-11")}
          placeholder="Model name or number, e.g. Galaxy A54 or SM-A546E"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          autoComplete="off"
        />
        {searching ? <Loader2 className="absolute right-3.5 top-1/2 h-5 w-5 -translate-y-1/2 animate-spin text-faint" aria-hidden /> : null}
      </div>
      {results.length && !isLink ? (
        <ul className="mt-2 divide-y divide-line overflow-hidden rounded-2xl border border-line" role="listbox" aria-label="Matching models">
          {results.map((m) => (
            <li key={m.id}>
              <button
                type="button"
                role="option"
                aria-selected={false}
                onClick={() => onPick(m)}
                className="flex w-full items-start justify-between gap-3 px-4 py-3 text-left hover:bg-surface-2"
              >
                <span>
                  <span className="block font-semibold">{m.fullName}</span>
                  <span className="block text-sm text-muted">{[m.launchYear, m.summary].filter(Boolean).join(" · ")}</span>
                </span>
                {!m.verified ? <span className="shrink-0 rounded-md bg-warn-soft px-1.5 py-0.5 text-[0.7rem] font-semibold text-warn">Check specs</span> : null}
              </button>
            </li>
          ))}
        </ul>
      ) : query.trim().length >= 2 && !searching && !isLink ? (
        <p className="mt-2 text-sm text-muted">No match in your catalog yet.</p>
      ) : null}

      {!editor ? (
        <SpecsLookup
          query={query}
          aiEnabled={aiEnabled}
          onFound={(value, source, note) => (setSaveError(null), setEditor({ value, source, note }))}
          onManual={() => (setSaveError(null), setEditor({ value: { ...EMPTY_MODEL, name: isLink ? "" : query.trim() }, source: "manual" }))}
        />
      ) : null}
      {saveError ? (
        <Alert live tone="bad" className="mt-3">
          {saveError}
        </Alert>
      ) : null}
      {editor ? (
        <ModelEditor
          value={editor.value}
          source={editor.source}
          note={editor.note}
          onChange={(value) => setEditor({ ...editor, value })}
          onCancel={() => setEditor(null)}
          saving={saving}
          onSave={() =>
            startSave(async () => {
              const result = await createModelAction(editor.value, editor.source);
              if (result.ok && result.data) {
                setEditor(null);
                onPick(result.data);
              } else if (!result.ok) {
                setSaveError(result.error);
              }
            })
          }
        />
      ) : null}
    </div>
  );
}

// ---------------------------------------------------------------------------
// The form
// ---------------------------------------------------------------------------

export function PhoneForm({
  listingId,
  initial,
  initialModel,
  isOwner,
  aiEnabled,
  defaultWarranty,
  status,
  sourceRequestId,
}: {
  listingId: string | null;
  initial: PhoneFormValues | null;
  initialModel: ModelOption | null;
  isOwner: boolean;
  aiEnabled: boolean;
  defaultWarranty: number;
  status: string | null;
  sourceRequestId?: string | null;
}) {
  const [model, setModel] = useState<ModelOption | null>(initialModel);
  const [v, setV] = useState<PhoneFormValues>(initial ?? emptyValues(defaultWarranty));
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const set = (patch: Partial<PhoneFormValues>) => setV((prev) => ({ ...prev, ...patch }));

  const variants = model?.variants ?? [];
  const storageOptions = [...new Set(variants.map((x) => x.storageGb))].sort((a, b) => a - b);
  const ramOptions = [
    ...new Set(
      variants
        .filter((x) => x.storageGb === v.storageGb)
        .map((x) => x.ramGb)
        .filter((r): r is number => Boolean(r)),
    ),
  ];

  const pickModel = (next: ModelOption | null) => {
    setModel(next);
    if (next) {
      const first = next.variants[0];
      set({
        storageGb: first?.storageGb ?? 0,
        ramGb: first?.ramGb ?? null,
        launchPriceInr: first?.launchPriceInr ?? null,
      });
    }
  };

  const pickStorage = (storageGb: number) => {
    const match = variants.filter((x) => x.storageGb === storageGb);
    set({ storageGb, ramGb: match[0]?.ramGb ?? v.ramGb, launchPriceInr: match[0]?.launchPriceInr ?? v.launchPriceInr });
  };

  const cycleTest = (key: TestKey) => {
    const next: TestResults = { ...v.tests };
    if (next[key] === true) next[key] = false;
    else if (next[key] === false) delete next[key];
    else next[key] = true;
    set({ tests: next });
  };

  const margin = isOwner && v.costInr && v.priceInr ? v.priceInr - v.costInr : null;

  const submit = (publish: boolean) => {
    setError(null);
    if (!model) return setError("Pick the phone model first.");
    if (!v.storageGb) return setError("Pick the storage.");
    if (!v.priceInr) return setError("Enter the selling price.");
    startTransition(async () => {
      const result = await saveListingAction({
        ...v,
        id: listingId,
        modelId: model.id,
        publish,
        sourceRequestId: sourceRequestId ?? null,
      });
      if (result && !result.ok) setError(result.error);
    });
  };

  const isPublished = status && status !== "draft";

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        submit(true);
      }}
      className="space-y-4"
    >
      <Card title="1. Which phone?">
        <ModelPicker model={model} onPick={pickModel} aiEnabled={aiEnabled} />
      </Card>

      <Card title="2. Variant and colour">
        <div className="space-y-4">
          <Group label="Storage">
            <div className="flex flex-wrap gap-2">
              {storageOptions.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => pickStorage(s)}
                  aria-pressed={v.storageGb === s}
                  className={cn("h-11 rounded-xl border px-4 font-semibold", v.storageGb === s ? "border-brand bg-brand text-brand-fg" : "border-line-strong")}
                >
                  {s >= 1024 ? `${s / 1024} TB` : `${s} GB`}
                </button>
              ))}
              <input
                className={cn(inputClass, "h-11 w-28")}
                inputMode="numeric"
                placeholder="Other GB"
                value={storageOptions.includes(v.storageGb) || !v.storageGb ? "" : v.storageGb}
                onChange={(e) => set({ storageGb: num(e.target.value) ?? 0 })}
                aria-label="Other storage in GB"
              />
            </div>
          </Group>
          {model?.os !== "iOS" ? (
            <Group label="RAM (GB)">
              <div className="flex flex-wrap gap-2">
                {[...new Set([...ramOptions, 4, 6, 8, 12])]
                  .sort((a, b) => a - b)
                  .map((r) => (
                    <button
                      key={r}
                      type="button"
                      onClick={() => set({ ramGb: r })}
                      aria-pressed={v.ramGb === r}
                      className={cn("h-11 rounded-xl border px-4 font-semibold", v.ramGb === r ? "border-brand bg-brand text-brand-fg" : "border-line-strong")}
                    >
                      {r} GB
                    </button>
                  ))}
              </div>
            </Group>
          ) : null}
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Colour" htmlFor="color">
              <input
                id="color"
                className={inputClass}
                value={v.color}
                maxLength={40}
                placeholder="e.g. Midnight Blue"
                onChange={(e) => set({ color: e.target.value })}
              />
            </Field>
            <Field label="Price when new (₹)" htmlFor="launch" hint="Filled from the catalog. Shown as “You save …”.">
              <input
                id="launch"
                className={inputClass}
                inputMode="numeric"
                value={v.launchPriceInr ?? ""}
                onChange={(e) => set({ launchPriceInr: num(e.target.value) })}
              />
            </Field>
          </div>
        </div>
      </Card>

      <Card title="3. Condition">
        <div className="grid gap-2 sm:grid-cols-3">
          {GRADES.map((g) => (
            <button
              key={g.value}
              type="button"
              onClick={() => set({ grade: g.value })}
              aria-pressed={v.grade === g.value}
              className={cn(
                "rounded-2xl border-2 p-3.5 text-left",
                v.grade === g.value ? "border-brand bg-brand-soft" : "border-line hover:border-line-strong",
              )}
            >
              <span className="block font-display text-lg font-bold">{g.title}</span>
              <span className="block text-sm text-muted">{g.text}</span>
            </button>
          ))}
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <Field label="Battery health %" htmlFor="battery" hint="iPhone: Settings → Battery → Battery Health. Leave empty if the phone doesn't show it.">
            <input
              id="battery"
              className={inputClass}
              inputMode="numeric"
              placeholder="e.g. 88"
              value={v.batteryHealth ?? ""}
              onChange={(e) => set({ batteryHealth: num(e.target.value) })}
            />
          </Field>
          <Field label="Battery note (optional)" htmlFor="batteryNote">
            <input
              id="batteryNote"
              className={inputClass}
              maxLength={120}
              placeholder="e.g. New battery fitted"
              value={v.batteryNote ?? ""}
              onChange={(e) => set({ batteryNote: e.target.value || null })}
            />
          </Field>
        </div>
      </Card>

      <Card title="4. 12-point test">
        <p className="mb-3 text-sm text-muted">Tap to change: ✓ passed, ✗ not working, – not on this phone.</p>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {PHONE_TESTS.map((key) => {
            const state = v.tests[key];
            return (
              <button
                key={key}
                type="button"
                onClick={() => cycleTest(key)}
                className={cn(
                  "flex min-h-12 items-center gap-2 rounded-xl border px-3 text-left text-sm font-medium",
                  state === true && "border-ok/40 bg-ok-soft text-ok",
                  state === false && "border-bad/40 bg-bad-soft text-bad",
                  state === undefined && "border-line bg-surface-2 text-muted",
                )}
                aria-label={`${TEST_LABELS[key]}: ${state === true ? "passed" : state === false ? "not working" : "not on this phone"}`}
              >
                <span className="w-4 text-center font-bold">{state === true ? "✓" : state === false ? "✗" : "–"}</span>
                {TEST_LABELS[key]}
              </button>
            );
          })}
        </div>
      </Card>

      <Card title="5. What comes with it">
        <div className="flex flex-wrap gap-2">
          {(
            [
              ["hasBox", "Box"],
              ["hasCharger", "Charger"],
              ["hasBill", "Original bill"],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              aria-pressed={v[key]}
              onClick={() => set({ [key]: !v[key] } as Partial<PhoneFormValues>)}
              className={cn("h-11 rounded-xl border px-4 font-semibold", v[key] ? "border-brand bg-brand text-brand-fg" : "border-line-strong")}
            >
              {v[key] ? "✓ " : ""}
              {label}
            </button>
          ))}
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <Group label="Shop warranty">
            <div className="flex flex-wrap gap-2">
              {[0, 1, 3, 6].map((m) => (
                <button
                  key={m}
                  type="button"
                  aria-pressed={v.warrantyMonths === m}
                  onClick={() => set({ warrantyMonths: m })}
                  className={cn(
                    "h-11 rounded-xl border px-4 font-semibold",
                    v.warrantyMonths === m ? "border-brand bg-brand text-brand-fg" : "border-line-strong",
                  )}
                >
                  {m === 0 ? "None" : `${m} month${m === 1 ? "" : "s"}`}
                </button>
              ))}
            </div>
          </Group>
          <Field label="Brand warranty until (optional)" htmlFor="brandWarranty">
            <input
              id="brandWarranty"
              type="date"
              className={inputClass}
              value={v.brandWarrantyUntil ?? ""}
              onChange={(e) => set({ brandWarrantyUntil: e.target.value || null })}
            />
          </Field>
        </div>
      </Card>

      <Card title="6. Price">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Selling price (₹)" htmlFor="price">
            <input
              id="price"
              className={cn(inputClass, "h-14 font-display text-2xl font-bold")}
              inputMode="numeric"
              placeholder="0"
              value={v.priceInr || ""}
              onChange={(e) => set({ priceInr: num(e.target.value) ?? 0 })}
            />
          </Field>
          {isOwner ? (
            <Field label="What you paid (₹, only you see this)" htmlFor="cost" hint={margin !== null ? `Margin: ${formatInr(margin)}` : undefined}>
              <input
                id="cost"
                className={cn(inputClass, "h-14")}
                inputMode="numeric"
                value={v.costInr ?? ""}
                onChange={(e) => set({ costInr: num(e.target.value) })}
              />
            </Field>
          ) : null}
        </div>
      </Card>

      <Card title="7. Photos">
        <PhotoManager photos={v.photos} onChange={(update) => setV((prev) => ({ ...prev, photos: update(prev.photos) }))} />
      </Card>

      <Card title="8. IMEI check">
        <p className="mb-3 text-sm text-muted">
          The law requires checking every used phone&apos;s IMEI in the government database before buying or selling it. Dial *#06# on the phone to see the
          IMEI, then send <span className="font-mono">KYM &lt;IMEI&gt;</span> by SMS to 14422 (or use the Sanchar Saathi app). Only the result is saved here,
          never the IMEI number.
        </p>
        <Field label="Check reference (optional)" htmlFor="imeiRef" hint="Receipt or reference number from the check. Don't type the IMEI here.">
          <input
            id="imeiRef"
            className={cn(inputClass, "sm:max-w-sm")}
            maxLength={60}
            autoComplete="off"
            value={v.imeiCheckRef ?? ""}
            onChange={(e) => set({ imeiCheckRef: e.target.value || null })}
          />
        </Field>
        <Group label="Result of the check" className="mt-4">
          <div className="grid gap-2 sm:grid-cols-3">
            {(
              [
                ["pending", "Not checked yet"],
                ["clear", "Clear (not blocked)"],
                ["blocked", "Blocked, don't sell"],
              ] as const
            ).map(([value, label]) => (
              <button
                key={value}
                type="button"
                aria-pressed={v.imeiStatus === value}
                onClick={() => set({ imeiStatus: value })}
                className={cn(
                  "min-h-12 rounded-xl border-2 px-3 text-sm font-semibold",
                  v.imeiStatus === value
                    ? value === "clear"
                      ? "border-ok bg-ok-soft text-ok"
                      : value === "blocked"
                        ? "border-bad bg-bad-soft text-bad"
                        : "border-brand bg-brand-soft text-brand-ink"
                    : "border-line",
                )}
              >
                {label}
              </button>
            ))}
          </div>
        </Group>
      </Card>

      <Card title="9. Tags and notes">
        <Group label="Your picks (shown as tags)">
          <div className="flex flex-wrap gap-2">
            {SHOP_TAGS.map((tag) => (
              <button
                key={tag}
                type="button"
                aria-pressed={v.shopTags.includes(tag)}
                onClick={() => set({ shopTags: v.shopTags.includes(tag) ? v.shopTags.filter((t) => t !== tag) : [...v.shopTags, tag] })}
                className={cn(
                  "h-10 rounded-full border px-3.5 text-sm font-medium",
                  v.shopTags.includes(tag) ? "border-brand bg-brand text-brand-fg" : "border-line-strong",
                )}
              >
                {TAG_LABELS[tag]}
              </button>
            ))}
          </div>
        </Group>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <Field label="Notes for customers (English)" htmlFor="notesEn" hint="Be honest about any marks. It builds trust.">
            <textarea
              id="notesEn"
              className={cn(inputClass, "h-28 py-2")}
              maxLength={1000}
              value={v.notesEn}
              onChange={(e) => set({ notesEn: e.target.value })}
            />
          </Field>
          <Field label="Notes in Telugu (optional)" htmlFor="notesTe">
            <textarea
              id="notesTe"
              lang="te"
              className={cn(inputClass, "h-28 py-2")}
              maxLength={1000}
              value={v.notesTe}
              onChange={(e) => set({ notesTe: e.target.value })}
            />
          </Field>
        </div>
        <label className="mt-4 flex min-h-11 items-center gap-3 text-[0.95rem] font-medium">
          <input type="checkbox" className="h-5 w-5 accent-[var(--brand)]" checked={v.featured} onChange={(e) => set({ featured: e.target.checked })} />
          Show first on the home page
        </label>
      </Card>

      {error ? (
        <Alert live tone="bad" className="sticky bottom-24 z-20 lg:bottom-4">
          {error}
        </Alert>
      ) : null}

      <div className="sticky bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-20 -mx-4 flex gap-2 border-t border-line bg-bg/95 px-4 py-3 backdrop-blur lg:bottom-0 lg:mx-0 lg:rounded-2xl lg:border">
        {!isPublished ? (
          <button type="button" disabled={pending} onClick={() => submit(false)} className={buttonClass("secondary", "lg", "flex-1")}>
            Save draft
          </button>
        ) : null}
        <button type="submit" disabled={pending} className={buttonClass("primary", "lg", "flex-[2]")}>
          {pending ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Saving…
            </>
          ) : isPublished ? (
            "Save changes"
          ) : (
            "Publish"
          )}
        </button>
      </div>
      {isPublished ? null : <p className="text-center text-xs text-muted">To publish, add at least one photo and mark the IMEI check as clear.</p>}
    </form>
  );
}
