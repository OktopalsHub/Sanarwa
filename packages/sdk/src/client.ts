import axios, { AxiosInstance, AxiosResponse } from 'axios';
import {
  ApiError,
  BulkNotificationRequest,
  BulkNotificationResponse,
  ListNotificationsParams,
  NotificationRequest,
  NotificationResponse,
  PaginatedResponse,
  RecurringSchedule,
} from './types';

// Component classes for different notification types
class EmailComponent {
  constructor(private client: AxiosInstance) {}

  async send(request: NotificationRequest): Promise<NotificationResponse> {
    const response: AxiosResponse<NotificationResponse> =
      await this.client.post('/notifications/send', {
        ...request,
        channel: 'email',
      });
    return response.data;
  }

  async bulkSend(
    request: BulkNotificationRequest,
  ): Promise<BulkNotificationResponse> {
    const response: AxiosResponse<BulkNotificationResponse> =
      await this.client.post('/notifications/send/bulk', {
        ...request,
        notifications: request.notifications?.map((n) => ({
          ...n,
          channel: 'email',
        })),
      });
    return response.data;
  }

  async getHistory(
    params?: ListNotificationsParams,
  ): Promise<PaginatedResponse<NotificationResponse>> {
    const response: AxiosResponse<PaginatedResponse<NotificationResponse>> =
      await this.client.get('/notifications/analytics', {
        params: { ...params, channel: 'email' },
      });
    return response.data;
  }

  /**
   * Schedule an email for future delivery
   */
  async schedule(
    request: NotificationRequest,
    scheduledAt: string,
  ): Promise<NotificationResponse> {
    const response: AxiosResponse<NotificationResponse> =
      await this.client.post('/notifications', {
        ...request,
        type: 'email',
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
      frequency: 'daily' | 'weekly' | 'monthly';
      startDate: string;
      endDate?: string;
      timezone?: string;
    },
  ): Promise<NotificationResponse> {
    const response: AxiosResponse<NotificationResponse> =
      await this.client.post('/notifications/recurring', {
        ...request,
        type: 'email',
        schedule,
      });
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
    const response: AxiosResponse<NotificationResponse> =
      await this.client.post('/notifications/ab-test', {
        type: 'email',
        ...variants,
      });
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
    const response: AxiosResponse<NotificationResponse> =
      await this.client.post('/notifications', {
        to: params.to,
        subject: params.subject,
        html: params.html,
        message: params.text,
        channel: 'email',
      });
    return response.data;
  }
}

class SmsComponent {
  constructor(private client: AxiosInstance) {}

  async send(request: NotificationRequest): Promise<NotificationResponse> {
    const response: AxiosResponse<NotificationResponse> =
      await this.client.post('/notifications/send', {
        ...request,
        channel: 'sms',
      });
    return response.data;
  }

  async bulkSend(
    request: BulkNotificationRequest,
  ): Promise<BulkNotificationResponse> {
    const response: AxiosResponse<BulkNotificationResponse> =
      await this.client.post('/notifications/send/bulk', {
        ...request,
        notifications: request.notifications?.map((n) => ({
          ...n,
          channel: 'sms',
        })),
      });
    return response.data;
  }

  async getHistory(
    params?: ListNotificationsParams,
  ): Promise<PaginatedResponse<NotificationResponse>> {
    const response: AxiosResponse<PaginatedResponse<NotificationResponse>> =
      await this.client.get('/notifications', {
        params: { ...params, type: 'sms' },
      });
    return response.data;
  }
}

class VoiceComponent {
  constructor(private client: AxiosInstance) {}

  async send(request: NotificationRequest): Promise<NotificationResponse> {
    const response: AxiosResponse<NotificationResponse> =
      await this.client.post('/notifications', {
        ...request,
        type: 'voice',
      });
    return response.data;
  }

  async getHistory(
    params?: ListNotificationsParams,
  ): Promise<PaginatedResponse<NotificationResponse>> {
    const response: AxiosResponse<PaginatedResponse<NotificationResponse>> =
      await this.client.get('/notifications', {
        params: { ...params, type: 'voice' },
      });
    return response.data;
  }
}

class InAppComponent {
  constructor(private client: AxiosInstance) {}

