import { EventEmitter } from "events";
import type {
  ChannelMessageMap,
  WebSocketChannels,
  WebSocketConfig,
  WebSocketConnectionState,
  WebSocketMessage,
  WebSocketSubscription,
} from "../types/websocket";

export class WebSocketManager extends EventEmitter {
  private ws: WebSocket | null = null;
  private config: Required<WebSocketConfig>;
  private subscriptions = new Map<string, WebSocketSubscription>();
  private connectionState: WebSocketConnectionState = {
    status: "disconnected",
    reconnectAttempts: 0,
  };
  private reconnectTimer: NodeJS.Timeout | null = null;
  private heartbeatTimer: NodeJS.Timeout | null = null;
  private isManuallyDisconnected = false;
  private messageQueue: WebSocketMessage[] = [];

  constructor(config: WebSocketConfig) {
    super();

    this.config = {
      url: config.url,
      protocols: config.protocols || [],
      reconnectInterval: config.reconnectInterval || 5000,
      maxReconnectAttempts: config.maxReconnectAttempts || 10,
      heartbeatInterval: config.heartbeatInterval || 30000,
      timeout: config.timeout || 10000,
    };

    // Bind methods to preserve context
    this.handleOpen = this.handleOpen.bind(this);
    this.handleClose = this.handleClose.bind(this);
    this.handleError = this.handleError.bind(this);
    this.handleMessage = this.handleMessage.bind(this);
  }

