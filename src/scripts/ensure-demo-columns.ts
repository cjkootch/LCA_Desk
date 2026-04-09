/**
 * Ensures isDemo columns exist on users and tenants tables.
 * Safe to run multiple times — uses IF NOT EXISTS.
 * Called from the build script as a fallback if drizzle-kit push fails.
 */
import { sql } from "drizzle-orm";
import { getDb } from "@/server/db";

async function main() {
  const db = getDb();
  try {
    await db.execute(sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS is_demo BOOLEAN DEFAULT FALSE`);
    await db.execute(sql`ALTER TABLE tenants ADD COLUMN IF NOT EXISTS is_demo BOOLEAN DEFAULT FALSE`);
    console.log("✓ isDemo columns ensured on users and tenants");
  } catch (err) {
    console.error("Failed to ensure isDemo columns:", err);
  }
}

main();
