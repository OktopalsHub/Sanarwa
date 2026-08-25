import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { IInAppProvider, InAppPayload, InAppResponse } from "../in-app-provider.interface";

interface WebSocketRoomResponse {
  delivered: number;
  userIds: string[];
}

@Injectable()
export class WebSocketProvider implements IInAppProvider {
  private readonly logger = new Logger(WebSocketProvider.name);
  private readonly socketUrl: string;
  private readonly apiKey: string;

  constructor(private configService: ConfigService) {
    this.socketUrl = this.configService.get("WEBSOCKET_URL") || "ws://localhost:3001";
    this.apiKey = this.configService.get("WEBSOCKET_API_KEY") || "";
  }

  async sendNotification(payload: InAppPayload): Promise<InAppResponse> {
    try {
      const users = Array.isArray(payload.userId) ? payload.userId : [payload.userId];
      const deliveredTo: string[] = [];
      const failedDeliveries: string[] = [];

      const notificationPayload = {
        type: "notification",
        data: {
          id: `notif_${Date.now()}`,
          title: payload.title,
          message: payload.message,
          type: payload.type || "info",
          priority: payload.priority || "normal",
          data: payload.data,
          actions: payload.actions,
          persistent: payload.persistent || false,
          expiresAt: payload.expiresAt,
          timestamp: new Date().toISOString(),
        },
      };

      // Send to each user via WebSocket
      for (const userId of users) {
        try {
          await this.sendToUser(userId, notificationPayload);
          deliveredTo.push(userId);
        } catch (error) {
          this.logger.warn(`Failed to deliver to user ${userId}: ${error.message}`);
          failedDeliveries.push(userId);
        }
      }

      this.logger.log(`In-app notification sent to ${deliveredTo.length}/${users.length} users`);

      return {
        success: deliveredTo.length > 0,
        messageId: notificationPayload.data.id,
        deliveredTo,
        failedDeliveries,
        timestamp: new Date().toISOString(),
        provider: "websocket",
      };
    } catch (error) {
      this.logger.error(`Failed to send in-app notification: ${error.message}`, error.stack);
      return {
        success: false,
        error: error.message,
        provider: "websocket",
      };
    }
  }

  async sendToRoom(roomId: string, payload: InAppPayload): Promise<InAppResponse> {
    try {
      const roomPayload = {
        type: "room_notification",
        roomId,
        data: {
          id: `room_notif_${Date.now()}`,
          title: payload.title,
          message: payload.message,
          type: payload.type || "info",
          data: payload.data,
          timestamp: new Date().toISOString(),
        },
      };

      // Send to room via WebSocket API
      const response = await fetch(
        `${this.socketUrl.replace("ws://", "http://").replace("wss://", "https://")}/api/rooms/${roomId}/notify`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${this.apiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(roomPayload),
        },
      );

      if (!response.ok) {
        throw new Error(`Room notification failed: ${response.statusText}`);
      }

      const result = (await response.json()) as WebSocketRoomResponse;

      this.logger.log(`Room notification sent to ${roomId}: ${result.delivered} users`);

      return {
        success: true,
        messageId: roomPayload.data.id,
        deliveredTo: result.userIds || [],
        timestamp: new Date().toISOString(),
        provider: "websocket",
      };
    } catch (error) {
      this.logger.error(`Failed to send room notification: ${error.message}`, error.stack);
      return {
        success: false,
        error: error.message,
        provider: "websocket",
      };
    }
  }

  private async sendToUser(userId: string, payload: any): Promise<void> {
    // In a real implementation, this would use Socket.IO or similar
    // For now, we'll use HTTP API to trigger WebSocket send
    const response = await fetch(
      `${this.socketUrl.replace("ws://", "http://").replace("wss://", "https://")}/api/users/${userId}/notify`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      },
    );

    if (!response.ok) {
      throw new Error(`Failed to send to user ${userId}: ${response.statusText}`);
    }
  }

  async validateConfig(): Promise<boolean> {
    return !!(this.socketUrl && this.apiKey);
  }

  getProviderName(): string {
    return "websocket";
  }
}
