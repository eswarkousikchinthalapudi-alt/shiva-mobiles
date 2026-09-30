import Link from "next/link";
import { redirect } from "next/navigation";
import { getAdminSession } from "@/lib/auth/dal";
import { AuthShell } from "@/components/admin/auth-shell";
import { CodeForm } from "@/components/admin/auth-forms";

export const metadata = { title: "Enter code" };

export default async function VerifyPage() {
  const session = await getAdminSession();
  if (!session) redirect("/admin/login");
  if (session.stage === "full") redirect("/admin");
  if (session.stage === "setup_2fa") redirect("/admin/setup-2fa");
  return (
    <AuthShell title="Enter the code" subtitle="Open your authenticator app and type the 6-digit code for this shop.">
      <CodeForm />
      <p className="mt-5 text-center text-sm">
        <Link href="/admin/login" className="text-muted underline-offset-4 hover:underline">
          Use a different account
        </Link>
      </p>
    </AuthShell>
  );
}
