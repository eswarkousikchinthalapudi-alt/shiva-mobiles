import "server-only";
import { sql } from "drizzle-orm";
import { getDb } from "@/db";
import { rowsOf } from "@/db/helpers";
import { audit } from "@/lib/audit";
import { IDLE_LIMIT_SECONDS } from "@/lib/auth/session";
import { pruneRateLimits } from "@/lib/security/rate-limit";
import { getShopSettings } from "@/lib/settings";

/** "Notify me" entries are removed this many days after they were made (the form says so). */
export const WANTED_KEEP_DAYS = 90;
const AUDIT_KEEP_DAYS = 730;
const LOGIN_ATTEMPT_KEEP_DAYS = 90;
/** Uploaded photos that never got attached to a phone or request. */
const ORPHAN_MEDIA_HOURS = 48;

export type CleanupReport = {
  sellRequests: number;
  wanted: number;
  media: number;
  sessions: number;
  auditRows: number;
};

function countOf(result: unknown): number {
  const rows = rowsOf<unknown>(result);
  if (rows.length) return rows.length;
  const affected = (result as { affectedRows?: number; count?: number })?.affectedRows ?? (result as { count?: number })?.count;
  return Number(affected ?? 0);
}

/**
 * Deletes data the shop no longer needs: old sell requests and their photos,
 * old notify-me entries, unused photos, ended logins and old activity rows.
 * Runs at most once a day unless forced.
 */
export async function runCleanup(options: { force?: boolean } = {}): Promise<CleanupReport | null> {
  const db = await getDb();
  const today = Math.floor(Date.now() / 86400000);

  if (!options.force) {
    // Claim today's run; if another request already did, stop.
    const claimed = await db.execute(sql`
      INSERT INTO counters (name, value) VALUES ('cleanup-day', ${today})
      ON CONFLICT (name) DO UPDATE SET value = EXCLUDED.value WHERE counters.value < EXCLUDED.value
      RETURNING value
    `);
    if (rowsOf(claimed).length === 0) return null;
  }

  const settings = await getShopSettings();
  const retentionDays = Math.max(30, settings.retentionDays || 365);

  // Sell requests: photos first (they live in the media table), then the requests.
  const oldRequestPhotos = await db.execute(sql`
    DELETE FROM media WHERE id IN (
      SELECT p.media_id FROM sell_request_photos p
      JOIN sell_requests r ON r.id = p.request_id
      WHERE r.updated_at < now() - make_interval(days => ${retentionDays})
    ) RETURNING id
  `);
  const sellRequests = countOf(
    await db.execute(sql`DELETE FROM sell_requests WHERE updated_at < now() - make_interval(days => ${retentionDays}) RETURNING id`),
  );
  const wanted = countOf(await db.execute(sql`DELETE FROM wanted_requests WHERE created_at < now() - make_interval(days => ${WANTED_KEEP_DAYS}) RETURNING id`));
  const orphans = await db.execute(sql`
    DELETE FROM media m
    WHERE m.created_at < now() - make_interval(hours => ${ORPHAN_MEDIA_HOURS})
      AND NOT EXISTS (SELECT 1 FROM listing_photos lp WHERE m.id IN (lp.sm_id, lp.md_id, lp.lg_id))
      AND NOT EXISTS (SELECT 1 FROM sell_request_photos sp WHERE sp.media_id = m.id)
    RETURNING m.id
  `);
  const sessions = countOf(
    await db.execute(sql`
      DELETE FROM admin_sessions
      WHERE expires_at < now() OR (stage = 'full' AND last_seen_at < now() - make_interval(secs => ${IDLE_LIMIT_SECONDS}))
      RETURNING id
    `),
  );
  const auditRows =
    countOf(await db.execute(sql`DELETE FROM audit_log WHERE at < now() - make_interval(days => ${AUDIT_KEEP_DAYS}) RETURNING id`)) +
    // Failed logins by strangers (with their IP) are only kept for a short time.
    countOf(
      await db.execute(sql`
        DELETE FROM audit_log
        WHERE user_id IS NULL AND action IN ('login_failed', 'login_blocked')
          AND at < now() - make_interval(days => ${LOGIN_ATTEMPT_KEEP_DAYS})
        RETURNING id
      `),
    );
  await pruneRateLimits();

  const report: CleanupReport = {
    sellRequests,
    wanted,
    media: countOf(oldRequestPhotos) + countOf(orphans),
    sessions,
    auditRows,
  };
  if (report.sellRequests || report.wanted || report.media || report.auditRows) {
    const note = [
      report.sellRequests && `${report.sellRequests} old sell requests`,
      report.wanted && `${report.wanted} old notify-me entries`,
      report.media && `${report.media} unused photos`,
      report.auditRows && `${report.auditRows} old log rows`,
    ]
      .filter(Boolean)
      .join(", ");
    await audit(null, "cleanup", { details: { ...report, note: `Removed ${note}` } });
  }
  return report;
}
