import { cn } from "./cn";

const gradeStyles: Record<string, string> = {
  A: "bg-ok-soft text-ok",
  B: "bg-brand-soft text-brand-ink",
  C: "bg-warn-soft text-warn",
};

export function GradeBadge({ grade, label, className }: { grade: string; label: string; className?: string }) {
  return (
    <span
      className={cn("inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold", gradeStyles[grade] ?? "bg-surface-3 text-fg", className)}
    >
      <span className="font-display text-[0.8rem] leading-none font-bold">{grade}</span>
      <span>{label}</span>
    </span>
  );
}

export function Chip({
  children,
  tone = "neutral",
  className,
}: {
  children: React.ReactNode;
  tone?: "neutral" | "ok" | "warn" | "bad" | "brand" | "tag";
  className?: string;
}) {
  const tones = {
    neutral: "bg-surface-3 text-fg",
    ok: "bg-ok-soft text-ok",
    warn: "bg-warn-soft text-warn",
    bad: "bg-bad-soft text-bad",
    brand: "bg-brand-soft text-brand-ink",
    tag: "bg-tag-soft text-fg",
  };
  return <span className={cn("inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium", tones[tone], className)}>{children}</span>;
}
