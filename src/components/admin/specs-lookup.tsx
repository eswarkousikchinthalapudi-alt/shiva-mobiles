"use client";

import { ExternalLink, Link2, Loader2, Sparkles } from "lucide-react";
import { useState, useTransition } from "react";
import { lookupSpecsAction } from "@/app/admin/(panel)/phones/actions";
import type { ModelInput } from "@/lib/admin/catalog";
import { looksLikeLink } from "@/lib/specs/link";
import { buttonClass } from "@/components/ui/button";
import { Alert } from "./ui";

export type LookupSource = "gsmarena" | "ai";

export function gsmarenaSearchUrl(query: string) {
  const q = query.trim();
  return q && !looksLikeLink(q) ? `https://www.gsmarena.com/results.php3?sQuickSearch=yes&sName=${encodeURIComponent(q)}` : "https://www.gsmarena.com/";
}

/**
 * The buttons under the "which phone?" box. A pasted GSMArena link is read
 * for free; a typed name goes to the AI lookup when it's switched on.
 */
export function SpecsLookup({
  query,
  aiEnabled,
  onFound,
  onManual,
}: {
  query: string;
  aiEnabled: boolean;
  onFound: (value: ModelInput, source: LookupSource) => void;
  onManual: () => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const [looking, startLookup] = useTransition();
  const text = query.trim();
  const isLink = looksLikeLink(text);

  const lookup = () =>
    startLookup(async () => {
      setError(null);
      const result = await lookupSpecsAction(text);
      if (result.ok && result.data) onFound(result.data.specs, result.data.source);
      else if (!result.ok) setError(result.error);
    });

  return (
    <div className="mt-3 space-y-2">
      <div className="flex flex-wrap gap-2">
        {isLink ? (
          <button type="button" onClick={lookup} disabled={looking} className={buttonClass("primary", "md")}>
            {looking ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Link2 className="h-4 w-4" aria-hidden />}
            {looking ? "Reading GSMArena…" : "Get specs from this link"}
          </button>
        ) : aiEnabled ? (
          <button type="button" onClick={lookup} disabled={looking || text.length < 2} className={buttonClass("primary", "md")}>
            {looking ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Sparkles className="h-4 w-4" aria-hidden />}
            {looking ? "Searching online…" : "Find specs online"}
          </button>
        ) : null}
        {!isLink ? (
          <a href={gsmarenaSearchUrl(text)} target="_blank" rel="noopener noreferrer" className={buttonClass("secondary", "md")}>
            <ExternalLink className="h-4 w-4" aria-hidden /> Search on GSMArena
          </a>
        ) : null}
        <button type="button" onClick={onManual} className={buttonClass(isLink || aiEnabled ? "ghost" : "secondary", "md")}>
          Add by hand
        </button>
      </div>
      <p className="text-sm text-muted">
        {isLink
          ? "The specs are read from this GSMArena page. You can check them before saving."
          : aiEnabled
            ? "Free option: open the phone on GSMArena, copy the link of its page and paste it in the box above."
            : "Open the phone on GSMArena, copy the link of its page and paste it in the box above. The specs fill in by themselves."}
      </p>
      {error ? (
        <Alert live tone="bad">
          {error}
        </Alert>
      ) : null}
    </div>
  );
}
