import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between, MoreThanOrEqual } from 'typeorm';
import { NotificationLog } from '../../notifications/entities/notification-log.entity';

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
    priority?: 'low' | 'normal' | 'high' | 'urgent';
  };
  providers: {
    primary: string;
    fallback: string[];
    weights: Record<string, number>; // Dynamic weights based on performance
  };
  lastOptimized: Date;
}

@Injectable()
export class RoutingOptimizerService {
  private readonly logger = new Logger(RoutingOptimizerService.name);

  // In-memory cache for routing metrics
  private metricsCache = new Map<string, RoutingMetrics>();
  private recommendationsCache = new Map<string, OptimizationRecommendation[]>();
  private dynamicRules = new Map<string, DynamicRoutingRule>();

  // Cache TTL
  private readonly METRICS_CACHE_TTL = 300000; // 5 minutes
  private readonly RECOMMENDATIONS_CACHE_TTL = 1800000; // 30 minutes

  constructor(
    @InjectRepository(NotificationLog)
    private notificationLogRepository: Repository<NotificationLog>,
  ) {
    // Initialize with default dynamic rules
    this.initializeDefaultRules();
  }

  /**
   * Analyze routing performance and generate optimization recommendations
   */
  async analyzeAndOptimize(): Promise<{
    metrics: RoutingMetrics[];
    recommendations: OptimizationRecommendation[];
    optimizationsApplied: number;
  }> {
    const metrics = await this.calculateRoutingMetrics();
    const recommendations = await this.generateOptimizationRecommendations(metrics);

    // Apply automatic optimizations where confidence is high
    const optimizationsApplied = await this.applyAutomaticOptimizations(recommendations);

    return {
      metrics,
      recommendations,
      optimizationsApplied,
    };
  }

  /**
   * Calculate real-time routing metrics from notification logs
   */
  private async calculateRoutingMetrics(
    hoursBack: number = 24
  ): Promise<RoutingMetrics[]> {
    const since = new Date(Date.now() - hoursBack * 60 * 60 * 1000);

    // Use raw SQL for better performance on large datasets
    const metrics = await this.notificationLogRepository
      .createQueryBuilder('log')
      .select([
        'log.channel as channel',
        'COUNT(*) as totalSent',
        'COUNT(CASE WHEN log.status = \'delivered\' THEN 1 END) as delivered',
        'COUNT(CASE WHEN log.status = \'failed\' THEN 1 END) as failed',
        'AVG(EXTRACT(EPOCH FROM (log.delivered_at - log.sent_at))) as avgLatency',
      ])
      .where('log.created_at >= :since', { since })
      .groupBy('log.channel')
      .getRawMany();

    return metrics.map(row => ({
      channel: row.channel,
      provider: 'aggregated', // Would need provider tracking in logs
      totalSent: parseInt(row.totalSent),
      delivered: parseInt(row.delivered),
      failed: parseInt(row.failed),
      deliveryRate: parseInt(row.totalSent) > 0 ?
        (parseInt(row.delivered) / parseInt(row.totalSent)) * 100 : 0,
      averageLatency: parseFloat(row.avgLatency) || 0,
      costPerMessage: 0, // Would need cost tracking
      lastUpdated: new Date(),
    }));
  }

  /**
   * Generate optimization recommendations based on metrics
   */
  private async generateOptimizationRecommendations(
    metrics: RoutingMetrics[]
  ): Promise<OptimizationRecommendation[]> {
    const recommendations: OptimizationRecommendation[] = [];

    for (const metric of metrics) {
      // Analyze delivery rate performance
      if (metric.deliveryRate < 95) {
        recommendations.push({
          channel: metric.channel,
          currentProvider: metric.provider,
          recommendedProvider: await this.findBetterProvider(metric.channel, 'delivery_rate'),
          expectedImprovement: {
            deliveryRate: 5 + Math.random() * 10, // Simulated improvement
            costSavings: 0,
            latencyReduction: 0,
          },
          confidence: 0.8,
          reasoning: `Current delivery rate (${metric.deliveryRate.toFixed(1)}%) is below optimal threshold`,
        });
      }

      // Analyze latency performance
      if (metric.averageLatency > 30000) { // 30 seconds
        recommendations.push({
          channel: metric.channel,
          currentProvider: metric.provider,
          recommendedProvider: await this.findBetterProvider(metric.channel, 'latency'),
          expectedImprovement: {
            deliveryRate: 0,
            costSavings: 0,
            latencyReduction: 10000 + Math.random() * 20000, // 10-30 seconds
          },
          confidence: 0.7,
          reasoning: `High latency detected (${(metric.averageLatency / 1000).toFixed(1)}s average)`,
        });
      }
    }

    return recommendations;
  }

