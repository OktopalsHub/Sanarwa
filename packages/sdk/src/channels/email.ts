import type { AxiosInstance, AxiosResponse } from "axios";
import type {
  BulkNotificationRequest,
  BulkNotificationResponse,
  ListNotificationsParams,
  NotificationRequest,
  NotificationResponse,
  PaginatedResponse,
} from "../types";

export class EmailComponent {
  constructor(private client: AxiosInstance) {}

  async send(request: NotificationRequest): Promise<NotificationResponse> {
    const response: AxiosResponse<NotificationResponse> = await this.client.post(
      "/notifications/send",
      {
        ...request,
        channel: "email",
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
          channel: "email",
        })),
      },
    );
    return response.data;
  }

  async getHistory(
    params?: ListNotificationsParams,
  ): Promise<PaginatedResponse<NotificationResponse>> {
    const response: AxiosResponse<PaginatedResponse<NotificationResponse>> = await this.client.get(
      "/notifications/analytics",
      {
        params: { ...params, channel: "email" },
      },
    );
    return response.data;
  }

  /**
   * Schedule an email for future delivery
   */
  async schedule(request: NotificationRequest, scheduledAt: string): Promise<NotificationResponse> {
    const response: AxiosResponse<NotificationResponse> = await this.client.post("/notifications", {
      ...request,
      type: "email",
      scheduledAt,
    });
    return response.data;
  }

  /**
   * Send recurring emails (daily, weekly, monthly)
   */
  async sendRecurring(
    request: NotificationRequest,
    schedule: {
      frequency: "daily" | "weekly" | "monthly";
      startDate: string;
      endDate?: string;
      timezone?: string;
    },
  ): Promise<NotificationResponse> {
    const response: AxiosResponse<NotificationResponse> = await this.client.post(
      "/notifications/recurring",
      {
        ...request,
        type: "email",
        schedule,
      },
    );
    return response.data;
  }

  /**
   * Send A/B test emails
   */
  async sendABTest(variants: {
    templateA: string;
    templateB: string;
    splitPercentage: number; // 0-100, percentage for variant A
    recipients: any[];
    data?: Record<string, any>;
  }): Promise<NotificationResponse> {
    const response: AxiosResponse<NotificationResponse> = await this.client.post(
      "/notifications/ab-test",
      {
        type: "email",
        ...variants,
      },
    );
    return response.data;
  }

  /**
   * Send email with raw HTML content (no template)
   */
  async sendRaw(params: {
    to: string;
    subject: string;
    html: string;
    text?: string;
  }): Promise<NotificationResponse> {
    const response: AxiosResponse<NotificationResponse> = await this.client.post("/notifications", {
      to: params.to,
      subject: params.subject,
      html: params.html,
      message: params.text,
      channel: "email",
    });
    return response.data;
  }
}
