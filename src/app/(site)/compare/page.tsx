import { CheckCircle2, X } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { getT } from "@/i18n/server";
import { formatInr } from "@/lib/format";
import { listingsByCodes } from "@/lib/listings";
import { getSiteUrl } from "@/lib/settings";
import { GradeBadge } from "@/components/ui/badges";
import { cn } from "@/components/ui/cn";
import { PhoneImage } from "@/components/ui/phone-image";
import { PriceTag } from "@/components/ui/price-tag";
import { CompareFromStorage, CompareSync } from "@/components/site/compare-sync";
import { ShareButton } from "@/components/site/phone-actions";
import { variantLabel } from "@/components/site/phone-card";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getT();
  return { title: t.compare.title, robots: { index: false } };
}

type Cell = { text: React.ReactNode; score: number | null };
type RowDef = { label: string; cells: Cell[]; better: "high" | "low" };

const GRADE_SCORE: Record<string, number> = { A: 3, B: 2, C: 1 };

function bestIndexes(row: RowDef): Set<number> {
  const scores = row.cells.map((c) => c.score);
  const valid = scores.filter((s): s is number => s !== null);
  if (valid.length < 2) return new Set();
  const target = row.better === "high" ? Math.max(...valid) : Math.min(...valid);
  if (valid.every((s) => s === target)) return new Set();
  return new Set(scores.flatMap((s, i) => (s === target ? [i] : [])));
}

