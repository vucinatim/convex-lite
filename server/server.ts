import express, { Express, Request, Response } from "express";
import cors from "cors";
import { WebSocketServer, WebSocket } from "ws";
import http from "http";
import { z } from "zod"; // Import Zod

import type {
  WebSocketMessage,
  QueryRequestMessage,
  MutationRequestMessage,
  DataResponseMessage,
  ErrorResponseMessage,
  TextEntry, // Add TextEntry type import if not already there from common types
  Counter, // Also from common types
  // Document, // Removed as unused for now
  // Todo,     // Removed as unused for now
} from "../common/web-socket-types.ts";
import { MessageType } from "../common/web-socket-types.ts";

import { schema as appSchema } from "../convex/schema.ts"; // Counter is already imported
// TextEntry type from schema will be imported via common-web-socket-types or directly if preferred
import db from "./lib/database.ts";

const app: Express = express();
const port: number | string = process.env.PORT || 3001;

async function initializeDatabaseSchema() {
  console.log("Initializing database schema...");
  try {
    for (const [tableName, zodSchema] of Object.entries(appSchema)) {
      const tableExists = await db.schema.hasTable(tableName);
      if (!tableExists) {
        console.log(`Creating table: ${tableName}`);
        await db.schema.createTable(tableName, (table) => {
          // zodSchema is a ZodObject and shape should exist
          if (typeof zodSchema.shape !== "function" && zodSchema.shape) {
            // zodSchema is a ZodObject and shape should exist
            for (const [fieldName, fieldSchemaUntyped] of Object.entries(
              zodSchema.shape
            )) {
              const fieldSchema = fieldSchemaUntyped as z.ZodTypeAny;
              let columnBuilder;
              const zType = fieldSchema._def.typeName;
              if (fieldName === "_id") {
                columnBuilder = table.string("_id").primary();
              } else if (zType === "ZodString") {
                columnBuilder = table.string(fieldName);
              } else if (zType === "ZodNumber") {
                if (
                  fieldName.includes("At") ||
                  fieldName.includes("Timestamp")
                ) {
                  columnBuilder = table.bigInteger(fieldName);
                } else {
                  columnBuilder = table.integer(fieldName);
                }
              } else if (zType === "ZodBoolean") {
                columnBuilder = table.boolean(fieldName);
              } else if (zType === "ZodOptional" || zType === "ZodNullable") {
                let innerTypeName = "unknown";
                if (
                  fieldSchema._def &&
                  "innerType" in fieldSchema._def &&
                  fieldSchema._def.innerType &&
                  fieldSchema._def.innerType._def &&
                  "typeName" in fieldSchema._def.innerType._def
                ) {
                  innerTypeName = fieldSchema._def.innerType._def
                    .typeName as string;
                }
                if (innerTypeName === "ZodString")
                  columnBuilder = table.string(fieldName);
                else if (innerTypeName === "ZodNumber")
                  columnBuilder = table.integer(fieldName);
                else {
                  console.warn(
                    `Unhandled optional/nullable inner type ${innerTypeName} for ${fieldName} in ${tableName}`
                  );
                  continue;
                }
              } else {
                console.warn(
                  `Unhandled Zod type ${zType} for ${fieldName} in ${tableName}`
                );
                continue;
              }
              if (
                columnBuilder &&
                zType !== "ZodOptional" &&
                zType !== "ZodNullable"
              ) {
                // notNullable exists on columnBuilder
                columnBuilder.notNullable();
              }
              if (
                columnBuilder &&
                fieldSchema._def.defaultValue !== undefined &&
                typeof fieldSchema._def.defaultValue !== "function"
              ) {
                // defaultTo exists on columnBuilder
                columnBuilder.defaultTo(fieldSchema._def.defaultValue);
              }
            }
          } else {
            console.warn(
              `Schema for table ${tableName} does not appear to be a Zod object with a shape.`
            );
          }
        });
        console.log(`Table ${tableName} created.`);
      } else {
        console.log(`Table ${tableName} already exists.`);
      }
    }
    console.log("Database schema initialization complete.");
  } catch (error) {
    console.error("Error initializing database schema:", error);
    process.exit(1);
  }
}

