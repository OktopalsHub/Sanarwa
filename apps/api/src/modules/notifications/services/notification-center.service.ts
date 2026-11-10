import { Injectable, Logger, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { In, IsNull, LessThanOrEqual, MoreThan, Not, Or, Repository } from "typeorm";
import {
  InAppNotification,
  InAppNotificationStatus,
  InAppNotificationType,
} from "../../messaging/entities/in-app-notification.entity";
import { getPaginationSummary } from "../../../common/dto/pagination.dto";
import { IPaginatedData } from "../../../common/interfaces";
import { eraseInboxBySubscriber } from "./inbox-erase";
import {
  NotificationCenterItem,
  NotificationCenterStatus,
  toItem,
} from "./notification-center.types";

export interface NotificationCenterStats {
  total: number;
  unread: number;
  read: number;
  archived: number;
}

const MAX_PAGE_LIMIT = 100;

function clampLimit(limit: number | undefined, fallback = 20): number {
  const n = Number(limit);
  if (!Number.isFinite(n) || n < 1) return fallback;
  return Math.min(Math.floor(n), MAX_PAGE_LIMIT);
}

function activeExpiryFilter(now: Date) {
  return { expiresAt: Or(IsNull(), MoreThan(now)) };
}

function statusFilter(status?: NotificationCenterStatus) {
  if (status === NotificationCenterStatus.ARCHIVED) {
    return { archived: true };
  }

  if (status === NotificationCenterStatus.READ) {
    return { archived: false, readAt: Not(IsNull()) };
  }

  if (status === NotificationCenterStatus.UNREAD) {
    return { archived: false, readAt: IsNull() };
  }

  return { archived: false };
}

@Injectable()
export class NotificationCenterService {
  private readonly logger = new Logger(NotificationCenterService.name);

  constructor(
    @InjectRepository(InAppNotification)
    private readonly repository: Repository<InAppNotification>,
  ) {}

  async upsertInboundItem(dto: {
    tenantId: string;
    title: string;
    data: string;
    channel: string;
    messageId: string;
    threadId?: string;
    expiresAt?: Date;
    metadata?: Record<string, any>;
  }): Promise<NotificationCenterItem> {
    const existing = await this.repository.findOne({
      where: { tenantId: dto.tenantId, messageId: dto.messageId },
    });

    if (existing) {
      existing.message = dto.data ?? existing.message;
      existing.title = dto.title ?? existing.title;
      existing.expiresAt = dto.expiresAt ?? existing.expiresAt;
      if (dto.threadId) {
        existing.metadata = {
          ...(existing.metadata as Record<string, any>),
          threadId: dto.threadId,
        };
      }
      return toItem(await this.repository.save(existing));
    }

    const saved = await this.repository.save(
      this.repository.create({
        tenantId: dto.tenantId,
        title: dto.title,
        message: dto.data,
        type: InAppNotificationType.INFO,
        status: InAppNotificationStatus.DELIVERED,
        category: "email-reply",
        seen: false,
        archived: false,
        channel: dto.channel,
        messageId: dto.messageId,
        expiresAt: dto.expiresAt,
        metadata: { ...dto.metadata, threadId: dto.threadId },
      }),
    );

    return toItem(saved);
  }

  async getNotification(id: string, tenantId: string): Promise<NotificationCenterItem> {
    const notification = await this.repository.findOne({ where: { id, tenantId } });

    if (!notification) {
      throw new NotFoundException(`Notification ${id} not found`);
    }

    return toItem(notification);
  }

  async getNotificationFeed(
    subscriberId: string,
    tenantId: string,
    page: number = 1,
    limit: number = 20,
    status?: NotificationCenterStatus,
  ): Promise<IPaginatedData<NotificationCenterItem>> {
    const safeLimit = clampLimit(limit);
    const safePage = Math.max(1, Number(page) || 1);

    const [rows, total] = await this.repository.findAndCount({
      where: {
        subscriberId,
        tenantId,
        ...statusFilter(status),
        ...activeExpiryFilter(new Date()),
      },
      order: { createdAt: "DESC" },
      skip: (safePage - 1) * safeLimit,
      take: safeLimit,
    });

    return getPaginationSummary(
      rows.map(toItem),
      total,
      { page: safePage, limit: safeLimit },
      "notifications",
    );
  }

  async markAsRead(id: string, tenantId: string): Promise<NotificationCenterItem> {
    const notification = await this.repository.findOne({ where: { id, tenantId } });

    if (!notification) {
      throw new NotFoundException(`Notification ${id} not found`);
    }

    notification.readAt = new Date();
    notification.status = InAppNotificationStatus.READ;

    const saved = await this.repository.save(notification);
    this.logger.log(`Marked notification ${id} as read`);
    return toItem(saved);
  }

  async markMultipleAsRead(ids: string[], tenantId: string): Promise<void> {
    if (!ids.length) return;
    await this.repository.update(
      { id: In(ids), tenantId },
      { readAt: new Date(), status: InAppNotificationStatus.READ },
    );

    this.logger.log(`Marked ${ids.length} notifications as read`);
  }

  async markAllAsRead(subscriberId: string, tenantId: string): Promise<void> {
    await this.repository.update(
      { subscriberId, tenantId, readAt: IsNull(), archived: false },
      { readAt: new Date(), status: InAppNotificationStatus.READ },
    );

    this.logger.log(`Marked all notifications as read for subscriber ${subscriberId}`);
  }

  async archiveNotification(id: string, tenantId: string): Promise<NotificationCenterItem> {
    const notification = await this.repository.findOne({ where: { id, tenantId } });

    if (!notification) {
      throw new NotFoundException(`Notification ${id} not found`);
    }

    notification.archived = true;
    notification.archivedAt = new Date();

    const saved = await this.repository.save(notification);
    this.logger.log(`Archived notification ${id}`);
    return toItem(saved);
  }

  async archiveMultiple(ids: string[], tenantId: string): Promise<void> {
    if (!ids.length) return;
    await this.repository.update(
      { id: In(ids), tenantId },
      { archived: true, archivedAt: new Date() },
    );

    this.logger.log(`Archived ${ids.length} notifications`);
  }

  async deleteNotification(id: string, tenantId: string): Promise<void> {
    const result = await this.repository.delete({ id, tenantId });
    if (!result.affected) {
      throw new NotFoundException(`Notification ${id} not found`);
    }
    this.logger.log(`Deleted notification ${id}`);
  }

  async deleteMultiple(ids: string[], tenantId: string): Promise<void> {
    if (!ids.length) return;
    await this.repository.delete({ id: In(ids), tenantId });
    this.logger.log(`Deleted ${ids.length} notifications`);
  }

  async getStats(subscriberId: string, tenantId: string): Promise<NotificationCenterStats> {
    const now = new Date();

    const count = (where: Record<string, unknown>) =>
      this.repository.count({
        where: { subscriberId, tenantId, ...activeExpiryFilter(now), ...where },
      });

    const [total, unread, read, archived] = await Promise.all([
      count({ archived: false }),
      count({ archived: false, readAt: IsNull() }),
      count({ archived: false, readAt: Not(IsNull()) }),
      count({ archived: true }),
    ]);

    return { total, unread, read, archived };
  }

  async getUnreadCount(subscriberId: string, tenantId: string): Promise<number> {
    return this.repository.count({
      where: {
        subscriberId,
        tenantId,
        archived: false,
        readAt: IsNull(),
        ...activeExpiryFilter(new Date()),
      },
    });
  }

  async searchNotifications(
    subscriberId: string,
    tenantId: string,
    query: string,
    page: number = 1,
    limit: number = 20,
  ): Promise<IPaginatedData<NotificationCenterItem>> {
    const safeLimit = clampLimit(limit);
    const safePage = Math.max(1, Number(page) || 1);
    const like = `%${query}%`;

    const [rows, countRows] = await Promise.all([
      this.repository.query(
        `SELECT id,
                tenant_id AS "tenantId",
                subscriber_id AS "subscriberId",
                title,
                message,
                type,
                status,
                data,
                metadata,
                template_id AS "templateId",
                category,
                action_url AS "actionUrl",
                actions,
                scheduled_at AS "scheduledAt",
                sent_at AS "sentAt",
                delivered_at AS "deliveredAt",
                read_at AS "readAt",
                expires_at AS "expiresAt",
                transaction_id AS "transactionId",
                seen,
                seen_at AS "seenAt",
                archived,
                archived_at AS "archivedAt",
                message_id AS "messageId",
                delivery_id AS "deliveryId",
                created_at AS "createdAt",
                updated_at AS "updatedAt"
         FROM in_app_notifications
         WHERE tenant_id = $1 AND subscriber_id = $2
           AND archived = false
           AND (expires_at IS NULL OR expires_at > NOW())
           AND (title ILIKE $3 OR message ILIKE $3 OR metadata->>'description' ILIKE $3)
         ORDER BY created_at DESC
         OFFSET $4 LIMIT $5`,
        [tenantId, subscriberId, like, (safePage - 1) * safeLimit, safeLimit],
      ),
      this.repository.query(
        `SELECT COUNT(*)::int AS count FROM in_app_notifications
         WHERE tenant_id = $1 AND subscriber_id = $2
           AND archived = false
           AND (expires_at IS NULL OR expires_at > NOW())
           AND (title ILIKE $3 OR message ILIKE $3 OR metadata->>'description' ILIKE $3)`,
        [tenantId, subscriberId, like],
      ),
    ]);

    const total = Number(countRows?.[0]?.count ?? 0);
    const items = (rows as InAppNotification[]).map(toItem);

    return getPaginationSummary(
      items,
      total,
      { page: safePage, limit: safeLimit },
      "notifications",
    );
  }

  async getNotificationsByChannel(
    subscriberId: string,
    tenantId: string,
    channel: string,
    page: number = 1,
    limit: number = 20,
  ): Promise<IPaginatedData<NotificationCenterItem>> {
    const safeLimit = clampLimit(limit);
    const safePage = Math.max(1, Number(page) || 1);

    const [rows, total] = await this.repository.findAndCount({
      where: {
        subscriberId,
        tenantId,
        channel,
        archived: false,
        ...activeExpiryFilter(new Date()),
      },
      order: { createdAt: "DESC" },
      skip: (safePage - 1) * safeLimit,
      take: safeLimit,
    });

    return getPaginationSummary(
      rows.map(toItem),
      total,
      { page: safePage, limit: safeLimit },
      "notifications",
    );
  }

  async cleanupExpiredNotifications(): Promise<number> {
    const result = await this.repository.delete({
      expiresAt: LessThanOrEqual(new Date()),
    });

    const count = result.affected || 0;
    this.logger.log(`Cleaned up ${count} expired notifications`);
    return count;
  }

  /**
   * GDPR/right-to-erasure slice for the in-app inbox (deep inbox behavior, shared seam).
   * Deletes all inbox rows for the Subscriber (any status, including archived/not-yet-expired),
   * matching `subscriberId` and `userId` across both inbox API contracts.
   * Cross-store subscriber data is erased via `PreferencesService.eraseSubscriberData`.
   */
  async deleteBySubscriber(tenantId: string, subscriberId: string): Promise<number> {
    const count = await eraseInboxBySubscriber(this.repository, tenantId, subscriberId);
    this.logger.log(`Erased ${count} inbox notifications for subscriber ${subscriberId}`);
    return count;
  }
}
