import { providerApi } from "@/lib/api/provider";
import type {
  CreateProviderRequest,
  Provider,
  ProviderFailoverConfig,
  ProviderQueryParams,
  ProviderTestData,
  ProviderType,
  UpdateProviderRequest,
} from "@/lib/types/provider";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

// Query hook for providers with filtering and pagination
export function useProviders(params?: ProviderQueryParams) {
  return useQuery({
    queryKey: ["providers", params],
    queryFn: () => providerApi.getProviders(params),
    staleTime: 2 * 60 * 1000, // 2 minutes
  });
}

// Query hook for providers by project
export function useProvidersByProject(projectId: string, params?: ProviderQueryParams) {
  return useQuery({
    queryKey: ["providers", "project", projectId, params],
    queryFn: () => providerApi.getProvidersByProject(projectId, params),
    enabled: !!projectId,
    staleTime: 2 * 60 * 1000, // 2 minutes
  });
}

// Query hook for specific provider details
export function useProvider(providerId: string) {
  return useQuery({
    queryKey: ["providers", providerId],
    queryFn: () => providerApi.getProvider(providerId),
    enabled: !!providerId,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

// Query hook for provider health status
export function useProviderHealth(providerId: string) {
  return useQuery({
    queryKey: ["providers", providerId, "health"],
    queryFn: () => providerApi.checkProviderHealth(providerId),
    enabled: !!providerId,
    staleTime: 30 * 1000, // 30 seconds - health changes frequently
    refetchInterval: 60 * 1000, // Refetch every minute for real-time health monitoring
  });
}

// Query hook for all providers health status
export function useAllProvidersHealth() {
  return useQuery({
    queryKey: ["providers", "health", "all"],
    queryFn: () => providerApi.getAllProviderHealth(),
    staleTime: 30 * 1000, // 30 seconds
    refetchInterval: 60 * 1000, // Refetch every minute
  });
}

// Query hook for provider health history
export function useProviderHealthHistory(
  providerId: string,
  params?: {
    startDate?: Date;
    endDate?: Date;
    limit?: number;
  },
) {
  return useQuery({
    queryKey: ["providers", providerId, "health", "history", params],
    queryFn: () => providerApi.getProviderHealthHistory(providerId, params),
    enabled: !!providerId,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

// Query hook for provider metrics
export function useProviderMetrics(
  providerId: string,
  params?: {
    startDate?: Date;
    endDate?: Date;
    groupBy?: "hour" | "day" | "week" | "month";
  },
) {
  return useQuery({
    queryKey: ["providers", providerId, "metrics", params],
    queryFn: () => providerApi.getProviderMetrics(providerId, params),
    enabled: !!providerId,
    staleTime: 2 * 60 * 1000, // 2 minutes
  });
}

// Query hook for all providers metrics
export function useAllProvidersMetrics(params?: {
  type?: ProviderType;
  startDate?: Date;
  endDate?: Date;
  groupBy?: "hour" | "day" | "week" | "month";
}) {
  return useQuery({
    queryKey: ["providers", "metrics", "all", params],
    queryFn: () => providerApi.getAllProviderMetrics(params),
    staleTime: 2 * 60 * 1000, // 2 minutes
  });
}

// Query hook for provider comparison
export function useProviderComparison(
  providerIds: string[],
  params?: {
    startDate?: Date;
    endDate?: Date;
    metrics?: ("success_rate" | "response_time" | "usage_count")[];
  },
) {
  return useQuery({
    queryKey: ["providers", "comparison", providerIds, params],
    queryFn: () => providerApi.compareProviders(providerIds, params),
    enabled: providerIds.length > 0,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

// Query hook for failover configuration
export function useFailoverConfig(channel: ProviderType) {
  return useQuery({
    queryKey: ["providers", "failover", channel],
    queryFn: () => providerApi.getFailoverConfig(channel),
    enabled: !!channel,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

// Query hook for recommended provider
export function useRecommendedProvider(channel: ProviderType) {
  return useQuery({
    queryKey: ["providers", "recommendations", channel],
    queryFn: () => providerApi.getRecommendedProvider(channel),
    enabled: !!channel,
    staleTime: 10 * 60 * 1000, // 10 minutes
  });
}

// Query hook for provider feature support
export function useProviderFeatureSupport(providerId: string, feature: string) {
  return useQuery({
    queryKey: ["providers", providerId, "features", feature],
    queryFn: () => providerApi.checkProviderFeatureSupport(providerId, feature),
    enabled: !!providerId && !!feature,
    staleTime: 30 * 60 * 1000, // 30 minutes - feature support doesn't change often
  });
}

// Mutation hook for creating providers
export function useCreateProvider() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateProviderRequest) => providerApi.createProvider(data),
    onSuccess: () => {
      // Invalidate providers list
      queryClient.invalidateQueries({ queryKey: ["providers"] });
      // Invalidate health status
      queryClient.invalidateQueries({ queryKey: ["providers", "health"] });
    },
    onError: (error) => {
      console.error("Create provider failed:", error);
    },
  });
}

// Mutation hook for updating providers
export function useUpdateProvider(providerId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: UpdateProviderRequest) => providerApi.updateProvider(providerId, data),
    onSuccess: () => {
      // Invalidate specific provider
      queryClient.invalidateQueries({ queryKey: ["providers", providerId] });
      // Invalidate providers list
      queryClient.invalidateQueries({ queryKey: ["providers"] });
      // Invalidate health status
      queryClient.invalidateQueries({ queryKey: ["providers", providerId, "health"] });
    },
    onError: (error) => {
      console.error("Update provider failed:", error);
    },
  });
}

// Mutation hook for deleting providers
export function useDeleteProvider() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (providerId: string) => providerApi.deleteProvider(providerId),
    onSuccess: (data, providerId) => {
      // Remove provider from cache
      queryClient.removeQueries({ queryKey: ["providers", providerId] });
      // Invalidate providers list
      queryClient.invalidateQueries({ queryKey: ["providers"] });
      // Invalidate health status
      queryClient.invalidateQueries({ queryKey: ["providers", "health"] });
    },
    onError: (error) => {
      console.error("Delete provider failed:", error);
    },
  });
}

// Mutation hook for testing providers
export function useTestProvider() {
  return useMutation({
    mutationFn: ({ providerId, testData }: { providerId: string; testData?: ProviderTestData }) =>
      providerApi.testProvider(providerId, testData),
    onError: (error) => {
      console.error("Test provider failed:", error);
    },
  });
}

// Mutation hook for testing providers with custom data
export function useTestProviderWithData() {
  return useMutation({
    mutationFn: ({ providerId, testData }: { providerId: string; testData: ProviderTestData }) =>
      providerApi.testProviderWithData(providerId, testData),
    onError: (error) => {
      console.error("Test provider with data failed:", error);
    },
  });
}

// Mutation hook for activating providers
export function useActivateProvider() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (providerId: string) => providerApi.activateProvider(providerId),
    onSuccess: (data, providerId) => {
      // Update provider status in cache
      queryClient.setQueryData(["providers", providerId], (old: Provider | undefined) =>
        old ? { ...old, status: "active" } : old,
      );
      // Invalidate providers list
      queryClient.invalidateQueries({ queryKey: ["providers"] });
    },
    onError: (error) => {
      console.error("Activate provider failed:", error);
    },
  });
}

