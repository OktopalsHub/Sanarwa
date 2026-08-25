import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { IInAppProvider, InAppPayload, InAppResponse } from "./in-app-provider.interface";
import { WebSocketProvider } from "./providers/websocket.provider";
import { SSEProvider } from "./providers/sse.provider";

@Injectable()
export class InAppOrchestratorService {
  private readonly logger = new Logger(InAppOrchestratorService.name);

  constructor(
    private configService: ConfigService,
    private webSocketProvider: WebSocketProvider,
    private sseProvider: SSEProvider,
  ) {}

  /**
   * Send in-app notification with automatic fallback
   * Primary: WebSocket (bidirectional, real-time)
   * Fallback: SSE (unidirectional, reliable)
   */
  async sendInAppNotification(payload: InAppPayload): Promise<InAppResponse> {
    try {
      // Try WebSocket first (primary provider)
      if (await this.webSocketProvider.validateConfig()) {
        this.logger.debug("Attempting to send in-app notification via WebSocket (primary)");
        const result = await this.webSocketProvider.sendNotification(payload);

        if (result.success) {
          this.logger.log(
            `In-app notification sent successfully via WebSocket: ${result.messageId}`,
          );
          return result;
        } else {
          this.logger.warn(`WebSocket failed: ${result.error}, falling back to SSE`);
        }
      } else {
        this.logger.debug("WebSocket not configured, using SSE fallback");
      }

      // Fallback to SSE
      const result = await this.sseProvider.sendNotification(payload);

      if (result.success) {
        this.logger.log(
          `In-app notification sent successfully via SSE (fallback): ${result.messageId}`,
        );
      } else {
        this.logger.error(`Both WebSocket and SSE failed for in-app notification`);
      }

      return result;
    } catch (error) {
      this.logger.error(`In-app notification failed: ${error.message}`, error.stack);
      return {
        success: false,
        error: error.message,
        provider: "in-app-orchestrator",
      };
    }
  }

  /**
   * Send to specific room (for group notifications)
   */
  async sendToRoom(roomId: string, payload: InAppPayload): Promise<InAppResponse> {
    try {
      // Try WebSocket first for room notifications
      if (await this.webSocketProvider.validateConfig()) {
        this.logger.debug(`Attempting to send room notification via WebSocket: ${roomId}`);
        const result = await this.webSocketProvider.sendToRoom(roomId, payload);

        if (result.success) {
          this.logger.log(`Room notification sent successfully via WebSocket: ${result.messageId}`);
          return result;
        } else {
          this.logger.warn(
            `WebSocket room notification failed: ${result.error}, falling back to SSE`,
          );
        }
      }

      // Fallback to SSE
      const result = await this.sseProvider.sendToRoom(roomId, payload);

      if (result.success) {
        this.logger.log(
          `Room notification sent successfully via SSE (fallback): ${result.messageId}`,
        );
      } else {
        this.logger.error(`Both WebSocket and SSE failed for room notification`);
      }

      return result;
    } catch (error) {
      this.logger.error(`Room notification failed: ${error.message}`, error.stack);
      return {
        success: false,
        error: error.message,
        provider: "in-app-orchestrator",
      };
    }
  }

