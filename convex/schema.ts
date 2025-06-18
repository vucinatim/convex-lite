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

export const documentsTable = sqliteTable("documents", {
  _id: text("_id").primaryKey(),
  _createdAt: integer("_createdAt").notNull(),
  _updatedAt: integer("_updatedAt").notNull(),
  title: text("title").notNull(),
  content: text("content").notNull(),
});

export const todosTable = sqliteTable("todos", {
  _id: text("_id").primaryKey(),
  _createdAt: integer("_createdAt").notNull(),
  _updatedAt: integer("_updatedAt").notNull(),
  text: text("text_content").notNull(),
  completed: integer("completed", { mode: "boolean" }).notNull(),
});

export const textEntriesTable = sqliteTable("text_entries", {
  _id: text("_id").primaryKey(),
  _createdAt: integer("_createdAt").notNull(),
  _updatedAt: integer("_updatedAt").notNull(),
  content: text("content").notNull(),
});

// --- Export Drizzle tables (Still correct) ---
export const schema = {
  counters: countersTable,
  documents: documentsTable,
  todos: todosTable,
  text_entries: textEntriesTable,
};
export type AppSchema = typeof schema;

// --- Zod Select Schema Generation (Still correct) ---
export const selectCountersSchema = createSelectSchema(countersTable);
export const selectDocumentsSchema = createSelectSchema(documentsTable);
export const selectTodosSchema = createSelectSchema(todosTable);
export const selectTextEntriesSchema = createSelectSchema(textEntriesTable);

// Construct a Zod schema for the entire app structure by composing the individual schemas.
export const zodAppSchema = z.object({
  counters: selectCountersSchema.def,
  documents: selectDocumentsSchema,
  todos: selectTodosSchema,
  text_entries: selectTextEntriesSchema,
});

/**
 * Represents the inferred TypeScript type for the entire application schema structure,
 * suitable for validating or typing data objects that match the database structure.
 * This will now work correctly.
 */
export type AppSchemaValue = z.infer<typeof zodAppSchema>;
