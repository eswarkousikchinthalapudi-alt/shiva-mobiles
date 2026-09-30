/**
 * Tags shown on phone cards and used as quick filters.
 * "auto" tags are worked out from the phone's data; "shop" tags are the
 * owner's own picks, chosen when adding a phone.
 */
export const AUTO_TAGS = ["just-arrived", "price-dropped", "like-new", "5g", "120hz", "big-battery", "box-bill", "under-10k", "under-20k", "iphone"] as const;

export const SHOP_TAGS = ["gaming", "camera", "parents", "students", "office"] as const;

export type AutoTag = (typeof AUTO_TAGS)[number];
export type ShopTag = (typeof SHOP_TAGS)[number];
export type TagKey = AutoTag | ShopTag;

export const ALL_TAGS: readonly TagKey[] = [...AUTO_TAGS, ...SHOP_TAGS];

export function isTagKey(value: string): value is TagKey {
  return (ALL_TAGS as readonly string[]).includes(value);
}

export function isShopTag(value: string): value is ShopTag {
  return (SHOP_TAGS as readonly string[]).includes(value);
}

export const JUST_ARRIVED_DAYS = 7;
export const PRICE_DROP_DAYS = 14;

export type TagInput = {
  brand: string;
  grade: string;
  priceInr: number;
  previousPriceInr: number | null;
  priceDroppedAt: Date | string | null;
  publishedAt: Date | string | null;
  hasBox: boolean;
  hasBill: boolean;
  has5g: boolean;
  refreshHz: number | null;
  batteryMah: number | null;
  shopTags: string[];
};

function withinDays(value: Date | string | null, days: number, now: number) {
  if (!value) return false;
  const time = typeof value === "string" ? Date.parse(value) : value.getTime();
  return now - time <= days * 24 * 60 * 60 * 1000;
}

/** Most useful tags first; cards show only the first two or three. */
export function computeTags(input: TagInput, now = Date.now()): TagKey[] {
  const tags: TagKey[] = [];
  if (input.previousPriceInr && input.previousPriceInr > input.priceInr && withinDays(input.priceDroppedAt, PRICE_DROP_DAYS, now)) {
    tags.push("price-dropped");
  }
  if (withinDays(input.publishedAt, JUST_ARRIVED_DAYS, now)) tags.push("just-arrived");
  for (const tag of input.shopTags) if (isShopTag(tag) && !tags.includes(tag)) tags.push(tag);
  if (input.grade === "A") tags.push("like-new");
  if (input.has5g) tags.push("5g");
  if ((input.refreshHz ?? 0) >= 120) tags.push("120hz");
  if ((input.batteryMah ?? 0) >= 5000) tags.push("big-battery");
  if (input.hasBox && input.hasBill) tags.push("box-bill");
  if (input.priceInr <= 10000) tags.push("under-10k");
  else if (input.priceInr <= 20000) tags.push("under-20k");
  if (input.brand.toLowerCase() === "apple") tags.push("iphone");
  return tags;
}
