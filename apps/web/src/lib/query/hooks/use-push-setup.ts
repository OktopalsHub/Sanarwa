"use client";

import { apiClient } from "@/lib/api/client";
import { useMutation, useQuery } from "@tanstack/react-query";

export function usePushProviders(tenantId?: string) {
  return useQuery({
    queryKey: ["push", "providers", tenantId],
    queryFn: async () => {
      return apiClient.get(`/provider-configs`, { channel: "PUSH", limit: 10 } as any) as any;
    },
    enabled: !!tenantId,
    staleTime: 30_000,
  });
}

export function useCreatePushProvider() {
  return useMutation({
    mutationFn: async (data: { tenantId: string; providerId: string; config: any }) => {
      return apiClient.post(`/provider-configs`, { providerId: data.providerId, channel: "PUSH", config: data.config, priority: 1 } as any) as any;
    },
  });
}

export function useTestPush(tenantId?: string) {
  return useMutation({
    mutationFn: async (data: { providerId: string; deviceToken: string; title: string; body: string }) => {
      return apiClient.post(`/provider-configs/${data.providerId}/test`, { testData: { deviceToken: data.deviceToken, title: data.title, body: data.body } } as any) as any;
    },
  });
}

export function useDeviceRegistrations(tenantId?: string) {
  return useQuery({
    queryKey: ["push", "devices", tenantId],
    queryFn: async () => {
      return apiClient.get(`/provider-configs/health` as any) as any; // fallback, device stats via provider health
    },
    enabled: false,
  });
}
