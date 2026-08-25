import { apiClient } from "./client";

export interface WebhookRecord {
  id: string;
  name?: string;
  url: string;
  events: string[];
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateWebhookRequest {
  name?: string;
  url: string;
  secret?: string;
  events: string[];
  active?: boolean;
}

export const webhookApi = {
  async list(): Promise<WebhookRecord[]> {
    return apiClient.get<WebhookRecord[]>("/tenants/:tenantId/webhooks");
  },

  async create(data: CreateWebhookRequest): Promise<WebhookRecord> {
    return apiClient.post<WebhookRecord>("/tenants/:tenantId/webhooks", data);
  },

  async update(id: string, data: Partial<CreateWebhookRequest>): Promise<WebhookRecord> {
    return apiClient.patch<WebhookRecord>(`/tenants/:tenantId/webhooks/${id}`, data);
  },

  async remove(id: string): Promise<void> {
    return apiClient.delete(`/tenants/:tenantId/webhooks/${id}`);
  },
};
