import { apiClient } from "./client";

export interface MessageLogListParams {
  page?: number;
  limit?: number;
  channel?: string;
  status?: string;
  projectId?: string;
  q?: string;
  startDate?: string;
  endDate?: string;
}

export interface MessageLogListItem {
  id: string;
  trackingId: string;
  channel: string;
  to: string;
  status: string;
  projectId: string;
  messageId?: string;
  subject?: string | null;
  hasContent: boolean;
  error?: string;
  createdAt: string;
  sentAt?: string;
  deliveredAt?: string;
}

export interface MessageLogEvent {
  type: string;
  at: string;
  error?: string;
  detail?: unknown;
}

export interface MessageLogDetail extends MessageLogListItem {
  failedAt?: string;
  scheduledAt?: string;
  content?: string | null;
  events: MessageLogEvent[];
  deliveries: Array<{
    id: string;
    channel: string;
    recipient: string;
    status: string;
    providerId?: string;
    providerMessageId?: string;
    providerResponse?: unknown;
    errorMessage?: string;
    sentAt?: string;
    deliveredAt?: string;
    openedAt?: string;
    clickedAt?: string;
  }>;
}

export interface MessageLogListResponse {
  records: MessageLogListItem[];
  totalItems: number;
  page: number;
  limit: number;
  pageCount: number;
}

export interface DeliveryStats {
  total: number;
  sent: number;
  delivered: number;
  failed: number;
  queued: number;
  deliveryRate: number;
}

export const messagingApi = {
  async list(params: MessageLogListParams = {}): Promise<MessageLogListResponse> {
    return apiClient.get<MessageLogListResponse>("/messaging", params);
  },

  async get(id: string): Promise<MessageLogDetail> {
    return apiClient.get<MessageLogDetail>(`/messaging/${id}`);
  },

  async stats(params?: { startDate?: string; endDate?: string }): Promise<DeliveryStats> {
    return apiClient.get<DeliveryStats>("/messaging/stats/delivery", params);
  },
};
