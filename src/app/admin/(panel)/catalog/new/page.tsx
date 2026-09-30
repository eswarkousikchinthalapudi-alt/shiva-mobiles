import { requireAdmin } from "@/lib/auth/dal";
import { aiLookupEnabled } from "@/lib/specs";
import { Card, PageHeader } from "@/components/admin/ui";
import { NewModelForm } from "@/components/admin/catalog-forms";

export const metadata = { title: "Add a model" };

export default async function NewModelPage() {
  await requireAdmin();
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="Add a model" subtitle="Type the phone's name or model number and tap Get specs. Check them, then save." />
      <Card>
        <NewModelForm aiEnabled={aiLookupEnabled()} />
      </Card>
    </div>
  );
}
