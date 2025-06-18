import express, { Express, Request, Response } from "express";
import cors from "cors";
import { WebSocketServer, WebSocket } from "ws";
import http from "http";
import fs from "fs/promises"; // For dynamic loading
import path from "path"; // For dynamic loading
import { fileURLToPath, pathToFileURL } from "url"; // For __dirname equivalent in ESM and pathToFileURL

import type {
  WebSocketMessage,
  QueryRequestMessage,
  MutationRequestMessage,
  DataResponseMessage,
  ErrorResponseMessage,
} from "../common/web-socket-types.ts";
import { MessageType } from "../common/web-socket-types.ts";

import { schema as appSchema } from "../convex/schema.ts";
import db from "./lib/database.ts";
import { ensureDatabaseSchemaIsUpToDate } from "./lib/schema-initializer.ts"; // Import new function

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

async function loadApiHandlersFromDirectory(dirPath: string) {
  try {
    const files = await fs.readdir(dirPath);
    for (const file of files) {
      if (file.endsWith(".ts") || file.endsWith(".js")) {
        const modulePath = path.join(dirPath, file);
        try {
          const module = await import(pathToFileURL(modulePath).href);
          for (const exportName in module) {
            if (typeof module[exportName] === "function") {
              const handler = module[exportName];
              if (
                exportName.startsWith("get") ||
                exportName.startsWith("list")
              ) {
                queryHandlers.set(exportName, handler);
                console.log(
                  `Registered query handler: ${exportName} from ${path.relative(
                    path.resolve(__dirname, ".."),
                    modulePath
                  )}`
                );
              } else {
                mutationHandlers.set(exportName, handler);
                console.log(
                  `Registered mutation handler: ${exportName} from ${path.relative(
                    path.resolve(__dirname, ".."),
                    modulePath
                  )}`
                );

                const baseName = path
                  .basename(file, path.extname(file))
                  .replace(/_api$/, "");
                const capitalizedBaseName =
                  baseName.charAt(0).toUpperCase() + baseName.slice(1);
                const metadataExportName = `affectedTablesBy${capitalizedBaseName}Api`;
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
    // If a directory doesn't exist (e.g., admin on a branch without it), log and continue
    if (
      typeof err === "object" &&
      err !== null &&
      "code" in err &&
      (err as { code: string }).code === "ENOENT"
    ) {
      console.warn(`API handler directory not found: ${dirPath}. Skipping.`);
    } else {
      console.error(`Error reading API directory ${dirPath}:`, err);
    }
  }
}

async function loadApiHandlers() {
  console.log("Loading API handlers...");
  const apiDir = path.resolve(__dirname, "../convex/api");
  const adminApiDir = path.resolve(__dirname, "../convex/admin");

  await loadApiHandlersFromDirectory(apiDir);
  await loadApiHandlersFromDirectory(adminApiDir);

  console.log("API handlers loading complete.");
  console.log("Query Handlers:", Array.from(queryHandlers.keys()));
  console.log("Mutation Handlers:", Array.from(mutationHandlers.keys()));
  console.log("Mutation Affected Tables:", mutationAffectedTables);
}

async function startServer() {
  // await initializeDatabaseSchema(); // Old call
  await ensureDatabaseSchemaIsUpToDate(db, appSchema); // New call
  await loadApiHandlers(); // Load handlers after DB is ready

  app.use(cors());
  app.use(express.json());

  app.get("/api", (req: Request, res: Response) => {
    res.json({ message: "Hello from server!" });
  });

  const server = http.createServer(app);
  const wss = new WebSocketServer({ server });

  const clients = new Set<WebSocket>();

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
                // Fetch the updated data for the table
                try {
                  const tableData = await db
                    .select()
                    .from(appSchema[tableName as keyof typeof appSchema]);
                  // Broadcast using the new general admin table data query key
                  broadcastQueryUpdateForHandler("get_admin_table_data", {
                    table: tableName,
                    data: tableData,
                  });
                  console.log(
                    `Broadcasted admin update for table: ${tableName} via get_admin_table_data`
                  );
                } catch (broadcastError) {
                  console.error(
                    `Error fetching or broadcasting data for affected table ${tableName}:`,
                    broadcastError
                  );
                }
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
