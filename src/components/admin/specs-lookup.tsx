"use client";

import { ClipboardPaste, Loader2, Sparkles } from "lucide-react";
import { useState, useTransition } from "react";
import { lookupSpecsAction, readSpecsTextAction } from "@/app/admin/(panel)/phones/actions";
import type { ModelInput } from "@/lib/admin/catalog";
import { looksLikeLink } from "@/lib/specs/link";
import { buttonClass } from "@/components/ui/button";
import { cn } from "@/components/ui/cn";
import { Alert, inputClass } from "./ui";

export type LookupSource = "gsmarena" | "wikipedia" | "ai" | "pasted";

/**
 * The buttons under the "which phone?" box. One tap gets the specs
 * (Wikipedia read by the free AI, the AI's memory as a backup, or a
 * GSMArena link if one was pasted). Pasting specs text from any site is
 * kept as a fallback for phones nothing knows.
 */
export function SpecsLookup({
  query,
  aiEnabled,
  onFound,
  onManual,
}: {
  query: string;
  aiEnabled: boolean;
  onFound: (value: ModelInput, source: LookupSource, note?: string) => void;
  onManual: () => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const [pasteOpen, setPasteOpen] = useState(false);
  const [pasted, setPasted] = useState("");
  const [looking, startLookup] = useTransition();
  const [reading, startRead] = useTransition();
  const text = query.trim();
  const isLink = looksLikeLink(text);

  const lookup = () =>
    startLookup(async () => {
      setError(null);
      const result = await lookupSpecsAction(text);
      if (result.ok && result.data) onFound(result.data.specs, result.data.source, result.data.note);
      else if (!result.ok) setError(result.error);
    });

  const readPasted = () =>
    startRead(async () => {
      setError(null);
      const result = await readSpecsTextAction(pasted, isLink ? "" : text);
      if (result.ok && result.data) onFound(result.data.specs, result.data.source, result.data.note);
      else if (!result.ok) setError(result.error);
    });

  return (
    <div className="mt-3 space-y-3">
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={lookup} disabled={looking || text.length < 2} className={buttonClass("primary", "md")}>
          {looking ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Sparkles className="h-4 w-4" aria-hidden />}
          {looking ? "Getting specs…" : isLink ? "Get specs from this link" : "Get specs"}
        </button>
        <button type="button" onClick={onManual} className={buttonClass("secondary", "md")}>
          Add by hand
        </button>
        <button type="button" onClick={() => setPasteOpen((open) => !open)} aria-expanded={pasteOpen} className={buttonClass("ghost", "md")}>
          <ClipboardPaste className="h-4 w-4" aria-hidden /> Paste specs
        </button>
      </div>
      {!pasteOpen ? (
        <p className="text-sm text-muted">
          {isLink
            ? "The specs are read from this GSMArena page."
            : aiEnabled
              ? "Looks the phone up on Wikipedia and fills in the specs for you to check. Takes a few seconds."
              : "Looks the phone up on Wikipedia. Add OPENROUTER_API_KEY on the server for better results."}
        </p>
      ) : null}
      {pasteOpen ? (
        <div className="space-y-3 rounded-2xl border border-line-strong bg-surface-2 p-4">
          <p className="font-semibold">Paste the specs from any website</p>
          <p className="text-sm text-muted">
            Open the phone&apos;s page on GSMArena, 91mobiles, Smartprix or the brand&apos;s site, copy all the text (on a phone: long-press a word →{" "}
            <strong>Select all</strong> → <strong>Copy</strong>; on a computer: Ctrl+A, Ctrl+C) and paste it here. Menus and other text that come along are
            fine.
          </p>
          <label htmlFor="specs-paste" className="sr-only">
            Copied specs text
          </label>
          <textarea
            id="specs-paste"
            className={cn(inputClass, "h-32 py-2 text-sm")}
            placeholder="Paste here"
            value={pasted}
            maxLength={200000}
            onChange={(e) => setPasted(e.target.value)}
          />
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={readPasted} disabled={reading || pasted.trim().length < 20} className={buttonClass("primary", "md")}>
              {reading ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
              {reading ? "Reading…" : "Read specs"}
            </button>
            <button type="button" onClick={() => setPasteOpen(false)} className={buttonClass("ghost", "md")}>
              Close
            </button>
          </div>
        </div>
      ) : null}
      {error ? (
        <Alert live tone="bad">
          {error}
        </Alert>
      ) : null}
    </div>
  );
}
