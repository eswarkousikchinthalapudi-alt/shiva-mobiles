import "server-only";
import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { cache } from "react";
import { getDb, schema } from "@/db";
import type { AdminRole, SessionStage } from "@/db/schema";
import { IDLE_LIMIT_SECONDS, currentSessionId, sessionById } from "./session";

export type AdminUser = {
  id: string;
  username: string;
  name: string;
  role: AdminRole;
  totpEnabled: boolean;
  mustChangePassword: boolean;
};

type AccessOptions = {
  role?: AdminRole;
  /** Only for the password-change page and its action. */
  allowPasswordChange?: boolean;
};

export type AdminSession = {
  id: string;
  stage: SessionStage;
  pendingTotpEnc: string | null;
  flashEnc: string | null;
  failedAttempts: number;
  user: AdminUser & { totpSecretEnc: string | null; totpLastStep: number | null };
};

/**
 * Data access layer for admin auth. Every admin page and server action must
 * go through requireAdmin(); the proxy's cookie check is only a fast path.
 */
export const getAdminSession = cache(async (): Promise<AdminSession | null> => {
  const id = await currentSessionId();
  if (!id) return null;
  const row = await sessionById(id);
  if (!row) return null;
  const { session, user } = row;
  const now = Date.now();
  const db = await getDb();

  const idleTooLong = session.stage === "full" && now - session.lastSeenAt.getTime() > IDLE_LIMIT_SECONDS * 1000;
  if (session.expiresAt.getTime() <= now || !user.isActive || idleTooLong) {
    await db.delete(schema.adminSessions).where(eq(schema.adminSessions.id, id));
    return null;
  }
  // Sessions made before a password change are no longer valid.
  if (session.createdAt.getTime() < user.passwordChangedAt.getTime() - 1000) {
    await db.delete(schema.adminSessions).where(eq(schema.adminSessions.id, id));
    return null;
  }
  if (session.stage === "full" && now - session.lastSeenAt.getTime() > 10 * 60 * 1000) {
    await db.update(schema.adminSessions).set({ lastSeenAt: new Date() }).where(eq(schema.adminSessions.id, id));
  }

  return {
    id,
    stage: session.stage,
    pendingTotpEnc: session.pendingTotpEnc,
    flashEnc: session.flashEnc,
    failedAttempts: session.failedAttempts,
    user: {
      id: user.id,
      username: user.username,
      name: user.name,
      role: user.role,
      totpEnabled: Boolean(user.totpEnabledAt && user.totpSecretEnc),
      mustChangePassword: user.mustChangePassword,
      totpSecretEnc: user.totpSecretEnc,
      totpLastStep: user.totpLastStep,
    },
  };
});

function publicUser(session: AdminSession): AdminUser {
  const { id, username, name, role, totpEnabled, mustChangePassword } = session.user;
  return { id, username, name, role, totpEnabled, mustChangePassword };
}

/** Returns the signed-in admin or sends the visitor to the right login step. */
export async function requireAdmin(options?: AccessOptions): Promise<AdminUser> {
  const session = await getAdminSession();
  if (!session) redirect("/admin/login");
  if (session.stage === "mfa_pending") redirect("/admin/login/verify");
  if (session.stage === "setup_2fa") redirect("/admin/setup-2fa");
  if (session.user.mustChangePassword && !options?.allowPasswordChange) redirect("/admin/security?must=1");
  if (options?.role === "owner" && session.user.role !== "owner") redirect("/admin?denied=1");
  return publicUser(session);
}

/** For server actions that return errors instead of redirecting. */
export async function getAdminOrNull(options?: AccessOptions): Promise<AdminUser | null> {
  const session = await getAdminSession();
  if (!session || session.stage !== "full") return null;
  if (session.user.mustChangePassword && !options?.allowPasswordChange) return null;
  if (options?.role === "owner" && session.user.role !== "owner") return null;
  return publicUser(session);
}
