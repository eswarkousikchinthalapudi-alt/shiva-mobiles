import { formatInr } from "@/lib/format";
import { cn } from "./cn";

/**
 * The turmeric price sticker used for every price on the site. With no
 * value (the shop hides prices) it shows the "ask for price" label instead.
 */
export function PriceTag({ value, askLabel, size = "md", className }: { value: number | null; askLabel?: string; size?: "md" | "lg"; className?: string }) {
  return (
    <span className={cn("price-tag", size === "lg" && "price-tag-lg", size === "md" && "text-[1.05rem]", className)}>
      {value === null ? (askLabel ?? "Ask for price") : formatInr(value)}
    </span>
  );
}
