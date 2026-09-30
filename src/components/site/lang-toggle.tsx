"use client";

import { Languages } from "lucide-react";
import { useTransition } from "react";
import { setLanguage } from "@/i18n/actions";
import { useLang, useT } from "@/i18n/client";
import { cn } from "@/components/ui/cn";

export function LangToggle({ className }: { className?: string }) {
  const lang = useLang();
  const t = useT();
  const [pending, startTransition] = useTransition();
  return (
    <button
      type="button"
      onClick={() => startTransition(() => setLanguage(lang === "en" ? "te" : "en"))}
      disabled={pending}
      aria-label={t.switchToLabel}
      lang={lang === "en" ? "te" : "en"}
      className={cn(
        "inline-flex h-10 items-center gap-1.5 rounded-full border border-line-strong px-3 text-sm font-medium hover:border-brand hover:text-brand-ink",
        pending && "opacity-60",
        className,
      )}
    >
      <Languages className="h-4 w-4" aria-hidden />
      {t.switchTo}
    </button>
  );
}
