import { desc, eq } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { requireAdmin, getAdminSession } from "@/lib/auth/dal";
import { unusedRecoveryCodeCount, RECOVERY_CODE_COUNT } from "@/lib/auth/recovery";
import { describeDevice } from "@/lib/admin/devices";
import { formatDate, timeAgo } from "@/lib/format";
import { Alert, Card, PageHeader } from "@/components/admin/ui";
import { SubmitButton } from "@/components/admin/submit-button";
import { ChangePasswordForm, NewRecoveryCodesButton, ResetAuthenticatorButton } from "@/components/admin/security-forms";
import { logoutOtherDevicesAction } from "./actions";

export const metadata = { title: "My login and security" };

export default async function SecurityPage({ searchParams }: { searchParams: Promise<{ must?: string; recovery?: string; changed?: string }> }) {
  const user = await requireAdmin({ allowPasswordChange: true });
  const [params, session] = await Promise.all([searchParams, getAdminSession()]);
  const db = await getDb();
  const [[account], sessions, codesLeft] = await Promise.all([
    db
      .select({ totpEnabledAt: schema.adminUsers.totpEnabledAt, passwordChangedAt: schema.adminUsers.passwordChangedAt })
      .from(schema.adminUsers)
      .where(eq(schema.adminUsers.id, user.id))
      .limit(1),
    db.select().from(schema.adminSessions).where(eq(schema.adminSessions.userId, user.id)).orderBy(desc(schema.adminSessions.lastSeenAt)),
    unusedRecoveryCodeCount(user.id),
  ]);
  const active = sessions.filter((s) => s.stage === "full" && s.expiresAt > new Date());
  const others = active.filter((s) => s.id !== session?.id);

  if (user.mustChangePassword) {
    return (
      <div className="mx-auto max-w-xl space-y-4">
        <PageHeader title="Set your own password" />
        <Alert tone="info">You logged in with a temporary password. Please choose your own password to continue.</Alert>
        <Card>
          <ChangePasswordForm username={user.username} />
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <PageHeader title="My login and security" subtitle={`Logged in as ${user.username}`} />
      {params.changed ? <Alert tone="ok">Password changed. All your other devices were logged out.</Alert> : null}
      {params.recovery ? (
        <Alert tone="warn">
          You logged in with a recovery code. {codesLeft} {codesLeft === 1 ? "code is" : "codes are"} left. If you lost your phone, use “Set up on a new phone”
          below.
        </Alert>
      ) : null}

      <Card title="Password">
        <p className="mb-4 text-sm text-muted">Last changed {formatDate(account?.passwordChangedAt)}.</p>
        <ChangePasswordForm username={user.username} />
      </Card>

      <Card title="2-step login">
        <p className="text-[0.95rem]">
          On since {formatDate(account?.totpEnabledAt)}. Each login needs your password and the 6-digit code from the authenticator app.
        </p>
        <p className={`mt-2 text-[0.95rem] font-medium ${codesLeft <= 2 ? "text-warn" : ""}`}>
          Recovery codes left: {codesLeft} of {RECOVERY_CODE_COUNT}
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <NewRecoveryCodesButton />
          <ResetAuthenticatorButton />
        </div>
      </Card>

      <Card title="Where you are logged in">
        <ul className="divide-y divide-line">
          {active.map((s) => (
            <li key={s.id} className="flex flex-wrap items-baseline justify-between gap-2 py-3">
              <div>
                <p className="font-semibold">
                  {describeDevice(s.userAgent)}
                  {s.id === session?.id ? <span className="ml-2 rounded-full bg-ok-soft px-2 py-0.5 text-xs font-semibold text-ok">This device</span> : null}
                </p>
                <p className="text-sm text-muted">
                  IP {s.ip ?? "unknown"} · logged in {timeAgo(s.createdAt)}
                </p>
              </div>
              <p className="text-sm text-muted">Active {timeAgo(s.lastSeenAt)}</p>
            </li>
          ))}
        </ul>
        {others.length ? (
          <form action={logoutOtherDevicesAction} className="mt-3">
            <SubmitButton variant="secondary" size="md" pendingText="Logging out…">
              Log out {others.length === 1 ? "the other device" : `the other ${others.length} devices`}
            </SubmitButton>
          </form>
        ) : null}
        <p className="mt-3 text-sm text-muted">If you see a device you don’t know, log it out and change your password.</p>
      </Card>
    </div>
  );
}
