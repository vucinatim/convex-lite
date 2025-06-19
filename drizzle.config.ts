import type { Config } from "drizzle-kit";

export default {
  schema: "./convex/_schema.ts", // Pointing to our existing schema file, which we'll adapt
  out: "./drizzle/migrations", // Standard output directory for migrations
  dialect: "sqlite", // Specify SQLite dialect
  dbCredentials: {
    url: "./dev.sqlite3", // Path to your SQLite database file
  },
  verbose: true, // Enable verbose logging for Drizzle Kit
  strict: true, // Enable strict mode for Drizzle Kit
} satisfies Config;
