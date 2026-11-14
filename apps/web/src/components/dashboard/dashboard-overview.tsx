"use client";

import { Skeleton } from "@sanarwa/ui/skeleton";
import { DashboardChart } from "./dashboard-chart";
import { DashboardEmpty, MilestoneChecklist } from "./dashboard-states";
import { MetricCard } from "./metric-card";
import { RecentDeliveries } from "./recent-deliveries";
import { ChannelBreakdown } from "./channel-breakdown";
import { TokenPeek } from "./token-peek";
import { SectionError } from "./section-error";
import { useDashboardData } from "@/hooks/use-dashboard-data";
import { useTenantBasePath } from "@/hooks/use-tenant-slug";

export function DashboardOverview() {
  const { stats, allTimeStats, breakdown, recent, tokens, setup } = useDashboardData();
  const basePath = useTenantBasePath();

  const neverSent = allTimeStats.isSuccess && allTimeStats.data.total === 0;
  const setupComplete =
    setup.data !== undefined &&
    allTimeStats.isSuccess &&
    setup.data.hasProvider &&
    setup.data.hasApiKey &&
    allTimeStats.data.total > 0;

  const steps = [
    {
      done: setup.data?.hasProvider ?? false,
      href: `${basePath}/providers`,
      label: "Add a provider",
      detail: "Email domain, SMS number, WhatsApp or push.",
    },
    {
      done: setup.data?.hasApiKey ?? false,
      href: `${basePath}/api-keys`,
      label: "Create an API key",
      detail: "Authenticate POST /api/v1/messages from your app.",
    },
    {
      done: (allTimeStats.data?.total ?? 0) > 0,
      href: `${basePath}/messages`,
      label: "Send your first message",
      detail: "Any channel. The receipt lands in Messages.",
    },
  ];

  return (
    <div className="flex flex-col gap-6">
      {!setupComplete && setup.isSuccess && allTimeStats.isSuccess ? (
        <MilestoneChecklist steps={steps} />
      ) : null}

      {neverSent ? (
        <DashboardEmpty basePath={basePath} />
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {stats.isLoading ? (
              <>
                <Skeleton className="h-28" />
                <Skeleton className="h-28" />
                <Skeleton className="h-28" />
                <Skeleton className="h-28" />
              </>
            ) : stats.isError ? (
              <div className="sm:col-span-2 lg:col-span-4">
                <SectionError label="delivery stats" onRetry={() => void stats.refetch()} />
              </div>
            ) : (
              <>
                <MetricCard
                  title="Messages sent"
                  value={(stats.data?.sent ?? 0).toLocaleString()}
                  description="Last 30 days"
                />
                <MetricCard
                  title="Delivery rate"
                  value={`${(stats.data?.deliveryRate ?? 0).toFixed(1)}%`}
                  description="Last 30 days"
                />
                <MetricCard
                  title="Failed"
                  value={(stats.data?.failed ?? 0).toLocaleString()}
                  description="Last 30 days"
                />
                <MetricCard
                  title="Queued"
                  value={(stats.data?.queued ?? 0).toLocaleString()}
                  description="Waiting to send"
                />
              </>
            )}
          </div>

          <div className="grid min-w-0 gap-6 lg:grid-cols-3">
            <div className="flex min-w-0 flex-col gap-6 lg:col-span-2">
              {breakdown.isLoading ? (
                <Skeleton className="h-64 w-full" />
              ) : breakdown.isError ? (
                <SectionError label="send volume" onRetry={() => void breakdown.refetch()} />
              ) : (
                <DashboardChart
                  title="Send volume · last 30 days"
                  data={breakdown.data?.days ?? []}
                  type="bar"
                  dataKey="sent"
                  xAxisKey="name"
                  height={256}
                />
              )}
              <RecentDeliveries
                records={recent.data?.records ?? []}
                isLoading={recent.isLoading}
                isError={recent.isError}
                onRetry={() => void recent.refetch()}
              />
            </div>
            <div className="flex min-w-0 flex-col gap-6">
              <ChannelBreakdown
                channels={breakdown.data?.channels}
                isLoading={breakdown.isLoading}
                isError={breakdown.isError}
                onRetry={() => void breakdown.refetch()}
              />
              <TokenPeek
                data={tokens.data}
                isLoading={tokens.isLoading}
                isError={tokens.isError}
                onRetry={() => void tokens.refetch()}
              />
            </div>
          </div>
        </>
      )}
    </div>
  );
}
