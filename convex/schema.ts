import { z } from "zod";
import { v4 as uuidv4 } from "uuid"; // For _id generation

// Base schema definition for common fields
const baseSchemaFields = {
  _id: z.string().default(() => `id_${uuidv4()}`), // Ensure _id is always present
  _createdAt: z.number().default(() => Date.now()),
  _updatedAt: z.number().default(() => Date.now()), // Will be updated manually on modifications
};

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
    ...baseSchemaFields,
    name: z.string().default("globalCounter"), // Name might be specific to the counter's purpose
    value: z.number().default(0),
  }),

  /**
   * A collection for generic documents.
   */
  documents: z.object({
    ...baseSchemaFields,
    title: z.string(),
    content: z.string(),
  }),

  // Example of a more complex schema for a to-do item
  todos: z.object({
    ...baseSchemaFields,
    text: z.string(),
    completed: z.boolean().default(false),
  }),

  /**
   * A collection for simple text entries.
   */
  text_entries: z.object({
    ...baseSchemaFields,
    content: z.string(),
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