  /**
   * Connect to the WebSocket server
   */
  connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.ws?.readyState === WebSocket.OPEN) {
        resolve();
        return;
      }

      if (this.ws?.readyState === WebSocket.CONNECTING) {
        // Already connecting, wait for result
        const onOpen = () => {
          this.off("connection:open", onOpen);
          this.off("connection:error", onError);
          resolve();
        };
        const onError = (error: Event) => {
          this.off("connection:open", onOpen);
          this.off("connection:error", onError);
          reject(error);
        };

        this.on("connection:open", onOpen);
        this.on("connection:error", onError);
        return;
      }

      this.isManuallyDisconnected = false;
      this.updateConnectionState({ status: "connecting" });

      try {
        this.ws = new WebSocket(this.config.url, this.config.protocols);
        this.setupEventListeners();

        // Set up connection timeout
        const timeout = setTimeout(() => {
          if (this.ws?.readyState === WebSocket.CONNECTING) {
            this.ws.close();
            reject(new Error("WebSocket connection timeout"));
          }
        }, this.config.timeout);

        const onOpen = () => {
          clearTimeout(timeout);
          this.off("connection:open", onOpen);
          this.off("connection:error", onError);
          resolve();
        };

        const onError = (error: Event) => {
          clearTimeout(timeout);
          this.off("connection:open", onOpen);
          this.off("connection:error", onError);
          reject(error);
        };

        this.once("connection:open", onOpen);
        this.once("connection:error", onError);
      } catch (error) {
        this.updateConnectionState({
          status: "error",
          error: error instanceof Error ? error.message : "Unknown error",
        });
        reject(error);
      }
    });
  }

  /**
   * Disconnect from the WebSocket server
   */
  disconnect(): void {
    this.isManuallyDisconnected = true;
    this.clearTimers();

    if (this.ws) {
      this.ws.close(1000, "Manual disconnect");
      this.ws = null;
    }

    this.updateConnectionState({ status: "disconnected" });
  }

  /**
   * Subscribe to a channel for real-time updates
   */
  subscribe<T extends WebSocketChannels>(
    channel: T,
    callback: (data: ChannelMessageMap[T]) => void,
  ): string {
    const subscriptionId = this.generateSubscriptionId();
    const subscription: WebSocketSubscription = {
      id: subscriptionId,
      channel,
      callback: callback as (data: any) => void,
    };

    this.subscriptions.set(subscriptionId, subscription);

    // Send subscription message if connected
    if (this.isConnected()) {
      this.sendMessage({
        type: "subscribe",
        channel,
        data: { subscriptionId },
        timestamp: Date.now(),
      });
    }

    this.emit("subscription:added", subscription);
    return subscriptionId;
  }

  /**
   * Unsubscribe from a channel
   */
  unsubscribe(subscriptionId: string): void {
    const subscription = this.subscriptions.get(subscriptionId);
    if (!subscription) return;

    this.subscriptions.delete(subscriptionId);

    // Send unsubscribe message if connected
    if (this.isConnected()) {
      this.sendMessage({
        type: "unsubscribe",
        channel: subscription.channel,
        data: { subscriptionId },
        timestamp: Date.now(),
      });
    }

    this.emit("subscription:removed", subscriptionId);
  }

  /**
   * Send a message through the WebSocket
   */
  sendMessage(message: WebSocketMessage): void {
    if (!this.isConnected() || !this.ws) {
      // Queue message for when connection is restored
      this.messageQueue.push(message);
      return;
    }

    try {
      this.ws.send(JSON.stringify(message));
    } catch (error) {
      console.error("Failed to send WebSocket message:", error);
    }
  }

  /**
   * Get current connection state
   */
  getConnectionState(): WebSocketConnectionState {
    return { ...this.connectionState };
  }

  /**
   * Check if WebSocket is connected
   */
  isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }

  /**
   * Get active subscriptions
   */
  getSubscriptions(): WebSocketSubscription[] {
    return Array.from(this.subscriptions.values());
  }

  private setupEventListeners(): void {
    if (!this.ws) return;

    this.ws.addEventListener("open", this.handleOpen);
    this.ws.addEventListener("close", this.handleClose);
    this.ws.addEventListener("error", this.handleError);
    this.ws.addEventListener("message", this.handleMessage);
  }

  private handleOpen(): void {
    this.updateConnectionState({
      status: "connected",
      lastConnected: new Date(),
      reconnectAttempts: 0,
      error: undefined,
    });

    this.startHeartbeat();
    this.resubscribeAll();
    this.flushMessageQueue();

    this.emit("connection:open");

    // If this was a reconnection
    if (this.connectionState.reconnectAttempts > 0) {
      this.emit("connection:reconnected");
    }
  }

  private handleClose(event: CloseEvent): void {
    this.clearTimers();

    this.updateConnectionState({ status: "disconnected" });
    this.emit("connection:close", event);

    // Attempt reconnection if not manually disconnected
    if (!this.isManuallyDisconnected && event.code !== 1000) {
      this.attemptReconnection();
    }
  }

  private handleError(event: Event): void {
    const error = "WebSocket connection error";
    this.updateConnectionState({
      status: "error",
      error,
    });

    this.emit("connection:error", event);
  }

  private handleMessage(event: MessageEvent): void {
    try {
      const message: WebSocketMessage = JSON.parse(event.data);
      this.emit("message:received", message);

      // Route message to appropriate subscribers
      if (message.channel) {
        this.routeMessageToSubscribers(message);
      }

      // Handle system messages
      this.handleSystemMessage(message);
    } catch (error) {
      console.error("Failed to parse WebSocket message:", error);
    }
  }

  private routeMessageToSubscribers(message: WebSocketMessage): void {
    for (const subscription of this.subscriptions.values()) {
      if (subscription.channel === message.channel) {
        try {
          subscription.callback(message.data);
        } catch (error) {
          console.error("Error in subscription callback:", error);
        }
      }
    }
  }

  private handleSystemMessage(message: WebSocketMessage): void {
    switch (message.type) {
      case "ping":
        // Respond to server ping
        this.sendMessage({
          type: "pong",
          data: message.data,
          timestamp: Date.now(),
        });
        break;

      case "error":
        console.error("WebSocket server error:", message.data);
        break;

      case "subscription:confirmed":
        console.log("Subscription confirmed:", message.data);
        break;

      case "subscription:error":
        console.error("Subscription error:", message.data);
        break;
    }
  }

  private attemptReconnection(): void {
    if (this.connectionState.reconnectAttempts >= this.config.maxReconnectAttempts) {
      this.updateConnectionState({ status: "error", error: "Max reconnection attempts reached" });
      this.emit("connection:failed");
      return;
    }

    this.updateConnectionState({
      status: "reconnecting",
      reconnectAttempts: this.connectionState.reconnectAttempts + 1,
    });

    this.emit("connection:reconnecting", this.connectionState.reconnectAttempts);

    // Exponential backoff with jitter
    const baseDelay = this.config.reconnectInterval;
    const exponentialDelay = baseDelay * Math.pow(2, this.connectionState.reconnectAttempts - 1);
    const jitter = Math.random() * 1000;
    const delay = Math.min(exponentialDelay + jitter, 30000); // Max 30 seconds

    this.reconnectTimer = setTimeout(() => {
      this.connect().catch(() => {
        // Connection failed, will trigger another reconnection attempt
      });
    }, delay);
  }

  private startHeartbeat(): void {
    this.heartbeatTimer = setInterval(() => {
      if (this.isConnected()) {
        this.sendMessage({
          type: "ping",
          data: { timestamp: Date.now() },
          timestamp: Date.now(),
        });
      }
    }, this.config.heartbeatInterval);
  }

  private resubscribeAll(): void {
    // Re-establish all subscriptions after reconnection
    for (const subscription of this.subscriptions.values()) {
      this.sendMessage({
        type: "subscribe",
        channel: subscription.channel,
        data: { subscriptionId: subscription.id },
        timestamp: Date.now(),
      });
    }
  }

  private flushMessageQueue(): void {
    // Send any queued messages
    while (this.messageQueue.length > 0) {
      const message = this.messageQueue.shift();
      if (message) {
        this.sendMessage(message);
      }
    }
  }

  private clearTimers(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  private updateConnectionState(updates: Partial<WebSocketConnectionState>): void {
    this.connectionState = { ...this.connectionState, ...updates };
  }

  private generateSubscriptionId(): string {
    return `sub_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Clean up resources
   */
  destroy(): void {
    this.disconnect();
    this.subscriptions.clear();
    this.messageQueue.length = 0;
    this.removeAllListeners();
  }
}

// Singleton instance for global use
let globalWebSocketManager: WebSocketManager | null = null;

/**
 * Get or create the global WebSocket manager instance
 */
export function getWebSocketManager(config?: WebSocketConfig): WebSocketManager {
  if (!globalWebSocketManager && config) {
    globalWebSocketManager = new WebSocketManager(config);
  }

  if (!globalWebSocketManager) {
    throw new Error("WebSocket manager not initialized. Please provide config on first call.");
  }

  return globalWebSocketManager;
}

/**
 * Initialize the global WebSocket manager
 */
export function initializeWebSocketManager(config: WebSocketConfig): WebSocketManager {
  if (globalWebSocketManager) {
    globalWebSocketManager.destroy();
  }

  globalWebSocketManager = new WebSocketManager(config);
  return globalWebSocketManager;
}

/**
 * Destroy the global WebSocket manager
 */
export function destroyWebSocketManager(): void {
  if (globalWebSocketManager) {
    globalWebSocketManager.destroy();
    globalWebSocketManager = null;
  }
}
