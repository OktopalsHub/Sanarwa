import axios, { AxiosInstance, AxiosResponse } from "axios";
import {
  ApiError,
  BulkNotificationResponse,
  ListNotificationsParams,
  NotificationRequest,
  NotificationResponse,
  PaginatedResponse,
  RecurringSchedule,
} from "./types";
import { AnalyticsComponent } from "./channels/analytics";
import { EmailComponent } from "./channels/email";
import { InAppComponent } from "./channels/inapp";
import { NotificationCenterComponent } from "./channels/notification-center";
import { PushComponent } from "./channels/push";
import { SmsComponent } from "./channels/sms";
import { TemplateComponent } from "./channels/templates";
import { VoiceComponent } from "./channels/voice";
import { WhatsAppComponent } from "./channels/whatsapp";
export class Sanarwa {
  private client: AxiosInstance;

  // Component instances
  public readonly email: EmailComponent;
  public readonly sms: SmsComponent;
  public readonly voice: VoiceComponent;
  public readonly inapp: InAppComponent;
  public readonly push: PushComponent;
  public readonly whatsapp: WhatsAppComponent;
  public readonly analytics: AnalyticsComponent;
  public readonly templates: TemplateComponent;
  public readonly notificationCenter: NotificationCenterComponent;

  constructor(config: string | { key: string; baseUrl?: string; timeout?: number }) {
    // Support both string (just API key) and object config
    const apiKey = typeof config === "string" ? config : config.key;
    const baseUrl =
      typeof config === "string"
        ? "https://api.sanarwa.com/v1"
        : config.baseUrl || "https://api.sanarwa.com/v1";
    const timeout = typeof config === "string" ? 30000 : config.timeout || 30000;

    this.client = axios.create({
      baseURL: baseUrl,
      timeout: timeout,
      headers: {
        "X-API-Key": apiKey,
        "Content-Type": "application/json",
        "User-Agent": "sanarwa-sdk@0.2.0",
      },
    });

    // Response interceptor for error handling
    this.client.interceptors.response.use(
      (response) => response,
      (error) => {
        if (error.response?.data) {
          const apiError: ApiError = error.response.data;
          throw new Error(`${apiError.error}: ${apiError.message}`);
        }
        throw error;
      },
    );

    // Initialize components
    this.email = new EmailComponent(this.client);
    this.sms = new SmsComponent(this.client);
    this.voice = new VoiceComponent(this.client);
    this.inapp = new InAppComponent(this.client);
    this.push = new PushComponent(this.client);
    this.whatsapp = new WhatsAppComponent(this.client);
    this.analytics = new AnalyticsComponent(this.client);
    this.templates = new TemplateComponent(this.client);
    this.notificationCenter = new NotificationCenterComponent(this.client);
  }

  /**
   * Get the current status of a notification by tracking ID
   */
  async getNotificationStatus(trackingId: string): Promise<any> {
    const response: AxiosResponse<any> = await this.client.get(
      `/notifications/status/${trackingId}`,
    );
    return response.data;
  }

  /**
   * Schedule a notification for future delivery
   */
  async scheduleNotification(
    request: NotificationRequest,
    scheduledAt: string,
  ): Promise<NotificationResponse> {
    const scheduledRequest = { ...request, scheduledAt };
    const response: AxiosResponse<NotificationResponse> = await this.client.post(
      "/notifications",
      scheduledRequest,
    );
    return response.data;
  }

  /**
   * Cancel a scheduled notification
   */
  async cancelScheduledNotification(id: string): Promise<void> {
    await this.client.post(`/notifications/${id}/cancel`);
  }

  /**
   * Update a scheduled notification (before it's sent)
   */
  async updateScheduledNotification(
    id: string,
    updates: Partial<NotificationRequest>,
  ): Promise<NotificationResponse> {
    const response: AxiosResponse<NotificationResponse> = await this.client.patch(
      `/notifications/${id}`,
      updates,
    );
    return response.data;
  }

  /**
   * Get scheduled notifications
   */
  async getScheduledNotifications(
    params?: ListNotificationsParams,
  ): Promise<PaginatedResponse<NotificationResponse>> {
    const response: AxiosResponse<PaginatedResponse<NotificationResponse>> = await this.client.get(
      "/notifications/scheduled",
      {
        params,
      },
    );
    return response.data;
  }

  /**
   * Create a recurring notification schedule
   */
  async createRecurringSchedule(
    request: NotificationRequest,
    schedule: RecurringSchedule,
  ): Promise<{ scheduleId: string }> {
    const response: AxiosResponse<{ scheduleId: string }> = await this.client.post(
      "/schedules/recurring",
      {
        notification: request,
        schedule,
      },
    );
    return response.data;
  }

  /**
   * Pause/Resume a recurring schedule
   */
  async pauseRecurringSchedule(scheduleId: string): Promise<void> {
    await this.client.post(`/schedules/recurring/${scheduleId}/pause`);
  }

  async resumeRecurringSchedule(scheduleId: string): Promise<void> {
    await this.client.post(`/schedules/recurring/${scheduleId}/resume`);
  }

  /**
   * Pause/resume notifications by tag or tracking ID
   */
  async pauseNotifications(filter: { tag?: string; trackingId?: string }): Promise<void> {
    await this.client.post("/notifications/pause", filter);
  }

  async resumeNotifications(filter: { tag?: string; trackingId?: string }): Promise<void> {
    await this.client.post("/notifications/resume", filter);
  }

  /**
   * Get notification delivery timeline
   */
  async getDeliveryTimeline(id: string): Promise<any[]> {
    const response: AxiosResponse<any[]> = await this.client.get(`/notifications/${id}/timeline`);
    return response.data;
  }

  /**
   * Bulk operations management
   */
  async getBulkOperationStatus(batchId: string): Promise<BulkNotificationResponse> {
    const response: AxiosResponse<BulkNotificationResponse> = await this.client.get(
      `/notifications/bulk/${batchId}`,
    );
    return response.data;
  }

  async cancelBulkOperation(batchId: string): Promise<void> {
    await this.client.post(`/notifications/bulk/${batchId}/cancel`);
  }
}
