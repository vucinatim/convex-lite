import type { WebSocketMessage } from "../../common/web-socket-types";

const WS_URL = "ws://localhost:3001";

let socket: WebSocket | null = null;
let pendingSubscribers: Array<(socket: WebSocket) => void> = [];

export const connect = (): WebSocket => {
  if (socket && socket.readyState === WebSocket.OPEN) {
    return socket;
  }

  if (socket && socket.readyState === WebSocket.CONNECTING) {
    return socket;
  }

  socket = new WebSocket(WS_URL);

  socket.onopen = () => {
    console.log("WebSocket connected");
    pendingSubscribers.forEach((cb) => cb(socket!));
    pendingSubscribers = [];
  };

  socket.onclose = () => {
    console.log("WebSocket disconnected");
    socket = null;
  };

  socket.onerror = (error) => {
    console.error("WebSocket error:", error);
  };

  return socket;
};

const ensureConnected = (): Promise<WebSocket> => {
  return new Promise((resolve) => {
    const currentSocket = connect();
    if (currentSocket.readyState === WebSocket.OPEN) {
      resolve(currentSocket);
    } else {
      pendingSubscribers.push(resolve);
    }
  });
};

export const sendMessage = async (message: WebSocketMessage) => {
  const ws = await ensureConnected();
  ws.send(JSON.stringify(message));
};

export const subscribeToMessages = async (
  callback: (data: WebSocketMessage) => void
) => {
  const ws = await ensureConnected();
  const handler = (event: MessageEvent) => {
    try {
      const data = JSON.parse(event.data as string) as WebSocketMessage;
      callback(data);
    } catch (error) {
      console.error("Error parsing WebSocket message:", error);
    }
  };
  ws.addEventListener("message", handler);

  return () => {
    ws.removeEventListener("message", handler);
  };
};
