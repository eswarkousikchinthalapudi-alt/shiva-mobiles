import { AlertTriangle, ArrowRight, BellRing, Inbox, Plus } from "lucide-react";
import Link from "next/link";
import { after } from "next/server";
import { requireAdmin } from "@/lib/auth/dal";
import { dashboardData } from "@/lib/admin/dashboard";
import { runCleanup } from "@/lib/cleanup";
import { adminStatusCounts, topViewedThisWeek } from "@/lib/admin/listings";
import { formatInr, timeAgo } from "@/lib/format";
import { buttonClass } from "@/components/ui/button";
import { Alert, Card } from "@/components/admin/ui";

export const metadata = { title: "Home" };

function Stat({ label, value, href, tone }: { label: string; value: React.ReactNode; href?: string; tone?: "brand" | "ok" | "warn" }) {
  const body = (
    <div className="rounded-[18px] border border-line bg-surface p-4">
      <p className="text-sm text-muted">{label}</p>
      <p className={`mt-1 font-display text-3xl font-bold tabular ${tone === "ok" ? "text-ok" : tone === "warn" ? "text-warn" : ""}`}>{value}</p>
    </div>
  );
  return href ? (
    <Link href={href} className="block rounded-[18px] hover:ring-2 hover:ring-line-strong">
      {body}
    </Link>
  ) : (
    body
  );
}

