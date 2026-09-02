"use client";

import { apiClient } from "@/lib/api/client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

// World-class Novu-style email setup - managed vs BYOK (Cloudflare hidden for BYOK)

export function useBrands(tenantId?: string) {
  return useQuery({
    queryKey: ["brands", tenantId],
    queryFn: async () => {
      return apiClient.get(`/tenants/${tenantId}/brands`) as any;
    },
    enabled: !!tenantId,
    staleTime: 30_000,
  });
}

export function useIsBYOK(tenantId?: string) {
  return useQuery({
    queryKey: ["email", "isBYOK", tenantId],
    queryFn: async () => {
      const res: any = await apiClient.get(`/provider-configs`, { channel: "EMAIL", limit: 1 } as any);
      const data = res?.data || res || [];
      return { isBYOK: Array.isArray(data) ? data.length > 0 : !!res?.data?.length, raw: res };
    },
    enabled: !!tenantId,
    staleTime: 30_000,
  });
}

export function useSESDomainInstructions(tenantId?: string, brandId?: string) {
  return useQuery({
    queryKey: ["email", "ses-instructions", tenantId, brandId],
    queryFn: async () => {
      return apiClient.get(`/tenants/${tenantId}/brands/${brandId}/ses-domain-verification-instructions`) as any;
    },
    enabled: !!tenantId && !!brandId,
    staleTime: 30_000,
  });
}

export function useSESCapability(tenantId?: string, brandId?: string) {
  return useQuery({
    queryKey: ["email", "capability", tenantId, brandId],
    queryFn: async () => {
      return apiClient.get(`/tenants/${tenantId}/brands/${brandId}/ses-email-capability`) as any;
    },
    enabled: !!tenantId && !!brandId,
    staleTime: 30_000,
  });
}

export function useVerifyDomain(tenantId?: string, brandId?: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: { domain: string; cloudflareApiToken?: string }) => {
      return apiClient.post(`/tenants/${tenantId}/brands/${brandId}/verify-domain`, data) as any;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["brands", tenantId] }),
  });
}

export function useVerifySESDomain(tenantId?: string, brandId?: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: { domain: string; cloudflareApiToken?: string }) => {
      return apiClient.post(`/tenants/${tenantId}/brands/${brandId}/verify-ses-domain`, data) as any;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["email"] }),
  });
}

export function useSetupSESDKIM(tenantId?: string, brandId?: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: { cloudflareApiToken?: string } = {}) => {
      return apiClient.post(`/tenants/${tenantId}/brands/${brandId}/setup-ses-dkim`, data) as any;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["email"] }),
  });
}

export function useVerifyDMARC(tenantId?: string, brandId?: string) {
  return useMutation({
    mutationFn: async () => {
      return apiClient.post(`/tenants/${tenantId}/brands/${brandId}/verify-dmarc`, {}) as any;
    },
  });
}
