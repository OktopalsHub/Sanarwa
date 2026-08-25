import type { AxiosInstance, AxiosResponse } from "axios";
import type {
  BulkNotificationRequest,
  BulkNotificationResponse,
  ListNotificationsParams,
  NotificationRequest,
  NotificationResponse,
  PaginatedResponse,
} from "../types";

export class SmsComponent {
  constructor(private client: AxiosInstance) {}

  async send(request: NotificationRequest): Promise<NotificationResponse> {
    const response: AxiosResponse<NotificationResponse> = await this.client.post(
      "/notifications/send",
      {
        ...request,
        channel: "sms",
      },
    );
    return response.data;
  }

  async bulkSend(request: BulkNotificationRequest): Promise<BulkNotificationResponse> {
    const response: AxiosResponse<BulkNotificationResponse> = await this.client.post(
      "/notifications/send/bulk",
      {
        ...request,
        notifications: request.notifications?.map((n) => ({
          ...n,
          channel: "sms",
        })),
      },
    );
    return response.data;
  }

  async getHistory(
    params?: ListNotificationsParams,
  ): Promise<PaginatedResponse<NotificationResponse>> {
    const response: AxiosResponse<PaginatedResponse<NotificationResponse>> = await this.client.get(
      "/notifications",
      {
        params: { ...params, type: "sms" },
      },
    );
    return response.data;
  }
}
