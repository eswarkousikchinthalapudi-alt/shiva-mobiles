import "server-only";
import { getDb, schema } from "@/db";
import type { AdminUser } from "@/lib/auth/dal";
import { getRequestInfo } from "@/lib/security/request";

/**
 * Writes one line to the activity log. Never put secrets, full IMEIs or
 * customer ID numbers in `details`.
 */
export async function audit(
  actor: Pick<AdminUser, "id" | "name"> | null,
  action: string,
  target?: { entity?: string; entityId?: string; details?: Record<string, unknown> },
) {
  try {
    const db = await getDb();
    const { ip } = await getRequestInfo().catch(() => ({ ip: "unknown" }));
    await db.insert(schema.auditLog).values({
      userId: actor?.id ?? null,
      userName: actor?.name ?? null,
      action,
      entity: target?.entity ?? null,
      entityId: target?.entityId ?? null,
      details: target?.details ?? null,
      ip,
    });
  } catch (error) {
    console.error("[audit] failed to write", action, error);
  }
}
