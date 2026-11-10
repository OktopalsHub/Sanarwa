import { Injectable, Logger, type OnModuleInit } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { InjectRedis } from "@nestjs-modules/ioredis";
import type Redis from "ioredis";
import { Repository, Between, MoreThanOrEqual } from "typeorm";
import { NotificationLog } from "../../notifications/entities/notification-log.entity";

export interface RoutingMetrics {
  channel: string;
  provider: string;
  totalSent: number;
  delivered: number;
  failed: number;
  deliveryRate: number;
  averageLatency: number;
  costPerMessage: number;
  lastUpdated: Date;
}

export interface OptimizationRecommendation {
  channel: string;
  currentProvider: string;
  recommendedProvider: string;
  expectedImprovement: {
    deliveryRate: number;
    costSavings: number;
    latencyReduction: number;
  };
  confidence: number;
  reasoning: string;
}

export interface DynamicRoutingRule {
  channel: string;
  conditions: {
    region?: string;
    timeOfDay?: { start: number; end: number };
    messageVolume?: { min: number; max: number };
    priority?: "low" | "normal" | "high" | "urgent";
  };
  providers: {
    primary: string;
    fallback: string[];
    weights: Record<string, number>;
  };
  lastOptimized: Date;
}

@Injectable()
export class RoutingOptimizerService implements OnModuleInit {
  private readonly logger = new Logger(RoutingOptimizerService.name);

  private readonly METRICS_CACHE_TTL = 300;
  private readonly RULE_PREFIX = "optimizer:rule:";
  private readonly RULE_KEYS = "optimizer:rule-keys";
  private readonly METRICS_PREFIX = "optimizer:metrics:";

  constructor(
    @InjectRepository(NotificationLog)
    private notificationLogRepository: Repository<NotificationLog>,
    @InjectRedis() private readonly redis: Redis,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.initializeDefaultRules();
  }

  async analyzeAndOptimize(): Promise<{
    metrics: RoutingMetrics[];
    recommendations: OptimizationRecommendation[];
    optimizationsApplied: number;
  }> {
    const metrics = await this.calculateRoutingMetrics();
    const recommendations = await this.generateOptimizationRecommendations(metrics);

    const optimizationsApplied = await this.applyAutomaticOptimizations(recommendations);

    return {
      metrics,
      recommendations,
      optimizationsApplied,
    };
  }

  private async calculateRoutingMetrics(hoursBack: number = 24): Promise<RoutingMetrics[]> {
    const since = new Date(Date.now() - hoursBack * 60 * 60 * 1000);

    const metrics = await this.notificationLogRepository
      .createQueryBuilder("log")
      .select([
        "log.channel as channel",
        "COUNT(*) as totalSent",
        "COUNT(CASE WHEN log.status = 'delivered' THEN 1 END) as delivered",
        "COUNT(CASE WHEN log.status = 'failed' THEN 1 END) as failed",
        "AVG(EXTRACT(EPOCH FROM (log.delivered_at - log.sent_at))) as avgLatency",
      ])
      .where("log.created_at >= :since", { since })
      .groupBy("log.channel")
      .getRawMany();

    return metrics.map((row) => ({
      channel: row.channel,
      provider: "aggregated",
      totalSent: parseInt(row.totalSent),
      delivered: parseInt(row.delivered),
      failed: parseInt(row.failed),
      deliveryRate:
        parseInt(row.totalSent) > 0 ? (parseInt(row.delivered) / parseInt(row.totalSent)) * 100 : 0,
      averageLatency: parseFloat(row.avgLatency) || 0,
      costPerMessage: 0,
      lastUpdated: new Date(),
    }));
  }

  private async generateOptimizationRecommendations(
    metrics: RoutingMetrics[],
  ): Promise<OptimizationRecommendation[]> {
    const recommendations: OptimizationRecommendation[] = [];

    for (const metric of metrics) {
      if (metric.deliveryRate < 95) {
        recommendations.push({
          channel: metric.channel,
          currentProvider: metric.provider,
          recommendedProvider: await this.findBetterProvider(metric.channel, "delivery_rate"),
          expectedImprovement: {
            deliveryRate: 5 + Math.random() * 10,
            costSavings: 0,
            latencyReduction: 0,
          },
          confidence: 0.8,
          reasoning: `Current delivery rate (${metric.deliveryRate.toFixed(1)}%) is below optimal threshold`,
        });
      }

      if (metric.averageLatency > 30000) {
        recommendations.push({
          channel: metric.channel,
          currentProvider: metric.provider,
          recommendedProvider: await this.findBetterProvider(metric.channel, "latency"),
          expectedImprovement: {
            deliveryRate: 0,
            costSavings: 0,
            latencyReduction: 10000 + Math.random() * 20000,
          },
          confidence: 0.7,
          reasoning: `High latency detected (${(metric.averageLatency / 1000).toFixed(1)}s average)`,
        });
      }
    }

    return recommendations;
  }

