import { notFound } from "next/navigation";
import { getDb, schema } from "@/db";
import { Alert } from "@/components/admin/ui";
import { AuthShell } from "@/components/admin/auth-shell";
import { SetupOwnerForm } from "@/components/admin/auth-forms";

export const metadata = { title: "First setup" };

/** Creates the first owner account. Disappears once any account exists. */
export default async function SetupPage() {
  const db = await getDb();
  const existing = await db.select({ id: schema.adminUsers.id }).from(schema.adminUsers).limit(1);
  if (existing.length > 0) notFound();
  const enabled = (process.env.SETUP_TOKEN?.trim().length ?? 0) >= 16;
  return (
    <AuthShell title="Create the owner account" subtitle="This page works only once, before any account exists.">
      {enabled ? (
        <SetupOwnerForm />
      ) : (
        <Alert tone="warn">
          Setup is switched off. Add a SETUP_TOKEN (at least 16 random characters) to the server settings, restart, then open this page again.
        </Alert>
      )}
    </AuthShell>
  );
}
