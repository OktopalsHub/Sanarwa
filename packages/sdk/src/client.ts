import axios, { AxiosInstance, AxiosResponse } from "axios";

import {
  ApiError,
  BulkNotificationResponse,
  NotificationRequest,
  NotificationResponse,
  TransportHealth,
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
import { TransportComponent } from "./transport";

const DEFAULT_BASE_URL = "https://api.sanarwa.com/api/v1";

export class Sanarwa {
  private client: AxiosInstance;

  public readonly email: EmailComponent;
  public readonly sms: SmsComponent;
  public readonly voice: VoiceComponent;
  public readonly inapp: InAppComponent;
  public readonly push: PushComponent;
  public readonly whatsapp: WhatsAppComponent;
  public readonly analytics: AnalyticsComponent;
  public readonly templates: TemplateComponent;
  public readonly notificationCenter: NotificationCenterComponent;
  public readonly transport: TransportComponent;

  constructor(config: string | { key: string; baseUrl?: string; timeout?: number }) {
    const apiKey = typeof config === "string" ? config : config.key;
    const baseUrl =
      typeof config === "string" ? DEFAULT_BASE_URL : config.baseUrl || DEFAULT_BASE_URL;
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

    this.email = new EmailComponent(this.client);
    this.sms = new SmsComponent(this.client);
    this.voice = new VoiceComponent(this.client);
    this.inapp = new InAppComponent(this.client);
    this.push = new PushComponent(this.client);
    this.whatsapp = new WhatsAppComponent(this.client);
    this.analytics = new AnalyticsComponent(this.client);
    this.templates = new TemplateComponent(this.client);
    this.notificationCenter = new NotificationCenterComponent(this.client);
    this.transport = new TransportComponent(this.client);
  }

  async sendNotification(request: NotificationRequest): Promise<NotificationResponse> {
    return this.transport.send(request);
  }

  async sendBulk(
    notifications: NotificationRequest[],
    batchId?: string,
  ): Promise<BulkNotificationResponse> {
    return this.transport.sendBulk(notifications, batchId);
  }

  async getNotificationStatus(trackingId: string): Promise<unknown> {
    const response: AxiosResponse<unknown> = await this.client.get(
      `/notifications/status/${trackingId}`,
    );
    return response.data;
  }

  async getHealth(): Promise<TransportHealth> {
    const response: AxiosResponse<TransportHealth> = await this.client.get("/notifications/health");
    return response.data;
  }

  async getDeliveryTimeline(messageId: string): Promise<unknown> {
    const response: AxiosResponse<unknown> = await this.client.get(
      `/messaging/${messageId}/deliveries`,
    );
    return response.data;
  }

  async getMessageStatus(messageId: string): Promise<unknown> {
    const response: AxiosResponse<unknown> = await this.client.get(
      `/messaging/${messageId}/status`,
    );
    return response.data;
  }

  async getDeliveryStats(params?: { startDate?: string; endDate?: string }): Promise<unknown> {
    const response: AxiosResponse<unknown> = await this.client.get("/messaging/stats/delivery", {
      params,
    });
    return response.data;
  }
}
