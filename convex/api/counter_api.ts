/* eslint-disable @typescript-eslint/no-unused-vars */
import type { Knex } from "knex";
import type { AppSchema, Counter } from "../schema"; // Assuming Counter type is from the main schema
import type { HandlerContext } from "../../server/server"; // Corrected import path

// interface HandlerContext { // Removed, will use imported type
//   db: Knex;
//   appSchema: AppSchema; // Pass the whole schema for now
//   // We can add auth, storage, etc. to context later
// }

// In-memory cache for the global counter data, similar to how it was in server.ts
// This is a simplification for this example. Ideally, this state management would be more robust
// or directly rely on fetching from DB for every query if performance allows.
let globalCounterDataInMemory: Counter | null = null;

async function ensureGlobalCounterInApi(
  db: Knex,
  appSchemaObj: AppSchema
): Promise<Counter> {
  if (globalCounterDataInMemory) {
    // Optionally, re-validate with DB if stale data is a concern for a specific use-case
    // For this example, we assume the in-memory is synced by mutations
    const freshCounter = (await db("counters")
      .where({ _id: globalCounterDataInMemory._id })
      .first()) as Counter | undefined;
    if (freshCounter) {
      globalCounterDataInMemory = freshCounter;
      return globalCounterDataInMemory;
    }
    // If not found (e.g. deleted from DB manually), reset and re-create
    globalCounterDataInMemory = null;
  }

  // If not in memory or reset, try to fetch or create
  const existing = (await db("counters")
    .where({ name: "globalCounter" })
    .first()) as Counter | undefined;
  if (existing) {
    globalCounterDataInMemory = existing;
  } else {
    const newCounter = appSchemaObj.counters.parse({
      name: "globalCounter",
      value: 0,
    });
    await db("counters").insert(newCounter);
    globalCounterDataInMemory = newCounter;
  }
  if (!globalCounterDataInMemory) {
    // This case should ideally not be reached if parse and insert are successful
    throw new Error("Failed to ensure global counter in API.");
  }
  console.log(
    "Global counter ensured/retrieved in API:",
    globalCounterDataInMemory
  );
  return globalCounterDataInMemory;
}

// Query to get the current counter value
export async function getCounter(
  { db, appSchema: appSchemaObj }: HandlerContext,
  _args: Record<string, unknown> // Explicitly type as an object with unknown properties
): Promise<Counter> {
  // Uses the local ensure function which maintains an in-memory copy for quick reads
  // and falls back to DB if not present.
  return await ensureGlobalCounterInApi(db, appSchemaObj);
}

// Mutation to increment the counter
export async function incrementCounter(
  { db, appSchema: appSchemaObj, broadcastQueryUpdate }: HandlerContext,
  _args: Record<string, unknown> // Explicitly type as an object with unknown properties
): Promise<Counter> {
  const currentCounter = await ensureGlobalCounterInApi(db, appSchemaObj);

  const newValue = currentCounter.value + 1;
  const newUpdatedAt = Date.now(); // Get current timestamp for _updatedAt

  await db("counters").where({ _id: currentCounter._id }).update({
    value: newValue,
    _updatedAt: newUpdatedAt, // Explicitly set _updatedAt
  });

  // Create a new object for the updated counter to reflect the change for the return value
  // and to update the in-memory cache with a new reference if it's an object.
  const updatedCounter: Counter = {
    ...currentCounter,
    value: newValue,
    _updatedAt: newUpdatedAt, // Ensure the returned object and in-memory cache also have the new _updatedAt
  };
  globalCounterDataInMemory = updatedCounter;

  console.log("Counter incremented in API to:", updatedCounter.value);

  // Broadcast the updated counter data for the "getCounter" queryKey
  broadcastQueryUpdate("getCounter", updatedCounter);

  return updatedCounter;
}

// Function to signal which tables this API file might affect (for broadcasting)
// This is a simple convention for now.
export const affectedTablesByCounterApi = {
  incrementCounter: ["counters"],
  // getCounter doesn't modify, so no entry or empty array
};
