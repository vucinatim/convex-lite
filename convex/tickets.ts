import { mutation, query } from "convex/lib/server";
import { z } from "zod/v4";
import { ticketsTable } from "./schema";

export const createTicket = mutation({
  args: z.object({
    title: z.string(),
    description: z.string(),
  }),
  handler: async (ctx, args) => {
    const ticket = await ctx.db.insert(ticketsTable).values({
      _id: crypto.randomUUID(),
      _createdAt: Date.now(),
      _updatedAt: Date.now(),
      title: args.title,
      description: args.description,
    });
    return ticket;
  },
});

export const getAllTickets = query({
  handler: async (ctx) => {
    const tickets = await ctx.db.select().from(ticketsTable);
    return tickets;
  },
});
