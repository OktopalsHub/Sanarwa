"use client";

import { apiClient } from "@/lib/api/client";
import { useMutation, useQuery } from "@tanstack/react-query";

export function useSMSProviders(tenantId?: string) {
  return useQuery({
    queryKey: ["sms", "providers", tenantId],
    queryFn: async () => {
      return apiClient.get(`/provider-configs`, { channel: "SMS", limit: 10 } as any) as any;
    },
    enabled: !!tenantId,
    staleTime: 30_000,
  });
}

export function useCreateSMSProvider() {
  return useMutation({
    mutationFn: async (data: { tenantId: string; providerId: string; config: any }) => {
      return apiClient.post(`/provider-configs`, { providerId: data.providerId, channel: "SMS", config: data.config, priority: 1 } as any) as any;
    },
  });
}

export function useTestSMS() {
  return useMutation({
    mutationFn: async (data: { providerId: string; phone: string; message: string }) => {
      return apiClient.post(`/provider-configs/${data.providerId}/test`, { testData: { phone: data.phone, message: data.message } } as any) as any;
    },
  });
}
