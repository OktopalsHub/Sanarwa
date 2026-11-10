import type { AxiosInstance, AxiosResponse } from "axios";

import type {
  BulkNotificationRequest,
  BulkNotificationResponse,
  NotificationRequest,
  NotificationResponse,
} from "../types";
import { NotificationChannel } from "@sanarwa/shared-types";

export class PushComponent {
  constructor(private readonly client: AxiosInstance) {}

  async send(request: NotificationRequest): Promise<NotificationResponse> {
    const response: AxiosResponse<NotificationResponse> = await this.client.post(
      "/notifications/send",
      { ...request, channel: NotificationChannel.PUSH },
    );
    return response.data;
  }

  async bulkSend(request: BulkNotificationRequest): Promise<BulkNotificationResponse> {
    const response: AxiosResponse<BulkNotificationResponse> = await this.client.post(
      "/notifications/send/bulk",
      {
        notifications: (request.notifications ?? []).map((n) => ({
          ...n,
          channel: NotificationChannel.PUSH,
        })),
        batchId: request.batchId,
      },
    );
    return response.data;
  }

  async getStatus(notificationId: string): Promise<unknown> {
    const response: AxiosResponse<unknown> = await this.client.get(
      `/notifications/${notificationId}/status`,
    );
    return response.data;
  }
}
