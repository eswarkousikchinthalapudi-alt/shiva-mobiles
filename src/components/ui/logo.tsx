import { cn } from "./cn";

/** Shop mark: a phone outline with the price-tag hole. */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={cn("h-8 w-8", className)} aria-hidden="true">
      <rect x="1" y="1" width="30" height="30" rx="9" fill="var(--brand)" />
      <rect x="10" y="6" width="12" height="20" rx="3.2" fill="none" stroke="var(--brand-fg)" strokeWidth="2" />
      <circle cx="16" cy="21.5" r="2.1" fill="var(--tag)" />
    </svg>
  );
}

export function Wordmark({ name, className }: { name: string; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <LogoMark />
      <span className="font-display text-[1.2rem] font-bold tracking-[-0.02em] text-fg">{name}</span>
    </span>
  );
}
