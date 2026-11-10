import { Injectable, Logger } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository, Between, MoreThanOrEqual, LessThanOrEqual } from "typeorm";
import { NotificationLog } from "../notifications/entities/notification-log.entity";

export interface CohortAnalysis {
  cohort: string;
  totalUsers: number;
  activeUsers: number;
  retentionRate: number;
  averageNotificationsPerUser: number;
  conversionRate: number;
}

export interface UserJourneyStep {
  step: number;
  channel: string;
  templateId?: string;
  sentAt: Date;
  status: string;
  timeToNextStep?: number;
}

export interface OptimalSendTime {
  hour: number;
  dayOfWeek: number;
  deliveryRate: number;
  openRate: number;
  clickRate: number;
  confidence: number;
}

export interface RevenueAttribution {
  campaignId?: string;
  totalRevenue: number;
  attributedRevenue: number;
  notificationsSent: number;
  conversionRate: number;
  averageOrderValue: number;
}

export interface AdvancedAnalyticsQuery {
  tenantId: string;
  startDate?: Date;
  endDate?: Date;
  channel?: string;
  segmentId?: string;
  campaignId?: string;
}

@Injectable()
export class AdvancedAnalyticsService {
  private readonly logger = new Logger(AdvancedAnalyticsService.name);

  constructor(
    @InjectRepository(NotificationLog)
    private notificationLogRepository: Repository<NotificationLog>,
  ) {}

  async getCohortAnalysis(
    query: AdvancedAnalyticsQuery,
    cohortType: "weekly" | "monthly" = "monthly",
  ): Promise<CohortAnalysis[]> {
    const startDate = query.startDate || new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
    const endDate = query.endDate || new Date();

    const logs = await this.notificationLogRepository.find({
      where: {
        tenantId: query.tenantId,
        createdAt: Between(startDate, endDate),
      },
      order: { createdAt: "ASC" },
    });

    const cohorts = new Map<
      string,
      {
        users: Set<string>;
        firstActivity: Date;
        totalNotifications: number;
      }
    >();

    logs.forEach((log) => {
      const cohortKey = this.getCohortKey(log.createdAt, cohortType);
      const userKey = `${log.channel}:${log.to}`;

      if (!cohorts.has(cohortKey)) {
        cohorts.set(cohortKey, {
          users: new Set(),
          firstActivity: log.createdAt,
          totalNotifications: 0,
        });
      }

      const cohort = cohorts.get(cohortKey)!;
      cohort.users.add(userKey);
      cohort.totalNotifications++;
    });

    const result: CohortAnalysis[] = [];

    for (const [cohortKey, data] of cohorts) {
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const recentLogs = logs.filter(
        (log) => log.createdAt >= thirtyDaysAgo && data.users.has(`${log.channel}:${log.to}`),
      );

      const activeUsers = new Set(recentLogs.map((log) => `${log.channel}:${log.to}`)).size;

      result.push({
        cohort: cohortKey,
        totalUsers: data.users.size,
        activeUsers,
        retentionRate: data.users.size > 0 ? (activeUsers / data.users.size) * 100 : 0,
        averageNotificationsPerUser:
          data.users.size > 0 ? data.totalNotifications / data.users.size : 0,
        conversionRate: this.calculateConversionRate(logs, data.users),
      });
    }

    return result.toSorted((a, b) => b.cohort.localeCompare(a.cohort));
  }

  async getUserJourney(
    tenantId: string,
    userIdentifier: string,
    limit: number = 50,
  ): Promise<UserJourneyStep[]> {
    const logs = await this.notificationLogRepository.find({
      where: {
        tenantId,
        to: userIdentifier,
      },
      order: { createdAt: "ASC" },
      take: limit,
    });

    const journey: UserJourneyStep[] = logs.map((log, index) => {
      const nextLog = logs[index + 1];
      const timeToNextStep = nextLog
        ? nextLog.createdAt.getTime() - log.createdAt.getTime()
        : undefined;

      return {
        step: index + 1,
        channel: log.channel,
        templateId: log.metadata?.templateId,
        sentAt: log.createdAt,
        status: log.status,
        timeToNextStep,
      };
    });

    return journey;
  }

