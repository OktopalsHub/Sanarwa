import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  MessageDeliveryStatus as DeliveryStatus,
  MessageDelivery as NotificationDelivery,
} from '../messaging/message-delivery.entity';
import {
  Message as Notification,
  MessageChannel as NotificationChannel,
  MessageStatus as NotificationStatus,
  MessagePriority as Priority,
} from '../messaging/message.entity';

export interface AnalyticsQuery {
  tenantId: string;
  startDate?: Date;
  endDate?: Date;
  channel?: NotificationChannel;
  status?: NotificationStatus | DeliveryStatus;
  priority?: Priority;
}

export interface DeliveryRateAnalytics {
  totalNotifications: number;
  totalDeliveries: number;
  deliveredCount: number;
  failedCount: number;
  pendingCount: number;
  bouncedCount: number;
  openedCount: number;
  clickedCount: number;
  deliveryRate: number;
  failureRate: number;
  openRate: number;
  clickRate: number;
  bounceRate: number;
}

export interface ChannelAnalytics {
  channel: NotificationChannel;
  totalSent: number;
  delivered: number;
  failed: number;
  deliveryRate: number;
  averageDeliveryTime: number;
}

export interface ProviderAnalytics {
  providerId: string;
  totalSent: number;
  delivered: number;
  failed: number;
  deliveryRate: number;
  averageCost: number;
}

/**
 * TRANSPORT MODE Analytics Service
 * 
 * NOTE: In transport mode, we don't store immediate sends in the database.
 * Analytics are limited to:
 * 1. Scheduled messages only (stored in DB)
 * 2. Provider-level metrics (from provider webhooks)
 * 
 * For comprehensive analytics, integrate with:
 * - Provider dashboards (SendGrid, Twilio, etc.)
 * - External analytics services (Segment, Mixpanel)
 * - Webhook event logs
 */
@Injectable()
export class AnalyticsService {
  private readonly logger = new Logger(AnalyticsService.name);

  constructor(
    @InjectRepository(Notification)
    private notificationRepository: Repository<Notification>,
    @InjectRepository(NotificationDelivery)
    private deliveryRepository: Repository<NotificationDelivery>,
  ) {}

  /**
   * Get delivery rate analytics - SCHEDULED MESSAGES ONLY
   */
  async getDeliveryRateAnalytics(
    query: AnalyticsQuery,
  ): Promise<DeliveryRateAnalytics> {
    this.logger.warn('Analytics only available for scheduled messages. Immediate sends are not tracked.');

    const notificationQueryBuilder = this.notificationRepository
      .createQueryBuilder('notification')
      .where('notification.tenantId = :tenantId', {
        tenantId: query.tenantId,
      });

    if (query.startDate) {
      notificationQueryBuilder.andWhere(
        'notification.createdAt >= :startDate',
        { startDate: query.startDate },
      );
    }

    if (query.endDate) {
      notificationQueryBuilder.andWhere('notification.createdAt <= :endDate', {
        endDate: query.endDate,
      });
    }

    if (query.channel) {
      notificationQueryBuilder.andWhere(
        'notification.channels @> :channel',
        { channel: JSON.stringify([query.channel]) },
      );
    }

    const notifications = await notificationQueryBuilder.getMany();
    const totalNotifications = notifications.length;

    const deliveredCount = notifications.filter(
      (n) => n.status === NotificationStatus.DELIVERED,
    ).length;
    const failedCount = notifications.filter(
      (n) => n.status === NotificationStatus.FAILED,
    ).length;
    const pendingCount = notifications.filter(
      (n) => n.status === NotificationStatus.PENDING,
    ).length;

    return {
      totalNotifications,
      totalDeliveries: totalNotifications,
      deliveredCount,
      failedCount,
      pendingCount,
      bouncedCount: 0,
      openedCount: 0,
      clickedCount: 0,
      deliveryRate: totalNotifications > 0 ? (deliveredCount / totalNotifications) * 100 : 0,
      failureRate: totalNotifications > 0 ? (failedCount / totalNotifications) * 100 : 0,
      openRate: 0,
      clickRate: 0,
      bounceRate: 0,
    };
  }

  /**
   * Get channel analytics - SCHEDULED MESSAGES ONLY
   */
  async getChannelAnalytics(
    query: AnalyticsQuery,
  ): Promise<ChannelAnalytics[]> {
    this.logger.warn('Channel analytics only available for scheduled messages.');

    const notifications = await this.notificationRepository
      .createQueryBuilder('notification')
      .where('notification.tenantId = :tenantId', {
        tenantId: query.tenantId,
      })
      .andWhere(query.startDate ? 'notification.createdAt >= :startDate' : '1=1', 
        query.startDate ? { startDate: query.startDate } : {})
      .andWhere(query.endDate ? 'notification.createdAt <= :endDate' : '1=1',
        query.endDate ? { endDate: query.endDate } : {})
      .getMany();

    const channelMap = new Map<NotificationChannel, {
      totalSent: number;
      delivered: number;
      failed: number;
    }>();

    notifications.forEach((notification) => {
      notification.channels.forEach((channel) => {
        const stats = channelMap.get(channel) || {
          totalSent: 0,
          delivered: 0,
          failed: 0,
        };

        stats.totalSent++;
        if (notification.status === NotificationStatus.DELIVERED) {
          stats.delivered++;
        } else if (notification.status === NotificationStatus.FAILED) {
          stats.failed++;
        }

        channelMap.set(channel, stats);
      });
    });

    return Array.from(channelMap.entries()).map(([channel, stats]) => ({
      channel,
      totalSent: stats.totalSent,
      delivered: stats.delivered,
      failed: stats.failed,
      deliveryRate: stats.totalSent > 0 ? (stats.delivered / stats.totalSent) * 100 : 0,
      averageDeliveryTime: 0,
    }));
  }

