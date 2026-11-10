import { Injectable, Logger } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import {
  MessageDeliveryStatus as DeliveryStatus,
  MessageDelivery as NotificationDelivery,
} from "../messaging/message-delivery.entity";
import {
  Message as Notification,
  MessageStatus as NotificationStatus,
  MessagePriority as Priority,
} from "../messaging/message.entity";
import { NotificationChannel } from "../../common/enums/notification-channel.enum";
import { DeliveryEvent } from "../messaging/entities/delivery-event.entity";
import { DeliveryEventType } from "../messaging/enums/delivery-event-type.enum";

export interface EventRatesQuery {
  tenantId: string;
  startDate?: Date;
  endDate?: Date;
  channel?: NotificationChannel;
}

export interface EventRateRow {
  channel: string;
  sent: number;
  delivered: number;
  opened: number;
  clicked: number;
  bouncedHard: number;
  bouncedSoft: number;
  complained: number;
  unsubscribed: number;
  dropped: number;
  deliveryRate: number;
  openRate: number;
  clickRate: number;
  bounceRate: number;
  complaintRate: number;
}

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

@Injectable()
export class AnalyticsService {
  private readonly logger = new Logger(AnalyticsService.name);

  constructor(
    @InjectRepository(Notification)
    private notificationRepository: Repository<Notification>,
    @InjectRepository(NotificationDelivery)
    private deliveryRepository: Repository<NotificationDelivery>,
    @InjectRepository(DeliveryEvent)
    private eventRepository: Repository<DeliveryEvent>,
  ) {}

  /**
   * Delivery-event rates computed from the append-only `delivery_events`
   * log (email bounce/open/click/complaint rates by channel).
   */
  async getEventRates(query: EventRatesQuery): Promise<EventRateRow[]> {
    const builder = this.eventRepository
      .createQueryBuilder("event")
      .select("event.channel", "channel")
      .addSelect("event.type", "type")
      .addSelect("event.bounceType", "bounceType")
      .addSelect("COUNT(*)", "count")
      .where("event.tenantId = :tenantId", { tenantId: query.tenantId })
      .groupBy("event.channel")
      .addGroupBy("event.type")
      .addGroupBy("event.bounceType");

    if (query.startDate) {
      builder.andWhere("event.occurredAt >= :startDate", { startDate: query.startDate });
    }
    if (query.endDate) {
      builder.andWhere("event.occurredAt <= :endDate", { endDate: query.endDate });
    }
    if (query.channel) {
      builder.andWhere("event.channel = :channel", { channel: query.channel });
    }

    const rows = await builder.getRawMany<{
      channel: string;
      type: string;
      bounceType: string | null;
      count: string;
    }>();

    const byChannel = new Map<string, Map<string, number>>();
    for (const row of rows) {
      const counts = byChannel.get(row.channel) ?? new Map<string, number>();
      const key =
        row.type === DeliveryEventType.BOUNCED ? `bounced_${row.bounceType ?? "hard"}` : row.type;
      counts.set(key, (counts.get(key) ?? 0) + Number(row.count));
      byChannel.set(row.channel, counts);
    }

    return [...byChannel.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([channel, counts]) => {
        const sent = counts.get(DeliveryEventType.SENT) ?? 0;
        const delivered = counts.get(DeliveryEventType.DELIVERED) ?? 0;
        const opened = counts.get(DeliveryEventType.OPENED) ?? 0;
        const clicked = counts.get(DeliveryEventType.CLICKED) ?? 0;
        const bouncedHard = counts.get("bounced_hard") ?? 0;
        const bouncedSoft = counts.get("bounced_soft") ?? 0;
        const complained = counts.get(DeliveryEventType.COMPLAINED) ?? 0;
        const unsubscribed = counts.get(DeliveryEventType.UNSUBSCRIBED) ?? 0;
        const dropped = counts.get(DeliveryEventType.DROPPED) ?? 0;
        const bounced = bouncedHard + bouncedSoft;
        const denominator = Math.max(delivered, 1);
        const denominatorSent = Math.max(sent, 1);

        return {
          channel,
          sent,
          delivered,
          opened,
          clicked,
          bouncedHard,
          bouncedSoft,
          complained,
          unsubscribed,
          dropped,
          deliveryRate: sent > 0 ? delivered / denominatorSent : 0,
          openRate: opened / denominator,
          clickRate: clicked / denominator,
          bounceRate: bounced / denominatorSent,
          complaintRate: complained / denominatorSent,
        };
      });
  }

