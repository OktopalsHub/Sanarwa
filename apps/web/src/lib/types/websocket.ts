// WebSocket types for real-time communication

export interface WebSocketConfig {
  url: string;
  protocols?: string | string[];
  reconnectInterval?: number;
  maxReconnectAttempts?: number;
  heartbeatInterval?: number;
  timeout?: number;
}

export interface WebSocketMessage<T = any> {
  type: string;
  channel?: string;
  data: T;
  timestamp: number;
  id?: string;
}

export interface WebSocketSubscription {
  channel: string;
  callback: (data: any) => void;
  id: string;
}

export interface WebSocketConnectionState {
  status: "connecting" | "connected" | "disconnected" | "reconnecting" | "error";
  lastConnected?: Date;
  reconnectAttempts: number;
  error?: string;
}

export interface WebSocketManagerEvents {
  "connection:open": () => void;
  "connection:close": (event: CloseEvent) => void;
  "connection:error": (error: Event) => void;
  "connection:reconnecting": (attempt: number) => void;
  "connection:reconnected": () => void;
  "connection:failed": () => void;
  "message:received": (message: WebSocketMessage) => void;
  "subscription:added": (subscription: WebSocketSubscription) => void;
  "subscription:removed": (subscriptionId: string) => void;
}

// Real-time notification update types
export interface NotificationUpdate {
  id: string;
  status: "pending" | "sent" | "delivered" | "failed" | "bounced";
  deliveredAt?: Date;
  failureReason?: string;
  metadata?: Record<string, any>;
}

export interface QueueStatus {
  channel: string;
  pending: number;
  processing: number;
  failed: number;
  processed: number;
  averageProcessingTime: number;
  lastProcessed?: Date;
}

export interface SystemHealth {
  status: "healthy" | "degraded" | "down";
  services: {
    database: "up" | "down";
    redis: "up" | "down";
    providers: Record<string, "up" | "down">;
  };
  metrics: {
    cpu: number;
    memory: number;
    activeConnections: number;
  };
  timestamp: Date;
}

// WebRTC signaling types
export interface WebRTCSignalingMessage {
  type:
    | "offer"
    | "answer"
    | "ice-candidate"
    | "call-request"
    | "call-accept"
    | "call-reject"
    | "call-end";
  sessionId: string;
  from: string;
  to: string;
  data?: any;
  timestamp: number;
}

export interface CallSession {
  id: string;
  initiator: string;
  participants: string[];
  status: "initiating" | "ringing" | "active" | "ended" | "failed";
  startedAt?: Date;
  endedAt?: Date;
  duration?: number;
  metadata?: Record<string, any>;
}

// Channel-specific message types
export type WebSocketChannels =
  | "notifications"
  | "queue-status"
  | "system-health"
  | "webrtc-signaling"
  | "tenant-updates"
  | "user-presence";

export interface ChannelMessageMap {
  notifications: NotificationUpdate;
  "queue-status": QueueStatus;
  "system-health": SystemHealth;
  "webrtc-signaling": WebRTCSignalingMessage;
  "tenant-updates": { type: "member-added" | "member-removed" | "settings-updated"; data: any };
  "user-presence": { userId: string; status: "online" | "offline" | "away"; lastSeen?: Date };
}