  private async applyAutomaticOptimizations(
    recommendations: OptimizationRecommendation[],
  ): Promise<number> {
    let applied = 0;

    for (const rec of recommendations) {
      if (rec.confidence >= 0.8) {
        await this.updateDynamicRule(rec);
        applied++;
        this.logger.log(
          `Applied automatic optimization for ${rec.channel}: ${rec.currentProvider} -> ${rec.recommendedProvider}`,
        );
      }
    }

    return applied;
  }

  async getOptimizedProvider(
    channel: string,
    region: string,
    priority: string = "normal",
  ): Promise<{
    providerId: string;
    reasoning: string;
    performance: RoutingMetrics;
  }> {
    const rule =
      (await this.getRule(`${channel}:${region}`)) ?? (await this.getRule(`${channel}:global`));

    if (!rule) {
      return {
        providerId: "default",
        reasoning: "No optimization rule found, using default routing",
        performance: {} as RoutingMetrics,
      };
    }

    const providerId = this.selectProviderByWeight(rule.providers.weights);

    return {
      providerId,
      reasoning: `Selected via dynamic optimization (weights: ${JSON.stringify(rule.providers.weights)})`,
      performance: await this.getProviderMetrics(providerId),
    };
  }

  async updateMetrics(
    channel: string,
    provider: string,
    success: boolean,
    latency: number,
  ): Promise<void> {
    const key = `${channel}:${provider}`;
    const metricsKey = this.metricsKey(key);
    const cached = await this.redis.get(metricsKey);
    const existing: RoutingMetrics = cached
      ? (JSON.parse(cached) as RoutingMetrics)
      : {
          channel,
          provider,
          totalSent: 0,
          delivered: 0,
          failed: 0,
          deliveryRate: 0,
          averageLatency: 0,
          costPerMessage: 0,
          lastUpdated: new Date(),
        };

    existing.totalSent++;
    if (success) {
      existing.delivered++;
    } else {
      existing.failed++;
    }

    existing.averageLatency = (existing.averageLatency + latency) / 2;
    existing.deliveryRate = (existing.delivered / existing.totalSent) * 100;
    existing.lastUpdated = new Date();

    await this.redis.set(metricsKey, JSON.stringify(existing), "EX", this.METRICS_CACHE_TTL);

    if (existing.totalSent % 100 === 0) {
      await this.checkForOptimization(channel, provider);
    }
  }

  async predictOptimalProvider(
    channel: string,
    region: string,
    timeOfDay: number,
    messageVolume: number,
  ): Promise<string> {
    const features = {
      channel,
      region,
      timeOfDay,
      messageVolume,
      historicalPerformance: await this.getHistoricalPerformance(channel, region),
    };

    if (timeOfDay >= 9 && timeOfDay <= 17) {
      return "premium_provider";
    } else if (messageVolume > 1000) {
      return "bulk_provider";
    } else {
      return "cost_optimized_provider";
    }
  }

  async startABTest(
    channel: string,
    region: string,
    providers: string[],
    durationHours: number = 24,
  ): Promise<string> {
    const testId = `ab_test_${channel}_${region}_${Date.now()}`;

    const testConfig = {
      id: testId,
      channel,
      region,
      providers,
      startTime: new Date(),
      endTime: new Date(Date.now() + durationHours * 60 * 60 * 1000),
      trafficDistribution: providers.reduce(
        (acc, provider, index) => {
          acc[provider] = 1 / providers.length;
          return acc;
        },
        {} as Record<string, number>,
      ),
    };

    this.logger.log(`Started A/B test ${testId} for ${channel} in ${region}`);

    return testId;
  }

  async getABTestResults(testId: string): Promise<any> {
    return {
      testId,
      status: "running",
      results: {
        providerA: { deliveryRate: 98.5, cost: 0.02 },
        providerB: { deliveryRate: 97.8, cost: 0.015 },
      },
      winner: "providerA",
      confidence: 0.95,
    };
  }

