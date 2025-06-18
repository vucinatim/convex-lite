/* eslint-disable @typescript-eslint/no-unused-vars */
import { eq } from "drizzle-orm";
import { countersTable } from "../schema.ts";
import type { HandlerContext } from "../../server/server";

// Define the Counter type based on Drizzle's select schema for countersTable
type Counter = typeof countersTable.$inferSelect;

// In-memory cache for the global counter.
// Mutations will update this to maintain consistency if used.
let globalCounterDataInMemory: Counter | null = null;
const GLOBAL_COUNTER_ID = "the_one_and_only_counter"; // A fixed, unique ID for the singleton counter

/**
 * Ensures the global counter document exists in the database and returns it.
 * Manages an in-memory cache for the counter.
 */
async function ensureGlobalCounter(db: HandlerContext["db"]): Promise<Counter> {
  // Option 1: Always fetch from DB for maximum consistency (cache updated after fetch/create)
  let counter = await db
    .select()
    .from(countersTable)
    .where(eq(countersTable._id, GLOBAL_COUNTER_ID))
    .get();

  // Option 2: Use in-memory cache if available (uncomment if this behavior is preferred)
  // if (globalCounterDataInMemory && !counter) { // Or some logic to refresh cache
  //   counter = globalCounterDataInMemory;
  // } else if (counter) {
  //   globalCounterDataInMemory = counter; // Update cache if fetched
  // }

  if (!counter) {
    const now = Date.now();
    // Define the data for the new counter record using Drizzle's insert type
    const newCounterData: typeof countersTable.$inferInsert = {
      _id: GLOBAL_COUNTER_ID,
      name: "Global Counter", // Provide the non-null name
      value: 0,
      _createdAt: now,
      _updatedAt: now,
    };
    await db.insert(countersTable).values(newCounterData);

    // Re-fetch the counter after insertion to ensure we have the definitive state from the DB
    const fetchedCounter = await db
      .select()
      .from(countersTable)
      .where(eq(countersTable._id, GLOBAL_COUNTER_ID))
      .get();
    if (!fetchedCounter) {
      throw new Error(
        "Failed to create or retrieve the global counter after attempting insert."
      );
    }
    counter = fetchedCounter;
  }

  globalCounterDataInMemory = counter; // Update/set the in-memory cache
  return counter;
}

// Query to get the current counter value
export async function getCounter(
  { db }: HandlerContext, // Removed appSchema: appSchemaObj as it's not directly used
  _args: Record<string, unknown>
): Promise<Counter> {
  return await ensureGlobalCounter(db);
}

// Mutation to increment the counter
export async function incrementCounter(
  { db, broadcastQueryUpdate }: HandlerContext, // Removed appSchema: appSchemaObj
  _args: Record<string, unknown>
): Promise<Counter> {
  const currentCounter = await ensureGlobalCounter(db);

  const newValue = currentCounter.value + 1;
  const newUpdatedAt = Date.now(); // Get current timestamp for _updatedAt

  // Use Drizzle's update syntax
  await db
    .update(countersTable)
    .set({ value: newValue, _updatedAt: newUpdatedAt })
    .where(eq(countersTable._id, currentCounter._id));

  console.log("Counter incremented in API to:", newValue);

  // Create a new object for the updated counter to reflect the change
  const updatedCounter: Counter = {
    ...currentCounter,
    value: newValue,
    _updatedAt: newUpdatedAt,
  };

  globalCounterDataInMemory = updatedCounter; // Update in-memory cache

  console.log("Counter incremented in API to:", updatedCounter.value);

  broadcastQueryUpdate("getCounter", updatedCounter);

  return updatedCounter;
}

// Function to signal which tables this API file might affect (for broadcasting)
// This convention remains the same.
export const affectedTablesByCounterApi = {
  incrementCounter: ["counters"],
  // getCounter doesn't modify, so no entry or empty array
};