  /**
   * Apply automatic optimizations for high-confidence recommendations
   */
  private async applyAutomaticOptimizations(
    recommendations: OptimizationRecommendation[]
  ): Promise<number> {
    let applied = 0;

    for (const rec of recommendations) {
      if (rec.confidence >= 0.8) {
        await this.updateDynamicRule(rec);
        applied++;
        this.logger.log(`Applied automatic optimization for ${rec.channel}: ${rec.currentProvider} -> ${rec.recommendedProvider}`);
      }
    }

    return applied;
  }

  /**
   * Get optimized provider selection with real-time adjustments
   */
  async getOptimizedProvider(
    channel: string,
    region: string,
    priority: string = 'normal'
  ): Promise<{
    providerId: string;
    reasoning: string;
    performance: RoutingMetrics;
  }> {
    const rule = this.dynamicRules.get(`${channel}:${region}`) ||
                 this.dynamicRules.get(`${channel}:global`);

    if (!rule) {
      return {
        providerId: 'default',
        reasoning: 'No optimization rule found, using default routing',
        performance: {} as RoutingMetrics,
      };
    }

    // Select provider based on dynamic weights
    const providerId = this.selectProviderByWeight(rule.providers.weights);

    return {
      providerId,
      reasoning: `Selected via dynamic optimization (weights: ${JSON.stringify(rule.providers.weights)})`,
      performance: await this.getProviderMetrics(providerId),
    };
  }

