import { formatInr } from "@/lib/format";
import { cn } from "./cn";

/** The turmeric price sticker used for every price on the site. */
export function PriceTag({ value, size = "md", className }: { value: number; size?: "md" | "lg"; className?: string }) {
  return <span className={cn("price-tag", size === "lg" && "price-tag-lg", size === "md" && "text-[1.05rem]", className)}>{formatInr(value)}</span>;
}
