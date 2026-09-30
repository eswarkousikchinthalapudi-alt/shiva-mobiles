"use client";

import { Check, Plus } from "lucide-react";
import { useState } from "react";
import { useT } from "@/i18n/client";
import { cn } from "@/components/ui/cn";
import { useCompare } from "./compare-store";

export function CompareToggle({ code, className, size = "sm" }: { code: string; className?: string; size?: "sm" | "md" }) {
  const t = useT();
  const { has, toggle } = useCompare();
  const [full, setFull] = useState(false);
  const active = has(code);
  return (
    <>
      <button
        type="button"
        aria-pressed={active}
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
          const ok = toggle(code);
          setFull(!ok);
          if (!ok) window.setTimeout(() => setFull(false), 3500);
        }}
        className={cn(
          "inline-flex items-center gap-1.5 rounded-full border font-medium transition-colors",
          size === "sm" ? "h-8 px-3 text-xs" : "h-11 px-4 text-sm",
          active ? "border-brand bg-brand text-brand-fg" : "border-line-strong bg-surface text-fg hover:border-brand hover:text-brand-ink",
          className,
        )}
      >
        {active ? <Check className="h-3.5 w-3.5" aria-hidden /> : <Plus className="h-3.5 w-3.5" aria-hidden />}
        {active ? t.action.removeCompare : t.action.addCompare}
      </button>
      {full ? (
        <span role="status" className="sr-only">
          {t.compare.full}
        </span>
      ) : null}
      {full ? (
        <span className="fixed inset-x-4 bottom-24 z-50 mx-auto max-w-md rounded-xl bg-fg px-4 py-3 text-center text-sm text-bg shadow-lg" aria-hidden>
          {t.compare.full}
        </span>
      ) : null}
    </>
  );
}
