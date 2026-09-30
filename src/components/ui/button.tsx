import { cn } from "./cn";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "chat" | "danger" | "tag";
export type ButtonSize = "sm" | "md" | "lg";

const base =
  "inline-flex items-center justify-center gap-2 font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-55 select-none whitespace-nowrap";

const variants: Record<ButtonVariant, string> = {
  primary: "bg-brand text-brand-fg hover:bg-brand-hover",
  secondary: "bg-surface text-fg border border-line-strong hover:border-brand hover:text-brand-ink",
  ghost: "text-fg hover:bg-surface-3",
  // WhatsApp-style green, kept for chat actions only so people recognise it.
  chat: "bg-[#128C4A] text-white hover:bg-[#0f7a40] dark:bg-[#1FAF5C] dark:text-[#04210f] dark:hover:bg-[#27c56a]",
  danger: "bg-bad text-white hover:opacity-90 dark:text-[#2a0a05]",
  tag: "bg-tag text-tag-fg hover:brightness-95",
};

// min-h keeps the height even when a flex parent sets flex-basis (e.g. flex-1 in a column).
const sizes: Record<ButtonSize, string> = {
  sm: "h-9 min-h-9 px-3 text-sm rounded-[10px]",
  md: "h-11 min-h-11 px-4 text-[0.95rem] rounded-[12px]",
  lg: "h-13 min-h-13 px-6 text-base rounded-[14px]",
};

export function buttonClass(variant: ButtonVariant = "primary", size: ButtonSize = "md", extra?: string) {
  return cn(base, variants[variant], sizes[size], extra);
}

export function Button({
  variant = "primary",
  size = "md",
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant; size?: ButtonSize }) {
  return <button className={buttonClass(variant, size, className)} {...props} />;
}