  /**
   * Send system-wide announcement
   */
  async sendSystemAnnouncement(
    title: string,
    message: string,
    options?: {
      type?: InAppPayload["type"];
      priority?: InAppPayload["priority"];
      persistent?: boolean;
      data?: Record<string, any>;
    },
  ): Promise<InAppResponse> {
    try {
      // System announcements go to all connected users
      const result = await this.sendInAppNotification({
        userId: ["*"], // Special case for all users
        title,
        message,
        type: options?.type || "info",
        priority: options?.priority || "normal",
        persistent: options?.persistent || true,
        data: {
          ...options?.data,
          announcementType: "system_wide",
          timestamp: new Date().toISOString(),
        },
      });

      this.logger.log(`System announcement sent: ${result.messageId}`);
      return result;
    } catch (error) {
      this.logger.error(`System announcement failed: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Send user activity notification (online/offline, typing, etc.)
   */
  async sendActivityNotification(
    userId: string,
    activity: {
      type: "online" | "offline" | "typing" | "idle" | "away";
      roomId?: string;
      metadata?: Record<string, any>;
    },
  ): Promise<InAppResponse> {
    try {
      const result = await this.sendInAppNotification({
        userId: activity.roomId ? ["*"] : [userId], // Room-wide or user-specific
        title: "User Activity",
        message: `User ${userId} is ${activity.type}`,
        type: "info",
        priority: "low",
        persistent: false,
        data: {
          activityType: activity.type,
          userId,
          roomId: activity.roomId,
          ...activity.metadata,
          timestamp: new Date().toISOString(),
        },
        roomId: activity.roomId,
      });

      this.logger.debug(`Activity notification sent for user ${userId}: ${activity.type}`);
      return result;
    } catch (error) {
      this.logger.error(`Activity notification failed: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Send progress notification (file upload, processing, etc.)
   */
  async sendProgressNotification(
    userId: string,
    progress: {
      taskId: string;
      taskName: string;
      percentage: number;
      status: "started" | "in_progress" | "completed" | "failed";
      message?: string;
    },
  ): Promise<InAppResponse> {
    try {
      const result = await this.sendInAppNotification({
        userId,
        title: progress.taskName,
        message: progress.message || `${progress.status} - ${progress.percentage}%`,
        type:
          progress.status === "failed"
            ? "error"
            : progress.status === "completed"
              ? "success"
              : "info",
        priority: "normal",
        persistent: progress.status === "completed" || progress.status === "failed",
        data: {
          taskId: progress.taskId,
          taskName: progress.taskName,
          percentage: progress.percentage,
          status: progress.status,
          timestamp: new Date().toISOString(),
        },
      });

      this.logger.debug(
        `Progress notification sent for task ${progress.taskId}: ${progress.percentage}%`,
      );
      return result;
    } catch (error) {
      this.logger.error(`Progress notification failed: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Get provider status
   */
  async getProviderStatus(): Promise<{
    webSocket: { available: boolean; healthy?: boolean };
    sse: { available: boolean; healthy?: boolean };
    liveKit: { available: boolean; healthy?: boolean };
  }> {
    const status = {
      webSocket: { available: false, healthy: false },
      sse: { available: false, healthy: false },
      liveKit: { available: false, healthy: false },
    };

    try {
      status.webSocket.available = await this.webSocketProvider.validateConfig();
      if (status.webSocket.available) {
        status.webSocket.healthy = true; // Could add actual health check
      }
    } catch (error) {
      this.logger.warn(`WebSocket status check failed: ${error.message}`);
    }

    try {
      status.sse.available = await this.sseProvider.validateConfig();
      if (status.sse.available) {
        status.sse.healthy = true; // Could add actual health check
      }
    } catch (error) {
      this.logger.warn(`SSE status check failed: ${error.message}`);
    }

    // LiveKit status (mock for now)
    try {
      const liveKitApiKey = this.configService.get("LIVEKIT_API_KEY");
      status.liveKit.available = !!liveKitApiKey;
      status.liveKit.healthy = status.liveKit.available;
    } catch (error) {
      this.logger.warn(`LiveKit status check failed: ${error.message}`);
    }

    return status;
  }

  /**
   * Send batch notifications efficiently
   */
  async sendBatchNotifications(
    notifications: Array<{
      userId: string | string[];
      title: string;
      message: string;
      type?: InAppPayload["type"];
      priority?: InAppPayload["priority"];
      data?: Record<string, any>;
    }>,
  ): Promise<InAppResponse[]> {
    try {
      const results = await Promise.all(
        notifications.map((notification) =>
          this.sendInAppNotification({
            ...notification,
            persistent: false, // Batch notifications are typically not persistent
          }),
        ),
      );

      const successCount = results.filter((r) => r.success).length;
      this.logger.log(
        `Batch notifications sent: ${successCount}/${notifications.length} successful`,
      );

      return results;
    } catch (error) {
      this.logger.error(`Batch notifications failed: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Send call notification
   */
  async sendCallNotification(
    payload: InAppPayload & { callData: NonNullable<InAppPayload["callData"]> },
  ): Promise<InAppResponse> {
    try {
      return await this.sendInAppNotification(payload);
    } catch (error) {
      this.logger.error(`Call notification failed: ${error.message}`, error.stack);
      throw error;
    }
  }
}
