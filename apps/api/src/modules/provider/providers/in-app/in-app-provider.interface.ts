export interface InAppPayload {
  userId: string | string[];
  title: string;
  message: string;
  type?: "info" | "success" | "warning" | "error";
  priority?: "low" | "normal" | "high" | "urgent";
  data?: Record<string, any>;
  actions?: Array<{
    label: string;
    action: string;
    style?: "primary" | "secondary" | "danger";
  }>;
  persistent?: boolean;
  expiresAt?: Date;
  tenantId?: string;
  messageId?: string;
  deliveryId?: string;
  roomId?: string;
  callData?: {
    roomId: string;
    callType: "audio" | "video";
    participants: string[];
  };
}

export interface InAppResponse {
  success: boolean;
  messageId?: string;
  deliveredTo?: string[];
  failedDeliveries?: string[];
  timestamp?: string;
  error?: string;
  provider: string;
}

export interface IInAppProvider {
  sendNotification(payload: InAppPayload): Promise<InAppResponse>;
  sendToRoom(roomId: string, payload: InAppPayload): Promise<InAppResponse>;
  validateConfig(config?: unknown): Promise<boolean>;
  getProviderName(): string;
}