  /**
   * Send in-app notification to a specific user
   */
  async send(params: {
    to: string; // User ID
    message: string;
    title?: string;
    templateId?: string;
    templateData?: Record<string, any>;
    data?: Record<string, any>;
    priority?: 'low' | 'normal' | 'high';
  }): Promise<NotificationResponse> {
    const response: AxiosResponse<NotificationResponse> =
      await this.client.post('/notifications/send', {
        to: params.to,
        message: params.message,
        title: params.title,
        templateId: params.templateId,
        templateData: params.templateData,
        data: params.data,
        priority: params.priority,
        channel: 'in_app', // In-app notifications use WebSocket/SSE for real-time delivery
      });
    return response.data;
  }

  /**
   * Send bulk in-app notifications
   */
  async bulkSend(
    notifications: Array<{
      to: string; // User ID
      message: string;
      subject?: string;
      template?: string;
      data?: Record<string, any>;
      priority?: 'low' | 'normal' | 'high' | 'urgent';
      metadata?: Record<string, any>;
    }>,
  ): Promise<BulkNotificationResponse> {
    const response: AxiosResponse<BulkNotificationResponse> =
      await this.client.post('/notifications/bulk', {
        notifications: notifications.map((notification) => ({
          ...notification,
          channel: 'in_app',
        })),
      });
    return response.data;
  }

  /**
   * Get notification status
   */
  async getStatus(notificationId: string): Promise<any> {
    const response: AxiosResponse<any> = await this.client.get(
      `/notifications/${notificationId}/status`,
    );
    return response.data;
  }
}

class PushComponent {
  constructor(private client: AxiosInstance) {}

  /**
   * Send push notification to a device
   */
  async send(params: {
    to: string; // Device token or user ID
    message: string;
    title?: string;
    templateId?: string;
    templateData?: Record<string, any>;
    data?: Record<string, any>;
    priority?: 'low' | 'normal' | 'high';
  }): Promise<NotificationResponse> {
    const response: AxiosResponse<NotificationResponse> =
      await this.client.post('/notifications/send', {
        to: params.to,
        message: params.message,
        title: params.title,
        templateId: params.templateId,
        templateData: params.templateData,
        data: params.data,
        priority: params.priority,
        channel: 'push',
      });
    return response.data;
  }

  /**
   * Send bulk push notifications
   */
  async bulkSend(
    notifications: Array<{
      to: string; // Device token
      message: string;
      subject?: string;
      template?: string;
      data?: Record<string, any>;
      priority?: 'low' | 'normal' | 'high' | 'urgent';
      metadata?: Record<string, any>;
    }>,
  ): Promise<BulkNotificationResponse> {
    const response: AxiosResponse<BulkNotificationResponse> =
      await this.client.post('/notifications/bulk', {
        notifications: notifications.map((notification) => ({
          ...notification,
          channel: 'push',
        })),
      });
    return response.data;
  }

  /**
   * Get notification status
   */
  async getStatus(notificationId: string): Promise<any> {
    const response: AxiosResponse<any> = await this.client.get(
      `/notifications/${notificationId}/status`,
    );
    return response.data;
  }
}

class WhatsAppComponent {
  constructor(private client: AxiosInstance) {}

  /**
   * Send WhatsApp message
   */
  async send(params: {
    to: string; // Phone number (with country code)
    message: string;
    templateId?: string;
    templateData?: Record<string, any>;
    data?: Record<string, any>;
    priority?: 'low' | 'normal' | 'high';
  }): Promise<NotificationResponse> {
    const response: AxiosResponse<NotificationResponse> =
      await this.client.post('/notifications/send', {
        to: params.to,
        message: params.message,
        templateId: params.templateId,
        templateData: params.templateData,
        data: params.data,
        priority: params.priority,
        channel: 'whatsapp',
      });
    return response.data;
  }

  /**
   * Send bulk WhatsApp messages
   */
  async bulkSend(
    notifications: Array<{
      to: string; // Phone number (with country code)
      message: string;
      template?: string;
      data?: Record<string, any>;
      priority?: 'low' | 'normal' | 'high' | 'urgent';
      metadata?: Record<string, any>;
    }>,
  ): Promise<BulkNotificationResponse> {
    const response: AxiosResponse<BulkNotificationResponse> =
      await this.client.post('/notifications/bulk', {
        notifications: notifications.map((notification) => ({
          ...notification,
          channel: 'whatsapp',
        })),
      });
    return response.data;
  }

