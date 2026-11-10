import { Injectable, Logger } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Between, Repository } from "typeorm";
import { NotificationChannel } from "../../../common/enums/notification-channel.enum";
import { ProviderUsageLog } from "../entities/provider-usage-log.entity";
import {
  ProviderCostModel,
  ProviderUsageMetrics,
  TimeSeriesData,
} from "../interfaces/byop.interface";
import { ProviderConfig } from "../provider-config.entity";

export interface CostCalculationResult {
  totalCost: number;
  providerCost: number;
  infrastructureCost: number;
  breakdown: {
    base: number;
    overage: number;
    infrastructure: number;
  };
  savings?: {
    amount: number;
    percentage: number;
    comparedTo: string;
  };
}

export interface CostAlert {
  type: "threshold_exceeded" | "budget_warning" | "unusual_spike" | "cost_optimization";
  severity: "info" | "warning" | "critical";
  message: string;
  currentCost: number;
  threshold?: number;
  recommendations?: string[];
}

@Injectable()
export class ProviderCostTrackerService {
  private readonly logger = new Logger(ProviderCostTrackerService.name);

  constructor(
    @InjectRepository(ProviderUsageLog)
    private readonly usageLogRepository: Repository<ProviderUsageLog>,
    @InjectRepository(ProviderConfig)
    private readonly providerConfigRepository: Repository<ProviderConfig>,
  ) {}

  calculateCost(
    costModel: ProviderCostModel,
    messageCount: number,
    metadata?: Record<string, any>,
  ): CostCalculationResult {
    let providerCost = 0;
    let infrastructureCost = 0;

    if (costModel.type === "per_message") {
      if (costModel.tiers) {
        let remaining = messageCount;
        for (const tier of costModel.tiers) {
          const tierMessages = tier.to ? Math.min(remaining, tier.to - tier.from) : remaining;
          providerCost += tierMessages * tier.rate;
          remaining -= tierMessages;
          if (remaining <= 0) break;
        }
      } else {
        providerCost = messageCount * costModel.baseRate;
      }

      if (costModel.infrastructureFee) {
        infrastructureCost = messageCount * costModel.infrastructureFee;
      }
    } else if (costModel.type === "monthly") {
      providerCost = costModel.baseRate;
      infrastructureCost = costModel.infrastructureFee || 0;
    }

    if (costModel.minimumCharge && providerCost < costModel.minimumCharge) {
      providerCost = costModel.minimumCharge;
    }

    const totalCost = providerCost + infrastructureCost;

    return {
      totalCost,
      providerCost,
      infrastructureCost,
      breakdown: {
        base: providerCost,
        overage: 0,
        infrastructure: infrastructureCost,
      },
    };
  }

  async logUsage(
    providerConfigId: string,
    usage: {
      messageCount: number;
      successfulCount: number;
      failedCount: number;
      averageLatencyMs: number;
      errorBreakdown?: Record<string, number>;
      periodStart: Date;
      periodEnd: Date;
    },
  ): Promise<void> {
    const providerConfig = await this.providerConfigRepository.findOne({
      where: { id: providerConfigId },
    });

    if (!providerConfig) {
      throw new Error(`Provider config ${providerConfigId} not found`);
    }

    const costModel = this.extractCostModel(providerConfig);
    const costResult = this.calculateCost(costModel, usage.messageCount);

    const usageLog = this.usageLogRepository.create({
      providerConfigId,
      channel: providerConfig.channel,
      messageCount: usage.messageCount,
      successfulCount: usage.successfulCount,
      failedCount: usage.failedCount,
      totalCost: costResult.totalCost,
      providerCost: costResult.providerCost,
      infrastructureCost: costResult.infrastructureCost,
      averageLatencyMs: usage.averageLatencyMs,
      errorBreakdown: usage.errorBreakdown,
      currency: costModel.currency,
      periodStart: usage.periodStart,
      periodEnd: usage.periodEnd,
    });

    await this.usageLogRepository.save(usageLog);

    this.logger.debug(
      `Logged usage for provider ${providerConfigId}: ${usage.messageCount} messages, $${costResult.totalCost.toFixed(4)}`,
    );
  }

