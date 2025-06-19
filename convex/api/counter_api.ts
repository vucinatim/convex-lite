import { eq } from "drizzle-orm";
import { countersTable } from "convex/schema";
import { mutation, query } from "convex/server";
import { getAdminTableData } from "./table_api";

const GLOBAL_COUNTER_ID = "the_one_and_only_counter";

export const createCounter = mutation({
  // The context now provides `scheduler` for invalidation.
  handler: async ({ db, scheduler }) => {
    try {
      const newCounter = await db.insert(countersTable).values({
        _id: GLOBAL_COUNTER_ID,
        name: "Global Counter",
        value: 0,
        _createdAt: Date.now(),
        _updatedAt: Date.now(),
      });

      // Invalidate the `getCounter` query so all clients refetch.
      await scheduler.invalidate(getCounter);

      return newCounter;
    } catch (error) {
      console.error("Error creating counter:", error);
      throw error;
    }
  },
});

export const getCounter = query({
  handler: async ({ db }) => {
    try {
      const fetchedCounter = db
        .select()
        .from(countersTable)
        .where(eq(countersTable._id, GLOBAL_COUNTER_ID))
        .get();

      return fetchedCounter;
    } catch (error) {
      console.error("Error getting counter:", error);
      throw error;
    }
  },
});

export const incrementCounter = mutation({
  handler: async ({ db, scheduler }) => {
    try {
      const fetchedCounter = db
        .select()
        .from(countersTable)
        .where(eq(countersTable._id, GLOBAL_COUNTER_ID))
        .get();

      if (!fetchedCounter) {
        throw new Error("Failed to retrieve the global counter.");
      }

      const updatedCounter = await db
        .update(countersTable)
        .set({ value: fetchedCounter.value + 500, _updatedAt: Date.now() })
        .where(eq(countersTable._id, fetchedCounter._id));

      // Invalidate the queries to get the counter and admin table data.
      await scheduler.invalidate(getCounter);
      await scheduler.invalidate(getAdminTableData);

      return updatedCounter;
    } catch (error) {
      console.error("Error incrementing counter:", error);
      throw error;
    }
  },
});
