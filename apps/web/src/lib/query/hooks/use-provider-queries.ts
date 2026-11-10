import { providerApi } from "@sanarwa/api-client";
import type {
  CreateProviderRequest,
  Provider,
  ProviderFailoverConfig,
  ProviderQueryParams,
  ProviderType,
  UpdateProviderRequest,
} from "@/lib/types/provider";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

export function useProviders(params?: ProviderQueryParams) {
  return useQuery({
    queryKey: ["providers", params],
    queryFn: () => providerApi.getProviders(params),
    staleTime: 2 * 60 * 1000,
  });
}

export function useProvidersByProject(projectId: string, params?: ProviderQueryParams) {
  return useQuery({
    queryKey: ["providers", "project", projectId, params],
    queryFn: () => providerApi.getProvidersByProject(projectId, params),
    enabled: !!projectId,
    staleTime: 2 * 60 * 1000,
  });
}

export function useProvider(providerId: string) {
  return useQuery({
    queryKey: ["providers", providerId],
    queryFn: () => providerApi.getProvider(providerId),
    enabled: !!providerId,
    staleTime: 5 * 60 * 1000,
  });
}

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
    staleTime: 2 * 60 * 1000,
  });
}

export function useAllProvidersMetrics(params?: {
  type?: ProviderType;
  startDate?: Date;
  endDate?: Date;
  groupBy?: "hour" | "day" | "week" | "month";
}) {
  return useQuery({
    queryKey: ["providers", "metrics", "all", params],
    queryFn: () => providerApi.getAllProviderMetrics(params),
    staleTime: 2 * 60 * 1000,
  });
}

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
    staleTime: 5 * 60 * 1000,
  });
}

export function useFailoverConfig(channel: ProviderType) {
  return useQuery({
    queryKey: ["providers", "failover", channel],
    queryFn: () => providerApi.getFailoverConfig(channel),
    enabled: !!channel,
    staleTime: 5 * 60 * 1000,
  });
}

export function useRecommendedProvider(channel: ProviderType) {
  return useQuery({
    queryKey: ["providers", "recommendations", channel],
    queryFn: () => providerApi.getRecommendedProvider(channel),
    enabled: !!channel,
    staleTime: 10 * 60 * 1000,
  });
}

export function useProviderFeatureSupport(providerId: string, feature: string) {
  return useQuery({
    queryKey: ["providers", providerId, "features", feature],
    queryFn: () => providerApi.checkProviderFeatureSupport(providerId, feature),
    enabled: !!providerId && !!feature,
    staleTime: 30 * 60 * 1000,
  });
}

export function useCreateProvider() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateProviderRequest) => providerApi.createProvider(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["providers"] });
    },
    onError: (error) => {
      console.error("Create provider failed:", error);
    },
  });
}

export function useUpdateProvider(providerId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: UpdateProviderRequest) => providerApi.updateProvider(providerId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["providers", providerId] });
      queryClient.invalidateQueries({ queryKey: ["providers"] });
    },
    onError: (error) => {
      console.error("Update provider failed:", error);
    },
  });
}

export function useDeleteProvider() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (providerId: string) => providerApi.deleteProvider(providerId),
    onSuccess: (data, providerId) => {
      queryClient.removeQueries({ queryKey: ["providers", providerId] });
      queryClient.invalidateQueries({ queryKey: ["providers"] });
    },
    onError: (error) => {
      console.error("Delete provider failed:", error);
    },
  });
}

export function useActivateProvider() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (providerId: string) => providerApi.activateProvider(providerId),
    onSuccess: (data, providerId) => {
      queryClient.setQueryData(["providers", providerId], (old: Provider | undefined) =>
        old ? { ...old, status: "active" } : old,
      );
      queryClient.invalidateQueries({ queryKey: ["providers"] });
    },
    onError: (error) => {
      console.error("Activate provider failed:", error);
    },
  });
}

export function useDeactivateProvider() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (providerId: string) => providerApi.deactivateProvider(providerId),
    onSuccess: (data, providerId) => {
      queryClient.setQueryData(["providers", providerId], (old: Provider | undefined) =>
        old ? { ...old, status: "inactive" } : old,
      );
      queryClient.invalidateQueries({ queryKey: ["providers"] });
    },
    onError: (error) => {
      console.error("Deactivate provider failed:", error);
    },
  });
}

export function useSetDefaultProvider() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (providerId: string) => providerApi.setDefaultProvider(providerId),
    onSuccess: (data, providerId) => {
      queryClient.setQueryData(["providers", providerId], (old: Provider | undefined) =>
        old ? { ...old, isDefault: true } : old,
      );
      queryClient.invalidateQueries({ queryKey: ["providers"] });
    },
    onError: (error) => {
      console.error("Set default provider failed:", error);
    },
  });
}

export function useUpdateFailoverConfig(channel: ProviderType) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (config: Partial<ProviderFailoverConfig>) =>
      providerApi.updateFailoverConfig(channel, config),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["providers", "failover", channel] });
    },
    onError: (error) => {
      console.error("Update failover config failed:", error);
    },
  });
}

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
      queryClient.invalidateQueries({ queryKey: ["providers", "failover", channel] });
      queryClient.invalidateQueries({ queryKey: ["providers"] });
    },
    onError: (error) => {
      console.error("Trigger failover failed:", error);
    },
  });
}

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

export function useProviderStats() {
  const { data: providers } = useProviders();

  const stats = {
    total: providers?.data?.length || 0,
    active: providers?.data?.filter((p) => p.status === "active").length || 0,
    inactive: providers?.data?.filter((p) => p.status === "inactive").length || 0,
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
