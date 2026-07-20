'use client';

import { apiClient } from '@/lib/api/client';
import { analyticsApi } from '@/lib/api/analytics';
import { useTenant } from '@/contexts/tenant-context';
import { useQuery } from '@tanstack/react-query';

export interface DashboardMetrics {
  totalCampaigns: number;
  activeCampaigns: number;
  totalMessages: number;
  deliveryRate: number;
  openRate: number;
  clickRate: number;
  campaignsChange: number;
  messagesChange: number;
  deliveryRateChange: number;
}

export interface ChartData {
  name: string;
  value: number;
  [key: string]: string | number;
}

export interface DashboardData {
  metrics: DashboardMetrics;
  campaignPerformance: ChartData[];
  channelDistribution: ChartData[];
  recentActivity: ChartData[];
}

function mapAnalyticsToDashboard(raw: Record<string, unknown>): DashboardData {
  const summary = (raw.summary || raw) as Record<string, number>;
  return {
    metrics: {
      totalCampaigns: summary.totalCampaigns ?? 0,
      activeCampaigns: summary.activeCampaigns ?? 0,
      totalMessages: summary.totalSent ?? summary.totalMessages ?? 0,
      deliveryRate: summary.deliveryRate ?? 0,
      openRate: summary.openRate ?? 0,
      clickRate: summary.clickRate ?? 0,
      campaignsChange: 0,
      messagesChange: 0,
      deliveryRateChange: 0,
    },
    campaignPerformance: [],
    channelDistribution: Array.isArray(raw.channels)
      ? (raw.channels as Array<{ channel: string; sent: number }>).map((c) => ({
          name: c.channel,
          value: c.sent,
        }))
      : [],
    recentActivity: [],
  };
}

export function useDashboardData() {
  const { selectedTenant } = useTenant();

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['dashboard', selectedTenant?.id],
    queryFn: async (): Promise<DashboardData> => {
      if (selectedTenant?.id) {
        apiClient.setTenant(selectedTenant.id);
      }
      const end = new Date();
      const start = new Date();
      start.setDate(start.getDate() - 30);
      const raw = await analyticsApi.getTenantAnalytics(start, end);
      return mapAnalyticsToDashboard(raw as Record<string, unknown>);
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
