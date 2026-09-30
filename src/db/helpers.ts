import "server-only";
import { sql } from "drizzle-orm";
import { getDb } from "@/db";
import { schema } from "@/db";

/** Normalises db.execute() results across Postgres drivers. */
export function rowsOf<T>(result: unknown): T[] {
  if (Array.isArray(result)) return result as T[];
  const maybe = result as { rows?: T[] };
  return maybe?.rows ?? [];
}

/** Atomically increments a named counter and returns the new value. */
export async function nextCounter(name: string): Promise<number> {
  const db = await getDb();
  const result = await db
    .insert(schema.counters)
    .values({ name, value: 1 })
    .onConflictDoUpdate({ target: schema.counters.name, set: { value: sql`${schema.counters.value} + 1` } })
    .returning({ value: schema.counters.value });
  return result[0].value;
}

export function pad(value: number, width = 4) {
  return String(value).padStart(width, "0");
}
