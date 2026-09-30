import { requireAdmin } from "@/lib/auth/dal";
import { specsLookupEnabled } from "@/lib/specs-ai";
import { Card, PageHeader } from "@/components/admin/ui";
import { NewModelForm } from "@/components/admin/catalog-forms";

export const metadata = { title: "Add a model" };

export default async function NewModelPage() {
  await requireAdmin();
  const enabled = specsLookupEnabled();
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="Add a model" subtitle="Type the model name or number. We can fill in the specs from the internet for you to check." />
      <Card>
        <NewModelForm specsEnabled={enabled} />
        {!enabled ? <p className="mt-3 text-xs text-muted">Automatic specs lookup is off. Add ANTHROPIC_API_KEY on the server to switch it on.</p> : null}
      </Card>
    </div>
  );
}
