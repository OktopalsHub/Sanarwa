"use client";

import { apiClient } from "@/lib/api/client";
import { analyticsApi } from "@/lib/api/analytics";
import { messagingApi } from "@/lib/api/messaging";
import { useTenant } from "@/contexts/tenant-context";
import { useQuery } from "@tanstack/react-query";

export interface DashboardMetrics {
  totalCampaigns: number;
  activeCampaigns: number;
  totalMessages: number;
  deliveryRate: number;
  failed: number;
  openRate: number;
  clickRate: number;
}

export interface ChartData {
  name: string;
  value: number;
  [key: string]: string | number;
}

export interface DashboardData {
  metrics: DashboardMetrics;
  channelDistribution: ChartData[];
}

export function useDashboardData() {
  const { selectedTenant } = useTenant();

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["dashboard", selectedTenant?.id],
    queryFn: async (): Promise<DashboardData> => {
      if (selectedTenant?.id) {
        apiClient.setTenant(selectedTenant.id);
      }
      const end = new Date();
      const start = new Date();
      start.setDate(start.getDate() - 30);
      const [raw, stats] = await Promise.all([
        analyticsApi.getTenantAnalytics(start, end).catch(() => ({})),
        messagingApi
          .stats({
            startDate: start.toISOString(),
            endDate: end.toISOString(),
          })
          .catch(() => ({
            total: 0,
            sent: 0,
            delivered: 0,
            failed: 0,
            queued: 0,
            deliveryRate: 0,
          })),
      ]);
      const summary = ((raw as Record<string, unknown>).summary || raw) as Record<string, number>;
      return {
        metrics: {
          totalCampaigns: summary.totalCampaigns ?? 0,
          activeCampaigns: summary.activeCampaigns ?? 0,
          totalMessages: stats.total || summary.totalSent || 0,
          deliveryRate: stats.deliveryRate || summary.deliveryRate || 0,
          failed: stats.failed || 0,
          openRate: summary.openRate ?? 0,
          clickRate: summary.clickRate ?? 0,
        },
        channelDistribution: Array.isArray((raw as Record<string, unknown>).channels)
          ? (
              (raw as Record<string, unknown>).channels as Array<{ channel: string; sent: number }>
            ).map((c) => ({
              name: c.channel,
              value: c.sent,
            }))
          : [],
      };
    },
    enabled: !!selectedTenant?.id,
    staleTime: 5 * 60 * 1000,
  });

  return {
    data,
    isLoading,
    error,
    refetch,
  };
}
