import type { HandlerContext } from "../../server/server.ts"; // Adjust path as needed
import { schema as appSchema } from "../schema.ts";

interface GetAdminTableDataArgs {
  tableNameString: string;
}

/**
 * Fetches all data for a given table.
 * The client is expected to subscribe to this query with a specific tableNameString.
 * e.g., useConvexLite("get_admin_table_data", { tableNameString: "counters" })
 */
export async function get_admin_table_data(
  { db }: HandlerContext,
  { tableNameString }: GetAdminTableDataArgs
): Promise<Record<string, unknown>[]> {
  if (!tableNameString || typeof tableNameString !== "string") {
    throw new Error(
      "tableNameString parameter is required and must be a string."
    );
  }

  const tableKey = tableNameString as keyof typeof appSchema;
  const table = appSchema[tableKey];

  if (!table) {
    throw new Error(`Table "${tableNameString}" not found in schema.`);
  }

  // At this point, 'table' is a valid Drizzle table object from our schema.
  // The db.select().from(table) call will work if 'table' is a valid schema table.

  return (await db.select().from(table)) as Record<string, unknown>[];
}

// Admin APIs might not have affectedTables if they are read-only or handle updates differently.
// For now, this file only contains a query.
