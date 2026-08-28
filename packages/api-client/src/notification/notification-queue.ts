import {
  BulkNotificationRequest,
  BulkNotificationResponse,
  CreateInAppNotificationRequest,
  CreateNotificationRequest,
  InAppNotification,
  NotificationMetrics,
  NotificationQueryParams,
  NotificationResponse,
  NotificationStatusUpdate,
  QueueStatus,
} from "../types/notification";
import { ApiClientConsumer } from "../internal/api-client-consumer";
import { NotificationAnalyticsClient } from "./notification-analytics";

export class NotificationQueueClient extends NotificationAnalyticsClient {
  // Queue Management Methods

  /**
   * Get notification queue status
   * @returns Current queue status for all channels
   */
  async getQueueStatus(): Promise<QueueStatus[]> {
    return this.apiClient.get<QueueStatus[]>("/notifications/queue/status");
  }

  /**
   * Get queue statistics
   * @returns Detailed queue statistics
   */
  async getQueueStats(): Promise<{
    totalWaiting: number;
    totalActive: number;
    totalCompleted: number;
    totalFailed: number;
    totalDelayed: number;
    queues: QueueStatus[];
  }> {
    return this.apiClient.get("/notifications/queue/stats");
  }

  /**
   * Pause notification processing for a specific channel
   * @param channel Channel to pause
   */
  async pauseQueue(channel: string): Promise<void> {
    return this.apiClient.post<void>(`/notifications/queue/${channel}/pause`, {});
  }

  /**
   * Resume notification processing for a specific channel
   * @param channel Channel to resume
   */
  async resumeQueue(channel: string): Promise<void> {
    return this.apiClient.post<void>(`/notifications/queue/${channel}/resume`, {});
  }

  /**
   * Clear failed jobs from a specific channel queue
   * @param channel Channel to clear failed jobs from
   * @returns Number of jobs cleared
   */
  async clearFailedJobs(channel: string): Promise<{ cleared: number }> {
    return this.apiClient.post(`/notifications/queue/${channel}/clear-failed`, {});
  }

}
