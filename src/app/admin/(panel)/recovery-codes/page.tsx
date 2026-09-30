import Link from "next/link";
import { requireAdmin, getAdminSession } from "@/lib/auth/dal";
import { takeFlash } from "@/lib/auth/totp-setup";
import { buttonClass } from "@/components/ui/button";
import { Alert, Card, PageHeader } from "@/components/admin/ui";
import { PrintButton } from "@/components/admin/print-button";

export const metadata = { title: "Recovery codes" };

export default async function RecoveryCodesPage() {
  await requireAdmin({ allowPasswordChange: true });
  const session = await getAdminSession();
  const raw = session ? await takeFlash(session.id, session.flashEnc) : null;
  let codes: string[] = [];
  try {
    codes = raw ? ((JSON.parse(raw) as { recoveryCodes?: string[] }).recoveryCodes ?? []) : [];
  } catch {
    codes = [];
  }

  return (
    <div className="mx-auto max-w-xl">
      <PageHeader title="Save your recovery codes" />
      {codes.length ? (
        <Card>
          <p className="text-[0.95rem]">
            If you lose your phone, each of these codes lets you log in <strong>once</strong>. Write them on paper or print this page, and keep it somewhere
            safe. They are shown only now.
          </p>
          <ul className="mt-4 grid grid-cols-2 gap-2 rounded-2xl bg-surface-2 p-4 font-mono text-lg tracking-wider">
            {codes.map((code) => (
              <li key={code}>{code}</li>
            ))}
          </ul>
          <div className="no-print mt-5 flex flex-wrap gap-3">
            <PrintButton />
            <Link href="/admin" className={buttonClass("primary", "lg")}>
              I have saved them
            </Link>
          </div>
        </Card>
      ) : (
        <Alert tone="info">
          Recovery codes are shown only once. You can make a new set any time in{" "}
          <Link href="/admin/security" className="underline">
            My login and security
          </Link>
          .
        </Alert>
      )}
    </div>
  );
}
