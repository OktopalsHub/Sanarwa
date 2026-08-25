import { analyticsApi } from "@/lib/api/analytics";
import type { AnalyticsFilters, ExportFormat } from "@/lib/types/analytics";
import type { NotificationChannel } from "@/lib/types/notification";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

// Query hook for delivery rate analytics
export function useDeliveryAnalytics(params?: {
  startDate?: Date;
  endDate?: Date;
  channel?: NotificationChannel;
  status?: string;
  priority?: string;
}) {
  return useQuery({
    queryKey: ["analytics", "delivery", params],
    queryFn: () => analyticsApi.getDeliveryRateAnalytics(params),
    staleTime: 2 * 60 * 1000, // 2 minutes
  });
}

// Query hook for channel analytics
export function useChannelAnalytics(params?: { startDate?: Date; endDate?: Date }) {
  return useQuery({
    queryKey: ["analytics", "channels", params],
    queryFn: () => analyticsApi.getChannelAnalytics(params),
    staleTime: 2 * 60 * 1000, // 2 minutes
  });
}

// Query hook for provider analytics
export function useProviderAnalytics(params?: {
  startDate?: Date;
  endDate?: Date;
  channel?: NotificationChannel;
}) {
  return useQuery({
    queryKey: ["analytics", "providers", params],
    queryFn: () => analyticsApi.getProviderAnalytics(params),
    staleTime: 2 * 60 * 1000, // 2 minutes
  });
}

// Query hook for time series data
export function useTimeSeriesData(params?: {
  startDate?: Date;
  endDate?: Date;
  channel?: NotificationChannel;
  interval?: "hour" | "day" | "week" | "month";
}) {
  return useQuery({
    queryKey: ["analytics", "time-series", params],
    queryFn: () => analyticsApi.getTimeSeriesData(params),
    staleTime: 1 * 60 * 1000, // 1 minute
  });
}