  async getUsageMetrics(
    providerConfigId: string,
    startDate: Date,
    endDate: Date,
  ): Promise<ProviderUsageMetrics> {
    const providerConfig = await this.providerConfigRepository.findOne({
      where: { id: providerConfigId },
    });

    if (!providerConfig) {
      throw new Error(`Provider config ${providerConfigId} not found`);
    }

    const usageLogs = await this.usageLogRepository.find({
      where: {
        providerConfigId,
        periodStart: Between(startDate, endDate),
      },
      order: { periodStart: "ASC" },
    });

    const totalMessages = usageLogs.reduce((sum, log) => sum + log.messageCount, 0);
    const successfulMessages = usageLogs.reduce((sum, log) => sum + log.successfulCount, 0);
    const failedMessages = usageLogs.reduce((sum, log) => sum + log.failedCount, 0);
    const totalCost = usageLogs.reduce((sum, log) => sum + log.totalCost, 0);
    const infrastructureCost = usageLogs.reduce((sum, log) => sum + log.infrastructureCost, 0);
    const providerCost = usageLogs.reduce((sum, log) => sum + log.providerCost, 0);

    const totalLatency = usageLogs.reduce(
      (sum, log) => sum + log.averageLatencyMs * log.messageCount,
      0,
    );
    const averageLatency = totalMessages > 0 ? totalLatency / totalMessages : 0;

    const deliveryRate = totalMessages > 0 ? (successfulMessages / totalMessages) * 100 : 0;

    const errorBreakdown: Record<string, number> = {};
    usageLogs.forEach((log) => {
      if (log.errorBreakdown) {
        Object.entries(log.errorBreakdown).forEach(([error, count]) => {
          errorBreakdown[error] = (errorBreakdown[error] || 0) + count;
        });
      }
    });

    return {
      providerId: providerConfig.providerId,
      channel: providerConfig.channel,
      period: { start: startDate, end: endDate },
      totalMessages,
      successfulMessages,
      failedMessages,
      totalCost,
      infrastructureCost,
      providerCost,
      averageLatency,
      deliveryRate,
      errorBreakdown,
      costBreakdown: {
        base: providerCost,
        overage: 0,
        infrastructure: infrastructureCost,
      },
    };
  }

  async getCostTrends(
    tenantId: string,
    channel?: NotificationChannel,
    startDate?: Date,
    endDate?: Date,
    granularity: "hour" | "day" | "week" | "month" = "day",
  ): Promise<TimeSeriesData[]> {
    const queryBuilder = this.usageLogRepository
      .createQueryBuilder("usage")
      .leftJoin("usage.providerConfig", "config")
      .leftJoin("config.project", "project")
      .where("project.tenantId = :tenantId", { tenantId });

    if (channel) {
      queryBuilder.andWhere("usage.channel = :channel", { channel });
    }

    if (startDate) {
      queryBuilder.andWhere("usage.periodStart >= :startDate", { startDate });
    }

    if (endDate) {
      queryBuilder.andWhere("usage.periodEnd <= :endDate", { endDate });
    }

    let dateFormat: string;
    switch (granularity) {
      case "hour":
        dateFormat = "%Y-%m-%d %H:00:00";
        break;
      case "day":
        dateFormat = "%Y-%m-%d";
        break;
      case "week":
        dateFormat = "%Y-%u";
        break;
      case "month":
        dateFormat = "%Y-%m";
        break;
    }

    const results = await queryBuilder
      .select([
        `DATE_FORMAT(usage.periodStart, '${dateFormat}') as period`,
        "SUM(usage.totalCost) as totalCost",
        "SUM(usage.messageCount) as messageCount",
      ])
      .groupBy("period")
      .orderBy("period", "ASC")
      .getRawMany();

    return results.map((result) => ({
      timestamp: new Date(result.period),
      value: parseFloat(result.totalCost),
      metadata: {
        messageCount: parseInt(result.messageCount),
      },
    }));
  }

