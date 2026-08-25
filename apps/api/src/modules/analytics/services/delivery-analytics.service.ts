import { Injectable, Logger } from "@nestjs/common";
import { Repository } from "typeorm";
import { InjectRepository } from "@nestjs/typeorm";
import { MessageDelivery } from "../../messaging/message-delivery.entity";
import { Message } from "../../messaging/message.entity";

export interface DeliveryMetrics {
  totalSent: number;
  delivered: number;
  failed: number;
  pending: number;
  deliveryRate: number;
  failureRate: number;
  averageDeliveryTime: number;
}

export interface ChannelMetrics {
  channel: string;
  sent: number;
  delivered: number;
  failed: number;
  deliveryRate: number;
  averageResponseTime: number;
}

export interface EngagementMetrics {
  opens: number;
  clicks: number;
  unsubscribes: number;
  openRate: number;
  clickRate: number;
  unsubscribeRate: number;
}

export interface SubscriberEngagement {
  subscriberId: string;
  totalNotifications: number;
  opens: number;
  clicks: number;
  engagementScore: number; // 0-100
  lastEngagementDate: Date;
  preferredChannel: string;
}

@Injectable()
export class DeliveryAnalyticsService {
  private readonly logger = new Logger(DeliveryAnalyticsService.name);

  constructor(
    @InjectRepository(Message)
    private readonly messageRepository: Repository<Message>,
    @InjectRepository(MessageDelivery)
    private readonly deliveryRepository: Repository<MessageDelivery>,
  ) {}

  /**
   * Get delivery metrics for a tenant
   */
  async getDeliveryMetrics(
    tenantId: string,
    startDate?: Date,
    endDate?: Date,
  ): Promise<DeliveryMetrics> {
    const query = this.messageRepository
      .createQueryBuilder("message")
      .where("message.tenantId = :tenantId", { tenantId });

    if (startDate) {
      query.andWhere("message.createdAt >= :startDate", { startDate });
    }
    if (endDate) {
      query.andWhere("message.createdAt <= :endDate", { endDate });
    }

    const messages = await query.getMany();

    const totalSent = messages.length;
    const delivered = messages.filter((m) => m.status === "delivered").length;
    const failed = messages.filter((m) => m.status === "failed").length;
    const pending = messages.filter((m) => m.status === "pending").length;

    const deliveryRate = totalSent > 0 ? (delivered / totalSent) * 100 : 0;
    const failureRate = totalSent > 0 ? (failed / totalSent) * 100 : 0;

    // Calculate average delivery time
    const deliveredMessages = messages.filter((m) => m.deliveredAt && m.createdAt);
    const avgDeliveryTime =
      deliveredMessages.length > 0
        ? deliveredMessages.reduce((sum, m) => {
            const time = m.deliveredAt!.getTime() - m.createdAt.getTime();
            return sum + time;
          }, 0) / deliveredMessages.length
        : 0;

    return {
      totalSent,
      delivered,
      failed,
      pending,
      deliveryRate,
      failureRate,
      averageDeliveryTime: Math.round(avgDeliveryTime / 1000), // Convert to seconds
    };
  }

  /**
   * Get metrics by channel
   */
  async getChannelMetrics(
    tenantId: string,
    startDate?: Date,
    endDate?: Date,
  ): Promise<ChannelMetrics[]> {
    const query = this.messageRepository
      .createQueryBuilder("message")
      .where("message.tenantId = :tenantId", { tenantId });

    if (startDate) {
      query.andWhere("message.createdAt >= :startDate", { startDate });
    }
    if (endDate) {
      query.andWhere("message.createdAt <= :endDate", { endDate });
    }

    const messages = await query.getMany();

    // Group by channel
    const channelMap = new Map<string, any>();

    for (const message of messages) {
      for (const channel of message.channels) {
        if (!channelMap.has(channel)) {
          channelMap.set(channel, {
            channel,
            sent: 0,
            delivered: 0,
            failed: 0,
            totalResponseTime: 0,
            deliveredCount: 0,
          });
        }

        const stats = channelMap.get(channel);
        stats.sent++;

        if (message.status === "delivered") {
          stats.delivered++;
          if (message.deliveredAt && message.createdAt) {
            const responseTime = message.deliveredAt.getTime() - message.createdAt.getTime();
            stats.totalResponseTime += responseTime;
            stats.deliveredCount++;
          }
        } else if (message.status === "failed") {
          stats.failed++;
        }
      }
    }

    // Convert to array and calculate rates
    return Array.from(channelMap.values()).map((stats) => ({
      channel: stats.channel,
      sent: stats.sent,
      delivered: stats.delivered,
      failed: stats.failed,
      deliveryRate: stats.sent > 0 ? (stats.delivered / stats.sent) * 100 : 0,
      averageResponseTime:
        stats.deliveredCount > 0
          ? Math.round(stats.totalResponseTime / stats.deliveredCount / 1000)
          : 0,
    }));
  }

  /**
   * Get engagement metrics
   */
  async getEngagementMetrics(
    tenantId: string,
    startDate?: Date,
    endDate?: Date,
  ): Promise<EngagementMetrics> {
    const query = this.deliveryRepository
      .createQueryBuilder("delivery")
      .leftJoin("delivery.message", "message")
      .where("message.tenantId = :tenantId", { tenantId });

    if (startDate) {
      query.andWhere("delivery.createdAt >= :startDate", { startDate });
    }
    if (endDate) {
      query.andWhere("delivery.createdAt <= :endDate", { endDate });
    }

    const deliveries = await query.getMany();

    const opens = deliveries.filter((d) => d.metadata?.opened).length;
    const clicks = deliveries.filter((d) => d.metadata?.clicked).length;
    const unsubscribes = deliveries.filter((d) => d.metadata?.unsubscribed).length;

    const totalDeliveries = deliveries.length;
    const openRate = totalDeliveries > 0 ? (opens / totalDeliveries) * 100 : 0;
    const clickRate = totalDeliveries > 0 ? (clicks / totalDeliveries) * 100 : 0;
    const unsubscribeRate = totalDeliveries > 0 ? (unsubscribes / totalDeliveries) * 100 : 0;

    return {
      opens,
      clicks,
      unsubscribes,
      openRate,
      clickRate,
      unsubscribeRate,
    };
  }

