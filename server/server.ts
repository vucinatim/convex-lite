/* eslint-disable @typescript-eslint/no-explicit-any */
import express, { type Express, type Response } from "express";
import cors from "cors";
import { WebSocketServer, WebSocket } from "ws";
import http from "http";
import path from "path";
import { fileURLToPath, pathToFileURL } from "url";
import { ZodError } from "zod";
import { getApiFiles } from "./utils/file-discovery";

import type {
  WebSocketMessage,
  QueryRequestMessage,
  MutationRequestMessage,
  DataResponseMessage,
  ErrorResponseMessage,
  RequeryMessage,
} from "../common/web-socket-types";
import { MessageType } from "../common/web-socket-types";
import type { WrappedApiFunction, QueryReference } from "convex/_lib/server";

import { schema as appSchema } from "../convex/_schema";
import db from "./lib/database";
import { ensureDatabaseSchemaIsUpToDate } from "./lib/schema-initializer";

// --- Context & App Setup ---

// This is the base context. The full context, including the scheduler,
// will be assembled and passed to handlers.
export interface HandlerContext {
  db: typeof db;
  appSchema: typeof appSchema;
}

const apiHandlers = new Map<string, WrappedApiFunction<any, any>>();
// This map allows us to find the string key for a function object, which is needed for invalidation.
const reverseApiMap = new Map<WrappedApiFunction<any, any>, string>();

const app: Express = express();
const port: number | string = process.env.PORT || 3001;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const CONVEX_DIR = path.resolve(__dirname, "../convex");

/**
 * The new main handler loading function. It recursively scans the entire
 * convex directory to find and register API handlers.
 */
async function loadApiHandlers() {
  console.log("Loading API handlers...");

  for await (const filePath of getApiFiles(CONVEX_DIR)) {
    try {
      const module = await import(pathToFileURL(filePath).href);
      // e.g., 'tasks/queries.ts' -> 'tasks_queries'
      const moduleKey = path
        .relative(CONVEX_DIR, filePath)
        .replace(/\.(ts|js)$/, "")
        .replace(/[/\\]/g, "_");

      for (const exportName in module) {
        const handlerObject = module[exportName] as WrappedApiFunction<
          any,
          any
        >;
        if (
          handlerObject &&
          (handlerObject._type === "query" ||
            handlerObject._type === "mutation")
        ) {
          const fullKey = `${moduleKey}:${exportName}`;
          apiHandlers.set(fullKey, handlerObject);
          reverseApiMap.set(handlerObject, fullKey);
          console.log(`Registered ${handlerObject._type} handler: ${fullKey}`);
        }
      }
    } catch (err) {
      console.error(`Error importing module ${filePath}:`, err);
    }
  }

  console.log("API handlers loading complete.");
}

// --- WebSocket Server Logic with Invalidation ---
async function startServer() {
  await ensureDatabaseSchemaIsUpToDate(db, appSchema);
  await loadApiHandlers();

  app.use(cors());
  app.use(express.json());
  app.get("/api", (_, res: Response) => {
    res.json({ message: "Hello from server!" });
  });

  const server = http.createServer(app);
  const wss = new WebSocketServer({ server });
  const clients = new Set<WebSocket>();

  // The new invalidation function that will be passed in the context
  const invalidateQuery = async (queryRef: QueryReference<any, any>) => {
    const queryKey = reverseApiMap.get(queryRef);
    if (!queryKey) {
      console.error(
        "Could not find query key for invalidation. Was the API handler loaded correctly?"
      );
      return;
    }
    const message: RequeryMessage = {
      type: MessageType.REQUERY,
      queryKey,
    };
    const messageString = JSON.stringify(message);
    clients.forEach(
      (client) =>
        client.readyState === WebSocket.OPEN && client.send(messageString)
    );
    console.log(`Broadcasted invalidation for queryKey: ${queryKey}`);
  };

  wss.on("connection", (ws: WebSocket) => {
    console.log("Client connected");
    clients.add(ws);

    ws.on("message", async (messageString: string) => {
      let message: WebSocketMessage;
      try {
        message = JSON.parse(messageString) as WebSocketMessage;
      } catch (error) {
        ws.send(
          JSON.stringify({
            type: MessageType.ERROR,
            message: `Invalid JSON: ${error}`,
          })
        );
        return;
      }

      // ** The new context now includes the scheduler **
      const handlerContext = {
        db,
        appSchema,
        scheduler: { invalidate: invalidateQuery },
      };

      const isQuery = message.type === MessageType.QUERY;
      const key = isQuery
        ? (message as QueryRequestMessage).queryKey
        : (message as MutationRequestMessage).mutationKey;
      const clientArgs = isQuery
        ? (message as QueryRequestMessage).params
        : (message as MutationRequestMessage).args;
      const handlerObject = apiHandlers.get(key);

      const sendError = (id: string | undefined, message: string) => {
        const errorMsg: ErrorResponseMessage = {
          type: MessageType.ERROR,
          id,
          message,
        };
        ws.send(JSON.stringify(errorMsg));
      };

      if (!handlerObject) {
        return sendError(message.id, `Unknown handler for key: ${key}`);
      }
      if (
        (isQuery && handlerObject._type !== "query") ||
        (!isQuery && handlerObject._type !== "mutation")
      ) {
        return sendError(message.id, `Mismatched handler type for key: ${key}`);
      }

      try {
        let validatedArgs = clientArgs;
        if (handlerObject.args) {
          const parseResult = handlerObject.args.safeParse(clientArgs || {});
          if (!parseResult.success) {
            throw parseResult.error;
          }
          validatedArgs = parseResult.data;
        } else if (clientArgs && Object.keys(clientArgs).length > 0) {
          throw new Error("This function does not accept any arguments.");
        }

        const result = await handlerObject.handler(
          handlerContext,
          validatedArgs
        );

        const response: DataResponseMessage<unknown> = {
          type: MessageType.DATA_UPDATE,
          id: message.id,
          queryKey: isQuery ? key : undefined,
          data: result,
        };
        ws.send(JSON.stringify(response));
      } catch (error) {
        let errorMessage = `Error in ${handlerObject._type} ${key}: ${
          error instanceof Error ? error.message : String(error)
        }`;
        if (error instanceof ZodError) {
          errorMessage = `Argument validation failed: ${JSON.stringify(
            error.format()
          )}`;
        }
        console.error(errorMessage);
        sendError(message.id, errorMessage);
      }
    });

    ws.on("close", () => {
      clients.delete(ws);
      console.log("Client disconnected");
    });
    ws.on("error", (error: Error) => {
      console.error("WebSocket error:", error);
      clients.delete(ws);
    });
  });

  server.listen(port, () => console.log(`Server listening on port ${port}`));
}

startServer().catch(console.error);
