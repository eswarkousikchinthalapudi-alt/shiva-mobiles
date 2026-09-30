import Link from "next/link";
import { cn } from "@/components/ui/cn";

export const inputClass =
  "h-12 w-full rounded-[12px] border border-line-strong bg-surface px-3.5 text-base text-fg placeholder:text-faint focus:border-brand focus:outline-none disabled:opacity-60";

export function Field({
  label,
  hint,
  error,
  htmlFor,
  children,
  className,
}: {
  label: React.ReactNode;
  hint?: React.ReactNode;
  error?: string | null;
  htmlFor?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <label htmlFor={htmlFor} className="block text-sm font-semibold">
        {label}
      </label>
      {children}
      {hint && !error ? <p className="text-sm text-muted">{hint}</p> : null}
      {error ? (
        <p className="text-sm font-medium text-bad" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}

/** A labelled group of choice buttons; screen readers read the label as the question. */
export function Group({ label, hint, children, className }: { label: React.ReactNode; hint?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <fieldset className={cn("min-w-0", className)}>
      <legend className="mb-1.5 block text-sm font-semibold">{label}</legend>
      {children}
      {hint ? <p className="mt-1.5 text-sm text-muted">{hint}</p> : null}
    </fieldset>
  );
}

export function Card({
  children,
  className,
  title,
  action,
}: {
  children: React.ReactNode;
  className?: string;
  title?: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <section className={cn("rounded-[20px] border border-line bg-surface p-4 sm:p-5", className)}>
      {title || action ? (
        <div className="mb-3 flex items-center justify-between gap-3">
          {title ? <h2 className="font-display text-lg font-semibold">{title}</h2> : <span />}
          {action}
        </div>
      ) : null}
      {children}
    </section>
  );
}

export function PageHeader({ title, subtitle, action }: { title: React.ReactNode; subtitle?: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div className="min-w-0">
        <h1 className="font-display text-2xl font-bold sm:text-3xl">{title}</h1>
        {subtitle ? <p className="mt-1 text-muted">{subtitle}</p> : null}
      </div>
      {action}
    </div>
  );
}

export function Alert({
  tone = "info",
  children,
  className,
  live = false,
}: {
  tone?: "info" | "ok" | "warn" | "bad";
  children: React.ReactNode;
  className?: string;
  /** Set for messages that appear after an action, so screen readers announce them. */
  live?: boolean;
}) {
  const tones = {
    info: "bg-brand-soft text-brand-ink",
    ok: "bg-ok-soft text-ok",
    warn: "bg-warn-soft text-warn",
    bad: "bg-bad-soft text-bad",
  };
  return (
    <div
      role={live ? (tone === "bad" ? "alert" : "status") : undefined}
      className={cn("rounded-2xl px-4 py-3 text-[0.95rem] font-medium", tones[tone], className)}
    >
      {children}
    </div>
  );
}

export type Tab = { href: string; label: string; count?: number; active: boolean };

/** Pill tabs that scroll sideways on small screens instead of wrapping. */
export function TabNav({ label, tabs }: { label: string; tabs: Tab[] }) {
  return (
    <nav className="scroll-row -mx-4 mb-4 flex gap-2 overflow-x-auto px-4 pb-1" aria-label={label}>
      {tabs.map((tab) => (
        <Link
          key={tab.href}
          href={tab.href}
          aria-current={tab.active ? "page" : undefined}
          className={cn(
            "inline-flex h-10 shrink-0 items-center gap-2 whitespace-nowrap rounded-full border px-4 text-sm font-semibold",
            tab.active ? "border-brand bg-brand text-brand-fg" : "border-line-strong bg-surface hover:border-brand",
          )}
        >
          {tab.label}
          {tab.count !== undefined ? (
            <span className={cn("rounded-full px-1.5 text-xs tabular", tab.active ? "bg-brand-fg/20" : "bg-surface-3")}>{tab.count}</span>
          ) : null}
        </Link>
      ))}
    </nav>
  );
}

export function StatusPill({ status }: { status: string }) {
  const map: Record<string, string> = {
    available: "bg-ok-soft text-ok",
    reserved: "bg-warn-soft text-warn",
    sold: "bg-surface-3 text-muted",
    draft: "bg-brand-soft text-brand-ink",
    hidden: "bg-surface-3 text-muted",
    new: "bg-tag-soft text-fg",
    contacted: "bg-brand-soft text-brand-ink",
    offer_sent: "bg-brand-soft text-brand-ink",
    pickup_scheduled: "bg-warn-soft text-warn",
    bought: "bg-ok-soft text-ok",
    rejected: "bg-surface-3 text-muted",
    cancelled: "bg-surface-3 text-muted",
    open: "bg-tag-soft text-fg",
    notified: "bg-ok-soft text-ok",
    closed: "bg-surface-3 text-muted",
  };
  const labels: Record<string, string> = {
    available: "Available",
    reserved: "Reserved",
    sold: "Sold",
    draft: "Draft",
    hidden: "Hidden",
    new: "New",
    contacted: "Contacted",
    offer_sent: "Offer sent",
    pickup_scheduled: "Pickup booked",
    bought: "Bought",
    rejected: "Not buying",
    cancelled: "Cancelled",
    open: "Waiting",
    notified: "Told them",
    closed: "Closed",
  };
  return (
    <span className={cn("inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold", map[status] ?? "bg-surface-3")}>
      {labels[status] ?? status}
    </span>
  );
}
