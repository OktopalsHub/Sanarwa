"use client";

import { Card } from "@/components/ui/card";
import { useDashboardData } from "@/hooks/use-dashboard-data";
import { SignalIcon, EyeIcon, ChatBubbleLeftRightIcon, PaperAirplaneIcon, ArrowTrendingUpIcon, UsersIcon, BoltIcon, ArrowTopRightOnSquareIcon, CursorArrowRaysIcon } from '@heroicons/react/24/outline'
import { DashboardChart } from "./dashboard-chart";
import { MetricCard } from "./metric-card";

export function DashboardOverview() {
  const { data, isLoading } = useDashboardData();

  if (isLoading) {
    return (
      <div className="animate-in fade-in space-y-6 duration-500">
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <Card key={i} className="glass animate-pulse p-6">
              <div className="bg-muted mb-3 h-4 w-3/4 rounded-lg"></div>
              <div className="bg-muted mb-3 h-8 w-1/2 rounded-lg"></div>
              <div className="bg-muted h-3 w-full rounded-lg"></div>
            </Card>
          ))}
        </div>
        <div className="grid gap-6 lg:grid-cols-2">
          {[...Array(2)].map((_, i) => (
            <Card key={i} className="glass animate-pulse p-6">
              <div className="bg-muted mb-6 h-6 w-1/3 rounded-lg"></div>
              <div className="bg-muted h-64 rounded-lg"></div>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="glass border-border/50 flex h-64 flex-col items-center justify-center rounded-lg border">
        <SignalIcon className="text-muted-foreground mb-4 h-12 w-12" />
        <p className="text-muted-foreground text-lg">
          No dashboard data available
        </p>
        <p className="text-muted-foreground/70 mt-2 text-sm">
          Start by creating your first campaign
        </p>
      </div>
    );
  }

  const { metrics, campaignPerformance, channelDistribution, recentActivity } =
    data;

  return (
    <div className="animate-in fade-in space-y-6 duration-500">
      {/* Key Metrics */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          title="Total Campaigns"
          value={metrics.totalCampaigns}
          change={{
            value: metrics.campaignsChange,
            type: metrics.campaignsChange > 0 ? "increase" : "decrease",
          }}
          icon={PaperAirplaneIcon}
          description="All time campaigns"
        />
        <MetricCard
          title="Messages Sent"
          value={metrics.totalMessages.toLocaleString()}
          change={{
            value: metrics.messagesChange,
            type: metrics.messagesChange > 0 ? "increase" : "decrease",
          }}
          icon={ChatBubbleLeftRightIcon}
          description="This month"
        />
        <MetricCard
          title="Delivery Rate"
          value={`${metrics.deliveryRate}%`}
          change={{
            value: metrics.deliveryRateChange,
            type: metrics.deliveryRateChange > 0 ? "increase" : "decrease",
          }}
          icon={ArrowTrendingUpIcon}
          description="Last 30 days"
        />
        <MetricCard
          title="Active Campaigns"
          value={metrics.activeCampaigns}
          icon={BoltIcon}
          description="Currently running"
        />
      </div>

      {/* Engagement Metrics */}
      <div className="grid gap-6 md:grid-cols-2">
        <MetricCard
          title="Open Rate"
          value={`${metrics.openRate}%`}
          icon={EyeIcon}
          description="Average across all channels"
        />
        <MetricCard
          title="Click Rate"
          value={`${metrics.clickRate}%`}
          icon={CursorArrowRaysIcon}
          description="Average across all channels"
        />
      </div>

      {/* Charts */}
      <div className="grid gap-6 lg:grid-cols-2">
        <DashboardChart
          title="Campaign Performance (Last 30 Days)"
          data={campaignPerformance.map((item) => {
            const dateLabel = new Date(String(item.date)).toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
            });
            return {
              name: dateLabel,
              value: Number(item.delivered ?? 0),
              date: dateLabel,
              Sent: Number(item.sent ?? 0),
              Delivered: Number(item.delivered ?? 0),
              Opened: Number(item.opened ?? 0),
              Clicked: Number(item.clicked ?? 0),
            };
          })}
          type="line"
          dataKey="Delivered"
          xAxisKey="date"
          height={300}
        />

        <DashboardChart
          title="Channel Distribution"
          data={channelDistribution}
          type="pie"
          height={300}
        />
      </div>

      {/* Recent Activity & Quick Actions */}
      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="glass border-border/50 lg:col-span-2">
          <div className="p-6">
            <div className="mb-6 flex items-center justify-between">
              <h3 className="text-lg font-semibold">Recent Activity</h3>
              <button className="text-primary hover:text-primary/80 text-sm font-medium">
                View All
              </button>
            </div>
            <div className="space-y-4">
              {recentActivity.slice(0, 5).map((activity) => (
                <div
                  key={activity.id}
                  className="hover:bg-muted/50 flex items-start space-x-4 rounded-lg p-4 transition-colors"
                >
                  <div
                    className={`rounded-lg p-2 ${
                      activity.status === "success"
                        ? "bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400"
                        : activity.status === "error"
                          ? "bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400"
                          : activity.status === "warning"
                            ? "bg-yellow-100 text-yellow-600 dark:bg-yellow-900/30 dark:text-yellow-400"
                            : "bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400"
                    }`}
                  >
                    {activity.type === "campaign_sent" && (
                      <PaperAirplaneIcon className="h-4 w-4" />
                    )}
                    {activity.type === "notification_delivered" && (
                      <ChatBubbleLeftRightIcon className="h-4 w-4" />
                    )}
                    {activity.type === "template_created" && (
                      <BoltIcon className="h-4 w-4" />
                    )}
                    {activity.type === "notification_failed" && (
                      <SignalIcon className="h-4 w-4" />
                    )}
                    {activity.type === "provider_configured" && (
                      <ArrowTrendingUpIcon className="h-4 w-4" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium">{activity.title}</p>
                    <p className="text-muted-foreground truncate text-sm">
                      {activity.description}
                    </p>
                    <p className="text-muted-foreground mt-1 text-xs">
                      {new Date(String(activity.timestamp)).toLocaleString()}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </Card>

        <Card className="glass border-border/50">
          <div className="p-6">
            <h3 className="mb-6 text-lg font-semibold">Quick Actions</h3>
            <div className="space-y-3">
              <button className="border-border/50 hover:border-primary hover:bg-primary/5 group flex w-full items-center space-x-3 rounded-lg border p-3 transition-all duration-200">
                <div className="bg-primary/10 group-hover:bg-primary/20 rounded-lg p-2 transition-colors">
                  <PaperAirplaneIcon className="text-primary h-4 w-4" />
                </div>
                <div className="text-left">
                  <p className="text-sm font-medium">Create Campaign</p>
                </div>
                <ArrowTopRightOnSquareIcon className="text-muted-foreground ml-auto h-4 w-4 opacity-0 transition-opacity group-hover:opacity-100" />
              </button>
              <button className="border-border/50 hover:border-accent hover:bg-accent/5 group flex w-full items-center space-x-3 rounded-lg border p-3 transition-all duration-200">
                <div className="bg-accent/10 group-hover:bg-accent/20 rounded-lg p-2 transition-colors">
                  <BoltIcon className="text-accent h-4 w-4" />
                </div>
                <div className="text-left">
                  <p className="text-sm font-medium">Build Workflow</p>
                </div>
                <ArrowTopRightOnSquareIcon className="text-muted-foreground ml-auto h-4 w-4 opacity-0 transition-opacity group-hover:opacity-100" />
              </button>
              <button className="border-border/50 hover:border-primary hover:bg-primary/5 group flex w-full items-center space-x-3 rounded-lg border p-3 transition-all duration-200">
                <div className="bg-primary/10 group-hover:bg-primary/20 rounded-lg p-2 transition-colors">
                  <UsersIcon className="text-primary h-4 w-4" />
                </div>
                <div className="text-left">
                  <p className="text-sm font-medium">Manage Audience</p>
                </div>
                <ArrowTopRightOnSquareIcon className="text-muted-foreground ml-auto h-4 w-4 opacity-0 transition-opacity group-hover:opacity-100" />
              </button>
              <button className="border-border/50 hover:border-accent hover:bg-accent/5 group flex w-full items-center space-x-3 rounded-lg border p-3 transition-all duration-200">
                <div className="bg-accent/10 group-hover:bg-accent/20 rounded-lg p-2 transition-colors">
                  <EyeIcon className="text-accent h-4 w-4" />
                </div>
                <div className="text-left">
                  <p className="text-sm font-medium">View Analytics</p>
                </div>
                <ArrowTopRightOnSquareIcon className="text-muted-foreground ml-auto h-4 w-4 opacity-0 transition-opacity group-hover:opacity-100" />
              </button>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}

