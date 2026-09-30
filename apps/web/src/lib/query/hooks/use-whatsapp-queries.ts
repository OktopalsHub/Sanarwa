"use client";

import { apiClient } from "@/lib/api/client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

export function useWABAStatus(tenantId?: string) {
  return useQuery({
    queryKey: ["whatsapp", "waba-status", tenantId],
    queryFn: async () => {
      return apiClient.get(`/whatsapp/embedded-signup/status/${tenantId}`) as any;
    },
    enabled: !!tenantId,
    staleTime: 30_000,
  });
}

export function useTemplateCapacity(tenantId?: string) {
  return useQuery({
    queryKey: ["whatsapp", "template-capacity", tenantId],
    queryFn: async () => {
      return apiClient.get(`/whatsapp/embedded-signup/template-capacity/${tenantId}`) as any;
    },
    enabled: !!tenantId,
    staleTime: 30_000,
  });
}

export function useInitiateEmbeddedSignup() {
  return useMutation({
    mutationFn: async (data: { tenantId: string; businessName: string; businessEmail: string; businessPhone: string; businessWebsite?: string; redirectUri: string }) => {
      return apiClient.post("/whatsapp/embedded-signup/initiate", data) as any;
    },
  });
}

export function useCompleteEmbeddedSignup() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: { code: string; state: string }) => {
      return apiClient.post("/whatsapp/embedded-signup/complete", data) as any;
    },
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ["whatsapp"] });
    },
  });
}

export function useSyncWABA() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (tenantId: string) => {
      return apiClient.post(`/whatsapp/embedded-signup/sync/${tenantId}`, {}) as any;
    },
    onSuccess: (_data, tenantId) => {
      qc.invalidateQueries({ queryKey: ["whatsapp", "waba-status", tenantId] });
    },
  });
}
