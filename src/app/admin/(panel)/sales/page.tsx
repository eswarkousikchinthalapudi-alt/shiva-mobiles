import { ChevronLeft, ChevronRight, Download, FileText, MessageCircle, Search } from "lucide-react";
import Link from "next/link";
import { requireAdmin } from "@/lib/auth/dal";
import { salesForMonth, summarize } from "@/lib/admin/sales";
import { daysUntil, isMonthString, istMonthString, monthLabel, shiftMonth } from "@/lib/dates";
import { displayMobile, formatDate, formatInr, formatStorage, whatsappLink } from "@/lib/format";
import { getShopSettings, getSiteUrl } from "@/lib/settings";
import { buttonClass } from "@/components/ui/button";
import { Card, PageHeader } from "@/components/admin/ui";

export const metadata = { title: "Sales" };

const PAYMENT: Record<string, string> = {
  cash: "Cash",
  upi: "UPI",
  card: "Card",
  other: "Other",
};

export default async function SalesPage({ searchParams }: { searchParams: Promise<{ month?: string; q?: string }> }) {
  const user = await requireAdmin();
  const params = await searchParams;
  const thisMonth = istMonthString();
  const month = isMonthString(params.month) && params.month <= thisMonth ? params.month : thisMonth;
  const q = (params.q ?? "").slice(0, 40);
  const [rows, settings, siteUrl] = await Promise.all([salesForMonth(month, q), getShopSettings(), getSiteUrl()]);
  const total = summarize(rows);
  const isOwner = user.role === "owner";
  const monthHref = (m: string) => `/admin/sales?month=${m}${q ? `&q=${encodeURIComponent(q)}` : ""}`;

  return (
    <div>
      <PageHeader
        title="Sales"
        subtitle="Every sale has a digital bill and warranty card."
        action={
          isOwner && rows.length ? (
            <a href={`/admin/sales/export?month=${month}`} className={buttonClass("secondary", "md")}>
              <Download className="h-4 w-4" aria-hidden /> Download (Excel)
            </a>
          ) : null
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Link href={monthHref(shiftMonth(month, -1))} className={buttonClass("secondary", "md", "w-11 px-0")} aria-label="Previous month">
          <ChevronLeft className="h-5 w-5" aria-hidden />
        </Link>
        <p className="min-w-40 text-center font-display text-lg font-semibold">{monthLabel(month)}</p>
        {month < thisMonth ? (
          <Link href={monthHref(shiftMonth(month, 1))} className={buttonClass("secondary", "md", "w-11 px-0")} aria-label="Next month">
            <ChevronRight className="h-5 w-5" aria-hidden />
          </Link>
        ) : null}
        <form method="get" role="search" className="ml-auto flex min-w-60 flex-1 gap-2 sm:max-w-sm">
          <input type="hidden" name="month" value={month} />
          <label htmlFor="sales-q" className="sr-only">
            Search sales
          </label>
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-faint" aria-hidden />
            <input
              id="sales-q"
              name="q"
              defaultValue={q}
              placeholder="Bill no, name or mobile"
              className="h-11 w-full rounded-[12px] border border-line-strong bg-surface pl-11 pr-3 focus:border-brand focus:outline-none"
            />
          </div>
          <button type="submit" className={buttonClass("secondary", "md")}>
            Search
          </button>
        </form>
      </div>

      <div className={`mb-4 grid gap-3 ${isOwner ? "grid-cols-2 md:grid-cols-4" : "grid-cols-2"}`}>
        <Card>
          <p className="text-sm text-muted">Phones sold</p>
          <p className="font-display text-3xl font-bold tabular">{total.count}</p>
        </Card>
        <Card>
          <p className="text-sm text-muted">Sales</p>
          <p className="font-display text-3xl font-bold tabular">{formatInr(total.revenue)}</p>
        </Card>
        {isOwner ? (
          <>
            <Card>
              <p className="text-sm text-muted">Margin</p>
              <p className="font-display text-3xl font-bold text-ok tabular">{formatInr(total.margin)}</p>
              {total.marginCount < total.count ? <p className="text-xs text-muted">{total.count - total.marginCount} without buying cost</p> : null}
            </Card>
            <Card>
              <p className="text-sm text-muted">Days to sell (average)</p>
              <p className="font-display text-3xl font-bold tabular">{total.avgDaysToSell ?? "—"}</p>
            </Card>
          </>
        ) : null}
      </div>

      {rows.length === 0 ? (
        <p className="rounded-[20px] border border-dashed border-line-strong bg-surface p-8 text-center text-muted">
          {q ? "No sales match this search." : "No sales in this month yet."}
        </p>
      ) : (
        <ul className="divide-y divide-line overflow-hidden rounded-[20px] border border-line bg-surface">
          {rows.map((r) => {
            const left = daysUntil(r.warrantyUntil);
            const billUrl = r.billPath ? `${siteUrl}${r.billPath}` : null;
            return (
              <li key={r.id} className={`flex flex-wrap items-start justify-between gap-3 p-4 ${r.cancelled ? "opacity-60" : ""}`}>
                <div className="min-w-0">
                  <p className="font-semibold">
                    <Link href={`/admin/phones/${r.listingId}`} className="hover:underline">
                      {r.phoneName} {formatStorage(r.storageGb)}
                    </Link>{" "}
                    <span className="text-sm font-normal text-muted">{r.code}</span>
                    {r.cancelled ? <span className="ml-2 rounded-full bg-bad-soft px-2 py-0.5 text-xs font-semibold text-bad">Cancelled</span> : null}
                  </p>
                  <p className="text-sm text-muted">
                    {r.billNo} · {formatDate(r.createdAt)} · {r.buyerName}, {displayMobile(r.buyerPhone)} · {PAYMENT[r.paymentMode] ?? r.paymentMode}
                  </p>
                  {r.cancelled ? null : (
                    <p className={`text-sm ${r.warrantyMonths > 0 && left >= 0 ? "text-ok" : "text-muted"}`}>
                      {r.warrantyMonths === 0
                        ? "No shop warranty"
                        : left >= 0
                          ? `Warranty till ${formatDate(r.warrantyUntil)}`
                          : `Warranty ended ${formatDate(r.warrantyUntil)}`}
                    </p>
                  )}
                </div>
                <div className="flex flex-col items-end gap-2">
                  <p className="font-display text-lg font-bold tabular">{formatInr(r.soldPriceInr)}</p>
                  {isOwner && r.costInr !== null && !r.cancelled ? (
                    <p className="text-xs text-muted tabular">margin {formatInr(r.soldPriceInr - r.costInr)}</p>
                  ) : null}
                  <div className="flex gap-2">
                    {r.billPath ? (
                      <a href={r.billPath} target="_blank" className={buttonClass("secondary", "sm")}>
                        <FileText className="h-4 w-4" aria-hidden /> Bill
                      </a>
                    ) : null}
                    {billUrl && !r.cancelled ? (
                      <a
                        href={whatsappLink(`91${r.buyerPhone}`, `Your bill and warranty card from ${settings.shopName}: ${billUrl}`)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={buttonClass("chat", "sm")}
                        aria-label={`Send bill ${r.billNo} on WhatsApp`}
                      >
                        <MessageCircle className="h-4 w-4" aria-hidden />
                      </a>
                    ) : null}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
