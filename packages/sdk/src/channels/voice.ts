import type { AxiosInstance, AxiosResponse } from "axios";
import type {
  ListNotificationsParams,
  NotificationRequest,
  NotificationResponse,
  PaginatedResponse,
} from "../types";

export class VoiceComponent {
  constructor(private client: AxiosInstance) {}

  async send(request: NotificationRequest): Promise<NotificationResponse> {
    const response: AxiosResponse<NotificationResponse> = await this.client.post("/notifications", {
      ...request,
      type: "voice",
    });
    return response.data;
  }

  async getHistory(
    params?: ListNotificationsParams,
  ): Promise<PaginatedResponse<NotificationResponse>> {
    const response: AxiosResponse<PaginatedResponse<NotificationResponse>> = await this.client.get(
      "/notifications",
      {
        params: { ...params, type: "voice" },
      },
    );
    return response.data;
  }
}
