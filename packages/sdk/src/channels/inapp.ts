import type { AxiosInstance, AxiosResponse } from "axios";
import type { BulkNotificationResponse, NotificationResponse } from "../types";

export class InAppComponent {
  constructor(private client: AxiosInstance) {}

  /**
   * Send in-app notification to a specific user
   */
  async send(params: {
    to: string; // User ID
    message: string;
    title?: string;
    templateId?: string;
    templateData?: Record<string, any>;
    data?: Record<string, any>;
    priority?: "low" | "normal" | "high";
  }): Promise<NotificationResponse> {
    const response: AxiosResponse<NotificationResponse> = await this.client.post(
      "/notifications/send",
      {
        to: params.to,
        message: params.message,
        title: params.title,
        templateId: params.templateId,
        templateData: params.templateData,
        data: params.data,
        priority: params.priority,
        channel: "in_app", // In-app notifications use WebSocket/SSE for real-time delivery
      },
    );
    return response.data;
  }

  /**
   * Send bulk in-app notifications
   */
  async bulkSend(
    notifications: Array<{
      to: string; // User ID
      message: string;
      subject?: string;
      template?: string;
      data?: Record<string, any>;
      priority?: "low" | "normal" | "high" | "urgent";
      metadata?: Record<string, any>;
    }>,
  ): Promise<BulkNotificationResponse> {
    const response: AxiosResponse<BulkNotificationResponse> = await this.client.post(
      "/notifications/bulk",
      {
        notifications: notifications.map((notification) => ({
          ...notification,
          channel: "in_app",
        })),
      },
    );
    return response.data;
  }

  /**
   * Get notification status
   */
  async getStatus(notificationId: string): Promise<any> {
    const response: AxiosResponse<any> = await this.client.get(
      `/notifications/${notificationId}/status`,
    );
    return response.data;
  }
}
