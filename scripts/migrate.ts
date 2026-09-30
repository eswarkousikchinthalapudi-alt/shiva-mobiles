/**
 * Applies database migrations to the Postgres database in DATABASE_URL.
 * Run this before starting a new version in production:
 *   npm run db:migrate
 * (The local embedded database migrates itself automatically.)
 */
import path from "node:path";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";

async function main() {
  const url = process.env.DATABASE_URL?.trim();
  if (!url) {
    console.log("DATABASE_URL is not set; the local database migrates itself on start. Nothing to do.");
    return;
  }
  const client = postgres(url, { max: 1, prepare: false });
  try {
    await migrate(drizzle({ client }), { migrationsFolder: path.join(process.cwd(), "drizzle") });
    console.log("Migrations applied.");
  } finally {
    await client.end({ timeout: 5 });
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
