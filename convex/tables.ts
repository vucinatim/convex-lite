import { query } from "convex/_lib/server";
import { tables } from "convex/_schema";
import z4 from "zod/v4";

export const getAdminTableData = query({
  args: z4.object({ tableNameString: z4.string() }),
  handler: async ({ db }, { tableNameString }) => {
    if (!tableNameString || typeof tableNameString !== "string") {
      throw new Error(
        "tableNameString parameter is required and must be a string."
      );
    }

    const tableKey = tableNameString as keyof typeof tables;
    const table = tables[tableKey];

    if (!table) {
      throw new Error(`Table "${tableNameString}" not found in schema.`);
    }

    return await db.select().from(table);
  },
});