  /**
   * Get subscriber engagement scores
   */
  async getSubscriberEngagement(
    tenantId: string,
    limit: number = 100,
  ): Promise<SubscriberEngagement[]> {
    const query = this.deliveryRepository
      .createQueryBuilder("delivery")
      .leftJoin("delivery.message", "message")
      .where("message.tenantId = :tenantId", { tenantId })
      .select("delivery.subscriberId", "subscriberId")
      .addSelect("COUNT(delivery.id)", "totalNotifications")
      .addSelect("SUM(CASE WHEN delivery.metadata->'opened' = 'true' THEN 1 ELSE 0 END)", "opens")
      .addSelect("SUM(CASE WHEN delivery.metadata->'clicked' = 'true' THEN 1 ELSE 0 END)", "clicks")
      .addSelect("MAX(delivery.createdAt)", "lastEngagementDate")
      .groupBy("delivery.subscriberId")
      .orderBy("opens", "DESC")
      .limit(limit);

    const results = await query.getRawMany();

    return results.map((r) => ({
      subscriberId: r.subscriberId,
      totalNotifications: parseInt(r.totalNotifications) || 0,
      opens: parseInt(r.opens) || 0,
      clicks: parseInt(r.clicks) || 0,
      engagementScore: this.calculateEngagementScore(
        parseInt(r.opens) || 0,
        parseInt(r.clicks) || 0,
        parseInt(r.totalNotifications) || 1,
      ),
      lastEngagementDate: r.lastEngagementDate,
      preferredChannel: "email", // Can be enhanced with actual channel tracking
    }));
  }

  /**
   * Calculate engagement score (0-100)
   */
  private calculateEngagementScore(opens: number, clicks: number, total: number): number {
    if (total === 0) return 0;
    const openScore = (opens / total) * 50; // Opens worth 50 points
    const clickScore = (clicks / total) * 50; // Clicks worth 50 points
    return Math.min(100, Math.round(openScore + clickScore));
  }

  /**
   * Get delivery trends over time
   */
  async getDeliveryTrends(
    tenantId: string,
    days: number = 30,
  ): Promise<Array<{ date: string; sent: number; delivered: number; failed: number }>> {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const query = this.messageRepository
      .createQueryBuilder("message")
      .where("message.tenantId = :tenantId", { tenantId })
      .andWhere("message.createdAt >= :startDate", { startDate })
      .select("DATE(message.createdAt)", "date")
      .addSelect("COUNT(message.id)", "sent")
      .addSelect("SUM(CASE WHEN message.status = 'delivered' THEN 1 ELSE 0 END)", "delivered")
      .addSelect("SUM(CASE WHEN message.status = 'failed' THEN 1 ELSE 0 END)", "failed")
      .groupBy("DATE(message.createdAt)")
      .orderBy("date", "ASC");

    const results = await query.getRawMany();

    return results.map((r) => ({
      date: r.date,
      sent: parseInt(r.sent) || 0,
      delivered: parseInt(r.delivered) || 0,
      failed: parseInt(r.failed) || 0,
    }));
  }

  /**
   * Get A/B test results
   */
  async getABTestResults(
    tenantId: string,
    testId: string,
  ): Promise<{
    variantA: EngagementMetrics;
    variantB: EngagementMetrics;
    winner: "A" | "B" | "tie";
  }> {
    const query = this.deliveryRepository
      .createQueryBuilder("delivery")
      .leftJoin("delivery.message", "message")
      .where("message.tenantId = :tenantId", { tenantId })
      .andWhere("message.metadata->'testId' = :testId", { testId });

    const deliveries = await query.getMany();

    const variantADeliveries = deliveries.filter((d) => d.metadata?.variant === "A");
    const variantBDeliveries = deliveries.filter((d) => d.metadata?.variant === "B");

    const variantA = this.calculateEngagementMetrics(variantADeliveries);
    const variantB = this.calculateEngagementMetrics(variantBDeliveries);

    // Determine winner based on click rate
    let winner: "A" | "B" | "tie" = "tie";
    if (variantA.clickRate > variantB.clickRate + 5) {
      winner = "A";
    } else if (variantB.clickRate > variantA.clickRate + 5) {
      winner = "B";
    }

    return { variantA, variantB, winner };
  }

  /**
   * Calculate engagement metrics from deliveries
   */
  private calculateEngagementMetrics(deliveries: MessageDelivery[]): EngagementMetrics {
    const opens = deliveries.filter((d) => d.metadata?.opened).length;
    const clicks = deliveries.filter((d) => d.metadata?.clicked).length;
    const unsubscribes = deliveries.filter((d) => d.metadata?.unsubscribed).length;

    const total = deliveries.length;
    const openRate = total > 0 ? (opens / total) * 100 : 0;
    const clickRate = total > 0 ? (clicks / total) * 100 : 0;
    const unsubscribeRate = total > 0 ? (unsubscribes / total) * 100 : 0;

    return {
      opens,
      clicks,
      unsubscribes,
      openRate,
      clickRate,
      unsubscribeRate,
    };
  }
}