  /**
   * Send WhatsApp template message
   */
  async sendTemplate(params: {
    to: string; // Phone number (with country code)
    template: string; // Template name
    data?: Record<string, any>; // Template variables
    priority?: 'low' | 'normal' | 'high' | 'urgent';
    metadata?: Record<string, any>;
  }): Promise<NotificationResponse> {
    const response: AxiosResponse<NotificationResponse> =
      await this.client.post('/notifications', {
        ...params,
        channel: 'whatsapp',
      });
    return response.data;
  }

  /**
   * Get notification status
   */
  async getStatus(notificationId: string): Promise<any> {
    const response: AxiosResponse<any> = await this.client.get(
      `/notifications/${notificationId}/status`,
    );
    return response.data;
  }
}

class AnalyticsComponent {
  constructor(private client: AxiosInstance) {}

  /**
   * Get delivery metrics
   */
  async getDeliveryMetrics(params?: {
    startDate?: string;
    endDate?: string;
  }): Promise<any> {
    const response: AxiosResponse<any> = await this.client.get(
      '/analytics/delivery-metrics',
      { params },
    );
    return response.data;
  }

  /**
   * Get channel metrics
   */
  async getChannelMetrics(params?: {
    startDate?: string;
    endDate?: string;
  }): Promise<any> {
    const response: AxiosResponse<any> = await this.client.get(
      '/analytics/channel-metrics',
      { params },
    );
    return response.data;
  }

  /**
   * Get engagement metrics
   */
  async getEngagementMetrics(params?: {
    startDate?: string;
    endDate?: string;
  }): Promise<any> {
    const response: AxiosResponse<any> = await this.client.get(
      '/analytics/engagement-metrics',
      { params },
    );
    return response.data;
  }

  /**
   * Get subscriber engagement scores
   */
  async getSubscriberEngagement(params?: { limit?: number }): Promise<any> {
    const response: AxiosResponse<any> = await this.client.get(
      '/analytics/subscriber-engagement',
      { params },
    );
    return response.data;
  }

  /**
   * Get delivery trends
   */
  async getDeliveryTrends(params?: { days?: number }): Promise<any> {
    const response: AxiosResponse<any> = await this.client.get(
      '/analytics/delivery-trends',
      { params },
    );
    return response.data;
  }

  /**
   * Get A/B test results
   */
  async getABTestResults(testId: string): Promise<any> {
    const response: AxiosResponse<any> = await this.client.get(
      `/analytics/ab-tests/${testId}`,
    );
    return response.data;
  }
}

class TemplateComponent {
  constructor(private client: AxiosInstance) {}

  /**
   * Create a new template version
   */
  async createVersion(params: {
    templateId: string;
    name: string;
    content: string;
    subject?: string;
    htmlContent?: string;
    variables?: Record<string, any>;
    channels?: string[];
    changeLog?: string;
  }): Promise<any> {
    const response: AxiosResponse<any> = await this.client.post(
      '/templates/versions',
      params,
    );
    return response.data;
  }

  /**
   * Get template versions
   */
  async getVersions(templateId: string): Promise<any> {
    const response: AxiosResponse<any> = await this.client.get(
      `/templates/${templateId}/versions`,
    );
    return response.data;
  }

  /**
   * Get active version
   */
  async getActiveVersion(templateId: string): Promise<any> {
    const response: AxiosResponse<any> = await this.client.get(
      `/templates/${templateId}/versions/active`,
    );
    return response.data;
  }

  /**
   * Activate a version
   */
  async activateVersion(versionId: string): Promise<any> {
    const response: AxiosResponse<any> = await this.client.post(
      `/templates/versions/${versionId}/activate`,
    );
    return response.data;
  }

  /**
   * Preview template with variables
   */
  async previewTemplate(
    versionId: string,
    variables: Record<string, any>,
  ): Promise<any> {
    const response: AxiosResponse<any> = await this.client.post(
      `/templates/versions/${versionId}/preview`,
      { variables },
    );
    return response.data;
  }

  /**
   * Validate template variables
   */
  async validateVariables(
    versionId: string,
    variables: Record<string, any>,
  ): Promise<any> {
    const response: AxiosResponse<any> = await this.client.post(
      `/templates/versions/${versionId}/validate`,
      { variables },
    );
    return response.data;
  }

  /**
   * Compare two versions
   */
  async compareVersions(versionId1: string, versionId2: string): Promise<any> {
    const response: AxiosResponse<any> = await this.client.get(
      `/templates/versions/compare`,
      { params: { v1: versionId1, v2: versionId2 } },
    );
    return response.data;
  }

