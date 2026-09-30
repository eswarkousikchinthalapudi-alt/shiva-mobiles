/** WhatsApp message texts the shop sends. Safe to use in client components. */
import { formatInr } from "./format";

type Lang = "en" | "te";

/** Tells a "notify me" customer that a matching phone is in. */
export function wantedPhoneMessage(
  lang: Lang,
  p: { name: string; shopName: string; wantText: string; phoneName: string; priceInr: number; url: string },
): string {
  return lang === "te"
    ? `నమస్తే ${p.name}, ${p.shopName} నుంచి. మీరు "${p.wantText}" కావాలని అడిగారు. ఇప్పుడు మా దగ్గర ${p.phoneName} ${formatInr(p.priceInr)} కి ఉంది. ఫోటోలు, వివరాలు: ${p.url}`
    : `Hi ${p.name}, this is ${p.shopName}. You asked us about "${p.wantText}". We now have a ${p.phoneName} for ${formatInr(p.priceInr)}. See photos and details: ${p.url}`;
}

/** First reply to a "notify me" request when nothing matches yet. */
export function wantedHelloMessage(lang: Lang, p: { name: string; shopName: string; wantText: string }): string {
  return lang === "te"
    ? `నమస్తే ${p.name}, ${p.shopName} నుంచి. "${p.wantText}" కోసం మీ రిక్వెస్ట్ అందింది. సరిపడే ఫోన్ రాగానే మీకు మెసేజ్ చేస్తాం.`
    : `Hi ${p.name}, this is ${p.shopName}. We got your request for "${p.wantText}". We'll message you as soon as a matching phone comes in.`;
}
