"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import type { Campaign, ChannelAnalytics } from "@/lib/types/campaign";
import { ArrowTrendingUpIcon, SignalIcon } from "@heroicons/react/24/outline";
import { CHANNEL_ICONS } from "./campaign-status";
import {
  formatCampaignNumber,
  formatCampaignPercentage,
  STATUS_COLORS,
  STATUS_ICONS,
} from "./campaign-status-monitor.helpers";
import { useCampaignStatusMonitor, type RealtimeEvent } from "./use-campaign-status-monitor";

interface CampaignStatusMonitorProps {
  campaignId: string;
  campaign?: Campaign;
  refreshInterval?: number;
  enableWebSocket?: boolean;
}

export function CampaignStatusMonitor({
  campaignId,
  campaign: initialCampaign,
  refreshInterval = 10000,
  enableWebSocket = true,
}: CampaignStatusMonitorProps) {
  const {
    campaign,
    isLoading,
    isActive,
    lastUpdate,
    connectionStatus,
    realtimeEvents,
  } = useCampaignStatusMonitor(campaignId, initialCampaign, refreshInterval, enableWebSocket);

  if (isLoading || !campaign) {
    return (
      <div className="space-y-4">
        {[...Array(3)].map((_, i) => (
          <Card key={i} className="animate-pulse">
            <CardContent className="p-6">
              <div className="h-4 bg-muted rounded w-1/3 mb-2" />
              <div className="h-8 bg-muted rounded w-full" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  const StatusIcon = STATUS_ICONS[campaign.status];

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <StatusIcon className={`w-5 h-5 ${STATUS_COLORS[campaign.status]}`} />
              Campaign Status
              {isActive && (
                <div className="flex items-center gap-1 ml-2">
                  <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                  <span className="text-sm text-green-600 font-medium">Live</span>
                </div>
              )}
            </CardTitle>
            <div className="text-sm text-muted-foreground">
              Last updated: {lastUpdate.toLocaleTimeString()}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              ["Total Sent", campaign.analytics.totalSent],
              ["Delivered", campaign.analytics.totalDelivered],
              ["Opened", campaign.analytics.totalOpened],
              ["Clicked", campaign.analytics.totalClicked],
            ].map(([label, value]) => (
              <div key={label as string} className="text-center">
                <div className="text-2xl font-bold">{formatCampaignNumber(value as number)}</div>
                <div className="text-sm text-muted-foreground">{label}</div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ArrowTrendingUpIcon className="w-5 h-5" />
            Performance Metrics
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[
              ["Delivery Rate", campaign.analytics.deliveryRate],
              ["Open Rate", campaign.analytics.openRate],
              ["Click Rate", campaign.analytics.clickRate],
            ].map(([label, value]) => (
              <div key={label as string} className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium">{label}</span>
                  <span className="text-sm font-bold">
                    {formatCampaignPercentage(value as number)}
                  </span>
                </div>
                <Progress value={value as number} className="h-2" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Channel Performance</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {campaign.analytics.channelBreakdown.map((channelData: ChannelAnalytics) => {
              const Icon = CHANNEL_ICONS[channelData.channel];
              return (
                <div key={channelData.channel} className="border rounded-lg p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <Icon className="w-4 h-4" />
                      <span className="font-medium capitalize">{channelData.channel}</span>
                      <Badge variant="outline">{formatCampaignNumber(channelData.sent)} sent</Badge>
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {formatCampaignPercentage(channelData.deliveryRate)} delivered
                    </div>
                  </div>
                  <div className="grid grid-cols-4 gap-4 text-sm">
                    {[
                      ["Delivered", channelData.delivered, channelData.deliveryRate],
                      ["Opened", channelData.opened, channelData.openRate],
                      ["Clicked", channelData.clicked, channelData.clickRate],
                      ["Converted", channelData.converted, channelData.conversionRate],
                    ].map(([label, count, rate]) => (
                      <div key={label as string} className="text-center">
                        <div className="font-medium">{formatCampaignNumber(count as number)}</div>
                        <div className="text-muted-foreground">{label}</div>
                        <Progress value={rate as number} className="h-1 mt-1" />
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {isActive && (
        <LiveActivityCard
          connectionStatus={connectionStatus}
          events={realtimeEvents}
          onRetry={() => window.location.reload()}
        />
      )}
    </div>
  );
}

function LiveActivityCard({
  connectionStatus,
  events,
  onRetry,
}: {
  connectionStatus: "connected" | "disconnected" | "error";
  events: RealtimeEvent[];
  onRetry: () => void;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <SignalIcon className="w-5 h-5" />
          Live Activity
          <div
            className={`w-2 h-2 rounded-full ${
              connectionStatus === "connected"
                ? "bg-green-500 animate-pulse"
                : connectionStatus === "error"
                  ? "bg-red-500"
                  : "bg-gray-400"
            }`}
          />
          <span className="text-xs text-muted-foreground capitalize">{connectionStatus}</span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3 max-h-64 overflow-y-auto">
          {events.length > 0 ? (
            events.map((event) => (
              <div key={event.id} className="flex items-center gap-3 text-sm">
                <div
                  className={`w-2 h-2 rounded-full ${
                    event.type === "success"
                      ? "bg-green-500"
                      : event.type === "warning"
                        ? "bg-yellow-500"
                        : event.type === "error"
                          ? "bg-red-500"
                          : "bg-blue-500"
                  }`}
                />
                <span className="text-muted-foreground">{event.timestamp.toLocaleTimeString()}</span>
                <span
                  className={
                    event.type === "error"
                      ? "text-red-600"
                      : event.type === "warning"
                        ? "text-yellow-600"
                        : event.type === "success"
                          ? "text-green-600"
                          : ""
                  }
                >
                  {event.message}
                </span>
              </div>
            ))
          ) : (
            <div className="text-center py-4 text-muted-foreground">
              <SignalIcon className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p>Waiting for real-time events...</p>
            </div>
          )}
        </div>
        {connectionStatus === "error" && (
          <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-md">
            <div className="flex items-center justify-between">
              <span className="text-sm text-red-600">
                Connection lost. Real-time updates unavailable.
              </span>
              <Button size="sm" variant="outline" onClick={onRetry}>
                Retry
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