  async compareProviderCosts(
    tenantId: string,
    channel: NotificationChannel,
    startDate: Date,
    endDate: Date,
  ): Promise<{
    providers: Array<{
      providerId: string;
      providerName: string;
      totalCost: number;
      messageCount: number;
      costPerMessage: number;
      deliveryRate: number;
    }>;
    recommendations: string[];
  }> {
    const queryBuilder = this.usageLogRepository
      .createQueryBuilder("usage")
      .leftJoin("usage.providerConfig", "config")
      .leftJoin("config.project", "project")
      .where("project.tenantId = :tenantId", { tenantId })
      .andWhere("usage.channel = :channel", { channel })
      .andWhere("usage.periodStart >= :startDate", { startDate })
      .andWhere("usage.periodEnd <= :endDate", { endDate });

    const results = await queryBuilder
      .select([
        "config.providerId as providerId",
        "config.providerName as providerName",
        "SUM(usage.totalCost) as totalCost",
        "SUM(usage.messageCount) as messageCount",
        "SUM(usage.successfulCount) as successfulCount",
      ])
      .groupBy("config.providerId, config.providerName")
      .orderBy("totalCost", "ASC")
      .getRawMany();

    const providers = results.map((result) => ({
      providerId: result.providerId,
      providerName: result.providerName,
      totalCost: parseFloat(result.totalCost),
      messageCount: parseInt(result.messageCount),
      costPerMessage: parseFloat(result.totalCost) / parseInt(result.messageCount),
      deliveryRate: (parseInt(result.successfulCount) / parseInt(result.messageCount)) * 100,
    }));

    const recommendations: string[] = [];
    if (providers.length > 1) {
      const cheapest = providers[0];
      const mostExpensive = providers[providers.length - 1];

      if (mostExpensive.totalCost > cheapest.totalCost * 1.2) {
        const savings = mostExpensive.totalCost - cheapest.totalCost;
        recommendations.push(
          `Consider switching from ${mostExpensive.providerName} to ${cheapest.providerName} to save $${savings.toFixed(2)} (${((savings / mostExpensive.totalCost) * 100).toFixed(1)}%)`,
        );
      }

      const bestDelivery = providers.reduce((best, current) =>
        current.deliveryRate > best.deliveryRate ? current : best,
      );

      if (bestDelivery.deliveryRate > 95 && bestDelivery.providerId !== cheapest.providerId) {
        recommendations.push(
          `${bestDelivery.providerName} has the highest delivery rate (${bestDelivery.deliveryRate.toFixed(1)}%) - consider for critical messages`,
        );
      }
    }

    return { providers, recommendations };
  }

  async checkCostAlerts(
    tenantId: string,
    thresholds: {
      dailyLimit?: number;
      monthlyLimit?: number;
      spikeThreshold?: number;
    },
  ): Promise<CostAlert[]> {
    const alerts: CostAlert[] = [];
    const now = new Date();

    if (thresholds.dailyLimit) {
      const dayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);

      const dailyCosts = await this.getTotalCosts(tenantId, dayStart, dayEnd);

      if (dailyCosts >= thresholds.dailyLimit) {
        alerts.push({
          type: "threshold_exceeded",
          severity: "critical",
          message: `Daily cost limit exceeded: $${dailyCosts.toFixed(2)} / $${thresholds.dailyLimit}`,
          currentCost: dailyCosts,
          threshold: thresholds.dailyLimit,
        });
      } else if (dailyCosts >= thresholds.dailyLimit * 0.8) {
        alerts.push({
          type: "budget_warning",
          severity: "warning",
          message: `Daily cost approaching limit: $${dailyCosts.toFixed(2)} / $${thresholds.dailyLimit}`,
          currentCost: dailyCosts,
          threshold: thresholds.dailyLimit,
        });
      }
    }

    if (thresholds.monthlyLimit) {
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);

      const monthlyCosts = await this.getTotalCosts(tenantId, monthStart, monthEnd);

