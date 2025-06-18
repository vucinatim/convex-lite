import { z } from "zod";

/**
 * Defines the schema for the application data.
 * Each key represents a "table" or "collection", and its value is a Zod schema
 * defining the structure of documents within that table.
 */
export const schema = {
  /**
   * A simple counter. We can use a literal _id to ensure it's a singleton if needed,
   * or allow multiple counters if that's the design.
   * For this example, let's keep it as a potential collection of counters,
   * though our current implementation uses a single in-memory counter.
   */
  counters: z.object({
    _id: z
      .string()
      .default(() => `counter_${Math.random().toString(36).substr(2)}`),
    name: z.string(), // e.g., "global", "userSpecific"
    value: z.number(),
  }),

  /**
   * A collection for generic documents.
   */
  documents: z.object({
    _id: z
      .string()
      .default(() => `doc_${Math.random().toString(36).substr(2)}`),
    title: z.string(),
    content: z.string().optional(),
    createdAt: z.number().default(() => Date.now()),
    updatedAt: z.number().default(() => Date.now()),
  }),

  // Example of a more complex schema for a to-do item
  todos: z.object({
    _id: z
      .string()
      .default(() => `todo_${Math.random().toString(36).substr(2)}`),
    text: z.string().min(1, { message: "Todo text cannot be empty" }),
    isCompleted: z.boolean().default(false),
    createdAt: z.number().default(() => Date.now()),
  }),

  /**
   * A collection for simple text entries.
   */
  text_entries: z.object({
    _id: z
      .string()
      .default(() => `text_${Math.random().toString(36).substr(2)}`),
    content: z.string().min(1, { message: "Text content cannot be empty" }),
    createdAt: z.number().default(() => Date.now()),
  }),
};

/**
 * Represents the overall application schema structure.
 * This type is derived from the `schema` object and can be used to ensure
 * type safety when referring to table names or schema definitions.
 */
export type AppSchema = typeof schema;

/**
 * Utility type to infer the TypeScript type from a Zod schema.
 * e.g., type MyDocumentType = Infer<typeof schema.documents>;
 */
export type Infer<T extends z.ZodTypeAny> = z.infer<T>;

// Example usage of Infer for specific schemas:
export type Counter = Infer<typeof schema.counters>;
export type Document = Infer<typeof schema.documents>;
export type Todo = Infer<typeof schema.todos>;
export type TextEntry = Infer<typeof schema.text_entries>;
