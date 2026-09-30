import "server-only";
import { sql } from "drizzle-orm";
import { getDb } from "@/db";
import { rowsOf } from "@/db/helpers";
import { keyedHash } from "./crypto";

export type RateLimitResult = { allowed: boolean; remaining: number; retryAfterSeconds: number };

/**
 * Fixed-window rate limit stored in Postgres, so it works across restarts
 * and multiple server instances. Keys are hashed before storage because
 * they can contain IP addresses.
 */
export async function rateLimit(rawKey: string, limit: number, windowSeconds: number): Promise<RateLimitResult> {
  const db = await getDb();
  const key = await keyedHash(rawKey, "rate-limit");
  const result = await db.execute(sql`
    INSERT INTO rate_limits (key, window_start, count)
    VALUES (${key}, now(), 1)
    ON CONFLICT (key) DO UPDATE SET
      count = CASE WHEN rate_limits.window_start < now() - make_interval(secs => ${windowSeconds})
                   THEN 1 ELSE rate_limits.count + 1 END,
      window_start = CASE WHEN rate_limits.window_start < now() - make_interval(secs => ${windowSeconds})
                   THEN now() ELSE rate_limits.window_start END
    RETURNING count, EXTRACT(EPOCH FROM (window_start + make_interval(secs => ${windowSeconds}) - now()))::int AS reset_in
  `);
  const row = rowsOf<{ count: number; reset_in: number }>(result)[0];
  const count = Number(row?.count ?? 1);
  return {
    allowed: count <= limit,
    remaining: Math.max(0, limit - count),
    retryAfterSeconds: Math.max(1, Number(row?.reset_in ?? windowSeconds)),
  };
}

/** Clears a limit, e.g. after a successful login. */
export async function resetRateLimit(rawKey: string) {
  const db = await getDb();
  const key = await keyedHash(rawKey, "rate-limit");
  await db.execute(sql`DELETE FROM rate_limits WHERE key = ${key}`);
}

export async function pruneRateLimits() {
  const db = await getDb();
  await db.execute(sql`DELETE FROM rate_limits WHERE window_start < now() - interval '2 days'`);
}
