import type { AxiosInstance, AxiosResponse } from "axios";
import type { BulkNotificationResponse, NotificationResponse } from "../types";

export class WhatsAppComponent {
  constructor(private client: AxiosInstance) {}

  /**
   * Send WhatsApp message
   */
  async send(params: {
    to: string; // Phone number (with country code)
    message: string;
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
        templateId: params.templateId,
        templateData: params.templateData,
        data: params.data,
        priority: params.priority,
        channel: "whatsapp",
      },
    );
    return response.data;
  }

  /**
   * Send bulk WhatsApp messages
   */
  async bulkSend(
    notifications: Array<{
      to: string; // Phone number (with country code)
      message: string;
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
          channel: "whatsapp",
        })),
      },
    );
    return response.data;
  }

  /**
   * Send WhatsApp template message
   */
  async sendTemplate(params: {
    to: string; // Phone number (with country code)
    template: string; // Template name
    data?: Record<string, any>; // Template variables
    priority?: "low" | "normal" | "high" | "urgent";
    metadata?: Record<string, any>;
  }): Promise<NotificationResponse> {
    const response: AxiosResponse<NotificationResponse> = await this.client.post("/notifications", {
      ...params,
      channel: "whatsapp",
    });
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
