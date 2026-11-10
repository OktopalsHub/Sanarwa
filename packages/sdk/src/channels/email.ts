import type { AxiosInstance, AxiosResponse } from "axios";

import type {
  BulkNotificationRequest,
  BulkNotificationResponse,
  NotificationRequest,
  NotificationResponse,
} from "../types";
import { NotificationChannel } from "@sanarwa/shared-types";

export class EmailComponent {
  constructor(private readonly client: AxiosInstance) {}

  async send(request: NotificationRequest): Promise<NotificationResponse> {
    const response: AxiosResponse<NotificationResponse> = await this.client.post(
      "/notifications/send",
      { ...request, channel: NotificationChannel.EMAIL },
    );
    return response.data;
  }

  async bulkSend(request: BulkNotificationRequest): Promise<BulkNotificationResponse> {
    const response: AxiosResponse<BulkNotificationResponse> = await this.client.post(
      "/notifications/send/bulk",
      {
        notifications: (request.notifications ?? []).map((n) => ({
          ...n,
          channel: NotificationChannel.EMAIL,
        })),
        batchId: request.batchId,
      },
    );
    return response.data;
  }

  async schedule(request: NotificationRequest, scheduledAt: string): Promise<NotificationResponse> {
    return this.send({ ...request, scheduledAt });
  }

  async sendRaw(params: {
    to: string;
    html: string;
    subject?: string;
    data?: Record<string, unknown>;
  }): Promise<NotificationResponse> {
    return this.send({
      to: params.to,
      channel: NotificationChannel.EMAIL,
      data: params.html,
      variables: params.data,
    });
  }
}