// Mutation hook for deactivating providers
export function useDeactivateProvider() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (providerId: string) => providerApi.deactivateProvider(providerId),
    onSuccess: (data, providerId) => {
      // Update provider status in cache
      queryClient.setQueryData(["providers", providerId], (old: Provider | undefined) =>
        old ? { ...old, status: "inactive" } : old,
      );
      // Invalidate providers list
      queryClient.invalidateQueries({ queryKey: ["providers"] });
    },
    onError: (error) => {
      console.error("Deactivate provider failed:", error);
    },
  });
}

// Mutation hook for setting default provider
export function useSetDefaultProvider() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (providerId: string) => providerApi.setDefaultProvider(providerId),
    onSuccess: (data, providerId) => {
      // Update provider default status in cache
      queryClient.setQueryData(["providers", providerId], (old: Provider | undefined) =>
        old ? { ...old, isDefault: true } : old,
      );
      // Invalidate providers list to update other providers' default status
      queryClient.invalidateQueries({ queryKey: ["providers"] });
    },
    onError: (error) => {
      console.error("Set default provider failed:", error);
    },
  });
}

// Mutation hook for triggering health checks
export function useTriggerHealthCheck() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (providerId: string) => providerApi.triggerHealthCheck(providerId),
    onSuccess: (data, providerId) => {
      // Update health status in cache
      queryClient.setQueryData(["providers", providerId, "health"], data);
      // Invalidate all health queries
      queryClient.invalidateQueries({ queryKey: ["providers", "health"] });
    },
    onError: (error) => {
      console.error("Trigger health check failed:", error);
    },
  });
}

