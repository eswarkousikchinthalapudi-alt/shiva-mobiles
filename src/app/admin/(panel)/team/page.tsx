import { asc } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { requireAdmin } from "@/lib/auth/dal";
import { timeAgo } from "@/lib/format";
import { Card, PageHeader } from "@/components/admin/ui";
import { AddMemberForm, MemberActions } from "@/components/admin/team-forms";

export const metadata = { title: "Team" };

export default async function TeamPage() {
  const me = await requireAdmin({ role: "owner" });
  const db = await getDb();
  const members = await db
    .select({
      id: schema.adminUsers.id,
      name: schema.adminUsers.name,
      username: schema.adminUsers.username,
      role: schema.adminUsers.role,
      isActive: schema.adminUsers.isActive,
      totpEnabledAt: schema.adminUsers.totpEnabledAt,
      mustChangePassword: schema.adminUsers.mustChangePassword,
      lastLoginAt: schema.adminUsers.lastLoginAt,
    })
    .from(schema.adminUsers)
    .orderBy(asc(schema.adminUsers.createdAt));

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <PageHeader title="Team" subtitle="People who can log in to this admin panel. Everyone uses 2-step login." />
      <Card>
        <AddMemberForm />
      </Card>
      <ul className="space-y-3">
        {members.map((m) => (
          <li key={m.id}>
            <Card className={m.isActive ? undefined : "opacity-70"}>
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="font-display text-lg font-semibold">
                    {m.name} {m.id === me.id ? <span className="text-sm font-normal text-muted">(you)</span> : null}
                  </p>
                  <p className="text-sm text-muted">
                    {m.username} · {m.role === "owner" ? "Owner" : "Staff"} · {m.lastLoginAt ? `last login ${timeAgo(m.lastLoginAt)}` : "never logged in"}
                  </p>
                </div>
                <div className="flex flex-wrap gap-1.5 text-xs font-semibold">
                  {!m.isActive ? <span className="rounded-full bg-surface-3 px-2.5 py-1 text-muted">Switched off</span> : null}
                  {m.isActive && !m.totpEnabledAt ? <span className="rounded-full bg-warn-soft px-2.5 py-1 text-warn">2-step login not set up yet</span> : null}
                  {m.isActive && m.mustChangePassword ? (
                    <span className="rounded-full bg-brand-soft px-2.5 py-1 text-brand-ink">Temporary password</span>
                  ) : null}
                </div>
              </div>
              {m.id !== me.id ? (
                <div className="mt-3">
                  <MemberActions member={{ id: m.id, username: m.username, role: m.role, isActive: m.isActive }} />
                </div>
              ) : null}
            </Card>
          </li>
        ))}
      </ul>
    </div>
  );
}
