import { relations } from "drizzle-orm";
import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";
import { createSelectSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const columnsTable = sqliteTable("columns", {
  _id: text("_id").primaryKey(),
  _createdAt: integer("_createdAt").notNull(),
  _updatedAt: integer("_updatedAt").notNull(),
  name: text("name").notNull(),
});

export const taskTable = sqliteTable("tasks", {
  _id: text("_id").primaryKey(),
  _createdAt: integer("_createdAt").notNull(),
  _updatedAt: integer("_updatedAt").notNull(),
  columnId: text("columnId").notNull(),
  title: text("title").notNull(),
  description: text("description").notNull(),
});

// THE NEW PART: Define the relationship
export const columnRelations = relations(columnsTable, ({ many }) => ({
  // A column has `many` tasks. The `tasks` property will be populated.
  tasks: many(taskTable),
}));

export const taskRelations = relations(taskTable, ({ one }) => ({
  // A task belongs to `one` column. This defines the foreign key link.
  column: one(columnsTable, {
    fields: [taskTable.columnId],
    references: [columnsTable._id],
  }),
}));

export const tables = {
  columns: columnsTable,
  tasks: taskTable,
};

// --- Export Drizzle tables (Still correct) ---
export const schema = {
  columns: columnsTable,
  tasks: taskTable,
  columnRelations,
  taskRelations,
};
export type AppSchema = typeof schema;

// --- Zod Select Schema Generation (Still correct) ---
export const selectColumnsSchema = createSelectSchema(columnsTable);
export const selectTasksSchema = createSelectSchema(taskTable);

// Construct a Zod schema for the entire app structure by composing the individual schemas.
export const zodAppSchema = z.object({
  columns: selectColumnsSchema,
  tasks: selectTasksSchema,
});

/**
 * Represents the inferred TypeScript type for the entire application schema structure,
 * suitable for validating or typing data objects that match the database structure.
 * This will now work correctly.
 */
export type AppSchemaValue = z.infer<typeof zodAppSchema>;
