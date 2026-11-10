import type { AxiosInstance, AxiosResponse } from "axios";

/**
 * The API channel vocabulary — a single source of truth shared across the
 * workspace (@sanarwa/shared-types). `TRANSPORT_CHANNELS` is kept as a
 * readable alias list for callers that want the full enumeration.
 */
export const TRANSPORT_CHANNELS = [
  "email",
  "sms",
  "push",
  "whatsapp",
  "webhook",
  "in_app",
  "voice",
  "chat",
] as const;

export { NotificationChannel } from "@sanarwa/shared-types";
import { NotificationChannel } from "@sanarwa/shared-types";
export type TransportChannel = NotificationChannel;

export interface TransportRecipient {
  id: string;
  email?: string;
  phone?: string;
  deviceToken?: string;
  whatsappNumber?: string;
  userId?: string;
  subscriberId?: string;
  metadata?: Record<string, unknown>;
}

export interface TransportSendRequest {
  to?: string;
  recipients?: TransportRecipient[];
  channel?: TransportChannel;
  channels?: TransportChannel[];
  data?: string;
  subject?: string;
  variables?: Record<string, unknown>;
  priority?: "low" | "normal" | "high" | "urgent";
  scheduledAt?: string;
  templateId?: string;
  brandId?: string;
  metadata?: Record<string, unknown>;
  webhookUrl?: string;
}

export interface UnifiedDeliverySummary {
  channel: TransportChannel;
  status: "queued" | "failed";
  error?: string;
}

export interface TransportSendResponse {
  messageId?: string;
  status: "queued" | "failed";
  deliveries: UnifiedDeliverySummary[];
}

export interface TransportAnalyticsParams {
  startDate?: string;
  endDate?: string;
  channel?: string;
}

export class TransportComponent {
  constructor(private readonly client: AxiosInstance) {}

  async send(request: TransportSendRequest): Promise<TransportSendResponse> {
    const response: AxiosResponse<TransportSendResponse> = await this.client.post(
      "/notifications/send",
      request,
    );
    return response.data;
  }

  async sendBulk(
    notifications: TransportSendRequest[],
    batchId?: string,
  ): Promise<{ batchId: string; status: string; results: TransportSendResponse[] }> {
    const response = await this.client.post("/notifications/send/bulk", {
      notifications,
      batchId,
    });
    return response.data;
  }

  async analytics(params?: TransportAnalyticsParams): Promise<unknown> {
    const response = await this.client.get("/notifications/analytics", { params });
    return response.data;
  }
}
