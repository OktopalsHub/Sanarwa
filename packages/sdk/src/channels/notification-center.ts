import type { AxiosInstance, AxiosResponse } from "axios";

export class NotificationCenterComponent {
  constructor(private client: AxiosInstance) {}

  /**
   * Get notification feed
   */
  async getFeed(params?: {
    subscriberId?: string;
    page?: number;
    limit?: number;
    status?: "unread" | "read" | "archived";
  }): Promise<any> {
    const response: AxiosResponse<any> = await this.client.get("/notifications/center/feed", {
      params,
    });
    return response.data;
  }

  /**
   * Get notification by ID
   */
  async getNotification(id: string): Promise<any> {
    const response: AxiosResponse<any> = await this.client.get(`/notifications/center/${id}`);
    return response.data;
  }

  /**
   * Mark notification as read
   */
  async markAsRead(id: string): Promise<any> {
    const response: AxiosResponse<any> = await this.client.patch(
      `/notifications/center/${id}/read`,
    );
    return response.data;
  }

  /**
   * Mark multiple notifications as read
   */
  async markMultipleAsRead(ids: string[]): Promise<void> {
    await this.client.post("/notifications/center/bulk/read", { ids });
  }

  /**
   * Mark all notifications as read
   */
  async markAllAsRead(subscriberId: string): Promise<void> {
    await this.client.post(`/notifications/center/${subscriberId}/read-all`);
  }

  /**
   * Archive notification
   */
  async archiveNotification(id: string): Promise<any> {
    const response: AxiosResponse<any> = await this.client.patch(
      `/notifications/center/${id}/archive`,
    );
    return response.data;
  }

  /**
   * Archive multiple notifications
   */
  async archiveMultiple(ids: string[]): Promise<void> {
    await this.client.post("/notifications/center/bulk/archive", { ids });
  }

  /**
   * Delete notification
   */
  async deleteNotification(id: string): Promise<void> {
    await this.client.delete(`/notifications/center/${id}`);
  }

  /**
   * Delete multiple notifications
   */
  async deleteMultiple(ids: string[]): Promise<void> {
    await this.client.post("/notifications/center/bulk/delete", { ids });
  }

  /**
   * Get notification center statistics
   */
  async getStats(subscriberId: string): Promise<any> {
    const response: AxiosResponse<any> = await this.client.get(
      `/notifications/center/stats/${subscriberId}`,
    );
    return response.data;
  }

  /**
   * Get unread count
   */
  async getUnreadCount(subscriberId: string): Promise<any> {
    const response: AxiosResponse<any> = await this.client.get(
      `/notifications/center/unread/${subscriberId}`,
    );
    return response.data;
  }

  /**
   * Search notifications
   */
  async search(params: {
    subscriberId: string;
    query: string;
    page?: number;
    limit?: number;
  }): Promise<any> {
    const response: AxiosResponse<any> = await this.client.get(
      `/notifications/center/search/${params.subscriberId}`,
      { params: { q: params.query, page: params.page, limit: params.limit } },
    );
    return response.data;
  }

  /**
   * Get notifications by channel
   */
  async getByChannel(params: {
    subscriberId: string;
    channel: string;
    page?: number;
    limit?: number;
  }): Promise<any> {
    const response: AxiosResponse<any> = await this.client.get(
      `/notifications/center/channel/${params.subscriberId}/${params.channel}`,
      { params: { page: params.page, limit: params.limit } },
    );
    return response.data;
  }
}