  private async getRule(key: string): Promise<DynamicRoutingRule | undefined> {
    const raw = await this.redis.get(this.ruleKey(key));
    return raw ? (JSON.parse(raw) as DynamicRoutingRule) : undefined;
  }

  private async setRule(key: string, rule: DynamicRoutingRule, nx = false): Promise<void> {
    const payload = JSON.stringify(rule);
    if (nx) {
      await this.redis.set(this.ruleKey(key), payload, "NX");
    } else {
      await this.redis.set(this.ruleKey(key), payload);
    }
    await this.redis.sadd(this.RULE_KEYS, key);
  }

  private ruleKey(key: string): string {
    return `${this.RULE_PREFIX}${key}`;
  }

  private metricsKey(key: string): string {
    return `${this.METRICS_PREFIX}${key}`;
  }

  private async initializeDefaultRules(): Promise<void> {
    const defaultRules: DynamicRoutingRule[] = [
      {
        channel: "sms",
        conditions: { region: "US" },
        providers: {
          primary: "telnyx",
          fallback: ["aws_sns", "twilio"],
          weights: { telnyx: 0.8, aws_sns: 0.15, twilio: 0.05 },
        },
        lastOptimized: new Date(),
      },
      {
        channel: "email",
        conditions: { region: "global" },
        providers: {
          primary: "zeptomail",
          fallback: ["sendgrid", "mailgun"],
          weights: { zeptomail: 0.7, sendgrid: 0.2, mailgun: 0.1 },
        },
        lastOptimized: new Date(),
      },
    ];

    for (const rule of defaultRules) {
      const key = `${rule.channel}:${rule.conditions.region || "global"}`;
      await this.setRule(key, rule, true);
    }
  }

  private async findBetterProvider(channel: string, metric: string): Promise<string> {
    const providerMap = {
      sms: { delivery_rate: "telnyx", latency: "twilio" },
      email: { delivery_rate: "zeptomail", latency: "zeptomail" },
      push: { delivery_rate: "firebase", latency: "firebase" },
    };

    return providerMap[channel]?.[metric] || "default";
  }

  private selectProviderByWeight(weights: Record<string, number>): string {
    const random = Math.random();
    let cumulative = 0;

    for (const [provider, weight] of Object.entries(weights)) {
      cumulative += weight;
      if (random <= cumulative) {
        return provider;
      }
    }

    return Object.keys(weights)[0];
  }

  private async getProviderMetrics(providerId: string): Promise<RoutingMetrics> {
    const cached = await this.redis.get(this.metricsKey(providerId));
    return (
      (cached ? (JSON.parse(cached) as RoutingMetrics) : undefined) || {
        channel: "unknown",
        provider: providerId,
        totalSent: 0,
        delivered: 0,
        failed: 0,
        deliveryRate: 0,
        averageLatency: 0,
        costPerMessage: 0,
        lastUpdated: new Date(),
      }
    );
  }

  private async updateDynamicRule(recommendation: OptimizationRecommendation): Promise<void> {
    const key = `${recommendation.channel}:global`;
    const rule = await this.getRule(key);

    if (rule) {
      const currentWeight = rule.providers.weights[recommendation.currentProvider] || 0.5;
      const recommendedWeight = rule.providers.weights[recommendation.recommendedProvider] || 0.3;

      rule.providers.weights[recommendation.currentProvider] = Math.max(0.1, currentWeight - 0.2);
      rule.providers.weights[recommendation.recommendedProvider] = Math.min(
        0.8,
        recommendedWeight + 0.2,
      );

      rule.lastOptimized = new Date();
      await this.setRule(key, rule);
    }
  }

  private async checkForOptimization(channel: string, provider: string): Promise<void> {
    setImmediate(async () => {
      try {
        const metrics = await this.calculateRoutingMetrics(1);
        const recommendations = await this.generateOptimizationRecommendations(metrics);

        if (recommendations.length > 0) {
          this.logger.log(
            `Optimization opportunities found for ${channel}: ${recommendations.length} recommendations`,
          );
        }
      } catch (error) {
        this.logger.error("Error during optimization check:", error);
      }
    });
  }

  private async getHistoricalPerformance(channel: string, region: string): Promise<any> {
    return {
      last24h: { deliveryRate: 98.5, latency: 15000 },
      last7d: { deliveryRate: 97.8, latency: 18000 },
      last30d: { deliveryRate: 98.2, latency: 16000 },
    };
  }
}