  async getDeliveryRateAnalytics(query: AnalyticsQuery): Promise<DeliveryRateAnalytics> {
    this.logger.warn(
      "Analytics only available for scheduled messages. Immediate sends are not tracked.",
    );

    const notificationQueryBuilder = this.notificationRepository
      .createQueryBuilder("notification")
      .where("notification.tenantId = :tenantId", {
        tenantId: query.tenantId,
      });

    if (query.startDate) {
      notificationQueryBuilder.andWhere("notification.createdAt >= :startDate", {
        startDate: query.startDate,
      });
    }

    if (query.endDate) {
      notificationQueryBuilder.andWhere("notification.createdAt <= :endDate", {
        endDate: query.endDate,
      });
    }

    if (query.channel) {
      notificationQueryBuilder.andWhere("notification.channels @> :channel", {
        channel: JSON.stringify([query.channel]),
      });
    }

    const notifications = await notificationQueryBuilder.getMany();
    const totalNotifications = notifications.length;

    const deliveredCount = notifications.filter(
      (n) => n.status === NotificationStatus.DELIVERED,
    ).length;
    const failedCount = notifications.filter((n) => n.status === NotificationStatus.FAILED).length;
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

  async getChannelAnalytics(query: AnalyticsQuery): Promise<ChannelAnalytics[]> {
    this.logger.warn("NotificationChannel analytics only available for scheduled messages.");

    const notifications = await this.notificationRepository
      .createQueryBuilder("notification")
      .where("notification.tenantId = :tenantId", {
        tenantId: query.tenantId,
      })
      .andWhere(
        query.startDate ? "notification.createdAt >= :startDate" : "1=1",
        query.startDate ? { startDate: query.startDate } : {},
      )
      .andWhere(
        query.endDate ? "notification.createdAt <= :endDate" : "1=1",
        query.endDate ? { endDate: query.endDate } : {},
      )
      .getMany();

    const channelMap = new Map<
      NotificationChannel,
      {
        totalSent: number;
        delivered: number;
        failed: number;
      }
    >();

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

  async getProviderAnalytics(query: AnalyticsQuery): Promise<ProviderAnalytics[]> {
    this.logger.warn(
      "Provider analytics limited in transport mode. Use provider dashboards for detailed metrics.",
    );

    return [
      {
        providerId: "transport-mode",
        totalSent: 0,
        delivered: 0,
        failed: 0,
        deliveryRate: 0,
        averageCost: 0,
      },
    ];
  }

  async getTimeSeriesAnalytics(query: AnalyticsQuery): Promise<any[]> {
    this.logger.warn("Time-series analytics only available for scheduled messages.");

    const notifications = await this.notificationRepository
      .createQueryBuilder("notification")
      .where("notification.tenantId = :tenantId", {
        tenantId: query.tenantId,
      })
      .andWhere(
        query.startDate ? "notification.createdAt >= :startDate" : "1=1",
        query.startDate ? { startDate: query.startDate } : {},
      )
      .andWhere(
        query.endDate ? "notification.createdAt <= :endDate" : "1=1",
        query.endDate ? { endDate: query.endDate } : {},
      )
      .orderBy("notification.createdAt", "ASC")
      .getMany();

    const dailyStats = new Map<string, { sent: number; delivered: number; failed: number }>();

    notifications.forEach((notification) => {
      const date = notification.createdAt.toISOString().split("T")[0];
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

  async getSummaryAnalytics(tenantId: string): Promise<any> {
    const last30Days = new Date();
    last30Days.setDate(last30Days.getDate() - 30);

    const notifications = await this.notificationRepository
      .createQueryBuilder("notification")
      .where("notification.tenantId = :tenantId", { tenantId })
      .andWhere("notification.createdAt >= :startDate", { startDate: last30Days })
      .getMany();

    const total = notifications.length;
    const delivered = notifications.filter((n) => n.status === NotificationStatus.DELIVERED).length;
    const failed = notifications.filter((n) => n.status === NotificationStatus.FAILED).length;
    const pending = notifications.filter((n) => n.status === NotificationStatus.PENDING).length;

    return {
      period: "Last 30 days",
      scheduledMessages: total,
      delivered,
      failed,
      pending,
      deliveryRate: total > 0 ? (delivered / total) * 100 : 0,
      note: "Analytics only include scheduled messages. For immediate sends, use provider dashboards.",
    };
  }

  async getTimeSeriesData(query: AnalyticsQuery, interval?: string): Promise<any[]> {
    return this.getTimeSeriesAnalytics(query);
  }

  async getTenantAnalytics(tenantId: string, ...args: any[]): Promise<any> {
    return this.getSummaryAnalytics(tenantId);
  }

  async getTopProviders(tenantId: string, ...args: any[]): Promise<any[]> {
    this.logger.warn("Provider rankings not available in transport mode.");
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
    this.logger.warn("Project analytics not available in transport mode.");
    return {
      projectId,
      note: "Analytics limited in transport mode. Use provider dashboards.",
    };
  }

  async getBrandAnalytics(brandId: string, ...args: any[]): Promise<any> {
    this.logger.warn("Brand analytics not available in transport mode.");
    return {
      brandId,
      note: "Analytics limited in transport mode. Use provider dashboards.",
    };
  }

  async compareProjects(tenantId: string, projectIds: string[], ...args: any[]): Promise<any> {
    this.logger.warn("Project comparison not available in transport mode.");
    return {
      tenantId,
      projects: projectIds,
      note: "Comparison not available in transport mode.",
    };
  }

  async compareBrands(tenantId: string, brandIds: string[], ...args: any[]): Promise<any> {
    this.logger.warn("Brand comparison not available in transport mode.");
    return {
      tenantId,
      brands: brandIds,
      note: "Comparison not available in transport mode.",
    };
  }
}
