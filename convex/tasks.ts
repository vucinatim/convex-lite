import { mutation } from "convex/_lib/server";
import { z } from "zod/v4";
import { taskTable } from "./_schema";
import { getAllColumnsWithTasks } from "./columns";
import { eq } from "drizzle-orm";
import { getAdminTableData } from "./tables";

export const createTask = mutation({
  args: z.object({
    title: z.string(),
    description: z.string(),
    columnId: z.string(),
  }),
  handler: async (ctx, args) => {
    const task = await ctx.db.insert(taskTable).values({
      _id: crypto.randomUUID(),
      _createdAt: Date.now(),
      _updatedAt: Date.now(),
      columnId: args.columnId,
      title: args.title,
      description: args.description,
    });
    ctx.scheduler.invalidate(getAllColumnsWithTasks);
    ctx.scheduler.invalidate(getAdminTableData);
    return task;
  },
});

export const deleteTask = mutation({
  args: z.object({
    id: z.string(),
  }),
  handler: async (ctx, args) => {
    await ctx.db.delete(taskTable).where(eq(taskTable._id, args.id));
    ctx.scheduler.invalidate(getAllColumnsWithTasks);
    ctx.scheduler.invalidate(getAdminTableData);
  },
});

export const moveTask = mutation({
  args: z.object({
    id: z.string(),
    columnId: z.string(),
  }),
  handler: async (ctx, args) => {
    await ctx.db
      .update(taskTable)
      .set({
        columnId: args.columnId,
        _updatedAt: Date.now(),
      })
      .where(eq(taskTable._id, args.id));

    ctx.scheduler.invalidate(getAllColumnsWithTasks);
    ctx.scheduler.invalidate(getAdminTableData);
  },
});

export const updateTask = mutation({
  args: z.object({
    id: z.string(),
    title: z.string(),
    description: z.string(),
  }),
  handler: async (ctx, args) => {
    await ctx.db
      .update(taskTable)
      .set({
        title: args.title,
        description: args.description,
        _updatedAt: Date.now(),
      })
      .where(eq(taskTable._id, args.id));

    ctx.scheduler.invalidate(getAllColumnsWithTasks);
    ctx.scheduler.invalidate(getAdminTableData);
  },
});