// Mutation hook for updating failover configuration
export function useUpdateFailoverConfig(channel: ProviderType) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (config: Partial<ProviderFailoverConfig>) =>
      providerApi.updateFailoverConfig(channel, config),
    onSuccess: () => {
      // Invalidate failover configuration
      queryClient.invalidateQueries({ queryKey: ["providers", "failover", channel] });
    },
    onError: (error) => {
      console.error("Update failover config failed:", error);
    },
  });
}

// Mutation hook for triggering manual failover
export function useTriggerFailover() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      channel,
      fromProviderId,
      toProviderId,
    }: {
      channel: ProviderType;
      fromProviderId: string;
      toProviderId: string;
    }) => providerApi.triggerFailover(channel, fromProviderId, toProviderId),
    onSuccess: (data, { channel }) => {
      // Invalidate failover configuration and provider status
      queryClient.invalidateQueries({ queryKey: ["providers", "failover", channel] });
      queryClient.invalidateQueries({ queryKey: ["providers"] });
      queryClient.invalidateQueries({ queryKey: ["providers", "health"] });
    },
    onError: (error) => {
      console.error("Trigger failover failed:", error);
    },
  });
}

// Hook for provider validation
export function useProviderValidation() {
  const validateProviderConfig = (data: CreateProviderRequest | UpdateProviderRequest) => {
    return providerApi.validateProviderConfig(data);
  };

  const getConfigTemplate = (type: ProviderType, subtype: string) => {
    return providerApi.getProviderConfigTemplate(type, subtype);
  };

  const formatProviderForDisplay = (provider: Provider) => {
    return providerApi.formatProviderForDisplay(provider);
  };

  return {
    validateProviderConfig,
    getConfigTemplate,
    formatProviderForDisplay,
  };
}

// Hook for provider statistics
export function useProviderStats() {
  const { data: providers } = useProviders();
  const { data: healthStatuses } = useAllProvidersHealth();

  const stats = {
    total: providers?.data?.length || 0,
    active: providers?.data?.filter((p) => p.status === "active").length || 0,
    inactive: providers?.data?.filter((p) => p.status === "inactive").length || 0,
    healthy: healthStatuses?.filter((h) => h.status === "healthy").length || 0,
    unhealthy: healthStatuses?.filter((h) => h.status === "unhealthy").length || 0,
    degraded: healthStatuses?.filter((h) => h.status === "degraded").length || 0,
    byType:
      providers?.data?.reduce(
        (acc, provider) => {
          acc[provider.type] = (acc[provider.type] || 0) + 1;
          return acc;
        },
        {} as Record<string, number>,
      ) || {},
  };

  return stats;
}

// Hook for provider performance insights
export function useProviderInsights(timeRange: { startDate: Date; endDate: Date }) {
  const { data: allMetrics } = useAllProvidersMetrics({
    startDate: timeRange.startDate,
    endDate: timeRange.endDate,
  });

  const insights = {
    bestPerforming: allMetrics?.reduce((best, current) =>
      current.successRate > (best?.successRate || 0) ? current : best,
    ),
    worstPerforming: allMetrics?.reduce((worst, current) =>
      current.successRate < (worst?.successRate || 1) ? current : worst,
    ),
    averageSuccessRate: allMetrics?.length
      ? allMetrics.reduce((sum, m) => sum + m.successRate, 0) / allMetrics.length
      : 0,
    averageResponseTime: allMetrics?.length
      ? allMetrics.reduce((sum, m) => sum + m.averageResponseTime, 0) / allMetrics.length
      : 0,
    totalRequests: allMetrics?.reduce((sum, m) => sum + m.totalRequests, 0) || 0,
    totalFailures: allMetrics?.reduce((sum, m) => sum + m.failedRequests, 0) || 0,
  };

  return insights;
}
