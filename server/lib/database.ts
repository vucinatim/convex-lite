import { drizzle, BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import Database from "better-sqlite3";
import * as schemaModule from "../../convex/schema.ts"; // We will define Drizzle table schemas here
import type { AppSchema } from "../../convex/schema.ts";

// Initialize better-sqlite3
// The path to the SQLite database file is now managed by drizzle.config.ts for migrations,
// but we still need to point the runtime client to it.
const sqlite = new Database("./dev.sqlite3");

// Initialize Drizzle ORM
// The schema object will be populated with our Drizzle table definitions
const db: BetterSQLite3Database<AppSchema> = drizzle(sqlite, {
  schema: schemaModule.schema,
});

// Optional: Test the connection (useful during initial setup)
try {
  sqlite.pragma("quick_check");
  console.log("SQLite connected successfully via Drizzle!");
} catch (e) {
  console.error("Failed to connect to SQLite via Drizzle:", e);
  process.exit(1); // Exit if DB connection fails
}

export default db;
