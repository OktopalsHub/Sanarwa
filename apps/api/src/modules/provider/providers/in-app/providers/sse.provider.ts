import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { IInAppProvider, InAppPayload, InAppResponse } from '../in-app-provider.interface';

interface SSERoomResponse {
  delivered: number;
  userIds: string[];
}

@Injectable()
export class SSEProvider implements IInAppProvider {
  private readonly logger = new Logger(SSEProvider.name);
  private readonly sseServerUrl: string;
  private readonly apiKey: string;

  constructor(private configService: ConfigService) {
    this.sseServerUrl = this.configService.get('SSE_SERVER_URL') || 'http://localhost:3003';
    this.apiKey = this.configService.get('SSE_API_KEY') || '';
  }

  async sendNotification(payload: InAppPayload): Promise<InAppResponse> {
    try {
      const users = Array.isArray(payload.userId) ? payload.userId : [payload.userId];
      const deliveredTo: string[] = [];
      const failedDeliveries: string[] = [];

      const notificationPayload = {
        type: 'in_app_notification',
        data: {
          id: `sse_${Date.now()}`,
          title: payload.title,
          message: payload.message,
          type: payload.type || 'info',
          priority: payload.priority || 'normal',
          data: payload.data,
          actions: payload.actions,
          persistent: payload.persistent || false,
          expiresAt: payload.expiresAt,
          timestamp: new Date().toISOString(),
        },
      };

      // Send to each user via SSE
      for (const userId of users) {
        try {
          await this.sendSSEToUser(userId, notificationPayload);
          deliveredTo.push(userId);
        } catch (error) {
          this.logger.warn(`Failed to deliver SSE to user ${userId}: ${error.message}`);
          failedDeliveries.push(userId);
        }
      }

      this.logger.log(`In-app notification sent via SSE to ${deliveredTo.length}/${users.length} users`);

      return {
        success: deliveredTo.length > 0,
        messageId: notificationPayload.data.id,
        deliveredTo,
        failedDeliveries,
        timestamp: new Date().toISOString(),
        provider: 'sse',
      };
    } catch (error) {
      this.logger.error(`Failed to send in-app notification via SSE: ${error.message}`, error.stack);
      return {
        success: false,
        error: error.message,
        provider: 'sse',
      };
    }
  }

  async sendToRoom(roomId: string, payload: InAppPayload): Promise<InAppResponse> {
    try {
      const roomPayload = {
        type: 'room_notification',
        roomId,
        data: {
          id: `sse_room_${Date.now()}`,
          title: payload.title,
          message: payload.message,
          type: payload.type || 'info',
          priority: payload.priority || 'normal',
          data: payload.data,
          actions: payload.actions,
          timestamp: new Date().toISOString(),
        },
      };

      // Send to room via SSE API
      const response = await fetch(`${this.sseServerUrl}/api/rooms/${roomId}/notify`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(roomPayload),
      });

      if (!response.ok) {
        throw new Error(`SSE room notification failed: ${response.statusText}`);
      }

      const result = await response.json() as SSERoomResponse;

      this.logger.log(`SSE room notification sent to ${roomId}: ${result.delivered} users`);

      return {
        success: true,
        messageId: roomPayload.data.id,
        deliveredTo: result.userIds || [],
        timestamp: new Date().toISOString(),
        provider: 'sse',
      };
    } catch (error) {
      this.logger.error(`Failed to send SSE room notification: ${error.message}`, error.stack);
      return {
        success: false,
        error: error.message,
        provider: 'sse',
      };
    }
  }

  private async sendSSEToUser(userId: string, payload: any): Promise<void> {
    // Send notification via SSE server
    const response = await fetch(`${this.sseServerUrl}/api/users/${userId}/notify`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        ...payload,
        // SSE-specific formatting
        event: 'notification',
        data: JSON.stringify(payload.data),
        retry: 3000, // Retry after 3 seconds if connection lost
      }),
    });

    if (!response.ok) {
      throw new Error(`Failed to send SSE to user ${userId}: ${response.statusText}`);
    }
  }

  async validateConfig(): Promise<boolean> {
    return !!(this.sseServerUrl && this.apiKey);
  }

  getProviderName(): string {
    return 'sse';
  }
}