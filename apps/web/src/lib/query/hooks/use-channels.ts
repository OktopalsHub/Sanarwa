"use client";

import { apiClient } from "@sanarwa/api-client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

export interface ChannelConnection {
  providerId: string;
  name: string;
  isActive: boolean;
  destination: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ChannelSummary {
  key: string;
  providerId: string;
  label: string;
  description: string;
  channel: string;
  connected: boolean;
  connection: ChannelConnection | null;
}

export function useChannels(tenantId?: string) {
  return useQuery({
    queryKey: ["channels", tenantId],
    queryFn: async () => {
      return apiClient.get<ChannelSummary[]>(`/tenants/${tenantId}/channels`);
    },
    enabled: !!tenantId,
    staleTime: 30_000,
  });
}

export function useUpsertChannel() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: {
      tenantId: string;
      providerId: string;
      name?: string;
      isActive?: boolean;
      config: Record<string, unknown>;
    }) => {
      return apiClient.put(`/tenants/${data.tenantId}/channels/${data.providerId}`, {
        name: data.name,
        isActive: data.isActive,
        config: data.config,
      });
    },
    onSuccess: (_data, vars) => {
      queryClient.invalidateQueries({ queryKey: ["channels", vars.tenantId] });
    },
  });
}

export function useTestChannel() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: {
      tenantId: string;
      providerId: string;
      to?: string;
      message?: string;
      verifyOnly?: boolean;
    }) => {
      return apiClient.post(`/tenants/${data.tenantId}/channels/${data.providerId}/test`, {
        to: data.to,
        message: data.message,
        verifyOnly: data.verifyOnly,
      });
    },
    onSuccess: (_data, vars) => {
      queryClient.invalidateQueries({ queryKey: ["channels", vars.tenantId] });
    },
  });
}

export function useDisconnectChannel() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: { tenantId: string; providerId: string }) => {
      return apiClient.delete(`/tenants/${data.tenantId}/channels/${data.providerId}`);
    },
    onSuccess: (_data, vars) => {
      queryClient.invalidateQueries({ queryKey: ["channels", vars.tenantId] });
    },
  });
}