      if (monthlyCosts >= thresholds.monthlyLimit) {
        alerts.push({
          type: "threshold_exceeded",
          severity: "critical",
          message: `Monthly cost limit exceeded: $${monthlyCosts.toFixed(2)} / $${thresholds.monthlyLimit}`,
          currentCost: monthlyCosts,
          threshold: thresholds.monthlyLimit,
        });
      }
    }

    if (thresholds.spikeThreshold) {
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const yesterdayStart = new Date(todayStart.getTime() - 24 * 60 * 60 * 1000);

      const todayCosts = await this.getTotalCosts(tenantId, todayStart, now);
      const yesterdayCosts = await this.getTotalCosts(tenantId, yesterdayStart, todayStart);

      if (yesterdayCosts > 0) {
        const increase = ((todayCosts - yesterdayCosts) / yesterdayCosts) * 100;

        if (increase >= thresholds.spikeThreshold) {
          alerts.push({
            type: "unusual_spike",
            severity: "warning",
            message: `Unusual cost spike detected: ${increase.toFixed(1)}% increase from yesterday`,
            currentCost: todayCosts,
            recommendations: [
              "Review recent message volume",
              "Check for failed messages causing retries",
              "Verify provider configurations",
            ],
          });
        }
      }
    }

    return alerts;
  }

  async getCostOptimizationRecommendations(
    tenantId: string,
    channel?: NotificationChannel,
  ): Promise<{
    recommendations: Array<{
      type:
        | "provider_switch"
        | "volume_optimization"
        | "timing_optimization"
        | "configuration_change";
      title: string;
      description: string;
      estimatedSavings: number;
      effort: "low" | "medium" | "high";
      impact: "low" | "medium" | "high";
    }>;
    totalPotentialSavings: number;
  }> {
    const recommendations: any[] = [];
    let totalPotentialSavings = 0;

    const endDate = new Date();
    const startDate = new Date(endDate.getTime() - 30 * 24 * 60 * 60 * 1000);

    const comparison = await this.compareProviderCosts(tenantId, channel!, startDate, endDate);

    if (comparison.providers.length > 1) {
      const cheapest = comparison.providers[0];
      const current = comparison.providers.find((p) => p.messageCount > 0);

      if (current && current.providerId !== cheapest.providerId) {
        const savings = (current.costPerMessage - cheapest.costPerMessage) * current.messageCount;
        if (savings > 10) {
          recommendations.push({
            type: "provider_switch",
            title: `Switch to ${cheapest.providerName}`,
            description: `Save $${savings.toFixed(2)} per month by switching from ${current.providerName}`,
            estimatedSavings: savings,
            effort: "medium",
            impact: "high",
          });
          totalPotentialSavings += savings;
        }
      }
    }

    const volumeAnalysis = await this.analyzeVolumePatterns(tenantId, channel, startDate, endDate);
    if (volumeAnalysis.wastedMessages > 100) {
      const savings = volumeAnalysis.wastedMessages * 0.001;
      recommendations.push({
        type: "volume_optimization",
        title: "Reduce Failed Messages",
        description: `${volumeAnalysis.wastedMessages} messages failed in the last 30 days. Improve targeting to reduce waste.`,
        estimatedSavings: savings,
        effort: "low",
        impact: "medium",
      });
      totalPotentialSavings += savings;
    }

    return {
      recommendations,
      totalPotentialSavings,
    };
  }

  private async getTotalCosts(tenantId: string, startDate: Date, endDate: Date): Promise<number> {
    const result = await this.usageLogRepository
      .createQueryBuilder("usage")
      .leftJoin("usage.providerConfig", "config")
      .leftJoin("config.project", "project")
      .where("project.tenantId = :tenantId", { tenantId })
      .andWhere("usage.periodStart >= :startDate", { startDate })
      .andWhere("usage.periodEnd <= :endDate", { endDate })
      .select("SUM(usage.totalCost)", "totalCost")
      .getRawOne();

    return parseFloat(result.totalCost) || 0;
  }

  private async analyzeVolumePatterns(
    tenantId: string,
    channel?: NotificationChannel,
    startDate?: Date,
    endDate?: Date,
  ): Promise<{
    totalMessages: number;
    successfulMessages: number;
    failedMessages: number;
    wastedMessages: number;
  }> {
    const queryBuilder = this.usageLogRepository
      .createQueryBuilder("usage")
      .leftJoin("usage.providerConfig", "config")
      .leftJoin("config.project", "project")
      .where("project.tenantId = :tenantId", { tenantId });

    if (channel) {
      queryBuilder.andWhere("usage.channel = :channel", { channel });
    }

    if (startDate) {
      queryBuilder.andWhere("usage.periodStart >= :startDate", { startDate });
    }

    if (endDate) {
      queryBuilder.andWhere("usage.periodEnd <= :endDate", { endDate });
    }

    const result = await queryBuilder
      .select([
        "SUM(usage.messageCount) as totalMessages",
        "SUM(usage.successfulCount) as successfulMessages",
        "SUM(usage.failedCount) as failedMessages",
      ])
      .getRawOne();

    const totalMessages = parseInt(result.totalMessages) || 0;
    const successfulMessages = parseInt(result.successfulMessages) || 0;
    const failedMessages = parseInt(result.failedMessages) || 0;

    return {
      totalMessages,
      successfulMessages,
      failedMessages,
      wastedMessages: failedMessages,
    };
  }

  private extractCostModel(providerConfig: ProviderConfig): ProviderCostModel {
    const metadata = providerConfig.metadata || {};

    return {
      type: metadata.costModel?.type || "per_message",
      baseRate: metadata.costModel?.baseRate || 0.001,
      currency: metadata.costModel?.currency || "USD",
      infrastructureFee: metadata.costModel?.infrastructureFee || 0.0003,
      tiers: metadata.costModel?.tiers,
      minimumCharge: metadata.costModel?.minimumCharge,
    };
  }
}
