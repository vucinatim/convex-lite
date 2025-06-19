import { query } from "convex/lib/server";
import { schema as appSchema } from "convex/schema";
import z4 from "zod/v4";

export const getAdminTableData = query({
  args: z4.object({ tableNameString: z4.string() }),
  handler: async ({ db }, { tableNameString }) => {
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

    return await db.select().from(table);
  },
});
