import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";
import { createSelectSchema } from "drizzle-zod";
import { z } from "zod/v4";

// --- Drizzle Table Definitions (Your code here is perfect) ---

export const countersTable = sqliteTable("counters", {
  _id: text("_id").primaryKey(),
  _createdAt: integer("_createdAt").notNull(),
  _updatedAt: integer("_updatedAt").notNull(),
  name: text("name").notNull(),
  value: integer("value").notNull(),
});

export const textEntriesTable = sqliteTable("text_entries", {
  _id: text("_id").primaryKey(),
  _createdAt: integer("_createdAt").notNull(),
  _updatedAt: integer("_updatedAt").notNull(),
  content: text("content").notNull(),
});

export const ticketsTable = sqliteTable("tickets", {
  _id: text("_id").primaryKey(),
  _createdAt: integer("_createdAt").notNull(),
  _updatedAt: integer("_updatedAt").notNull(),
  title: text("title").notNull(),
  description: text("description").notNull(),
});

// --- Export Drizzle tables (Still correct) ---
export const schema = {
  counters: countersTable,
  text_entries: textEntriesTable,
  tickets: ticketsTable,
};
export type AppSchema = typeof schema;

// --- Zod Select Schema Generation (Still correct) ---
export const selectCountersSchema = createSelectSchema(countersTable);
export const selectTextEntriesSchema = createSelectSchema(textEntriesTable);
export const selectTicketsSchema = createSelectSchema(ticketsTable);

// Construct a Zod schema for the entire app structure by composing the individual schemas.
export const zodAppSchema = z.object({
  counters: selectCountersSchema.def,
  text_entries: selectTextEntriesSchema,
  tickets: selectTicketsSchema,
});

/**
 * Represents the inferred TypeScript type for the entire application schema structure,
 * suitable for validating or typing data objects that match the database structure.
 * This will now work correctly.
 */
export type AppSchemaValue = z.infer<typeof zodAppSchema>;
