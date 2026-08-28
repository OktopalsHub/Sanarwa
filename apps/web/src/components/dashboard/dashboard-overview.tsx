"use client";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useDashboardData } from "@/hooks/use-dashboard-data";
import { useTenantBasePath } from "@/hooks/use-tenant-slug";
import { useTenant } from "@/contexts/tenant-context";
import { apiClient } from "@/lib/api/client";
import { providerApi } from "@/lib/api/provider";
import { projectApi } from "@/lib/api/project";
import { apiKeyApi } from "@/lib/api/api-key";
import { DashboardChart } from "./dashboard-chart";
import { DashboardEmpty, DashboardSetup } from "./dashboard-states";
import { MetricCard } from "./metric-card";
import {
  IconAlertCircle,
  IconBolt,
  IconInbox,
  IconKey,
  IconMessage,
  IconTrendingUp,
} from "@tabler/icons-react";
import { useQuery } from "@tanstack/react-query";
import Link from "@/compat/next-link";

export function DashboardOverview() {
  const { data, isLoading } = useDashboardData();
  const basePath = useTenantBasePath();
  const { selectedTenant } = useTenant();

  const setup = useQuery({
    queryKey: ["dashboard-setup", selectedTenant?.id],
    queryFn: async () => {
      if (selectedTenant?.id) apiClient.setTenant(selectedTenant.id);
      const [providers, projects] = await Promise.all([
        providerApi.getProviders({ limit: 1 }).catch(() => ({ data: [] })),
        projectApi.getProjects({ limit: 5 }).catch(() => ({ data: [] })),
      ]);
      let keyCount = 0;
      for (const project of projects.data || []) {
        const keys = await apiKeyApi.getApiKeysByProject(project.id).catch(() => ({ data: [] }));
        keyCount += keys.data?.length || 0;
        if (keyCount > 0) break;
      }
      return {
        hasProvider: (providers.data?.length || 0) > 0,
        hasApiKey: keyCount > 0,
      };
    },
    enabled: !!selectedTenant?.id,
  });

  if (isLoading) {
    return (
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        <Skeleton className="h-28" />
        <Skeleton className="h-28" />
        <Skeleton className="h-28" />
        <Skeleton className="h-28" />
      </div>
    );
  }

  const metrics = data?.metrics;
  const needsSetup = setup.data && (!setup.data.hasProvider || !setup.data.hasApiKey);
  const empty = !metrics || metrics.totalMessages === 0;

  return (
    <div className="flex flex-col gap-6">
      {needsSetup ? (
        <DashboardSetup
          hasProvider={Boolean(setup.data?.hasProvider)}
          hasApiKey={Boolean(setup.data?.hasApiKey)}
          basePath={basePath}
        />
      ) : null}

      {empty ? (
        <DashboardEmpty basePath={basePath} />
      ) : (
        <>
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
            <MetricCard
              title="Messages Sent"
              value={(metrics?.totalMessages ?? 0).toLocaleString()}
              icon={IconMessage}
              description="Last 30 days"
            />
            <MetricCard
              title="Delivery Rate"
              value={`${metrics?.deliveryRate ?? 0}%`}
              icon={IconTrendingUp}
              description="Last 30 days"
            />
            <MetricCard
              title="Failed"
              value={metrics?.failed ?? 0}
              icon={IconAlertCircle}
              description="Last 30 days"
            />
            <MetricCard
              title="Active Campaigns"
              value={metrics?.activeCampaigns ?? 0}
              icon={IconBolt}
              description="Currently running"
            />
          </div>

          <div className="grid gap-6 lg:grid-cols-3">
            <div className="lg:col-span-2">
              <DashboardChart
                title="Channel Distribution"
                data={data?.channelDistribution ?? []}
                type="pie"
                height={300}
              />
            </div>
            <Card className="p-6">
              <h3 className="mb-4 text-lg font-semibold">Quick actions</h3>
              <div className="flex flex-col gap-2">
                <Button asChild variant="outline" className="w-full justify-start">
                  <Link href={`${basePath}/messages`}>
                    <IconInbox data-icon="inline-start" />
                    View messages
                  </Link>
                </Button>
                <Button asChild variant="outline" className="w-full justify-start">
                  <Link href={`${basePath}/providers`}>
                    <IconBolt data-icon="inline-start" />
                    Manage providers
                  </Link>
                </Button>
                <Button asChild variant="outline" className="w-full justify-start">
                  <Link href={`${basePath}/api-keys`}>
                    <IconKey data-icon="inline-start" />
                    API keys
                  </Link>
                </Button>
                <Button asChild variant="outline" className="w-full justify-start">
                  <Link href={`${basePath}/analytics`}>View analytics</Link>
                </Button>
              </div>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
