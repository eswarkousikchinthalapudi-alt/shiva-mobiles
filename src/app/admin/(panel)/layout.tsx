import { count, eq } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { requireAdmin } from "@/lib/auth/dal";
import { AdminShell } from "@/components/admin/admin-shell";

export default async function PanelLayout({ children }: { children: React.ReactNode }) {
  // Pages check access themselves; the layout must also render the password page.
  const user = await requireAdmin({ allowPasswordChange: true });
  const db = await getDb();
  const [[requests], [wanted]] = await Promise.all([
    db.select({ n: count() }).from(schema.sellRequests).where(eq(schema.sellRequests.status, "new")),
    db.select({ n: count() }).from(schema.wantedRequests).where(eq(schema.wantedRequests.status, "open")),
  ]);
  return (
    <AdminShell user={{ name: user.name, role: user.role }} counts={{ requests: Number(requests?.n ?? 0), wanted: Number(wanted?.n ?? 0) }}>
      {children}
    </AdminShell>
  );
}