export default async function DashboardPage({ searchParams }: { searchParams: Promise<{ denied?: string; welcome?: string }> }) {
  const user = await requireAdmin();
  // Daily housekeeping (old requests, unused photos, ended logins). Cheap when already done today.
  after(() => runCleanup().catch((error) => console.error("[cleanup] failed", error)));
  const [{ denied, welcome }, counts, data, top] = await Promise.all([searchParams, adminStatusCounts(), dashboardData(), topViewedThisWeek(5)]);
  const hour = Number(new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata", hour: "numeric", hour12: false }));
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";

  return (
    <div className="space-y-5">
      {denied ? <Alert tone="warn">Only the owner can open that page.</Alert> : null}
      {welcome ? <Alert tone="ok">Your new password is saved. You are all set.</Alert> : null}
      {user.role === "owner" && data.failedCodes > 0 ? (
        <Alert tone="warn">
          {data.failedCodes} wrong 2-step {data.failedCodes === 1 ? "code was" : "codes were"} typed in the last 7 days. That means someone knew a password.{" "}
          <Link href="/admin/activity?group=logins" className="underline">
            See who
          </Link>{" "}
          and ask them to change their password.
        </Alert>
      ) : null}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-muted">{greeting},</p>
          <h1 className="font-display text-3xl font-bold">{user.name}</h1>
        </div>
        <Link href="/admin/phones/new" className={buttonClass("primary", "lg", "hidden sm:inline-flex")}>
          <Plus className="h-5 w-5" aria-hidden /> Add a phone
        </Link>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="For sale" value={counts.available} href="/admin/phones?status=available" tone="ok" />
        <Stat label="Reserved" value={counts.reserved} href="/admin/phones?status=reserved" />
        <Stat label="Sold this month" value={data.soldThisMonth.count} href="/admin/sales" />
        <Stat label="New sell requests" value={data.newRequests.length} href="/admin/requests" tone={data.newRequests.length ? "warn" : undefined} />
      </div>

      {user.role === "owner" && data.soldThisMonth.count > 0 ? (
        <Card title="This month">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-muted">Sales</p>
              <p className="font-display text-2xl font-bold tabular">{formatInr(data.soldThisMonth.revenue)}</p>
            </div>
            <div>
              <p className="text-sm text-muted">Margin (where cost was entered)</p>
              <p className="font-display text-2xl font-bold tabular text-ok">{data.soldThisMonth.cost ? formatInr(data.soldThisMonth.margin) : "—"}</p>
            </div>
          </div>
        </Card>
      ) : null}

      {data.drafts > 0 || data.imeiPending > 0 ? (
        <Card>
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-warn" aria-hidden />
            <div className="space-y-1 text-[0.95rem]">
              {data.drafts > 0 ? (
                <p>
                  <Link href="/admin/phones?status=draft" className="font-semibold underline-offset-4 hover:underline">
                    {data.drafts} draft{data.drafts === 1 ? "" : "s"}
                  </Link>{" "}
                  not published yet.
                </p>
              ) : null}
              {data.imeiPending > 0 ? (
                <p>
                  {data.imeiPending} phone{data.imeiPending === 1 ? "" : "s"} still need the IMEI check.
                </p>
              ) : null}
            </div>
          </div>
        </Card>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-2">
        <Card
          title={
            <span className="inline-flex items-center gap-2">
              <Inbox className="h-5 w-5" aria-hidden /> New sell requests
            </span>
          }
          action={
            <Link href="/admin/requests" className="text-sm font-semibold text-brand-ink hover:underline">
              All
            </Link>
          }
        >
          {data.newRequests.length === 0 ? (
            <p className="text-muted">No new requests. They appear here when someone asks you to buy their phone.</p>
          ) : (
            <ul className="divide-y divide-line">
              {data.newRequests.map((r) => (
                <li key={r.id}>
                  <Link href={`/admin/requests/${r.id}`} className="flex items-center justify-between gap-3 py-3 hover:bg-surface-2">
                    <span className="min-w-0">
                      <span className="block truncate font-semibold">
                        {r.modelText}
                        {r.storageGb ? ` ${r.storageGb} GB` : ""}
                      </span>
                      <span className="block text-sm text-muted">
                        {r.area} · {timeAgo(r.createdAt)}
                      </span>
                    </span>
                    <span className="shrink-0 text-right text-sm font-medium tabular">
                      {r.estimateMin ? `${formatInr(r.estimateMin)}–${formatInr(r.estimateMax)}` : "No estimate"}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card
          title={
            <span className="inline-flex items-center gap-2">
              <BellRing className="h-5 w-5" aria-hidden /> People waiting for a phone
            </span>
          }
          action={
            <Link href="/admin/wanted" className="text-sm font-semibold text-brand-ink hover:underline">
              All
            </Link>
          }
        >
          {data.wanted.length === 0 ? (
            <p className="text-muted">Nobody is waiting right now.</p>
          ) : (
            <ul className="divide-y divide-line">
              {data.wanted.map((w) => (
                <li key={w.id} className="py-3">
                  <p className="font-semibold">{w.wantText}</p>
                  <p className="text-sm text-muted">
                    {w.name}
                    {w.maxBudget ? ` · up to ${formatInr(w.maxBudget)}` : ""} · {timeAgo(w.createdAt)}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card title="Most viewed this week">
          {top.length === 0 ? (
            <p className="text-muted">Views appear here once people start opening your phones.</p>
          ) : (
            <ul className="divide-y divide-line">
              {top.map((t) => (
                <li key={t.id}>
                  <Link href={`/admin/phones/${t.id}`} className="flex items-center justify-between gap-3 py-3 hover:bg-surface-2">
                    <span className="min-w-0 truncate font-medium">{t.name}</span>
                    <span className="shrink-0 text-sm text-muted tabular">
                      {t.views} views · {t.clicks} WhatsApp
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card title="Not selling yet (30+ days)">
          {data.slowSellers.length === 0 ? (
            <p className="text-muted">Nothing old in stock. Good work.</p>
          ) : (
            <ul className="divide-y divide-line">
              {data.slowSellers.map((s) => (
                <li key={s.id}>
                  <Link href={`/admin/phones/${s.id}`} className="flex items-center justify-between gap-3 py-3 hover:bg-surface-2">
                    <span className="min-w-0">
                      <span className="block truncate font-medium">
                        {s.fullName} {s.storageGb} GB
                      </span>
                      <span className="block text-sm text-muted">Listed {timeAgo(s.publishedAt)}</span>
                    </span>
                    <span className="inline-flex shrink-0 items-center gap-1 text-sm font-medium">
                      {formatInr(s.priceInr)} <ArrowRight className="h-4 w-4" aria-hidden />
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
          {data.slowSellers.length ? <p className="mt-2 text-sm text-muted">Tip: a small price cut adds a “Price dropped” tag automatically.</p> : null}
        </Card>
      </div>
    </div>
  );
}