  /**
   * Rollback to a previous version
   */
  async rollbackToVersion(versionId: string): Promise<any> {
    const response: AxiosResponse<any> = await this.client.post(
      `/templates/versions/${versionId}/rollback`,
    );
    return response.data;
  }

  /**
   * Get version history
   */
  async getVersionHistory(templateId: string): Promise<any> {
    const response: AxiosResponse<any> = await this.client.get(
      `/templates/${templateId}/history`,
    );
    return response.data;
  }
}

class NotificationCenterComponent {
  constructor(private client: AxiosInstance) {}

  /**
   * Get notification feed
   */
  async getFeed(params?: {
    subscriberId?: string;
    page?: number;
    limit?: number;
    status?: 'unread' | 'read' | 'archived';
  }): Promise<any> {
    const response: AxiosResponse<any> = await this.client.get(
      '/notifications/center/feed',
      { params },
    );
    return response.data;
  }

  /**
   * Get notification by ID
   */
  async getNotification(id: string): Promise<any> {
    const response: AxiosResponse<any> = await this.client.get(
      `/notifications/center/${id}`,
    );
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
    await this.client.post('/notifications/center/bulk/read', { ids });
  }

  /**
   * Mark all notifications as read
   */
  async markAllAsRead(subscriberId: string): Promise<void> {
    await this.client.post(
      `/notifications/center/${subscriberId}/read-all`,
    );
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
    await this.client.post('/notifications/center/bulk/archive', { ids });
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
    await this.client.post('/notifications/center/bulk/delete', { ids });
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

  constructor(
    config: string | { key: string; baseUrl?: string; timeout?: number },
  ) {
    // Support both string (just API key) and object config
    const apiKey = typeof config === 'string' ? config : config.key;
    const baseUrl =
      typeof config === 'string'
        ? 'https://api.sanarwa.com/v1'
        : config.baseUrl || 'https://api.sanarwa.com/v1';
    const timeout =
      typeof config === 'string' ? 30000 : config.timeout || 30000;

    this.client = axios.create({
      baseURL: baseUrl,
      timeout: timeout,
      headers: {
        'X-API-Key': apiKey,
        'Content-Type': 'application/json',
        'User-Agent': 'sanarwa-sdk@0.2.0',
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
    const response: AxiosResponse<NotificationResponse> =
      await this.client.post('/notifications', scheduledRequest);
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
    const response: AxiosResponse<NotificationResponse> =
      await this.client.patch(`/notifications/${id}`, updates);
    return response.data;
  }

  /**
   * Get scheduled notifications
   */
  async getScheduledNotifications(
    params?: ListNotificationsParams,
  ): Promise<PaginatedResponse<NotificationResponse>> {
    const response: AxiosResponse<PaginatedResponse<NotificationResponse>> =
      await this.client.get('/notifications/scheduled', {
        params,
      });
    return response.data;
  }

  /**
   * Create a recurring notification schedule
   */
  async createRecurringSchedule(
    request: NotificationRequest,
    schedule: RecurringSchedule,
  ): Promise<{ scheduleId: string }> {
    const response: AxiosResponse<{ scheduleId: string }> =
      await this.client.post('/schedules/recurring', {
        notification: request,
        schedule,
      });
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
  async pauseNotifications(filter: {
    tag?: string;
    trackingId?: string;
  }): Promise<void> {
    await this.client.post('/notifications/pause', filter);
  }

  async resumeNotifications(filter: {
    tag?: string;
    trackingId?: string;
  }): Promise<void> {
    await this.client.post('/notifications/resume', filter);
  }

  /**
   * Get notification delivery timeline
   */
  async getDeliveryTimeline(id: string): Promise<any[]> {
    const response: AxiosResponse<any[]> = await this.client.get(
      `/notifications/${id}/timeline`,
    );
    return response.data;
  }

  /**
   * Bulk operations management
   */
  async getBulkOperationStatus(
    batchId: string,
  ): Promise<BulkNotificationResponse> {
    const response: AxiosResponse<BulkNotificationResponse> =
      await this.client.get(`/notifications/bulk/${batchId}`);
    return response.data;
  }

  async cancelBulkOperation(batchId: string): Promise<void> {
    await this.client.post(`/notifications/bulk/${batchId}/cancel`);
  }
}
