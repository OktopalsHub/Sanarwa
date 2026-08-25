import { Injectable, Logger } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository, LessThanOrEqual } from "typeorm";
import { NotificationCenterItem } from "../entities/notification-center.entity";
import { TenantSettings } from "../../tenant/entities/tenant-settings.entity";
import { Cron, CronExpression } from "@nestjs/schedule";

@Injectable()
export class NotificationPersistenceService {
  private readonly logger = new Logger(NotificationPersistenceService.name);

  constructor(
    @InjectRepository(NotificationCenterItem)
    private readonly repository: Repository<NotificationCenterItem>,
    @InjectRepository(TenantSettings)
    private readonly tenantSettingsRepository: Repository<TenantSettings>,
  ) {}

  /**
   * Persist notification to database
   */
  async persistNotification(
    notification: Partial<NotificationCenterItem>,
  ): Promise<NotificationCenterItem> {
    try {
      const item = this.repository.create(notification);
      const saved = await this.repository.save(item);

      this.logger.debug(`Persisted notification ${saved.id}`);

      return saved;
    } catch (error) {
      this.logger.error("Failed to persist notification", error);
      throw error;
    }
  }

  /**
   * Batch persist notifications
   */
  async batchPersistNotifications(
    notifications: Partial<NotificationCenterItem>[],
  ): Promise<NotificationCenterItem[]> {
    try {
      const items = this.repository.create(notifications);
      const saved = await this.repository.save(items);

      this.logger.debug(`Persisted ${saved.length} notifications`);

      return saved;
    } catch (error) {
      this.logger.error("Failed to batch persist notifications", error);
      throw error;
    }
  }

  /**
   * Update notification status
   */
  async updateNotificationStatus(
    id: string,
    status: string,
    metadata?: Record<string, any>,
  ): Promise<void> {
    try {
      await this.repository.update(
        { id },
        {
          status: status as any,
          metadata,
          updatedAt: new Date(),
        },
      );

      this.logger.debug(`Updated notification ${id} status to ${status}`);
    } catch (error) {
      this.logger.error("Failed to update notification status", error);
      throw error;
    }
  }

  /**
   * Cleanup expired notifications (runs daily at 2 AM)
   */
  @Cron(CronExpression.EVERY_DAY_AT_2AM)
  async cleanupExpiredNotifications(): Promise<number> {
    try {
      const now = new Date();
      const expiredByDate = await this.repository.delete({
        expiresAt: LessThanOrEqual(now),
      });

      const tenantSettings = await this.tenantSettingsRepository.find();
      let retentionDeleted = 0;

      for (const settings of tenantSettings) {
        const retentionDays =
          settings.contentRetentionDays ??
          settings.retentionPolicy?.notificationContentRetentionDays ??
          90;
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

        const result = await this.repository.delete({
          tenantId: settings.tenantId,
          createdAt: LessThanOrEqual(cutoffDate),
        });
        retentionDeleted += result.affected || 0;
      }

      const count = (expiredByDate.affected || 0) + retentionDeleted;
      this.logger.log(`Cleaned up ${count} expired notification center items`);
      return count;

      return count;
    } catch (error) {
      this.logger.error("Failed to cleanup expired notifications", error);
      return 0;
    }
  }

  /**
   * Archive old read notifications (runs weekly)
   */
  @Cron(CronExpression.EVERY_WEEK)
  async archiveOldReadNotifications(): Promise<number> {
    try {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const result = await this.repository.update(
        {
          status: "read" as any,
          readAt: new Date(thirtyDaysAgo),
        },
        {
          status: "archived" as any,
          archivedAt: new Date(),
        },
      );

      const count = result.affected || 0;

      this.logger.log(`Archived ${count} old read notifications`);

      return count;
    } catch (error) {
      this.logger.error("Failed to archive old notifications", error);
      return 0;
    }
  }

  /**
   * Get notification delivery stats
   */
  async getDeliveryStats(
    subscriberId: string,
    tenantId: string,
  ): Promise<{
    total: number;
    delivered: number;
    failed: number;
    pending: number;
  }> {
    try {
      const total = await this.repository.count({
        where: { subscriberId, tenantId },
      });

      const delivered = await this.repository.count({
        where: { subscriberId, tenantId, status: "read" as any },
      });

      const failed = await this.repository.count({
        where: { subscriberId, tenantId, status: "archived" as any },
      });

      const pending = await this.repository.count({
        where: { subscriberId, tenantId, status: "unread" as any },
      });

      return { total, delivered, failed, pending };
    } catch (error) {
      this.logger.error("Failed to get delivery stats", error);
      throw error;
    }
  }

  /**
   * Bulk update notifications
   */
  async bulkUpdateNotifications(
    ids: string[],
    updates: Partial<NotificationCenterItem>,
  ): Promise<number> {
    try {
      const result = await this.repository.update(ids, updates);

      const count = result.affected || 0;

      this.logger.debug(`Bulk updated ${count} notifications`);

      return count;
    } catch (error) {
      this.logger.error("Failed to bulk update notifications", error);
      throw error;
    }
  }

  /**
   * Export notifications for subscriber
   */
  async exportNotifications(
    subscriberId: string,
    tenantId: string,
  ): Promise<NotificationCenterItem[]> {
    try {
      const notifications = await this.repository.find({
        where: { subscriberId, tenantId },
        order: { createdAt: "DESC" },
      });

      this.logger.log(
        `Exported ${notifications.length} notifications for subscriber ${subscriberId}`,
      );

      return notifications;
    } catch (error) {
      this.logger.error("Failed to export notifications", error);
      throw error;
    }
  }

  /**
   * Delete all notifications for subscriber
   */
  async deleteAllNotifications(subscriberId: string, tenantId: string): Promise<number> {
    try {
      const result = await this.repository.delete({
        subscriberId,
        tenantId,
      });

      const count = result.affected || 0;

      this.logger.log(`Deleted ${count} notifications for subscriber ${subscriberId}`);

      return count;
    } catch (error) {
      this.logger.error("Failed to delete notifications", error);
      throw error;
    }
  }
}
