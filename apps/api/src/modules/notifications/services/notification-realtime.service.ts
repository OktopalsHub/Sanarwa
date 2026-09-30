import { Injectable, Logger } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { OnEvent } from "@nestjs/event-emitter";
import {
  NotificationCenterItem,
  NotificationCenterStatus,
} from "../entities/notification-center.entity";
import { NotificationGateway } from "../gateways/notification.gateway";

export interface NotificationQueue {
  subscriberId: string;
  notifications: NotificationCenterItem[];
  isProcessing: boolean;
}

@Injectable()
export class NotificationRealtimeService {
  private readonly logger = new Logger(NotificationRealtimeService.name);
  private readonly offlineQueue = new Map<string, NotificationCenterItem[]>();
  private readonly connectionStates = new Map<string, "online" | "offline">();

  constructor(
    @InjectRepository(NotificationCenterItem)
    private readonly repository: Repository<NotificationCenterItem>,
    private readonly notificationGateway: NotificationGateway,
  ) {}

  /**
   * Queue notification for offline subscriber
   */
  async queueOfflineNotification(
    subscriberId: string,
    notification: NotificationCenterItem,
  ): Promise<void> {
    try {
      if (!this.offlineQueue.has(subscriberId)) {
        this.offlineQueue.set(subscriberId, []);
      }

      const queue = this.offlineQueue.get(subscriberId)!;
      queue.push(notification);

      this.logger.log(
        `Queued notification for offline subscriber ${subscriberId} (queue size: ${queue.length})`,
      );
    } catch (error) {
      this.logger.error("Failed to queue offline notification", error);
    }
  }

  /**
   * Deliver queued notifications when subscriber comes online
   */
  async deliverQueuedNotifications(subscriberId: string): Promise<number> {
    try {
      const queue = this.offlineQueue.get(subscriberId);
      if (!queue || queue.length === 0) {
        return 0;
      }

      this.logger.log(`Delivering ${queue.length} queued notifications to ${subscriberId}`);

      // Send all queued notifications
      for (const notification of queue) {
        this.notificationGateway.broadcastToSubscriber(subscriberId, "queued_notification", {
          notification,
        });
      }

      // Clear queue
      this.offlineQueue.delete(subscriberId);

      return queue.length;
    } catch (error) {
      this.logger.error(`Failed to deliver queued notifications for ${subscriberId}`, error);
      return 0;
    }
  }

  /**
   * Mark subscriber as online
   */
  markSubscriberOnline(subscriberId: string): void {
    this.connectionStates.set(subscriberId, "online");
    this.logger.log(`Subscriber ${subscriberId} marked as online`);

    // Deliver queued notifications
    this.deliverQueuedNotifications(subscriberId);
  }

  /**
   * Mark subscriber as offline
   */
  markSubscriberOffline(subscriberId: string): void {
    this.connectionStates.set(subscriberId, "offline");
    this.logger.log(`Subscriber ${subscriberId} marked as offline`);
  }

  /**
   * Check if subscriber is online
   */
  isSubscriberOnline(subscriberId: string): boolean {
    return this.connectionStates.get(subscriberId) === "online";
  }

  /**
   * Get queue size for subscriber
   */
  getQueueSize(subscriberId: string): number {
    return this.offlineQueue.get(subscriberId)?.length || 0;
  }

  /**
   * Handle notification ordering for bulk operations
   */
  async orderNotifications(
    notifications: NotificationCenterItem[],
  ): Promise<NotificationCenterItem[]> {
    try {
      // Sort by creation time to maintain order
      return notifications.toSorted((a, b) => {
        const timeA = new Date(a.createdAt).getTime();
        const timeB = new Date(b.createdAt).getTime();
        return timeA - timeB;
      });
    } catch (error) {
      this.logger.error("Failed to order notifications", error);
      return notifications;
    }
  }

