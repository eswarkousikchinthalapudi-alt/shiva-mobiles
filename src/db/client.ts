/**
 * Database connection.
 *
 * - DATABASE_URL set  → real Postgres (Neon, Supabase, your own server).
 * - DATABASE_URL empty → PGlite, an embedded Postgres stored in .data/pglite.
 *   Good for local development: no install, no account. Migrations run
 *   automatically on first use.
 *
 * This file has no "server-only" import so the scripts in /scripts can use it.
 * App code should import from "@/db" instead.
 */
import fs from "node:fs";
import path from "node:path";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import * as schema from "./schema";

export type DB = PostgresJsDatabase<typeof schema>;

type Holder = { db?: Promise<DB>; close?: () => Promise<void> };
const globalHolder = globalThis as unknown as { __shivaDb?: Holder };
const holder: Holder = (globalHolder.__shivaDb ??= {});

export const MIGRATIONS_FOLDER = path.join(process.cwd(), "drizzle");

/**
 * Applies new migrations before the app uses the database (MIGRATE_ON_START=1,
 * used by the Docker setup). A Postgres advisory lock makes sure only one
 * server process migrates at a time.
 */
async function migratePostgres(url: string) {
  const { default: postgres } = await import("postgres");
  const { drizzle } = await import("drizzle-orm/postgres-js");
  const { migrate } = await import("drizzle-orm/postgres-js/migrator");
  const client = postgres(url, { max: 1, prepare: false, connect_timeout: 15, onnotice: () => {} });
  try {
    await client`select pg_advisory_lock(727274)`;
    await migrate(drizzle({ client }), { migrationsFolder: MIGRATIONS_FOLDER });
    await client`select pg_advisory_unlock(727274)`;
  } finally {
    await client.end({ timeout: 5 });
  }
}

async function connect(): Promise<DB> {
  const url = process.env.DATABASE_URL?.trim();
  if (url) {
    const { default: postgres } = await import("postgres");
    const { drizzle } = await import("drizzle-orm/postgres-js");
    if (process.env.MIGRATE_ON_START === "1") await migratePostgres(url);
    const client = postgres(url, {
      max: Number(process.env.DATABASE_POOL_MAX ?? 5),
      // Works with poolers such as Neon's PgBouncer endpoint.
      prepare: false,
      idle_timeout: 30,
      connect_timeout: 15,
    });
    holder.close = () => client.end({ timeout: 5 });
    return drizzle({ client, schema });
  }

  if (process.env.NODE_ENV === "production" && process.env.ALLOW_PGLITE_IN_PRODUCTION !== "1") {
    throw new Error("DATABASE_URL is not set. Set it to your Postgres connection string before starting in production.");
  }

  const { PGlite } = await import("@electric-sql/pglite");
  const { drizzle } = await import("drizzle-orm/pglite");
  const { migrate } = await import("drizzle-orm/pglite/migrator");
  // Local data folder for development; not part of the deployed server bundle.
  const dataDir = path.resolve(/*turbopackIgnore: true*/ process.env.PGLITE_DIR ?? ".data/pglite");
  fs.mkdirSync(path.dirname(dataDir), { recursive: true });
  const client = new PGlite(dataDir);
  const db = drizzle({ client, schema });
  await migrate(db, { migrationsFolder: MIGRATIONS_FOLDER });
  holder.close = () => client.close();
  return db as unknown as DB;
}

export function getDb(): Promise<DB> {
  if (!holder.db) {
    holder.db = connect().catch((error) => {
      holder.db = undefined;
      throw error;
    });
  }
  return holder.db;
}

export async function closeDb() {
  await holder.close?.();
  holder.db = undefined;
  holder.close = undefined;
}

export { schema };
