"use client";

import { Menu, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";
import { useT } from "@/i18n/client";
import { LangToggle } from "./lang-toggle";

export function MobileMenu({ phone, whatsapp }: { phone: string; whatsapp: string }) {
  const t = useT();
  const ref = useRef<HTMLDialogElement>(null);
  const pathname = usePathname();

  useEffect(() => {
    ref.current?.close();
  }, [pathname]);

  const links = [
    { href: "/phones", label: t.nav.phones },
    { href: "/sell", label: t.nav.sell },
    { href: "/compare", label: t.nav.compare },
    { href: "/#visit", label: t.nav.visit },
    { href: "/warranty", label: t.footer.warranty },
  ];

  return (
    <>
      <button
        type="button"
        className="grid h-10 w-10 place-items-center rounded-full border border-line-strong md:hidden"
        onClick={() => ref.current?.showModal()}
        aria-label={t.nav.menu}
      >
        <Menu className="h-5 w-5" aria-hidden />
      </button>
      <dialog ref={ref} className="sheet" aria-label={t.nav.menu} onClick={(e) => e.target === ref.current && ref.current?.close()}>
        <div className="flex items-center justify-between border-b border-line px-5 py-4">
          <span className="font-display text-lg font-semibold">{t.nav.menu}</span>
          <button
            type="button"
            onClick={() => ref.current?.close()}
            className="grid h-10 w-10 place-items-center rounded-full hover:bg-surface-3"
            aria-label={t.nav.close}
          >
            <X className="h-5 w-5" aria-hidden />
          </button>
        </div>
        <nav className="flex flex-col p-3">
          {links.map((link) => (
            <Link key={link.href} href={link.href} className="rounded-xl px-3 py-3.5 text-lg font-medium hover:bg-surface-3">
              {link.label}
            </Link>
          ))}
        </nav>
        <div className="flex flex-wrap items-center gap-3 border-t border-line px-5 py-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
          <LangToggle />
          {phone ? (
            <a href={`tel:${phone.replace(/[^\d+]/g, "")}`} className="text-sm font-medium text-brand-ink underline-offset-4 hover:underline">
              {phone}
            </a>
          ) : null}
          {whatsapp ? <span className="sr-only">{whatsapp}</span> : null}
        </div>
      </dialog>
    </>
  );
}
