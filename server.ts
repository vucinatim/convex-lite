import express, { Express, Request, Response } from "express";
import cors from "cors";
import { WebSocketServer, WebSocket } from "ws";
import http from "http";

// Attempt to import types from the frontend. This might need adjustment
// in a production build if paths change or a true shared package is preferred.
import type {
  WebSocketMessage,
  QueryRequestMessage,
  MutationRequestMessage,
  DataResponseMessage,
  ErrorResponseMessage,
} from "./common/web-socket-types.ts"; // Updated path
import { MessageType } from "./common/web-socket-types.ts"; // Updated path

const app: Express = express();
const port: number | string = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

app.get("/api", (req: Request, res: Response) => {
  res.json({ message: "Hello from server!" });
});

// Create HTTP server instance
const server = http.createServer(app);

// Create WebSocket server
const wss = new WebSocketServer({ server });

// In-memory store
let counter = { value: 0 };

// Keep track of connected clients
const clients = new Set<WebSocket>();

const broadcastCounterUpdate = () => {
  const message: DataResponseMessage<{ value: number }> = {
    type: MessageType.DATA_UPDATE,
    queryKey: "getCounter",
    data: counter,
  };
  const messageString = JSON.stringify(message);
  clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(messageString);
    }
  });
};

wss.on("connection", (ws: WebSocket) => {
  console.log("Client connected via WebSocket");
  clients.add(ws);

  ws.on("message", (messageString: string) => {
    console.log("received: %s", messageString);
    let parsedMessage: WebSocketMessage;
    try {
      parsedMessage = JSON.parse(messageString) as WebSocketMessage;
    } catch (error) {
      console.error("Failed to parse message:", error);
      // Optionally send an error back to the client
      const errorMsg: ErrorResponseMessage = {
        type: MessageType.ERROR,
        message: "Invalid JSON message format",
      };
      ws.send(JSON.stringify(errorMsg));
      return;
    }

    if (parsedMessage.type === MessageType.QUERY) {
      const queryMessage = parsedMessage as QueryRequestMessage;
      if (queryMessage.queryKey === "getCounter") {
        const response: DataResponseMessage<{ value: number }> = {
          type: MessageType.DATA_UPDATE,
          id: queryMessage.id, // Echo back the request ID
          queryKey: "getCounter",
          data: counter,
        };
        ws.send(JSON.stringify(response));
      }
    } else if (parsedMessage.type === MessageType.MUTATION) {
      const mutationMessage = parsedMessage as MutationRequestMessage;
      if (mutationMessage.mutationKey === "incrementCounter") {
        counter = { ...counter, value: counter.value + 1 };

        // Respond to the mutator
        const response: DataResponseMessage<{ value: number }> = {
          type: MessageType.DATA_UPDATE, // Or a custom MUTATION_SUCCESS type
          id: mutationMessage.id, // Echo back the request ID
          data: counter, // Send back the new counter state
        };
        ws.send(JSON.stringify(response));

        // Broadcast the update to all clients
        broadcastCounterUpdate();
      }
    } else {
      // Echo back for unknown message types for now, or send an error
      // ws.send(`Hello, you sent -> ${messageString}`);
      const errorMsg: ErrorResponseMessage = {
        type: MessageType.ERROR,
        id: parsedMessage.id,
        message: `Unknown message type or action: ${parsedMessage.type}`,
      };
      ws.send(JSON.stringify(errorMsg));
    }
  });

  ws.on("close", () => {
    console.log("Client disconnected");
    clients.delete(ws);
  });

  ws.on("error", (error) => {
    console.error("WebSocket error:", error);
    clients.delete(ws); // Also remove on error
  });

  // ws.send("Hi there, I am a WebSocket server."); // Initial greeting can be removed or kept
});

server.listen(port, () => {
  console.log(`Server (HTTP and WebSocket) listening on port ${port}`);
});
