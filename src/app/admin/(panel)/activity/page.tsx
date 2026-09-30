import Link from "next/link";
import { desc, inArray, sql, type SQL } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { requireAdmin } from "@/lib/auth/dal";
import { formatDateTime } from "@/lib/format";
import { buttonClass } from "@/components/ui/button";
import { cn } from "@/components/ui/cn";
import { PageHeader, TabNav } from "@/components/admin/ui";

export const metadata = { title: "Activity log" };

const LABELS: Record<string, string> = {
  login: "Logged in",
  login_with_recovery_code: "Logged in with a recovery code",
  login_failed: "Wrong password",
  login_blocked: "Login blocked after too many tries",
  login_code_failed: "Wrong 2-step code",
  logout: "Logged out",
  "2fa_enabled": "Turned on 2-step login",
  "2fa_reset_by_self": "Moved 2-step login to a new phone",
  password_changed: "Changed their password",
  recovery_codes_regenerated: "Made new recovery codes",
  other_sessions_ended: "Logged out other devices",
  owner_created: "Owner account created",
  team_member_added: "Added a team member",
  team_password_reset: "Reset a team member's password",
  team_2fa_reset: "Reset a team member's 2-step login",
  team_member_disabled: "Switched off a team member",
  team_member_enabled: "Switched on a team member",
  team_role_changed: "Changed a team member's role",
  settings_changed: "Changed shop settings",
  pricing_changed: "Changed buying price rules",
  buy_prices_changed: "Changed buying prices",
  listing_created: "Added a phone (draft)",
  listing_published: "Published a phone",
  listing_updated: "Edited a phone",
  listing_status: "Changed a phone's status",
  listing_deleted: "Deleted a phone",
  listing_sold: "Sold a phone",
  sale_undone: "Undid a sale",
  sales_exported: "Downloaded the sales list",
  photo_uploaded: "Uploaded a photo",
  model_created: "Added a phone model",
  model_updated: "Edited a phone model",
  model_deleted: "Deleted a phone model",
  specs_lookup: "Looked up specs online",
  specs_lookup_failed: "Specs lookup failed",
  sell_request_updated: "Updated a sell request",
  sell_request_deleted: "Deleted a sell request",
  wanted_notified: "Told a customer about a phone",
  wanted_updated: "Updated a notify-me request",
  wanted_deleted: "Deleted a notify-me request",
  cleanup: "Automatic clean-up",
  seed: "Demo data loaded",
};

const GROUPS: Record<string, { label: string; actions: string[] | null }> = {
  all: { label: "Everything", actions: null },
  logins: {
    label: "Logins",
    actions: ["login", "login_with_recovery_code", "login_failed", "login_blocked", "login_code_failed", "logout"],
  },
  security: {
    label: "Security and team",
    actions: [
      "2fa_enabled",
      "2fa_reset_by_self",
      "password_changed",
      "recovery_codes_regenerated",
      "other_sessions_ended",
      "owner_created",
      "team_member_added",
      "team_password_reset",
      "team_2fa_reset",
      "team_member_disabled",
      "team_member_enabled",
      "team_role_changed",
      "settings_changed",
    ],
  },
  stock: {
    label: "Phones and sales",
    actions: [
      "listing_created",
      "listing_published",
      "listing_updated",
      "listing_status",
      "listing_deleted",
      "listing_sold",
      "sale_undone",
      "model_created",
      "model_updated",
    ],
  },
};

const PAGE_SIZE = 50;

/** Short, safe summary of the details column. */
function summary(details: Record<string, unknown> | null): string {
  if (!details) return "";
  const parts: string[] = [];
  for (const key of ["code", "billNo", "username", "status", "role", "price", "offer", "query", "changed", "note"]) {
    const value = details[key];
    if (value === undefined || value === null || value === "") continue;
    const text = Array.isArray(value) ? value.join(", ") : String(value);
    parts.push(key === "price" || key === "offer" ? `₹${text}` : text);
  }
  return parts.join(" · ").slice(0, 160);
}

export default async function ActivityPage({ searchParams }: { searchParams: Promise<{ page?: string; group?: string }> }) {
  await requireAdmin({ role: "owner" });
  const params = await searchParams;
  const group = params.group && params.group in GROUPS ? params.group : "all";
  const page = Math.max(1, Math.min(200, Number(params.page) || 1));
  const actions = GROUPS[group].actions;
  const where: SQL | undefined = actions ? inArray(schema.auditLog.action, actions) : undefined;
  const db = await getDb();
  const rows = await db
    .select()
    .from(schema.auditLog)
    .where(where)
    .orderBy(desc(schema.auditLog.at))
    .limit(PAGE_SIZE + 1)
    .offset((page - 1) * PAGE_SIZE);
  const hasMore = rows.length > PAGE_SIZE;
  const [failed] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(schema.auditLog)
    .where(sql`${schema.auditLog.action} in ('login_failed','login_blocked','login_code_failed') and ${schema.auditLog.at} > now() - interval '7 days'`);

  const href = (p: number) => `/admin/activity?group=${group}${p > 1 ? `&page=${p}` : ""}`;
  const warn = new Set(["login_failed", "login_blocked", "login_code_failed", "login_with_recovery_code"]);

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="Activity log" subtitle="Who did what, newest first." />
      {Number(failed?.n ?? 0) > 0 ? (
        <p className="mb-4 rounded-2xl bg-warn-soft px-4 py-3 text-[0.95rem] font-medium text-warn">
          {failed?.n} failed login {Number(failed?.n) === 1 ? "try" : "tries"} in the last 7 days.
        </p>
      ) : null}
      <TabNav
        label="Filter activity"
        tabs={Object.entries(GROUPS).map(([key, g]) => ({ href: `/admin/activity?group=${key}`, label: g.label, active: key === group }))}
      />
      <ol className="divide-y divide-line overflow-hidden rounded-[20px] border border-line bg-surface">
        {rows.slice(0, PAGE_SIZE).map((row) => (
          <li key={row.id} className="grid gap-0.5 px-4 py-3 sm:grid-cols-[9.5rem_1fr]">
            <p className="text-sm text-muted tabular">{formatDateTime(row.at)}</p>
            <div className="min-w-0">
              <p className={cn("font-medium", warn.has(row.action) && "text-warn")}>
                {row.userName ?? "Someone"} · {LABELS[row.action] ?? row.action.replaceAll("_", " ")}
              </p>
              <p className="truncate text-sm text-muted">
                {[summary(row.details), row.ip && row.ip !== "unknown" ? `IP ${row.ip}` : ""].filter(Boolean).join(" · ")}
              </p>
            </div>
          </li>
        ))}
        {rows.length === 0 ? <li className="p-8 text-center text-muted">Nothing here yet.</li> : null}
      </ol>
      <div className="mt-4 flex justify-between">
        {page > 1 ? (
          <Link href={href(page - 1)} className={buttonClass("secondary", "md")}>
            Newer
          </Link>
        ) : (
          <span />
        )}
        {hasMore ? (
          <Link href={href(page + 1)} className={buttonClass("secondary", "md")}>
            Older
          </Link>
        ) : null}
      </div>
    </div>
  );
}
