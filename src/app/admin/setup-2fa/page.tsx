import { redirect } from "next/navigation";
import { getAdminSession } from "@/lib/auth/dal";
import { getTotpSetup } from "@/lib/auth/totp-setup";
import { AuthShell } from "@/components/admin/auth-shell";
import { ConfirmTotpForm } from "@/components/admin/auth-forms";

export const metadata = { title: "Set up 2-step login" };

export default async function SetupTwoFactorPage() {
  const session = await getAdminSession();
  if (!session) redirect("/admin/login");
  if (session.stage === "full") redirect("/admin");
  if (session.stage === "mfa_pending") redirect("/admin/login/verify");
  const { qrDataUrl, secret } = await getTotpSetup(session);
  const grouped = secret.match(/.{1,4}/g)?.join(" ") ?? secret;

  return (
    <AuthShell
      title="Protect your account"
      subtitle="Every login needs your password and a code from your phone. This keeps the shop safe even if someone learns your password."
    >
      <ol className="space-y-5">
        <li>
          <p className="font-semibold">1. Install an authenticator app</p>
          <p className="mt-1 text-sm text-muted">Google Authenticator or Microsoft Authenticator, free from the Play Store or App Store.</p>
        </li>
        <li>
          <p className="font-semibold">2. Scan this code with the app</p>
          <div className="mt-3 flex justify-center rounded-2xl bg-white p-4">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={qrDataUrl} alt="QR code for the authenticator app" width={220} height={220} />
          </div>
          <details className="mt-2 text-sm">
            <summary className="cursor-pointer text-brand-ink">Can&apos;t scan? Type this key instead</summary>
            <p className="mt-2 break-all rounded-xl bg-surface-2 p-3 font-mono text-base tracking-wider">{grouped}</p>
          </details>
        </li>
        <li>
          <p className="mb-2 font-semibold">3. Type the 6-digit code the app shows</p>
          <ConfirmTotpForm />
        </li>
      </ol>
    </AuthShell>
  );
}
