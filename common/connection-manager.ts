import type { WebSocketMessage } from "./web-socket-types";

export type ConnectionStatus = "connecting" | "connected" | "disconnected";

class ConnectionManager {
  private ws: WebSocket | null = null;
  public status: ConnectionStatus = "disconnected";
  private statusListeners = new Set<(status: ConnectionStatus) => void>();
  private messageListeners = new Set<(message: WebSocketMessage) => void>();

  private reconnectAttempts = 0;
  private maxReconnectDelay = 30000; // 30 seconds
  private reconnectTimeoutId: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    this.connect();
  }

  private setStatus(newStatus: ConnectionStatus) {
    if (this.status === newStatus) return;
    this.status = newStatus;
    this.statusListeners.forEach((listener) => listener(this.status));
  }

  public connect = () => {
    if (this.reconnectTimeoutId) clearTimeout(this.reconnectTimeoutId);
    if (
      this.ws &&
      (this.ws.readyState === WebSocket.OPEN ||
        this.ws.readyState === WebSocket.CONNECTING)
    ) {
      return;
    }

    this.setStatus("connecting");
    console.log("[Convex-Lite] WebSocket: Connecting...");

    const wsUrl = `ws://${window.location.host.replace(/:\d+$/, "")}:3001`;
    this.ws = new WebSocket(wsUrl);

    this.ws.onopen = () => {
      console.log("[Convex-Lite] WebSocket: Connected!");
      this.setStatus("connected");
      this.reconnectAttempts = 0;
    };

    this.ws.onmessage = (event) => {
      const message = JSON.parse(event.data);
      this.messageListeners.forEach((listener) => listener(message));
    };

    this.ws.onclose = () => {
      console.log("[Convex-Lite] WebSocket: Disconnected.");
      this.ws = null;
      if (this.status !== "disconnected") {
        this.setStatus("disconnected");
      }
      this.scheduleReconnect();
    };

    this.ws.onerror = (error) => {
      console.error("[Convex-Lite] WebSocket: Error:", error);
      // onclose will be called automatically by the browser after an error.
    };
  };

  private scheduleReconnect() {
    if (this.reconnectAttempts >= 10) {
      console.error(
        "[Convex-Lite] WebSocket: Max reconnect attempts reached. Giving up."
      );
      return;
    }

    const delay = Math.min(
      1000 * Math.pow(2, this.reconnectAttempts),
      this.maxReconnectDelay
    );

    console.log(`[Convex-Lite] WebSocket: Reconnecting in ${delay / 1000}s...`);

    this.reconnectTimeoutId = setTimeout(() => {
      this.reconnectAttempts++;
      this.connect();
    }, delay);
  }

  public sendMessage(message: WebSocketMessage) {
    if (this.status === "connected" && this.ws) {
      this.ws.send(JSON.stringify(message));
    } else {
      console.error(
        "[Convex-Lite] WebSocket: Cannot send message, not connected.",
        message
      );
    }
  }

  public subscribeToMessages(
    callback: (message: WebSocketMessage) => void
  ): () => void {
    this.messageListeners.add(callback);
    return () => {
      this.messageListeners.delete(callback);
    };
  }

  public subscribeToStatus(
    callback: (status: ConnectionStatus) => void
  ): () => void {
    this.statusListeners.add(callback);
    callback(this.status);
    return () => {
      this.statusListeners.delete(callback);
    };
  }
}

// Export a singleton instance to be used throughout the app.
export const connectionManager = new ConnectionManager();