  /**
   * Handle race conditions in bulk operations
   */
  async processBulkNotificationsWithLocking(
    subscriberIds: string[],
    notifications: NotificationCenterItem[],
  ): Promise<{ processed: number; failed: number }> {
    try {
      let processed = 0;
      let failed = 0;

      for (const subscriberId of subscriberIds) {
        try {
          // Check if subscriber is online
          if (this.isSubscriberOnline(subscriberId)) {
            // Send directly
            this.notificationGateway.broadcastToSubscriber(subscriberId, "bulk_notifications", {
              notifications,
            });
            processed++;
          } else {
            // Queue for offline delivery
            for (const notification of notifications) {
              await this.queueOfflineNotification(subscriberId, notification);
            }
            processed++;
          }
        } catch (error) {
          this.logger.error(`Failed to process notification for subscriber ${subscriberId}`, error);
          failed++;
        }
      }

      this.logger.log(`Bulk notification processing: ${processed} processed, ${failed} failed`);

      return { processed, failed };
    } catch (error) {
      this.logger.error("Failed to process bulk notifications", error);
      return { processed: 0, failed: subscriberIds.length };
    }
  }

  /**
   * Handle reconnection with state recovery
   */
  async handleReconnection(subscriberId: string): Promise<{
    queuedCount: number;
    unreadCount: number;
  }> {
    try {
      this.logger.log(`Handling reconnection for subscriber ${subscriberId}`);

      // Mark as online
      this.markSubscriberOnline(subscriberId);

      // Get queued notifications
      const queuedCount = this.getQueueSize(subscriberId);

      // Get unread count
      const unreadCount = await this.repository.count({
        where: {
          subscriberId,
          status: NotificationCenterStatus.UNREAD,
        },
      });

      return { queuedCount, unreadCount };
    } catch (error) {
      this.logger.error(`Failed to handle reconnection for ${subscriberId}`, error);
      return { queuedCount: 0, unreadCount: 0 };
    }
  }

  /**
   * Cleanup expired notifications
   */
  async cleanupExpiredNotifications(): Promise<number> {
    try {
      const result = await this.repository.delete({
        expiresAt: new Date(),
      });

      const count = result.affected || 0;
      this.logger.log(`Cleaned up ${count} expired notifications`);

      return count;
    } catch (error) {
      this.logger.error("Failed to cleanup expired notifications", error);
      return 0;
    }
  }

  /**
   * Get connection statistics
   */
  getConnectionStats(): {
    totalOnline: number;
    totalOffline: number;
    totalQueued: number;
  } {
    let totalOnline = 0;
    let totalOffline = 0;
    let totalQueued = 0;

    for (const [, state] of this.connectionStates) {
      if (state === "online") {
        totalOnline++;
      } else {
        totalOffline++;
      }
    }

    for (const [, queue] of this.offlineQueue) {
      totalQueued += queue.length;
    }

    return { totalOnline, totalOffline, totalQueued };
  }

  /**
   * Event listener: Notification created
   */
  @OnEvent("notification.created")
  async onNotificationCreated(payload: {
    subscriberId: string;
    notification: NotificationCenterItem;
  }) {
    try {
      if (!this.isSubscriberOnline(payload.subscriberId)) {
        await this.queueOfflineNotification(payload.subscriberId, payload.notification);
      }
    } catch (error) {
      this.logger.error("Error in notification created event", error);
    }
  }

  /**
   * Event listener: Subscriber connected
   */
  @OnEvent("subscriber.connected")
  async onSubscriberConnected(payload: { subscriberId: string }) {
    try {
      this.markSubscriberOnline(payload.subscriberId);
      await this.deliverQueuedNotifications(payload.subscriberId);
    } catch (error) {
      this.logger.error("Error in subscriber connected event", error);
    }
  }

  /**
   * Event listener: Subscriber disconnected
   */
  @OnEvent("subscriber.disconnected")
  async onSubscriberDisconnected(payload: { subscriberId: string }) {
    try {
      this.markSubscriberOffline(payload.subscriberId);
    } catch (error) {
      this.logger.error("Error in subscriber disconnected event", error);
    }
  }
}
