import { BatteryMedium, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { dictionaries, type Lang } from "@/i18n/dictionaries";
import type { ListingCardData } from "@/lib/listings";
import { getShopSettings } from "@/lib/settings";
import { withoutPriceTags } from "@/lib/tags";
import { GradeBadge } from "@/components/ui/badges";
import { cn } from "@/components/ui/cn";
import { PhoneImage } from "@/components/ui/phone-image";
import { PriceTag } from "@/components/ui/price-tag";
import { CompareToggle } from "./compare-toggle";

export function variantLabel(ramGb: number | null, storageGb: number) {
  const storage = storageGb >= 1024 ? `${storageGb / 1024} TB` : `${storageGb} GB`;
  return ramGb ? `${ramGb}/${storage}` : storage;
}

export async function PhoneCard({
  item,
  lang,
  priority = false,
  showCompare = true,
  className,
}: {
  item: ListingCardData;
  lang: Lang;
  priority?: boolean;
  showCompare?: boolean;
  className?: string;
}) {
  const t = dictionaries[lang];
  const { showPrices } = await getShopSettings();
  const tags = showPrices ? item.tags : withoutPriceTags(item.tags);
  const sold = item.status === "sold";
  const reserved = item.status === "reserved";
  return (
    <article
      className={cn(
        "group relative flex flex-col overflow-hidden rounded-[20px] border border-line bg-surface transition-[border-color] hover:border-line-strong focus-within:ring-3 focus-within:ring-[var(--focus)]",
        sold && "opacity-75",
        className,
      )}
    >
      <div className="relative aspect-[4/5] bg-surface-2">
        <PhoneImage photo={item.photo} alt={item.name} priority={priority} fit="cover" className="h-full w-full" />
        <GradeBadge grade={item.grade} label={t.grade[item.grade]} className="absolute left-3 top-3" />
        {reserved || sold ? (
          <span className="absolute right-3 top-3 rounded-full bg-fg px-2.5 py-1 text-xs font-semibold text-bg">{sold ? t.card.sold : t.card.reserved}</span>
        ) : null}
        <PriceTag value={showPrices ? item.priceInr : null} askLabel={t.card.askPrice} className="absolute bottom-3 left-3" />
      </div>
      <div className="flex flex-1 flex-col gap-2 p-3.5 pt-3">
        <h3 className="font-display text-[1.02rem] font-semibold leading-snug">
          <Link href={`/phones/${item.slug}`} className="after:absolute after:inset-0 after:content-[''] focus-visible:outline-none">
            {item.name}
          </Link>
        </h3>
        <p className="-mt-1 text-sm text-muted">
          {variantLabel(item.ramGb, item.storageGb)}
          {item.color ? `, ${item.color}` : ""}
        </p>
        <ul className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted">
          <li className="inline-flex items-center gap-1">
            <BatteryMedium className="h-3.5 w-3.5" aria-hidden />
            {item.batteryHealth ? t.card.battery(item.batteryHealth) : t.card.batteryChecked}
          </li>
          {item.imeiVerified ? (
            <li className="inline-flex items-center gap-1 text-ok">
              <ShieldCheck className="h-3.5 w-3.5" aria-hidden />
              {t.trust.imei}
            </li>
          ) : null}
        </ul>
        {tags.length > 0 ? (
          <ul className="flex flex-wrap gap-1.5">
            {tags.slice(0, 2).map((tag) => (
              <li key={tag} className="rounded-md bg-surface-3 px-2 py-0.5 text-[0.72rem] font-medium text-fg">
                {t.tag[tag]}
              </li>
            ))}
          </ul>
        ) : null}
        {showCompare && !sold ? (
          <div className="relative z-10 mt-auto pt-1">
            <CompareToggle code={item.code} />
          </div>
        ) : null}
      </div>
    </article>
  );
}
