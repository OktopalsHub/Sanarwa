import type { AxiosInstance, AxiosResponse } from "axios";

import type {
  BulkNotificationRequest,
  BulkNotificationResponse,
  NotificationRequest,
  NotificationResponse,
  TransportHealth,
  WhatsAppTemplateParameter,
} from "../types";
import { NotificationChannel } from "@sanarwa/shared-types";

export class WhatsAppComponent {
  constructor(private readonly client: AxiosInstance) {}

  async send(request: NotificationRequest): Promise<NotificationResponse> {
    const response: AxiosResponse<NotificationResponse> = await this.client.post(
      "/notifications/send",
      { ...request, channel: NotificationChannel.WHATSAPP },
    );
    return response.data;
  }

  async bulkSend(request: BulkNotificationRequest): Promise<BulkNotificationResponse> {
    const response: AxiosResponse<BulkNotificationResponse> = await this.client.post(
      "/notifications/send/bulk",
      {
        notifications: (request.notifications ?? []).map((n) => ({
          ...n,
          channel: NotificationChannel.WHATSAPP,
        })),
        batchId: request.batchId,
      },
    );
    return response.data;
  }

  async sendTemplate(params: {
    to: string;
    templateName: string;
    languageCode?: string;
    parameters?: WhatsAppTemplateParameter[];
  }): Promise<unknown> {
    const response: AxiosResponse<unknown> = await this.client.post("/whatsapp/messages/template", {
      to: params.to,
      templateName: params.templateName,
      languageCode: params.languageCode || "en",
      parameters: params.parameters,
    });
    return response.data;
  }

  async getStatus(notificationId: string): Promise<unknown> {
    const response: AxiosResponse<unknown> = await this.client.get(
      `/notifications/${notificationId}/status`,
    );
    return response.data;
  }

  async health(): Promise<TransportHealth> {
    const response: AxiosResponse<TransportHealth> = await this.client.get("/whatsapp/health");
    return response.data;
  }
}
