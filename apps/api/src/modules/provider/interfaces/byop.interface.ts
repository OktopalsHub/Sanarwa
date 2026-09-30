/**
 * BYOP (Bring Your Own Provider) System Interfaces
 * Inspired by Novu's provider management system with optimizations
 */

export interface ProviderCostModel {
  type: "per_message" | "monthly" | "hybrid" | "custom";
  baseRate: number;
  currency: string;
  tiers?: ProviderCostTier[];
  infrastructureFee?: number; // Our management fee
  minimumCharge?: number;
  overage?: {
    rate: number;
    threshold: number;
  };
}

export interface ProviderCostTier {
  from: number;
  to?: number;
  rate: number;
}

export interface ProviderTemplate {
  id: string;
  name: string;
  providerId: string;
  channel: string;
  description: string;
  logoUrl?: string;
  configSchema: ProviderConfigSchema;
  setupInstructions: string;
  supportedFeatures: string[];
  costModel?: ProviderCostModel;
  regions?: string[];
  isPopular?: boolean;
  difficulty: "easy" | "medium" | "hard";
}

export interface ProviderConfigSchema {
  type: "object";
  properties: Record<string, ProviderConfigProperty>;
  required: string[];
  additionalProperties?: boolean;
}

export interface ProviderConfigProperty {
  type: "string" | "number" | "boolean" | "object" | "array";
  title: string;
  description: string;
  format?: string;
  enum?: any[];
  default?: any;
  sensitive?: boolean; // For encryption
  validation?: {
    pattern?: string;
    minLength?: number;
    maxLength?: number;
    minimum?: number;
    maximum?: number;
  };
  examples?: any[];
  helpUrl?: string;
}

export interface ProviderUsageMetrics {
  providerId: string;
  channel: string;
  period: {
    start: Date;
    end: Date;
  };
  totalMessages: number;
  successfulMessages: number;
  failedMessages: number;
  totalCost: number;
  infrastructureCost: number;
  providerCost: number;
  averageLatency: number;
  deliveryRate: number;
  errorBreakdown: Record<string, number>;
  costBreakdown: {
    base: number;
    overage: number;
    infrastructure: number;
  };
}

export interface ProviderFailoverRule {
  id: string;
  name: string;
  conditions: ProviderFailoverCondition[];
  actions: ProviderFailoverAction[];
  priority: number;
  isActive: boolean;
}

export interface ProviderFailoverCondition {
  type: "error_rate" | "latency" | "cost" | "quota" | "health_check";
  operator: "gt" | "lt" | "eq" | "gte" | "lte";
  value: number;
  timeWindow?: number; // in minutes
}

export interface ProviderFailoverAction {
  type: "switch_provider" | "disable_provider" | "alert" | "scale_down";
  targetProviderId?: string;
  alertChannels?: string[];
  parameters?: Record<string, any>;
}

export interface ProviderLoadBalancingStrategy {
  type: "round_robin" | "weighted" | "cost_optimized" | "latency_based" | "custom";
  weights?: Record<string, number>;
  parameters?: Record<string, any>;
}

export interface ProviderQuota {
  type: "daily" | "monthly" | "hourly";
  limit: number;
  current: number;
  resetAt: Date;
  alertThresholds: number[]; // Percentages: [80, 95]
}

export interface ProviderWebhookEvent {
  type:
    | "provider.status.changed"
    | "provider.quota.exceeded"
    | "provider.cost.threshold"
    | "provider.failover.triggered";
  providerId: string;
  channel: string;
  timestamp: Date;
  data: Record<string, any>;
  severity: "info" | "warning" | "error" | "critical";
}

export interface ProviderAnalytics {
  providerId: string;
  channel: string;
  timeRange: {
    start: Date;
    end: Date;
    granularity: "hour" | "day" | "week" | "month";
  };
  metrics: {
    volume: TimeSeriesData[];
    cost: TimeSeriesData[];
    latency: TimeSeriesData[];
    errorRate: TimeSeriesData[];
    deliveryRate: TimeSeriesData[];
  };
  comparisons?: {
    previousPeriod: ProviderAnalytics;
    otherProviders: ProviderAnalytics[];
  };
}

export interface TimeSeriesData {
  timestamp: Date;
  value: number;
  metadata?: Record<string, any>;
}

export interface ProviderRecommendation {
  providerId: string;
  channel: string;
  score: number;
  reasons: string[];
  estimatedCost: number;
  estimatedLatency: number;
  features: string[];
  pros: string[];
  cons: string[];
}

export interface BYOPConfiguration {
  tenantId: string;
  projectId: string;
  settings: {
    autoFailover: boolean;
    costOptimization: boolean;
    loadBalancing: ProviderLoadBalancingStrategy;
    quotaManagement: boolean;
    realTimeAnalytics: boolean;
    webhookUrl?: string;
    alertChannels: string[];
  };
  costLimits: {
    daily?: number;
    monthly?: number;
    alertThresholds: number[];
  };
  failoverRules: ProviderFailoverRule[];
}
