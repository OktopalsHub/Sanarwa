"use client";

import { apiKeyApi, billingApi, messagingApi, projectApi, providerApi } from "@sanarwa/api-client";
import { useTenant } from "@/contexts/tenant-context";
import { useQuery } from "@tanstack/react-query";

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;
const STALE_TIME = 5 * 60 * 1000;

function thirtyDayWindow() {
  const end = new Date();
  const start = new Date(end.getTime() - THIRTY_DAYS_MS);
  return { start, end };
}

export function useDashboardData() {
  const { selectedTenant } = useTenant();
  const tenantId = selectedTenant?.id;
  const enabled = Boolean(tenantId);

  const stats = useQuery({
    queryKey: ["dashboard-stats", tenantId],
    queryFn: () => {
      const { start, end } = thirtyDayWindow();
      return messagingApi.stats({
        startDate: start.toISOString(),
        endDate: end.toISOString(),
      });
    },
    enabled,
    staleTime: STALE_TIME,
  });

  const allTimeStats = useQuery({
    queryKey: ["dashboard-stats-all-time", tenantId],
    queryFn: () => messagingApi.stats(),
    enabled,
    staleTime: STALE_TIME,
  });

  const breakdown = useQuery({
    queryKey: ["dashboard-breakdown", tenantId],
    queryFn: async () => {
      const { start, end } = thirtyDayWindow();
      const result = await messagingApi.getDeliveryBreakdown({
        startDate: start.toISOString(),
        endDate: end.toISOString(),
      });
      const dayFormat = new Intl.DateTimeFormat(undefined, {
        month: "short",
        day: "numeric",
      });
      return {
        days: result.days.map((day) => ({
          name: dayFormat.format(new Date(`${day.date}T00:00:00`)),
          sent: day.sent,
          delivered: day.delivered,
          failed: day.failed,
        })),
        channels: result.channels.map((channel) => ({
          ...channel,
          deliveryRate:
            channel.sent > 0 ? Math.round((channel.delivered / channel.sent) * 1000) / 10 : 0,
        })),
      };
    },
    enabled,
    staleTime: STALE_TIME,
  });

  const recent = useQuery({
    queryKey: ["dashboard-recent", tenantId],
    queryFn: () => messagingApi.list({ limit: 6 }),
    enabled,
    staleTime: STALE_TIME,
  });

  const tokens = useQuery({
    queryKey: ["dashboard-tokens", tenantId],
    queryFn: async () => {
      const { start, end } = thirtyDayWindow();
      const [balance, usage] = await Promise.all([
        billingApi.getTokenBalance(),
        billingApi.getUsageStats(start.toISOString(), end.toISOString()),
      ]);
      return { balance, usage };
    },
    enabled,
    staleTime: STALE_TIME,
  });

  const setup = useQuery({
    queryKey: ["dashboard-setup", tenantId],
    queryFn: async () => {
      const projects = await projectApi.getProjects({ limit: 10 });
      const perProject = await Promise.all(
        projects.data.map(async (project) => {
          const [providers, keys] = await Promise.all([
            providerApi.getProvidersByProject(project.id, { limit: 1 }),
            apiKeyApi.getApiKeysByProject(project.id),
          ]);
          return {
            hasProvider: providers.data.length > 0,
            hasApiKey: keys.data.length > 0,
          };
        }),
      );
      return {
        hasProvider: perProject.some((result) => result.hasProvider),
        hasApiKey: perProject.some((result) => result.hasApiKey),
      };
    },
    enabled,
    staleTime: STALE_TIME,
  });

  return { stats, allTimeStats, breakdown, recent, tokens, setup };
}
