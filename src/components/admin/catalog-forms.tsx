"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { deleteModelAction, updateModelAction } from "@/app/admin/(panel)/catalog/actions";
import { createModelAction } from "@/app/admin/(panel)/phones/actions";
import type { ModelInput } from "@/lib/admin/catalog";
import { looksLikeLink } from "@/lib/specs/link";
import { buttonClass } from "@/components/ui/button";
import { Alert, Field, inputClass } from "./ui";
import { EMPTY_MODEL, ModelEditor } from "./model-editor";
import { SpecsLookup, type LookupSource } from "./specs-lookup";

export function EditModelForm({
  id,
  initial,
  initiallyVerified,
  canDelete,
}: {
  id: string;
  initial: ModelInput;
  initiallyVerified: boolean;
  canDelete: boolean;
}) {
  const router = useRouter();
  const [value, setValue] = useState<ModelInput>(initial);
  const [verified, setVerified] = useState(initiallyVerified);
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [saving, startSave] = useTransition();
  const [deleting, startDelete] = useTransition();

  return (
    <div className="space-y-4">
      <ModelEditor
        value={value}
        onChange={setValue}
        source="edit"
        saving={saving}
        saveLabel="Save specs"
        extra={
          <label className="flex cursor-pointer items-start gap-3 rounded-2xl border-2 border-line-strong bg-surface p-3 has-[:checked]:border-ok has-[:checked]:bg-ok-soft">
            <input type="checkbox" checked={verified} onChange={(e) => setVerified(e.target.checked)} className="mt-0.5 h-5 w-5 accent-[var(--ok)]" />
            <span>
              <span className="block font-semibold">I checked these specs</span>
              <span className="block text-sm text-muted">Tick after comparing with the box, the phone’s settings or the brand’s website.</span>
            </span>
          </label>
        }
        onSave={() =>
          startSave(async () => {
            const res = await updateModelAction(id, value, verified);
            setResult(res.ok ? { ok: true, text: "Saved. Every phone of this model now shows these specs." } : { ok: false, text: res.error });
            if (res.ok) router.refresh();
          })
        }
      />
      {result ? (
        <Alert live tone={result.ok ? "ok" : "bad"}>
          {result.text}
        </Alert>
      ) : null}
      {canDelete ? (
        confirmDelete ? (
          <div className="flex flex-wrap items-center gap-2 rounded-2xl bg-bad-soft p-3">
            <p className="text-[0.95rem] text-bad">Delete this model from the catalog?</p>
            <button
              type="button"
              disabled={deleting}
              onClick={() =>
                startDelete(async () => {
                  const res = await deleteModelAction(id);
                  if (!res.ok) setResult({ ok: false, text: res.error });
                })
              }
              className={buttonClass("danger", "sm")}
            >
              {deleting ? "Deleting…" : "Yes, delete"}
            </button>
            <button type="button" onClick={() => setConfirmDelete(false)} className={buttonClass("ghost", "sm")}>
              Cancel
            </button>
          </div>
        ) : (
          <button type="button" onClick={() => setConfirmDelete(true)} className={buttonClass("ghost", "sm", "text-bad")}>
            Delete this model
          </button>
        )
      ) : null}
    </div>
  );
}

export function NewModelForm({ aiEnabled }: { aiEnabled: boolean }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [editor, setEditor] = useState<{ value: ModelInput; source: LookupSource | "manual" } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, startSave] = useTransition();

  return (
    <div className="space-y-4">
      {!editor ? (
        <div>
          <Field label="GSMArena link, or model name or number" htmlFor="new-model-q" hint="e.g. a gsmarena.com link, Galaxy A55, SM-A556E or iPhone 14 Plus">
            <input id="new-model-q" className={inputClass} value={query} onChange={(e) => setQuery(e.target.value)} maxLength={500} autoComplete="off" />
          </Field>
          <SpecsLookup
            query={query}
            aiEnabled={aiEnabled}
            onFound={(value, source) => (setError(null), setEditor({ value, source }))}
            onManual={() => (setError(null), setEditor({ value: { ...EMPTY_MODEL, name: looksLikeLink(query) ? "" : query.trim() }, source: "manual" }))}
          />
        </div>
      ) : null}
      {error ? (
        <Alert live tone="bad">
          {error}
        </Alert>
      ) : null}
      {editor ? (
        <div>
          <ModelEditor
            value={editor.value}
            source={editor.source}
            saving={saving}
            onChange={(value) => setEditor({ ...editor, value })}
            onCancel={() => setEditor(null)}
            onSave={() =>
              startSave(async () => {
                const res = await createModelAction(editor.value, editor.source);
                if (res.ok && res.data) router.push(`/admin/catalog/${res.data.id}?created=1`);
                else if (!res.ok) setError(res.error);
              })
            }
          />
        </div>
      ) : null}
    </div>
  );
}