initializeDatabaseSchema()
  .then(() => {
    app.use(cors());
    app.use(express.json());

    app.get("/api", (req: Request, res: Response) => {
      res.json({ message: "Hello from server!" });
    });

    const server = http.createServer(app);
    const wss = new WebSocketServer({ server });

    let globalCounterData: Counter | null = null;

    async function ensureGlobalCounter() {
      const existing = await db("counters")
        .where({ name: "globalCounter" })
        .first();
      if (existing) {
        globalCounterData = existing as Counter;
      } else {
        // Use the Counter type from common types for parsing to ensure consistency
        const newCounterData = { name: "globalCounter", value: 0 };
        const parsedCounter = appSchema.counters.parse(
          newCounterData
        ) as Counter;
        await db("counters").insert(parsedCounter);
        globalCounterData = parsedCounter;
      }
      console.log("Global counter ensured:", globalCounterData);
    }

    ensureGlobalCounter();

    const clients = new Set<WebSocket>();

    const broadcastCounterUpdate = () => {
      if (!globalCounterData) return;
      const message: DataResponseMessage<Counter> = {
        type: MessageType.DATA_UPDATE,
        queryKey: "getCounter",
        data: globalCounterData,
      };
      const messageString = JSON.stringify(message);
      clients.forEach((client) => {
        if (client.readyState === WebSocket.OPEN) {
          client.send(messageString);
        }
      });
    };

    const broadcastTextEntriesUpdate = async () => {
      try {
        const entries = (await db("text_entries")
          .select("*")
          .orderBy("createdAt", "desc")) as TextEntry[];
        const message: DataResponseMessage<TextEntry[]> = {
          type: MessageType.DATA_UPDATE,
          queryKey: "getTextEntries",
          data: entries,
        };
        const messageString = JSON.stringify(message);
        clients.forEach((client) => {
          if (client.readyState === WebSocket.OPEN) {
            client.send(messageString);
          }
        });
      } catch (error) {
        console.error("Error broadcasting text entries update:", error);
      }
    };

    // New generic function to broadcast data for any table
    const broadcastTableData = async (
      tableName: keyof typeof appSchema,
      database: typeof db
    ) => {
      try {
        const data = await database(tableName).select("*"); // Fetch all data
        const queryKeyForTable = `table_${tableName}`;
        const message: DataResponseMessage<unknown[]> = {
          // Data is an array of records
          type: MessageType.DATA_UPDATE,
          queryKey: queryKeyForTable,
          data: data,
        };
        const messageString = JSON.stringify(message);
        clients.forEach((client) => {
          if (client.readyState === WebSocket.OPEN) {
            client.send(messageString);
          }
        });
        console.log(
          `Broadcasted data update for table: ${tableName} to key ${queryKeyForTable}`
        );
      } catch (error) {
        console.error(`Error broadcasting table data for ${tableName}:`, error);
      }
    };

    wss.on("connection", (ws: WebSocket) => {
      console.log("Client connected via WebSocket");
      clients.add(ws);

      ws.on("message", async (messageString: string) => {
        let parsedMessage: WebSocketMessage;
        try {
          parsedMessage = JSON.parse(messageString) as WebSocketMessage;
        } catch (error) {
          const errorMsg: ErrorResponseMessage = {
            type: MessageType.ERROR,
            message: `Invalid JSON message format: ${
              error instanceof Error ? error.message : String(error)
            }`,
          };
          ws.send(JSON.stringify(errorMsg));
          return;
        }

        if (parsedMessage.type === MessageType.QUERY) {
          const queryMessage = parsedMessage as QueryRequestMessage;
          if (queryMessage.queryKey === "getCounter") {
            if (!globalCounterData) {
              const errorMsg: ErrorResponseMessage = {
                type: MessageType.ERROR,
                id: queryMessage.id,
                message: "Global counter not found",
              };
              ws.send(JSON.stringify(errorMsg));
              return;
            }
            const response: DataResponseMessage<Counter> = {
              type: MessageType.DATA_UPDATE,
              id: queryMessage.id,
              queryKey: "getCounter",
              data: globalCounterData,
            };
            ws.send(JSON.stringify(response));
          } else if (queryMessage.queryKey === "getTextEntries") {
            try {
              const entries = (await db("text_entries")
                .select("*")
                .orderBy("createdAt", "desc")) as TextEntry[];
              const response: DataResponseMessage<TextEntry[]> = {
                type: MessageType.DATA_UPDATE,
                id: queryMessage.id,
                queryKey: "getTextEntries",
                data: entries,
              };
              ws.send(JSON.stringify(response));
            } catch (error) {
              console.error("Error fetching text entries:", error);
              const errorMsg: ErrorResponseMessage = {
                type: MessageType.ERROR,
                id: queryMessage.id,
                message: `Failed to fetch text entries: ${
                  error instanceof Error ? error.message : String(error)
                }`,
              };
              ws.send(JSON.stringify(errorMsg));
            }
          } else if (
            queryMessage.queryKey &&
            queryMessage.queryKey.startsWith("table_")
          ) {
            const tableName = queryMessage.queryKey.substring(
              "table_".length
            ) as keyof typeof appSchema;
            if (!Object.prototype.hasOwnProperty.call(appSchema, tableName)) {
              const errorMsg: ErrorResponseMessage = {
                type: MessageType.ERROR,
                id: queryMessage.id,
                message: `Unknown table specified in queryKey: ${tableName}`,
              };
              ws.send(JSON.stringify(errorMsg));
              return;
            }
            try {
              const data = await db(tableName).select("*");
              const response: DataResponseMessage<unknown[]> = {
                type: MessageType.DATA_UPDATE,
                id: queryMessage.id,
                queryKey: queryMessage.queryKey, // Respond to the specific table_X key
                data: data,
              };
              ws.send(JSON.stringify(response));
            } catch (error) {
              console.error(
                `Error fetching data for table ${tableName} (queryKey: ${queryMessage.queryKey}):`,
                error
              );
              const errorMsg: ErrorResponseMessage = {
                type: MessageType.ERROR,
                id: queryMessage.id,
                message: `Failed to fetch data for table: ${tableName}: ${
                  error instanceof Error ? error.message : String(error)
                }`,
              };
              ws.send(JSON.stringify(errorMsg));
            }
          } else {
            // Handle unknown query keys
            const errorMsg: ErrorResponseMessage = {
              type: MessageType.ERROR,
              id: queryMessage.id,
              message: `Unknown queryKey: ${queryMessage.queryKey}`,
            };
            ws.send(JSON.stringify(errorMsg));
          }
        } else if (parsedMessage.type === MessageType.MUTATION) {
          const mutationMessage = parsedMessage as MutationRequestMessage;
          if (mutationMessage.mutationKey === "incrementCounter") {
            if (!globalCounterData) {
              const errorMsg: ErrorResponseMessage = {
                type: MessageType.ERROR,
                id: mutationMessage.id,
                message: "Global counter not found for mutation",
              };
              ws.send(JSON.stringify(errorMsg));
              return;
            }
            const newvalue = globalCounterData.value + 1;
            // Use the Counter type for update consistency
            const updatedCounterFields: Partial<Counter> = { value: newvalue };
            await db("counters")
              .where({ _id: globalCounterData._id })
              .update(updatedCounterFields);
            globalCounterData.value = newvalue; // Update in-memory cache
            const response: DataResponseMessage<Counter> = {
              type: MessageType.DATA_UPDATE,
              id: mutationMessage.id,
              data: globalCounterData,
            };
            ws.send(JSON.stringify(response));
            broadcastCounterUpdate();
            await broadcastTableData("counters", db); // Broadcast for admin table view
          } else if (mutationMessage.mutationKey === "addTextEntry") {
            try {
              const args = mutationMessage.args as { content: string };
              const content = args?.content;

              if (typeof content !== "string") {
                throw new Error(
                  "Invalid arguments for addTextEntry: content must be a string."
                );
              }

              const newEntryDataToValidate = { content: content.trim() };
              const validatedEntry = appSchema.text_entries.parse(
                newEntryDataToValidate
              ) as TextEntry;

              await db("text_entries").insert(validatedEntry);

              const response: DataResponseMessage<TextEntry> = {
                type: MessageType.DATA_UPDATE,
                id: mutationMessage.id,
                data: validatedEntry,
              };
              ws.send(JSON.stringify(response));

              broadcastTextEntriesUpdate();
              await broadcastTableData("text_entries", db); // Broadcast for admin table view
            } catch (error) {
              console.error("Error adding text entry:", error);
              let errorMessage = "Failed to add text entry.";
              if (error instanceof z.ZodError) {
                errorMessage = error.errors
                  .map((e) => `${e.path.join(".")}: ${e.message}`)
                  .join(", ");
              } else if (error instanceof Error) {
                errorMessage = error.message;
              } else if (typeof error === "string") {
                errorMessage = error;
              }
              const errorMsg: ErrorResponseMessage = {
                type: MessageType.ERROR,
                id: mutationMessage.id,
                message: errorMessage,
              };
              ws.send(JSON.stringify(errorMsg));
            }
          }
        } else {
          const errorMsg: ErrorResponseMessage = {
            type: MessageType.ERROR,
            id: parsedMessage.id,
            message: `Unknown message type or action: ${parsedMessage.type}`,
          };
          ws.send(JSON.stringify(errorMsg));
        }
      });

      ws.on("close", () => {
        clients.delete(ws);
        console.log("Client disconnected");
      });

      ws.on("error", (error: Error) => {
        console.error("WebSocket error:", error.message || error);
        clients.delete(ws);
      });
    });

    server.listen(port, () => {
      console.log(`Server (HTTP and WebSocket) listening on port ${port}`);
    });
  })
  .catch((error) => {
    console.error("Failed to initialize server after DB setup:", error);
    process.exit(1);
  });
