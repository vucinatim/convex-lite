import express, { Express, Request, Response } from "express";
import cors from "cors";
import { WebSocketServer, WebSocket } from "ws";
import http from "http";
import { z } from "zod";
import fs from "fs/promises"; // For dynamic loading
import path from "path"; // For dynamic loading
import { fileURLToPath, pathToFileURL } from "url"; // For __dirname equivalent in ESM and pathToFileURL

import type {
  WebSocketMessage,
  QueryRequestMessage,
  MutationRequestMessage,
  DataResponseMessage,
  ErrorResponseMessage,
  // TextEntry, // Removed as unused in server.ts
  // Counter,   // Removed as unused in server.ts
} from "../common/web-socket-types.ts";
import { MessageType } from "../common/web-socket-types.ts";

import { schema as appSchema } from "../convex/schema.ts";
import db from "./lib/database.ts";

// Handler Context type to be passed to API functions
export interface HandlerContext {
  db: typeof db;
  appSchema: typeof appSchema;
  broadcastQueryUpdate: <TData>(queryKey: string, data: TData) => void;
  // We can add auth, etc. later
}

// Registries for dynamically loaded API handlers
const queryHandlers = new Map<
  string,
  (context: HandlerContext, args: unknown) => Promise<unknown>
>();
const mutationHandlers = new Map<
  string,
  (context: HandlerContext, args: unknown) => Promise<unknown>
>();
const mutationAffectedTables = new Map<string, string[]>();

const app: Express = express();
const port: number | string = process.env.PORT || 3001;

// Helper to get __dirname in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function loadApiHandlers() {
  console.log("Loading API handlers...");
  const apiDir = path.resolve(__dirname, "../convex/api");
  try {
    const files = await fs.readdir(apiDir);
    for (const file of files) {
      if (file.endsWith(".ts") || file.endsWith(".js")) {
        // .js for compiled output if any
        const modulePath = path.join(apiDir, file);
        try {
          // Use pathToFileURL for dynamic imports in ESM
          const module = await import(pathToFileURL(modulePath).href);
          for (const exportName in module) {
            if (typeof module[exportName] === "function") {
              const handler = module[exportName];
              // Heuristic: functions starting with get/list are queries, others mutations
              if (
                exportName.startsWith("get") ||
                exportName.startsWith("list")
              ) {
                queryHandlers.set(exportName, handler);
                console.log(
                  `Registered query handler: ${exportName} from ${file}`
                );
              } else {
                // Assume it's a mutation if not explicitly a query by name
                // More robust would be explicit wrapping like Convex.query/mutation
                mutationHandlers.set(exportName, handler);
                console.log(
                  `Registered mutation handler: ${exportName} from ${file}`
                );

                // Check for associated affectedTables metadata
                // Convention: export const affectedTablesByApiFileName = { mutationName: ['table'] }
                // Or more simply: export const affectedTables_mutationName = ['table']
                // For now, let's look for a related export like 'affectedTablesByCounterApi'
                // and then pick the specific mutation key from it.
                const baseName = path
                  .basename(file, path.extname(file))
                  .replace(/_api$/, ""); // e.g., "counter" or "text_entries"
                const capitalizedBaseName =
                  baseName.charAt(0).toUpperCase() + baseName.slice(1); // e.g., "Counter" or "TextEntries"
                const metadataExportName = `affectedTablesBy${capitalizedBaseName}Api`; // e.g. affectedTablesByCounterApi
                if (
                  module[metadataExportName] &&
                  module[metadataExportName][exportName]
                ) {
                  mutationAffectedTables.set(
                    exportName,
                    module[metadataExportName][exportName]
                  );
                  console.log(
                    `  Registered affectedTables for ${exportName}: ${module[
                      metadataExportName
                    ][exportName].join(", ")}`
                  );
                }
              }
            }
          }
        } catch (err) {
          console.error(
            `Error importing module ${modulePath} (${
              pathToFileURL(modulePath).href
            }):`,
            err
          );
        }
      }
    }
  } catch (err) {
    console.error("Error reading API directory:", err);
    // Decide if server should start if handlers can't be loaded
  }
  console.log("API handlers loading complete.");
  console.log("Query Handlers:", Array.from(queryHandlers.keys()));
  console.log("Mutation Handlers:", Array.from(mutationHandlers.keys()));
  console.log("Mutation Affected Tables:", mutationAffectedTables);
}

