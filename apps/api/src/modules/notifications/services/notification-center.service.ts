import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { NotificationCenterItem, NotificationCenterStatus } from '../entities/notification-center.entity';
import { getPaginationSummary } from '../../../common/dto/pagination.dto';
import { IPaginatedData } from '../../../common/interfaces';

export interface CreateNotificationCenterItemDto {
  tenantId: string;
  subscriberId: string;
  title: string;
  content: string;
  description?: string;
  channel: string;
  actionUrl?: string;
  actionLabel?: string;
  imageUrl?: string;
  metadata?: Record<string, any>;
  templateId?: string;
  messageId?: string;
  expiresAt?: Date;
}

export interface NotificationCenterStats {
  total: number;
  unread: number;
  read: number;
  archived: number;
}

@Injectable()
export class NotificationCenterService {
  private readonly logger = new Logger(NotificationCenterService.name);

  constructor(
    @InjectRepository(NotificationCenterItem)
    private readonly repository: Repository<NotificationCenterItem>,
  ) {}

  /**
   * Add notification to center
   */
  async addNotification(
    dto: CreateNotificationCenterItemDto,
  ): Promise<NotificationCenterItem> {
    const item = this.repository.create({
      ...dto,
      status: NotificationCenterStatus.UNREAD,
    });

    const saved = await this.repository.save(item);
    this.logger.log(
      `Added notification to center for subscriber ${dto.subscriberId}`,
    );

    return saved;
  }

  /**
   * Get notification by ID
   */
  async getNotification(id: string): Promise<NotificationCenterItem> {
    const notification = await this.repository.findOne({ where: { id } });

    if (!notification) {
      throw new NotFoundException(`Notification ${id} not found`);
    }

    return notification;
  }

  /**
   * Get subscriber's notification feed
   */
  async getNotificationFeed(
    subscriberId: string,
    tenantId: string,
    page: number = 1,
    limit: number = 20,
    status?: NotificationCenterStatus,
  ): Promise<IPaginatedData<NotificationCenterItem>> {
    const query = this.repository.createQueryBuilder('notification')
      .where('notification.subscriberId = :subscriberId', { subscriberId })
      .andWhere('notification.tenantId = :tenantId', { tenantId });

    if (status) {
      query.andWhere('notification.status = :status', { status });
    }

    // Exclude expired notifications
    query.andWhere(
      '(notification.expiresAt IS NULL OR notification.expiresAt > NOW())',
    );

    const total = await query.getCount();

    const notifications = await query
      .orderBy('notification.createdAt', 'DESC')
      .skip((page - 1) * limit)
      .take(limit)
      .getMany();

    return getPaginationSummary(
      notifications,
      total,
      { page, limit },
      'notifications',
    );
  }

  /**
   * Mark notification as read
   */
  async markAsRead(id: string): Promise<NotificationCenterItem> {
    const notification = await this.getNotification(id);

    notification.status = NotificationCenterStatus.READ;
    notification.readAt = new Date();

    const updated = await this.repository.save(notification);
    this.logger.log(`Marked notification ${id} as read`);

    return updated;
  }

  /**
   * Mark multiple notifications as read
   */
  async markMultipleAsRead(ids: string[]): Promise<void> {
    await this.repository.update(
      { id: ids as any },
      {
        status: NotificationCenterStatus.READ,
        readAt: new Date(),
      },
    );

    this.logger.log(`Marked ${ids.length} notifications as read`);
  }

  /**
   * Mark all notifications as read for subscriber
   */
  async markAllAsRead(subscriberId: string, tenantId: string): Promise<void> {
    await this.repository.update(
      {
        subscriberId,
        tenantId,
        status: NotificationCenterStatus.UNREAD,
      },
      {
        status: NotificationCenterStatus.READ,
        readAt: new Date(),
      },
    );

    this.logger.log(`Marked all notifications as read for subscriber ${subscriberId}`);
  }

  /**
   * Archive notification
   */
  async archiveNotification(id: string): Promise<NotificationCenterItem> {
    const notification = await this.getNotification(id);

    notification.status = NotificationCenterStatus.ARCHIVED;
    notification.archivedAt = new Date();

    const updated = await this.repository.save(notification);
    this.logger.log(`Archived notification ${id}`);

    return updated;
  }