  async getOptimalSendTimes(query: AdvancedAnalyticsQuery): Promise<OptimalSendTime[]> {
    const logs = await this.notificationLogRepository.find({
      where: {
        tenantId: query.tenantId,
        createdAt:
          query.startDate && query.endDate
            ? Between(query.startDate, query.endDate)
            : MoreThanOrEqual(new Date(Date.now() - 90 * 24 * 60 * 60 * 1000)),
        status: "delivered",
      },
    });

    const performance = new Map<
      string,
      {
        sent: number;
        delivered: number;
        opened: number;
        clicked: number;
      }
    >();

    logs.forEach((log) => {
      const hour = log.sentAt?.getHours() || log.createdAt.getHours();
      const dayOfWeek = log.sentAt?.getDay() || log.createdAt.getDay();
      const key = `${dayOfWeek}-${hour}`;

      const stats = performance.get(key) || { sent: 0, delivered: 0, opened: 0, clicked: 0 };
      stats.sent++;
      stats.delivered++;
      performance.set(key, stats);
    });

    const optimalTimes: OptimalSendTime[] = [];

    for (const [key, stats] of performance) {
      const [dayOfWeek, hour] = key.split("-").map(Number);

      if (stats.sent >= 10) {
        optimalTimes.push({
          hour,
          dayOfWeek,
          deliveryRate: (stats.delivered / stats.sent) * 100,
          openRate: 0,
          clickRate: 0,
          confidence: Math.min(stats.sent / 100, 1) * 100,
        });
      }
    }

    return optimalTimes.toSorted((a, b) => b.deliveryRate - a.deliveryRate).slice(0, 10);
  }

  async getChurnRiskAnalysis(tenantId: string): Promise<any[]> {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const sixtyDaysAgo = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000);

    const recentLogs = await this.notificationLogRepository.find({
      where: {
        tenantId,
        createdAt: MoreThanOrEqual(sixtyDaysAgo),
      },
    });

    const userActivity = new Map<string, Date[]>();

    recentLogs.forEach((log) => {
      const userKey = `${log.channel}:${log.to}`;
      const dates = userActivity.get(userKey) || [];
      dates.push(log.createdAt);
      userActivity.set(userKey, dates);
    });

    const churnRisk: any[] = [];

    for (const [userKey, dates] of userActivity) {
      const lastActivity = Math.max(...dates.map((d) => d.getTime()));
      const daysSinceLastActivity = (Date.now() - lastActivity) / (24 * 60 * 60 * 1000);

      const activityFrequency = dates.length / 60;
      const recencyScore = Math.max(0, 30 - daysSinceLastActivity) / 30;

      let riskLevel = "low";
      if (daysSinceLastActivity > 14) riskLevel = "medium";
      if (daysSinceLastActivity > 21) riskLevel = "high";

      churnRisk.push({
        userKey,
        lastActivity: new Date(lastActivity),
        daysSinceLastActivity,
        activityFrequency,
        recencyScore,
        churnRisk: riskLevel,
        recommendedAction: this.getChurnAction(riskLevel),
      });
    }

    return churnRisk.toSorted((a, b) => b.daysSinceLastActivity - a.daysSinceLastActivity);
  }

  private getCohortKey(date: Date, type: "weekly" | "monthly"): string {
    if (type === "weekly") {
      const year = date.getFullYear();
      const week = Math.ceil((date.getDate() - date.getDay() + 1) / 7);
      return `${year}-W${week.toString().padStart(2, "0")}`;
    } else {
      return `${date.toLocaleString("en-US", { month: "short" })}-${date.getFullYear()}`;
    }
  }

  private calculateConversionRate(logs: NotificationLog[], users: Set<string>): number {
    const convertedUsers = new Set<string>();

    logs.forEach((log) => {
      const userKey = `${log.channel}:${log.to}`;
      if (users.has(userKey) && log.status === "delivered") {
        convertedUsers.add(userKey);
      }
    });

    return users.size > 0 ? (convertedUsers.size / users.size) * 100 : 0;
  }

  private getChurnAction(riskLevel: string): string {
    switch (riskLevel) {
      case "high":
        return "Send re-engagement campaign immediately";
      case "medium":
        return "Send reminder notification";
      case "low":
        return "Monitor activity";
      default:
        return "No action needed";
    }
  }
}
