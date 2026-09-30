"use client";

import {
  Activity,
  BadgeIndianRupee,
  BellRing,
  BookOpen,
  ExternalLink,
  Home,
  Inbox,
  LogOut,
  Menu,
  Plus,
  Settings,
  ShieldCheck,
  Smartphone,
  Tags,
  Users,
  X,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";
import { logoutAction } from "@/app/admin/auth-actions";
import { cn } from "@/components/ui/cn";
import { LogoMark } from "@/components/ui/logo";

type NavItem = { href: string; label: string; icon: React.ElementType; badge?: number; ownerOnly?: boolean };

function isActive(pathname: string, href: string) {
  if (href === "/admin") return pathname === "/admin";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function AdminShell({
  children,
  user,
  counts,
}: {
  children: React.ReactNode;
  user: { name: string; role: "owner" | "staff" };
  counts: { requests: number; wanted: number };
}) {
  const pathname = usePathname();
  const moreRef = useRef<HTMLDialogElement>(null);
  useEffect(() => moreRef.current?.close(), [pathname]);

  const main: NavItem[] = [
    { href: "/admin", label: "Home", icon: Home },
    { href: "/admin/phones", label: "Phones", icon: Smartphone },
    { href: "/admin/requests", label: "Sell requests", icon: Inbox, badge: counts.requests },
    { href: "/admin/wanted", label: "Notify list", icon: BellRing, badge: counts.wanted },
    { href: "/admin/sales", label: "Sales", icon: BadgeIndianRupee },
  ];
  const more: NavItem[] = [
    { href: "/admin/catalog", label: "Phone catalog", icon: BookOpen },
    { href: "/admin/pricing", label: "Buying prices", icon: Tags },
    { href: "/admin/settings", label: "Shop settings", icon: Settings, ownerOnly: true },
    { href: "/admin/team", label: "Team", icon: Users, ownerOnly: true },
    { href: "/admin/activity", label: "Activity log", icon: Activity, ownerOnly: true },
    { href: "/admin/security", label: "My login and security", icon: ShieldCheck },
  ].filter((item) => !item.ownerOnly || user.role === "owner");

  const link = (item: NavItem, extra?: string) => (
    <Link
      key={item.href}
      href={item.href}
      aria-current={isActive(pathname, item.href) ? "page" : undefined}
      className={cn(
        "flex items-center gap-3 rounded-xl px-3 py-2.5 text-[0.95rem] font-medium",
        isActive(pathname, item.href) ? "bg-brand-soft text-brand-ink" : "hover:bg-surface-3",
        extra,
      )}
    >
      <item.icon className="h-5 w-5 shrink-0" aria-hidden />
      <span className="flex-1">{item.label}</span>
      {item.badge ? <span className="rounded-full bg-tag px-2 py-0.5 text-xs font-bold text-tag-fg">{item.badge}</span> : null}
    </Link>
  );

  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[16rem_1fr]">
      {/* Desktop sidebar */}
      <aside className="sticky top-0 hidden h-dvh flex-col border-r border-line bg-surface p-3 lg:flex">
        <Link href="/admin" className="mb-4 flex items-center gap-2.5 px-2 py-2">
          <LogoMark />
          <span className="font-display text-lg font-bold">Shop admin</span>
        </Link>
        <Link
          href="/admin/phones/new"
          className="mb-3 flex h-11 items-center justify-center gap-2 rounded-xl bg-brand font-semibold text-brand-fg hover:bg-brand-hover"
        >
          <Plus className="h-5 w-5" aria-hidden /> Add a phone
        </Link>
        <nav className="flex flex-1 flex-col gap-0.5 overflow-y-auto" aria-label="Admin">
          {main.map((item) => link(item))}
          <div className="my-2 border-t border-line" />
          {more.map((item) => link(item))}
        </nav>
        <div className="mt-3 border-t border-line pt-3">
          <p className="px-3 text-sm font-semibold">{user.name}</p>
          <p className="px-3 text-xs text-muted">{user.role === "owner" ? "Owner" : "Staff"}</p>
          <div className="mt-2 flex gap-1">
            <a href="/" target="_blank" className="flex flex-1 items-center justify-center gap-1.5 rounded-lg px-2 py-2 text-sm hover:bg-surface-3">
              <ExternalLink className="h-4 w-4" aria-hidden /> View site
            </a>
            <form action={logoutAction} className="flex-1">
              <button type="submit" className="flex w-full items-center justify-center gap-1.5 rounded-lg px-2 py-2 text-sm hover:bg-surface-3">
                <LogOut className="h-4 w-4" aria-hidden /> Log out
              </button>
            </form>
          </div>
        </div>
      </aside>

      <div className="min-w-0">
        {/* Mobile top bar */}
        <header className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b border-line bg-bg/90 px-4 backdrop-blur lg:hidden">
          <Link href="/admin" className="flex items-center gap-2">
            <LogoMark className="h-7 w-7" />
            <span className="font-display font-bold">Shop admin</span>
          </Link>
          <span className="ml-auto truncate text-sm text-muted">{user.name}</span>
        </header>

        <main className="mx-auto w-full max-w-5xl px-4 pb-28 pt-5 lg:px-8 lg:pb-12 lg:pt-8">{children}</main>

        {/* Mobile bottom tabs: the most used screens within thumb reach */}
        <nav
          className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-5 border-t border-line bg-surface pb-[env(safe-area-inset-bottom)] lg:hidden"
          aria-label="Admin"
        >
          {[main[0], main[1]].map((item) => (
            <Link
              key={item.href}
              href={item.href}
              aria-current={isActive(pathname, item.href) ? "page" : undefined}
              className={cn(
                "flex flex-col items-center gap-0.5 py-2 text-[0.7rem] font-medium",
                isActive(pathname, item.href) ? "text-brand-ink" : "text-muted",
              )}
            >
              <item.icon className="h-6 w-6" aria-hidden />
              {item.label}
            </Link>
          ))}
          <Link href="/admin/phones/new" className="flex flex-col items-center justify-center" aria-label="Add a phone">
            <span className="-mt-5 grid h-14 w-14 place-items-center rounded-2xl bg-brand text-brand-fg shadow-lg">
              <Plus className="h-7 w-7" aria-hidden />
            </span>
          </Link>
          <Link
            href="/admin/requests"
            aria-current={isActive(pathname, "/admin/requests") ? "page" : undefined}
            className={cn(
              "relative flex flex-col items-center gap-0.5 py-2 text-[0.7rem] font-medium",
              isActive(pathname, "/admin/requests") ? "text-brand-ink" : "text-muted",
            )}
          >
            <Inbox className="h-6 w-6" aria-hidden />
            Requests
            {counts.requests ? (
              <span className="absolute right-[22%] top-1 rounded-full bg-tag px-1.5 text-[0.65rem] font-bold text-tag-fg">{counts.requests}</span>
            ) : null}
          </Link>
          <button
            type="button"
            onClick={() => moreRef.current?.showModal()}
            className="flex flex-col items-center gap-0.5 py-2 text-[0.7rem] font-medium text-muted"
          >
            <Menu className="h-6 w-6" aria-hidden />
            More
          </button>
        </nav>

        <dialog ref={moreRef} className="sheet" aria-label="More" onClick={(e) => e.target === moreRef.current && moreRef.current?.close()}>
          <div className="flex items-center justify-between border-b border-line px-5 py-3.5">
            <span className="font-display text-lg font-semibold">More</span>
            <button
              type="button"
              onClick={() => moreRef.current?.close()}
              className="grid h-10 w-10 place-items-center rounded-full hover:bg-surface-3"
              aria-label="Close"
            >
              <X className="h-5 w-5" aria-hidden />
            </button>
          </div>
          <nav className="flex flex-col gap-0.5 p-3">
            {main.slice(3).map((item) => link(item))}
            {more.map((item) => link(item))}
            <a href="/" target="_blank" className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-[0.95rem] font-medium hover:bg-surface-3">
              <ExternalLink className="h-5 w-5" aria-hidden /> View the website
            </a>
            <form action={logoutAction}>
              <button type="submit" className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-[0.95rem] font-medium text-bad hover:bg-bad-soft">
                <LogOut className="h-5 w-5" aria-hidden /> Log out
              </button>
            </form>
          </nav>
        </dialog>
      </div>
    </div>
  );
}