  /**
   * Update routing metrics in real-time
   */
  async updateMetrics(channel: string, provider: string, success: boolean, latency: number): Promise<void> {
    const key = `${channel}:${provider}`;
    const existing = this.metricsCache.get(key) || {
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

    // Update rolling average latency
    existing.averageLatency = (existing.averageLatency + latency) / 2;
    existing.deliveryRate = (existing.delivered / existing.totalSent) * 100;
    existing.lastUpdated = new Date();

    this.metricsCache.set(key, existing);

    // Trigger optimization check if metrics changed significantly
    if (existing.totalSent % 100 === 0) { // Every 100 messages
      await this.checkForOptimization(channel, provider);
    }
  }

  /**
   * Machine learning-based provider selection
   */
  async predictOptimalProvider(
    channel: string,
    region: string,
    timeOfDay: number,
    messageVolume: number
  ): Promise<string> {
    // Simplified ML prediction (in real implementation, use trained model)
    const features = {
      channel,
      region,
      timeOfDay,
      messageVolume,
      historicalPerformance: await this.getHistoricalPerformance(channel, region),
    };

    // Simple rule-based prediction (replace with actual ML model)
    if (timeOfDay >= 9 && timeOfDay <= 17) { // Business hours
      return 'premium_provider'; // Use more expensive but reliable provider
    } else if (messageVolume > 1000) { // High volume
      return 'bulk_provider'; // Use provider optimized for volume
    } else {
      return 'cost_optimized_provider'; // Use cheapest reliable provider
    }
  }

  /**
   * A/B testing for routing optimization
   */
  async startABTest(
    channel: string,
    region: string,
    providers: string[],
    durationHours: number = 24
  ): Promise<string> {
    const testId = `ab_test_${channel}_${region}_${Date.now()}`;

    // Create test configuration
    const testConfig = {
      id: testId,
      channel,
      region,
      providers,
      startTime: new Date(),
      endTime: new Date(Date.now() + durationHours * 60 * 60 * 1000),
      trafficDistribution: providers.reduce((acc, provider, index) => {
        acc[provider] = 1 / providers.length; // Equal distribution
        return acc;
      }, {} as Record<string, number>),
    };

    // Store test configuration (in real implementation, save to database)
    this.logger.log(`Started A/B test ${testId} for ${channel} in ${region}`);

    return testId;
  }

  /**
   * Get A/B test results
   */
  async getABTestResults(testId: string): Promise<any> {
    // In real implementation, analyze test results from database
    return {
      testId,
      status: 'running',
      results: {
        providerA: { deliveryRate: 98.5, cost: 0.02 },
        providerB: { deliveryRate: 97.8, cost: 0.015 },
      },
      winner: 'providerA',
      confidence: 0.95,
    };
  }

  // Helper methods

  private initializeDefaultRules(): void {
    // Initialize with default dynamic rules
    const defaultRules: DynamicRoutingRule[] = [
      {
        channel: 'sms',
        conditions: { region: 'US' },
        providers: {
          primary: 'telnyx',
          fallback: ['aws_sns', 'twilio'],
          weights: { telnyx: 0.8, aws_sns: 0.15, twilio: 0.05 },
        },
        lastOptimized: new Date(),
      },
      {
        channel: 'email',
        conditions: { region: 'global' },
        providers: {
          primary: 'sendgrid',
          fallback: ['ses', 'mailgun'],
          weights: { sendgrid: 0.7, ses: 0.2, mailgun: 0.1 },
        },
        lastOptimized: new Date(),
      },
    ];

    defaultRules.forEach(rule => {
      const key = `${rule.channel}:${rule.conditions.region || 'global'}`;
      this.dynamicRules.set(key, rule);
    });
  }

  private async findBetterProvider(channel: string, metric: string): Promise<string> {
    // Simplified provider recommendation logic
    const providerMap = {
      sms: { delivery_rate: 'telnyx', latency: 'twilio' },
      email: { delivery_rate: 'sendgrid', latency: 'ses' },
      push: { delivery_rate: 'firebase', latency: 'firebase' },
    };

    return providerMap[channel]?.[metric] || 'default';
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

    return Object.keys(weights)[0]; // Fallback
  }

  private async getProviderMetrics(providerId: string): Promise<RoutingMetrics> {
    // Return cached or default metrics
    return this.metricsCache.get(providerId) || {
      channel: 'unknown',
      provider: providerId,
      totalSent: 0,
      delivered: 0,
      failed: 0,
      deliveryRate: 0,
      averageLatency: 0,
      costPerMessage: 0,
      lastUpdated: new Date(),
    };
  }

  private async updateDynamicRule(recommendation: OptimizationRecommendation): Promise<void> {
    const key = `${recommendation.channel}:global`;
    const rule = this.dynamicRules.get(key);

    if (rule) {
      // Adjust weights based on recommendation
      const currentWeight = rule.providers.weights[recommendation.currentProvider] || 0.5;
      const recommendedWeight = rule.providers.weights[recommendation.recommendedProvider] || 0.3;

      rule.providers.weights[recommendation.currentProvider] = Math.max(0.1, currentWeight - 0.2);
      rule.providers.weights[recommendation.recommendedProvider] = Math.min(0.8, recommendedWeight + 0.2);

      rule.lastOptimized = new Date();
      this.dynamicRules.set(key, rule);
    }
  }

  private async checkForOptimization(channel: string, provider: string): Promise<void> {
    // Trigger background optimization analysis
    setImmediate(async () => {
      try {
        const metrics = await this.calculateRoutingMetrics(1); // Last hour
        const recommendations = await this.generateOptimizationRecommendations(metrics);

        if (recommendations.length > 0) {
          this.logger.log(`Optimization opportunities found for ${channel}: ${recommendations.length} recommendations`);
        }
      } catch (error) {
        this.logger.error('Error during optimization check:', error);
      }
    });
  }

  private async getHistoricalPerformance(channel: string, region: string): Promise<any> {
    // Return historical performance data for ML features
    return {
      last24h: { deliveryRate: 98.5, latency: 15000 },
      last7d: { deliveryRate: 97.8, latency: 18000 },
      last30d: { deliveryRate: 98.2, latency: 16000 },
    };
  }
}