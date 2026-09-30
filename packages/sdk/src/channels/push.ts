import type { AxiosInstance, AxiosResponse } from "axios";
import type { BulkNotificationResponse, NotificationResponse } from "../types";

export class PushComponent {
  constructor(private client: AxiosInstance) {}

  /**
   * Send push notification to a device
   */
  async send(params: {
    to: string; // Device token or user ID
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
        channel: "push",
      },
    );
    return response.data;
  }

  /**
   * Send bulk push notifications
   */
  async bulkSend(
    notifications: Array<{
      to: string; // Device token
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
          channel: "push",
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
