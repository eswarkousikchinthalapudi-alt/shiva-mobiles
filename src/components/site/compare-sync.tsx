"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useT } from "@/i18n/client";
import { useCompare } from "./compare-store";
import Link from "next/link";
import { buttonClass } from "@/components/ui/button";

/** Keeps the compare tray in step with the phones shown on /compare. */
export function CompareSync({ codes }: { codes: string[] }) {
  const { set } = useCompare();
  const key = codes.join(",");
  useEffect(() => {
    set(key ? key.split(",") : []);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return null;
}

/** /compare without ids: use the phones picked in this browser, if any. */
export function CompareFromStorage({ autoRedirect }: { autoRedirect: boolean }) {
  const t = useT();
  const router = useRouter();
  const { codes } = useCompare();
  useEffect(() => {
    if (autoRedirect && codes.length > 0) router.replace(`/compare?ids=${codes.join(",")}`);
  }, [autoRedirect, codes, router]);
  return (
    <div className="rounded-[22px] border border-dashed border-line-strong bg-surface p-8 text-center">
      <p className="mx-auto max-w-md text-muted">{t.compare.empty}</p>
      <Link href="/phones" className={buttonClass("primary", "md", "mt-5")}>
        {t.compare.pick}
      </Link>
    </div>
  );
}