async function initializeDatabaseSchema() {
  console.log("Initializing database schema...");
  try {
    for (const [tableName, zodSchema] of Object.entries(appSchema)) {
      const tableExists = await db.schema.hasTable(tableName);
      if (!tableExists) {
        console.log(`Creating table: ${tableName}`);
        await db.schema.createTable(tableName, (table) => {
          if (typeof zodSchema.shape !== "function" && zodSchema.shape) {
            for (const [fieldName, fieldSchemaUntyped] of Object.entries(
              zodSchema.shape
            )) {
              const fieldSchema = fieldSchemaUntyped as z.ZodTypeAny;
              let columnBuilder;
              const zType = fieldSchema._def.typeName;

              // Handle specific fields first
              if (fieldName === "_id") {
                columnBuilder = table.string("_id").primary(); // _id is primary key
              } else if (
                fieldName === "_createdAt" ||
                fieldName === "_updatedAt"
              ) {
                columnBuilder = table.bigInteger(fieldName).notNullable(); // Timestamps as BIGINT, not nullable
              } else if (zType === "ZodString") {
                columnBuilder = table.string(fieldName);
              } else if (zType === "ZodNumber") {
                // Keep existing logic for other number fields (e.g., counter value)
                if (
                  fieldName.includes("At") || // This might conflict if we have other 'At' fields not timestamps
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
                  columnBuilder =
                    table.integer(
                      fieldName
                    ); // Could also be bigInteger based on inner type nature
                else {
                  console.warn(
                    `Unhandled optional/nullable inner type ${innerTypeName} for ${fieldName} in ${tableName}`
                  );
                  continue;
                }
                // Optional/nullable fields by definition don't get .notNullable() here
              } else {
                console.warn(
                  `Unhandled Zod type ${zType} for ${fieldName} in ${tableName}`
                );
                continue;
              }

              // Apply notNullable for non-optional/nullable fields, excluding special fields handled above
              if (
                columnBuilder &&
                fieldName !== "_id" && // Already handled
                fieldName !== "_createdAt" && // Already handled
                fieldName !== "_updatedAt" && // Already handled
                zType !== "ZodOptional" &&
                zType !== "ZodNullable"
              ) {
                columnBuilder.notNullable();
              }

              // Apply defaultTo if specified in Zod schema, but _createdAt and _updatedAt defaults are app-level
              if (
                columnBuilder &&
                fieldSchema._def.defaultValue !== undefined &&
                typeof fieldSchema._def.defaultValue !== "function" && // Knex defaultTo needs a literal
                fieldName !== "_createdAt" && // Application logic handles default via Zod
                fieldName !== "_updatedAt" // Application logic handles default via Zod
              ) {
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

async function startServer() {
  await initializeDatabaseSchema();
  await loadApiHandlers(); // Load handlers after DB is ready

  app.use(cors());
  app.use(express.json());

  app.get("/api", (req: Request, res: Response) => {
    res.json({ message: "Hello from server!" });
  });

  const server = http.createServer(app);
  const wss = new WebSocketServer({ server });

  const clients = new Set<WebSocket>();

  const broadcastTableData = async (
    tableName: keyof typeof appSchema,
    database: typeof db
  ) => {
    try {
      const data = await database(tableName).select("*");
      const queryKeyForTable = `table_${tableName}`;
      const message: DataResponseMessage<unknown[]> = {
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

  const broadcastQueryUpdateForHandler = <TData>(
    queryKey: string,
    data: TData
  ) => {
    const message: DataResponseMessage<TData> = {
      type: MessageType.DATA_UPDATE,
      queryKey: queryKey,
      data: data,
    };
    const messageString = JSON.stringify(message);
    clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(messageString);
      }
    });
    console.log(
      `Broadcasted data update via handler for queryKey: ${queryKey}`
    );
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

      const handlerContext: HandlerContext = {
        db,
        appSchema,
        broadcastQueryUpdate: broadcastQueryUpdateForHandler,
      };

      if (parsedMessage.type === MessageType.QUERY) {
        const queryMessage = parsedMessage as QueryRequestMessage;
        const handler = queryHandlers.get(queryMessage.queryKey);

        if (handler) {
          try {
            const result = await handler(
              handlerContext,
              queryMessage.params || {}
            );
            const response: DataResponseMessage<unknown> = {
              // Type result properly based on handler return
              type: MessageType.DATA_UPDATE,
              id: queryMessage.id,
              queryKey: queryMessage.queryKey,
              data: result,
            };
            ws.send(JSON.stringify(response));
          } catch (error) {
            console.error(
              `Error executing query handler for ${queryMessage.queryKey}:`,
              error
            );
            const errorMsg: ErrorResponseMessage = {
              type: MessageType.ERROR,
              id: queryMessage.id,
              message: `Error in query ${queryMessage.queryKey}: ${
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
              queryKey: queryMessage.queryKey,
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
          const errorMsg: ErrorResponseMessage = {
            type: MessageType.ERROR,
            id: queryMessage.id,
            message: `Unknown query handler for key: ${queryMessage.queryKey}`,
          };
          ws.send(JSON.stringify(errorMsg));
        }
      } else if (parsedMessage.type === MessageType.MUTATION) {
        const mutationMessage = parsedMessage as MutationRequestMessage;
        const handler = mutationHandlers.get(mutationMessage.mutationKey);

        if (handler) {
          try {
            const result = await handler(
              handlerContext,
              mutationMessage.args || {}
            );
            const response: DataResponseMessage<unknown> = {
              // Type result properly
              type: MessageType.DATA_UPDATE, // Or a specific success type if defined
              id: mutationMessage.id,
              data: result,
            };
            ws.send(JSON.stringify(response));

            // After successful mutation, broadcast updates for affected tables
            const affected = mutationAffectedTables.get(
              mutationMessage.mutationKey
            );
            if (affected) {
              for (const tableName of affected) {
                await broadcastTableData(
                  tableName as keyof typeof appSchema,
                  db
                );
              }
            }
            // Additionally, if the mutation handler itself wants to trigger specific query broadcasts,
            // it should do so internally (e.g. counter_api.incrementCounter might call a broadcast for "getCounter")
            // For now, this generic mechanism updates table views in admin.
          } catch (error) {
            console.error(
              `Error executing mutation handler for ${mutationMessage.mutationKey}:`,
              error
            );
            const errorMsg: ErrorResponseMessage = {
              type: MessageType.ERROR,
              id: mutationMessage.id,
              message: `Error in mutation ${mutationMessage.mutationKey}: ${
                error instanceof Error ? error.message : String(error)
              }`,
            };
            ws.send(JSON.stringify(errorMsg));
          }
        } else {
          const errorMsg: ErrorResponseMessage = {
            type: MessageType.ERROR,
            id: mutationMessage.id,
            message: `Unknown mutation handler for key: ${mutationMessage.mutationKey}`,
          };
          ws.send(JSON.stringify(errorMsg));
        }
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
}

startServer().catch((error) => {
  console.error("Failed to start server:", error);
  process.exit(1);
});