  /**
   * Get provider analytics - LIMITED DATA
   */
  async getProviderAnalytics(
    query: AnalyticsQuery,
  ): Promise<ProviderAnalytics[]> {
    this.logger.warn('Provider analytics limited in transport mode. Use provider dashboards for detailed metrics.');

    return [{
      providerId: 'transport-mode',
      totalSent: 0,
      delivered: 0,
      failed: 0,
      deliveryRate: 0,
      averageCost: 0,
    }];
  }

  /**
   * Get time-series analytics - SCHEDULED MESSAGES ONLY
   */
  async getTimeSeriesAnalytics(query: AnalyticsQuery): Promise<any[]> {
    this.logger.warn('Time-series analytics only available for scheduled messages.');

    const notifications = await this.notificationRepository
      .createQueryBuilder('notification')
      .where('notification.tenantId = :tenantId', {
        tenantId: query.tenantId,
      })
      .andWhere(query.startDate ? 'notification.createdAt >= :startDate' : '1=1',
        query.startDate ? { startDate: query.startDate } : {})
      .andWhere(query.endDate ? 'notification.createdAt <= :endDate' : '1=1',
        query.endDate ? { endDate: query.endDate } : {})
      .orderBy('notification.createdAt', 'ASC')
      .getMany();

    // Group by day
    const dailyStats = new Map<string, { sent: number; delivered: number; failed: number }>();

    notifications.forEach((notification) => {
      const date = notification.createdAt.toISOString().split('T')[0];
      const stats = dailyStats.get(date) || { sent: 0, delivered: 0, failed: 0 };

      stats.sent++;
      if (notification.status === NotificationStatus.DELIVERED) {
        stats.delivered++;
      } else if (notification.status === NotificationStatus.FAILED) {
        stats.failed++;
      }

      dailyStats.set(date, stats);
    });

    return Array.from(dailyStats.entries()).map(([date, stats]) => ({
      date,
      ...stats,
    }));
  }

  /**
   * Get summary analytics
   */
  async getSummaryAnalytics(tenantId: string): Promise<any> {
    const last30Days = new Date();
    last30Days.setDate(last30Days.getDate() - 30);

    const notifications = await this.notificationRepository
      .createQueryBuilder('notification')
      .where('notification.tenantId = :tenantId', { tenantId })
      .andWhere('notification.createdAt >= :startDate', { startDate: last30Days })
      .getMany();

    const total = notifications.length;
    const delivered = notifications.filter(n => n.status === NotificationStatus.DELIVERED).length;
    const failed = notifications.filter(n => n.status === NotificationStatus.FAILED).length;
    const pending = notifications.filter(n => n.status === NotificationStatus.PENDING).length;

    return {
      period: 'Last 30 days',
      scheduledMessages: total,
      delivered,
      failed,
      pending,
      deliveryRate: total > 0 ? (delivered / total) * 100 : 0,
      note: 'Analytics only include scheduled messages. For immediate sends, use provider dashboards.',
    };
  }

  /**
   * STUB METHODS - Return minimal data in transport mode
   */

  async getTimeSeriesData(query: AnalyticsQuery, interval?: string): Promise<any[]> {
    return this.getTimeSeriesAnalytics(query);
  }

  async getTenantAnalytics(tenantId: string, ...args: any[]): Promise<any> {
    return this.getSummaryAnalytics(tenantId);
  }

  async getTopProviders(tenantId: string, ...args: any[]): Promise<any[]> {
    this.logger.warn('Provider rankings not available in transport mode.');
    return [];
  }

  async getDeliveryTrends(tenantId: string, ...args: any[]): Promise<any> {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 30);
    
    return this.getTimeSeriesAnalytics({
      tenantId,
      startDate,
      endDate: new Date(),
    });
  }

  async getProjectAnalytics(projectId: string, ...args: any[]): Promise<any> {
    this.logger.warn('Project analytics not available in transport mode.');
    return {
      projectId,
      note: 'Analytics limited in transport mode. Use provider dashboards.',
    };
  }

  async getBrandAnalytics(brandId: string, ...args: any[]): Promise<any> {
    this.logger.warn('Brand analytics not available in transport mode.');
    return {
      brandId,
      note: 'Analytics limited in transport mode. Use provider dashboards.',
    };
  }

  async compareProjects(tenantId: string, projectIds: string[], ...args: any[]): Promise<any> {
    this.logger.warn('Project comparison not available in transport mode.');
    return {
      tenantId,
      projects: projectIds,
      note: 'Comparison not available in transport mode.',
    };
  }

  async compareBrands(tenantId: string, brandIds: string[], ...args: any[]): Promise<any> {
    this.logger.warn('Brand comparison not available in transport mode.');
    return {
      tenantId,
      brands: brandIds,
      note: 'Comparison not available in transport mode.',
    };
  }
}