// Query hook for comprehensive tenant analytics
export function useTenantAnalytics(startDate?: Date, endDate?: Date) {
  return useQuery({
    queryKey: ["analytics", "tenant", startDate?.toISOString(), endDate?.toISOString()],
    queryFn: () => analyticsApi.getTenantAnalytics(startDate, endDate),
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

// Query hook for top performing providers
export function useTopProviders(params?: { limit?: number; startDate?: Date; endDate?: Date }) {
  return useQuery({
    queryKey: ["analytics", "providers", "top", params],
    queryFn: () => analyticsApi.getTopProviders(params),
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

// Query hook for delivery trends comparison
export function useDeliveryTrends(
  currentPeriodStart: Date,
  currentPeriodEnd: Date,
  previousPeriodStart: Date,
  previousPeriodEnd: Date,
) {
  return useQuery({
    queryKey: [
      "analytics",
      "trends",
      currentPeriodStart.toISOString(),
      currentPeriodEnd.toISOString(),
      previousPeriodStart.toISOString(),
      previousPeriodEnd.toISOString(),
    ],
    queryFn: () =>
      analyticsApi.getDeliveryTrends(
        currentPeriodStart,
        currentPeriodEnd,
        previousPeriodStart,
        previousPeriodEnd,
      ),
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

// Query hook for delivery statistics
export function useDeliveryStats(params?: {
  channel?: NotificationChannel;
  startDate?: Date;
  endDate?: Date;
}) {
  return useQuery({
    queryKey: ["analytics", "delivery-stats", params],
    queryFn: () => analyticsApi.getDeliveryStats(params),
    staleTime: 2 * 60 * 1000, // 2 minutes
  });
}

// Query hook for delivery history of a specific notification
export function useDeliveryHistory(notificationId: string) {
  return useQuery({
    queryKey: ["analytics", "delivery-history", notificationId],
    queryFn: () => analyticsApi.getDeliveryHistory(notificationId),
    enabled: !!notificationId,
    staleTime: 30 * 1000, // 30 seconds
  });
}

// Query hook for multiple delivery statuses
export function useMultipleDeliveryStatus(notificationIds: string[]) {
  return useQuery({
    queryKey: ["analytics", "delivery-status", "batch", notificationIds],
    queryFn: () => analyticsApi.getMultipleDeliveryStatus(notificationIds),
    enabled: notificationIds.length > 0,
    staleTime: 30 * 1000, // 30 seconds
  });
}

// Query hook for webhook configuration
export function useWebhookConfig() {
  return useQuery({
    queryKey: ["analytics", "webhook", "config"],
    queryFn: () => analyticsApi.getWebhookConfig(),
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

// Query hook for audit logs
export function useAuditLogs(params?: {
  eventType?: string;
  resourceType?: string;
  resourceId?: string;
  userId?: string;
  startDate?: Date;
  endDate?: Date;
  limit?: number;
  offset?: number;
}) {
  return useQuery({
    queryKey: ["analytics", "audit-logs", params],
    queryFn: () => analyticsApi.getAuditLogs(params),
    staleTime: 1 * 60 * 1000, // 1 minute
  });
}

// Query hook for notification audit trail
export function useNotificationAuditTrail(notificationId: string) {
  return useQuery({
    queryKey: ["analytics", "audit-logs", "notification", notificationId],
    queryFn: () => analyticsApi.getNotificationAuditTrail(notificationId),
    enabled: !!notificationId,
    staleTime: 2 * 60 * 1000, // 2 minutes
  });
}

// Query hook for audit statistics
export function useAuditStatistics(startDate?: Date, endDate?: Date) {
  return useQuery({
    queryKey: [
      "analytics",
      "audit-logs",
      "statistics",
      startDate?.toISOString(),
      endDate?.toISOString(),
    ],
    queryFn: () => analyticsApi.getAuditStatistics(startDate, endDate),
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

// Query hook for system performance metrics
export function useSystemPerformanceMetrics(startDate?: Date, endDate?: Date) {
  return useQuery({
    queryKey: [
      "analytics",
      "performance",
      "system",
      startDate?.toISOString(),
      endDate?.toISOString(),
    ],
    queryFn: () => analyticsApi.getSystemPerformanceMetrics(startDate, endDate),
    staleTime: 1 * 60 * 1000, // 1 minute
  });
}

// Query hook for provider performance metrics
export function useProviderPerformanceMetrics(params?: {
  providerId?: string;
  channel?: NotificationChannel;
  startDate?: Date;
  endDate?: Date;
}) {
  return useQuery({
    queryKey: ["analytics", "performance", "providers", params],
    queryFn: () => analyticsApi.getProviderPerformanceMetrics(params),
    staleTime: 2 * 60 * 1000, // 2 minutes
  });
}

// Query hook for tenant performance metrics
export function useTenantPerformanceMetrics(startDate?: Date, endDate?: Date) {
  return useQuery({
    queryKey: [
      "analytics",
      "performance",
      "tenant",
      startDate?.toISOString(),
      endDate?.toISOString(),
    ],
    queryFn: () => analyticsApi.getTenantPerformanceMetrics(startDate, endDate),
    staleTime: 1 * 60 * 1000, // 1 minute
  });
}

// Query hook for performance trends
export function usePerformanceTrends(
  metricName: string,
  startDate: Date,
  endDate: Date,
  interval?: "hour" | "day",
) {
  return useQuery({
    queryKey: [
      "analytics",
      "performance",
      "trends",
      metricName,
      startDate.toISOString(),
      endDate.toISOString(),
      interval,
    ],
    queryFn: () => analyticsApi.getPerformanceTrends(metricName, startDate, endDate, interval),
    enabled: !!metricName,
    staleTime: 2 * 60 * 1000, // 2 minutes
  });
}

// Query hook for real-time metrics
export function useRealTimeMetrics() {
  return useQuery({
    queryKey: ["analytics", "performance", "realtime"],
    queryFn: () => analyticsApi.getRealTimeMetrics(),
    staleTime: 10 * 1000, // 10 seconds
    refetchInterval: 15 * 1000, // Refetch every 15 seconds for real-time updates
  });
}

// Query hook for project analytics
export function useProjectAnalytics(projectId: string, startDate?: Date, endDate?: Date) {
  return useQuery({
    queryKey: ["analytics", "project", projectId, startDate?.toISOString(), endDate?.toISOString()],
    queryFn: () => analyticsApi.getProjectAnalytics(projectId, startDate, endDate),
    enabled: !!projectId,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

// Query hook for brand analytics
export function useBrandAnalytics(brandId: string, startDate?: Date, endDate?: Date) {
  return useQuery({
    queryKey: ["analytics", "brand", brandId, startDate?.toISOString(), endDate?.toISOString()],
    queryFn: () => analyticsApi.getBrandAnalytics(brandId, startDate, endDate),
    enabled: !!brandId,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

// Query hook for project comparison
export function useProjectComparison(projectIds: string[], startDate?: Date, endDate?: Date) {
  return useQuery({
    queryKey: [
      "analytics",
      "compare",
      "projects",
      projectIds,
      startDate?.toISOString(),
      endDate?.toISOString(),
    ],
    queryFn: () => analyticsApi.compareProjects(projectIds, startDate, endDate),
    enabled: projectIds.length > 0,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

// Query hook for brand comparison
export function useBrandComparison(brandIds: string[], startDate?: Date, endDate?: Date) {
  return useQuery({
    queryKey: [
      "analytics",
      "compare",
      "brands",
      brandIds,
      startDate?.toISOString(),
      endDate?.toISOString(),
    ],
    queryFn: () => analyticsApi.compareBrands(brandIds, startDate, endDate),
    enabled: brandIds.length > 0,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

// Mutation hook for registering webhook
export function useRegisterWebhook() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (config: {
      url: string;
      secret?: string;
      headers?: Record<string, string>;
      retryAttempts?: number;
      timeout?: number;
    }) => analyticsApi.registerWebhook(config),
    onSuccess: () => {
      // Invalidate webhook config
      queryClient.invalidateQueries({ queryKey: ["analytics", "webhook", "config"] });
    },
    onError: (error) => {
      console.error("Register webhook failed:", error);
    },
  });
}

// Mutation hook for removing webhook
export function useRemoveWebhook() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => analyticsApi.removeWebhook(),
    onSuccess: () => {
      // Invalidate webhook config
      queryClient.invalidateQueries({ queryKey: ["analytics", "webhook", "config"] });
    },
    onError: (error) => {
      console.error("Remove webhook failed:", error);
    },
  });
}

// Mutation hook for testing webhook
export function useTestWebhook() {
  return useMutation({
    mutationFn: () => analyticsApi.testWebhook(),
    onError: (error) => {
      console.error("Test webhook failed:", error);
    },
  });
}

// Mutation hook for exporting audit logs
export function useExportAuditLogs() {
  return useMutation({
    mutationFn: (params: {
      format: ExportFormat;
      eventType?: string;
      resourceType?: string;
      resourceId?: string;
      userId?: string;
      startDate?: Date;
      endDate?: Date;
      limit?: number;
      offset?: number;
    }) => analyticsApi.exportAuditLogs(params),
    onError: (error) => {
      console.error("Export audit logs failed:", error);
    },
  });
}

// Hook for analytics validation and utilities
export function useAnalyticsUtils() {
  const validateFilters = (filters: AnalyticsFilters) => {
    return analyticsApi.validateAnalyticsFilters(filters);
  };

  const calculatePercentageChange = (current: number, previous: number) => {
    return analyticsApi.calculatePercentageChange(current, previous);
  };

  const formatMetricValue = (
    value: number,
    type: "rate" | "count" | "time" | "percentage" | "bytes",
  ) => {
    return analyticsApi.formatMetricValue(value, type);
  };

  const getDateRangePresets = () => {
    return analyticsApi.getDateRangePresets();
  };

  return {
    validateFilters,
    calculatePercentageChange,
    formatMetricValue,
    getDateRangePresets,
  };
}

// Hook for analytics dashboard data
export function useAnalyticsDashboard(timeRange: { startDate: Date; endDate: Date }) {
  const { data: deliveryAnalytics } = useDeliveryAnalytics({
    startDate: timeRange.startDate,
    endDate: timeRange.endDate,
  });

  const { data: channelAnalytics } = useChannelAnalytics({
    startDate: timeRange.startDate,
    endDate: timeRange.endDate,
  });

  const { data: providerAnalytics } = useProviderAnalytics({
    startDate: timeRange.startDate,
    endDate: timeRange.endDate,
  });

  const { data: tenantAnalytics } = useTenantAnalytics(timeRange.startDate, timeRange.endDate);

  const { data: realTimeMetrics } = useRealTimeMetrics();

  return {
    deliveryAnalytics,
    channelAnalytics,
    providerAnalytics,
    tenantAnalytics,
    realTimeMetrics,
    isLoading: !deliveryAnalytics || !channelAnalytics || !providerAnalytics || !tenantAnalytics,
  };
}

// Hook for engagement metrics (derived from delivery analytics)
export function useEngagementMetrics(params?: {
  startDate?: Date;
  endDate?: Date;
  channel?: NotificationChannel;
}) {
  const { data: tenantAnalytics } = useTenantAnalytics(params?.startDate, params?.endDate);

  return {
    data: tenantAnalytics?.engagementStats,
    isLoading: !tenantAnalytics,
    error: null, // Would come from the query if there was an error
  };
}

// Hook for delivery metrics (derived from delivery analytics)
export function useDeliveryMetrics(params?: {
  startDate?: Date;
  endDate?: Date;
  channel?: NotificationChannel;
}) {
  const { data: deliveryAnalytics, isLoading, error } = useDeliveryAnalytics(params);

  return {
    data: deliveryAnalytics,
    isLoading,
    error,
  };
}

// Hook for analytics insights and recommendations
export function useAnalyticsInsights(timeRange: { startDate: Date; endDate: Date }) {
  const { data: deliveryAnalytics } = useDeliveryAnalytics({
    startDate: timeRange.startDate,
    endDate: timeRange.endDate,
  });

  const { data: channelAnalytics } = useChannelAnalytics({
    startDate: timeRange.startDate,
    endDate: timeRange.endDate,
  });

  const { data: topProviders } = useTopProviders({
    startDate: timeRange.startDate,
    endDate: timeRange.endDate,
    limit: 5,
  });

  const insights = {
    // Delivery insights
    overallDeliveryRate: deliveryAnalytics?.deliveryRate || 0,
    totalNotifications: deliveryAnalytics?.totalSent || 0,
    failureRate: deliveryAnalytics?.failureRate || 0,

    // Channel insights
    bestPerformingChannel: channelAnalytics?.channels?.reduce((best, current) =>
      current.deliveryRate > (best?.deliveryRate || 0) ? current : best,
    ),
    worstPerformingChannel: channelAnalytics?.channels?.reduce((worst, current) =>
      current.deliveryRate < (worst?.deliveryRate || 1) ? current : worst,
    ),

    // Provider insights
    topProvider: topProviders?.[0],
    providerCount: topProviders?.length || 0,

    // Recommendations
    recommendations: [] as string[],
  };

  // Generate recommendations based on data
  if (insights.overallDeliveryRate < 0.9) {
    insights.recommendations.push(
      "Consider reviewing provider configurations to improve delivery rates",
    );
  }

  if (insights.failureRate > 0.1) {
    insights.recommendations.push(
      "High failure rate detected - check provider health and configurations",
    );
  }

  if (insights.bestPerformingChannel && insights.worstPerformingChannel) {
    const rateDiff =
      insights.bestPerformingChannel.deliveryRate - insights.worstPerformingChannel.deliveryRate;
    if (rateDiff > 0.2) {
      insights.recommendations.push(
        `Consider optimizing ${insights.worstPerformingChannel.channel} channel configuration`,
      );
    }
  }

  return insights;
}
