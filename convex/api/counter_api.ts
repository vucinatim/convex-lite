import { eq } from "drizzle-orm";
import { countersTable } from "convex/schema";
import { mutation, query } from "convex/server";

const GLOBAL_COUNTER_ID = "the_one_and_only_counter"; // A fixed, unique ID for the singleton counter

export const createCounter = mutation({
  handler: async ({ db, broadcastQueryUpdate }) => {
    console.log("createCounter");
    try {
      const newCounter = await db.insert(countersTable).values({
        _id: GLOBAL_COUNTER_ID,
        name: "Global Counter",
        value: 0,
        _createdAt: Date.now(),
        _updatedAt: Date.now(),
      });
      console.log("newCounter", newCounter);
      broadcastQueryUpdate("counter:getCounter", newCounter);
      return newCounter;
    } catch (error) {
      console.error("Error creating counter:", error);
      throw error;
    }
  },
});

// Query to get the current counter value
export const getCounter = query({
  handler: async ({ db }) => {
    const fetchedCounter = db
      .select()
      .from(countersTable)
      .where(eq(countersTable._id, GLOBAL_COUNTER_ID))
      .get();
    if (!fetchedCounter) {
      throw new Error("Failed to retrieve the global counter.");
    }
    return fetchedCounter;
  },
});

// Mutation to increment the counter
export const incrementCounter = mutation({
  handler: async ({ db, broadcastQueryUpdate }) => {
    const fetchedCounter = db
      .select()
      .from(countersTable)
      .where(eq(countersTable._id, GLOBAL_COUNTER_ID))
      .get();
    if (!fetchedCounter) {
      throw new Error("Failed to retrieve the global counter.");
    }

    const newValue = fetchedCounter.value + 1;
    const newUpdatedAt = Date.now(); // Get current timestamp for _updatedAt

    // Use Drizzle's update syntax
    await db
      .update(countersTable)
      .set({ value: newValue, _updatedAt: newUpdatedAt })
      .where(eq(countersTable._id, fetchedCounter._id));

    // Create a new object for the updated counter to reflect the change
    const updatedCounter = {
      ...fetchedCounter,
      value: newValue,
      _updatedAt: newUpdatedAt,
    };

    broadcastQueryUpdate("counter:getCounter", updatedCounter);
    broadcastQueryUpdate("table:getAdminTableData", {
      tableNameString: "counters",
    });

    return updatedCounter;
  },
});