  /**
   * Archive multiple notifications
   */
  async archiveMultiple(ids: string[]): Promise<void> {
    await this.repository.update(
      { id: ids as any },
      {
        status: NotificationCenterStatus.ARCHIVED,
        archivedAt: new Date(),
      },
    );

    this.logger.log(`Archived ${ids.length} notifications`);
  }

  /**
   * Delete notification
   */
  async deleteNotification(id: string): Promise<void> {
    await this.repository.delete(id);
    this.logger.log(`Deleted notification ${id}`);
  }

  /**
   * Delete multiple notifications
   */
  async deleteMultiple(ids: string[]): Promise<void> {
    await this.repository.delete(ids);
    this.logger.log(`Deleted ${ids.length} notifications`);
  }

  /**
   * Get notification center statistics
   */
  async getStats(
    subscriberId: string,
    tenantId: string,
  ): Promise<NotificationCenterStats> {
    const baseQuery = this.repository.createQueryBuilder('notification')
      .where('notification.subscriberId = :subscriberId', { subscriberId })
      .andWhere('notification.tenantId = :tenantId', { tenantId })
      .andWhere(
        '(notification.expiresAt IS NULL OR notification.expiresAt > NOW())',
      );

    const total = await baseQuery.getCount();
    const unread = await baseQuery
      .andWhere('notification.status = :status', {
        status: NotificationCenterStatus.UNREAD,
      })
      .getCount();
    const read = await baseQuery
      .andWhere('notification.status = :status', {
        status: NotificationCenterStatus.READ,
      })
      .getCount();
    const archived = await baseQuery
      .andWhere('notification.status = :status', {
        status: NotificationCenterStatus.ARCHIVED,
      })
      .getCount();

    return { total, unread, read, archived };
  }

  /**
   * Get unread count
   */
  async getUnreadCount(subscriberId: string, tenantId: string): Promise<number> {
    return this.repository.count({
      where: {
        subscriberId,
        tenantId,
        status: NotificationCenterStatus.UNREAD,
      },
    });
  }

  /**
   * Search notifications
   */
  async searchNotifications(
    subscriberId: string,
    tenantId: string,
    query: string,
    page: number = 1,
    limit: number = 20,
  ): Promise<IPaginatedData<NotificationCenterItem>> {
    const qb = this.repository.createQueryBuilder('notification')
      .where('notification.subscriberId = :subscriberId', { subscriberId })
      .andWhere('notification.tenantId = :tenantId', { tenantId })
      .andWhere(
        '(notification.title ILIKE :query OR notification.content ILIKE :query OR notification.description ILIKE :query)',
        { query: `%${query}%` },
      );

    const total = await qb.getCount();

    const notifications = await qb
      .orderBy('notification.createdAt', 'DESC')
      .skip((page - 1) * limit)
      .take(limit)
      .getMany();

    return getPaginationSummary(
      notifications,
      total,
      { page, limit },
      'notifications',
    );
  }

  /**
   * Get notifications by channel
   */
  async getNotificationsByChannel(
    subscriberId: string,
    tenantId: string,
    channel: string,
    page: number = 1,
    limit: number = 20,
  ): Promise<IPaginatedData<NotificationCenterItem>> {
    const query = this.repository.createQueryBuilder('notification')
      .where('notification.subscriberId = :subscriberId', { subscriberId })
      .andWhere('notification.tenantId = :tenantId', { tenantId })
      .andWhere('notification.channel = :channel', { channel });

    const total = await query.getCount();

    const notifications = await query
      .orderBy('notification.createdAt', 'DESC')
      .skip((page - 1) * limit)
      .take(limit)
      .getMany();

    return getPaginationSummary(
      notifications,
      total,
      { page, limit },
      'notifications',
    );
  }

  /**
   * Clean up expired notifications
   */
  async cleanupExpiredNotifications(): Promise<number> {
    const result = await this.repository.delete({
      expiresAt: { $lt: new Date() } as any,
    });

    const count = result.affected || 0;
    this.logger.log(`Cleaned up ${count} expired notifications`);

    return count;
  }

  /**
   * Bulk add notifications
   */
  async bulkAddNotifications(
    items: CreateNotificationCenterItemDto[],
  ): Promise<NotificationCenterItem[]> {
    const notifications = items.map(item =>
      this.repository.create({
        ...item,
        status: NotificationCenterStatus.UNREAD,
      }),
    );

    const saved = await this.repository.save(notifications);
    this.logger.log(`Bulk added ${saved.length} notifications`);

    return saved;
  }
}