export default async function ComparePage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const raw = (await searchParams).ids;
  const codes = [...new Set((typeof raw === "string" ? raw : "").split(",").map((c) => c.trim().toUpperCase()))]
    .filter((c) => /^[A-Z]{2}-\d{3,6}$/.test(c))
    .slice(0, 3);
  const [{ t }, siteUrl, items] = await Promise.all([getT(), getSiteUrl(), listingsByCodes(codes)]);

  if (codes.length === 0 || items.length === 0) {
    return (
      <div className="mx-auto max-w-3xl px-4 pb-16 pt-8">
        <h1 className="mb-6 font-display text-3xl font-bold sm:text-4xl">{t.compare.title}</h1>
        {raw !== undefined ? <CompareSync codes={[]} /> : null}
        <CompareFromStorage autoRedirect={raw === undefined} />
      </div>
    );
  }

  const rows: RowDef[] = [
    { label: t.compare.price, better: "low", cells: items.map((x) => ({ text: formatInr(x.priceInr), score: x.priceInr })) },
    {
      label: t.grade.label,
      better: "high",
      cells: items.map((x) => ({ text: <GradeBadge grade={x.grade} label={t.grade[x.grade]} />, score: GRADE_SCORE[x.grade] ?? null })),
    },
    {
      label: t.phone.batteryHealth,
      better: "high",
      cells: items.map((x) => ({ text: x.batteryHealth ? `${x.batteryHealth}%` : t.phone.batteryUnknown, score: x.batteryHealth })),
    },
    {
      label: t.phone.testsPassed,
      better: "high",
      cells: items.map((x) => ({ text: t.phone.testsValue(x.testsPassed, x.testsTotal), score: x.testsTotal ? x.testsPassed / x.testsTotal : null })),
    },
    {
      label: t.phone.warranty,
      better: "high",
      cells: items.map((x) => ({ text: x.warrantyMonths ? t.phone.shopWarranty(x.warrantyMonths) : t.phone.noShopWarranty, score: x.warrantyMonths })),
    },
    { label: t.browse.storage, better: "high", cells: items.map((x) => ({ text: `${x.storageGb} GB`, score: x.storageGb })) },
    { label: t.browse.ram, better: "high", cells: items.map((x) => ({ text: x.ramGb ? `${x.ramGb} GB` : "—", score: x.ramGb })) },
    { label: t.phone.processor, better: "high", cells: items.map((x) => ({ text: x.specs.chipset ?? "—", score: null })) },
    {
      label: t.phone.speed,
      better: "high",
      cells: items.map((x) => ({ text: x.specs.performance ? t.phone.speedTiers[x.specs.performance] : "—", score: x.specs.performance })),
    },
    {
      label: t.phone.screen,
      better: "high",
      cells: items.map((x) => ({
        text: x.specs.displayInches ? `${x.specs.displayInches}″ ${x.specs.displayType ?? ""}${x.specs.refreshHz ? `, ${x.specs.refreshHz}Hz` : ""}` : "—",
        score: x.specs.refreshHz,
      })),
    },
    { label: t.phone.camera, better: "high", cells: items.map((x) => ({ text: x.specs.cameraSummary ?? "—", score: null })) },
    {
      label: t.phone.batterySize,
      better: "high",
      cells: items.map((x) => ({ text: x.specs.batteryMah ? `${x.specs.batteryMah} mAh` : "—", score: x.specs.batteryMah })),
    },
    {
      label: t.phone.charging,
      better: "high",
      cells: items.map((x) => ({ text: x.specs.chargingW ? `${x.specs.chargingW}W` : "—", score: x.specs.chargingW })),
    },
    { label: t.phone.network, better: "high", cells: items.map((x) => ({ text: x.specs.has5g ? "5G" : "4G", score: x.specs.has5g ? 1 : 0 })) },
    {
      label: t.phone.launched,
      better: "high",
      cells: items.map((x) => ({ text: x.specs.launchYear ? String(x.specs.launchYear) : "—", score: x.specs.launchYear })),
    },
    {
      label: t.phone.priceNew,
      better: "high",
      cells: items.map((x) => {
        const saving = x.launchPriceInr && x.launchPriceInr > x.priceInr ? x.launchPriceInr - x.priceInr : null;
        return { text: x.launchPriceInr ? `${formatInr(x.launchPriceInr)}${saving ? ` (−${formatInr(saving)})` : ""}` : "—", score: saving };
      }),
    },
  ];

  const cols = items.length === 3 ? "grid-cols-3" : items.length === 2 ? "grid-cols-2" : "grid-cols-1";
  const shareUrl = `${siteUrl}/compare?ids=${items.map((i) => i.code).join(",")}`;

  return (
    <div className="mx-auto max-w-5xl px-2 pb-16 pt-6 sm:px-4 sm:pt-8">
      <CompareSync codes={items.map((i) => i.code)} />
      <div className="flex flex-wrap items-center justify-between gap-3 px-2 sm:px-0">
        <h1 className="font-display text-3xl font-bold sm:text-4xl">{t.compare.title}</h1>
        <ShareButton url={shareUrl} title={t.compare.shareText} />
      </div>

      <div className="mt-6 overflow-hidden rounded-[22px] border border-line bg-surface">
        {/* Phone headers stay visible while scrolling the rows */}
        <div className={cn("sticky top-16 z-10 grid gap-2 border-b border-line bg-surface p-2 sm:gap-4 sm:p-4", cols)}>
          {items.map((item) => {
            const others = items.filter((i) => i.code !== item.code).map((i) => i.code);
            return (
              <div key={item.code} className="relative min-w-0">
                <Link href={`/phones/${item.slug}`} className="block">
                  <div className="aspect-square overflow-hidden rounded-2xl bg-surface-2">
                    <PhoneImage photo={item.photo} alt={item.name} fit="cover" sizes="33vw" className="h-full w-full" />
                  </div>
                  <p className="mt-2 line-clamp-2 font-display text-[0.92rem] font-semibold leading-snug sm:text-base">{item.name}</p>
                  <p className="text-xs text-muted sm:text-sm">{variantLabel(item.ramGb, item.storageGb)}</p>
                </Link>
                <PriceTag value={item.priceInr} className="mt-2 !text-[0.9rem] sm:!text-[1.05rem]" />
                <Link
                  href={others.length ? `/compare?ids=${others.join(",")}` : "/compare?ids="}
                  className="absolute right-1 top-1 grid h-8 w-8 place-items-center rounded-full bg-surface/90 text-muted shadow-sm hover:text-fg"
                  aria-label={`${t.compare.remove}: ${item.name}`}
                >
                  <X className="h-4 w-4" aria-hidden />
                </Link>
              </div>
            );
          })}
        </div>

        <dl>
          {rows.map((row) => {
            const best = bestIndexes(row);
            return (
              <div key={row.label} className="border-b border-line px-2 py-3 last:border-b-0 sm:px-4">
                <dt className="mb-1.5 px-1 text-xs font-medium text-muted sm:text-sm">{row.label}</dt>
                <div className={cn("grid gap-2 sm:gap-4", cols)}>
                  {row.cells.map((c, i) => (
                    <dd
                      key={i}
                      className={cn(
                        "flex min-w-0 items-start gap-1.5 rounded-xl px-2 py-1.5 text-[0.85rem] font-medium sm:text-[0.95rem]",
                        best.has(i) && "bg-ok-soft text-ok",
                      )}
                    >
                      <span className="min-w-0 break-words">{c.text}</span>
                      {best.has(i) ? (
                        <>
                          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
                          <span className="sr-only">{t.compare.best}</span>
                        </>
                      ) : null}
                    </dd>
                  ))}
                </div>
              </div>
            );
          })}
        </dl>
      </div>
      <p className="mt-3 flex items-center gap-1.5 px-2 text-sm text-muted sm:px-0">
        <span className="inline-block h-3 w-3 rounded bg-ok-soft ring-1 ring-ok/30" aria-hidden /> {t.compare.best}
      </p>
    </div>
  );
}
