import { redirect } from "next/navigation";
import { getAdminSession } from "@/lib/auth/dal";
import { Alert } from "@/components/admin/ui";
import { AuthShell } from "@/components/admin/auth-shell";
import { LoginForm } from "@/components/admin/auth-forms";

export const metadata = { title: "Log in" };

const REASONS: Record<string, { tone: "ok" | "warn"; text: string }> = {
  created: { tone: "ok", text: "Owner account created. Log in to continue." },
  "too-many-codes": { tone: "warn", text: "Too many wrong codes. Please log in again." },
  "already-set-up": { tone: "warn", text: "2-step login was already set up for this account. Log in with your authenticator app." },
};

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ reason?: string }> }) {
  const session = await getAdminSession();
  if (session?.stage === "full") redirect("/admin");
  const { reason } = await searchParams;
  const note = reason ? REASONS[reason] : null;
  return (
    <AuthShell title="Log in" subtitle="For shop staff only.">
      {note ? (
        <Alert tone={note.tone} className="mb-4">
          {note.text}
        </Alert>
      ) : null}
      <LoginForm />
    </AuthShell>
  );
}
