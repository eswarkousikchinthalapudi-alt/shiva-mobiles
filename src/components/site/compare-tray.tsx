"use client";

import { X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useT } from "@/i18n/client";
import { buttonClass } from "@/components/ui/button";
import { useCompare } from "./compare-store";

/** Sticky bar that appears once at least one phone is picked for comparing. */
export function CompareTray() {
  const t = useT();
  const pathname = usePathname();
  const { codes, clear } = useCompare();
  if (codes.length === 0 || pathname.startsWith("/compare")) return null;
  return (
    <div className="no-print fixed inset-x-0 bottom-0 z-40 px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
      <div className="mx-auto flex max-w-xl items-center gap-3 rounded-2xl border border-line bg-surface p-2.5 pl-4 shadow-[0_10px_40px_-12px_rgb(15_23_51/0.45)]">
        <p className="min-w-0 flex-1 text-sm font-medium">{t.compare.selected(codes.length)}</p>
        <button
          type="button"
          onClick={clear}
          className="grid h-10 w-10 place-items-center rounded-xl text-muted hover:bg-surface-3"
          aria-label={t.compare.clear}
        >
          <X className="h-4 w-4" aria-hidden />
        </button>
        <Link href={`/compare?ids=${codes.join(",")}`} className={buttonClass("primary", "md")}>
          {t.compare.now}
        </Link>
      </div>
    </div>
  );
}
