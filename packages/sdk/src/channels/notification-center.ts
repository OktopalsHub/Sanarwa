import type { AxiosInstance, AxiosResponse } from "axios";

import type { NotificationCenterItem, PaginatedResponse } from "../types";

/**
 * The notification centre lives under `/tenants/{tenantId}/notifications/center`,
 * so every method needs the tenant id. The API key alone is not enough.
 */
export class NotificationCenterComponent {
  constructor(private readonly client: AxiosInstance) {}

  private base(tenantId: string): string {
    return `/tenants/${tenantId}/notifications/center`;
  }

  async getFeed(
    tenantId: string,
    subscriberId: string,
    params?: { page?: number; limit?: number; status?: string },
  ): Promise<PaginatedResponse<NotificationCenterItem>> {
    const response: AxiosResponse<PaginatedResponse<NotificationCenterItem>> =
      await this.client.get(`${this.base(tenantId)}/feed/${subscriberId}`, { params });
    return response.data;
  }

  async getNotification(tenantId: string, id: string): Promise<NotificationCenterItem> {
    const response: AxiosResponse<NotificationCenterItem> = await this.client.get(
      `${this.base(tenantId)}/${id}`,
    );
    return response.data;
  }

  async markAsRead(tenantId: string, id: string): Promise<unknown> {
    const response: AxiosResponse<unknown> = await this.client.patch(
      `${this.base(tenantId)}/${id}/read`,
    );
    return response.data;
  }

  async markMultipleAsRead(tenantId: string, ids: string[]): Promise<void> {
    await this.client.post(`${this.base(tenantId)}/bulk/read`, { ids });
  }

  async markAllAsRead(tenantId: string, subscriberId: string): Promise<unknown> {
    const response: AxiosResponse<unknown> = await this.client.post(
      `${this.base(tenantId)}/${subscriberId}/read-all`,
    );
    return response.data;
  }

  async archiveNotification(tenantId: string, id: string): Promise<unknown> {
    const response: AxiosResponse<unknown> = await this.client.patch(
      `${this.base(tenantId)}/${id}/archive`,
    );
    return response.data;
  }

  async archiveMultiple(tenantId: string, ids: string[]): Promise<void> {
    await this.client.post(`${this.base(tenantId)}/bulk/archive`, { ids });
  }

  async deleteNotification(tenantId: string, id: string): Promise<void> {
    await this.client.delete(`${this.base(tenantId)}/${id}`);
  }

  async deleteMultiple(tenantId: string, ids: string[]): Promise<void> {
    await this.client.post(`${this.base(tenantId)}/bulk/delete`, { ids });
  }

  async getStats(tenantId: string, subscriberId: string): Promise<unknown> {
    const response: AxiosResponse<unknown> = await this.client.get(
      `${this.base(tenantId)}/stats/${subscriberId}`,
    );
    return response.data;
  }

  async getUnreadCount(tenantId: string, subscriberId: string): Promise<unknown> {
    const response: AxiosResponse<unknown> = await this.client.get(
      `${this.base(tenantId)}/unread/${subscriberId}`,
    );
    return response.data;
  }

  async search(
    tenantId: string,
    subscriberId: string,
    query: string,
    params?: { page?: number; limit?: number },
  ): Promise<unknown> {
    const response: AxiosResponse<unknown> = await this.client.get(
      `${this.base(tenantId)}/search/${subscriberId}`,
      { params: { ...params, q: query } },
    );
    return response.data;
  }

  async getByChannel(
    tenantId: string,
    subscriberId: string,
    channel: string,
    params?: { page?: number; limit?: number },
  ): Promise<unknown> {
    const response: AxiosResponse<unknown> = await this.client.get(
      `${this.base(tenantId)}/channel/${subscriberId}/${channel}`,
      { params },
    );
    return response.data;
  }
}
