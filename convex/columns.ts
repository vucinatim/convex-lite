import { mutation, query } from "convex/_lib/server";
import { z } from "zod/v4";
import { columnsTable } from "./_schema";
import { eq } from "drizzle-orm";
import { getAdminTableData } from "./tables";

export const createColumn = mutation({
  args: z.object({
    name: z.string(),
  }),
  handler: async (ctx, args) => {
    const column = await ctx.db.insert(columnsTable).values({
      _id: crypto.randomUUID(),
      _createdAt: Date.now(),
      _updatedAt: Date.now(),
      name: args.name,
    });
    ctx.scheduler.invalidate(getAllColumnsWithTasks);
    ctx.scheduler.invalidate(getAdminTableData);
    return column;
  },
});

export const deleteColumn = mutation({
  args: z.object({
    id: z.string(),
  }),
  handler: async (ctx, args) => {
    await ctx.db.delete(columnsTable).where(eq(columnsTable._id, args.id));
    ctx.scheduler.invalidate(getAllColumnsWithTasks);
    ctx.scheduler.invalidate(getAdminTableData);
  },
});

export const getAllColumnsWithTasks = query({
  handler: async (ctx) => {
    // This is the new, more idiomatic way to fetch related data in Drizzle.
    // It automatically performs the join and nests the tasks under each column.
    const columnsWithTasks = await ctx.db.query.columns.findMany({
      with: {
        // "with" tells Drizzle to include the related tasks for each column.
        // The name "tasks" comes from the `columnRelations` you defined in the schema.
        tasks: true,
      },
    });

    return columnsWithTasks;
  },
});
