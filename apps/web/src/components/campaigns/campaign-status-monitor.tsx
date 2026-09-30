"use client";

import { Activity, AlertCircle, CheckCircle, Clock, XCircle } from "@/lib/icons";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { campaignApi } from "@/lib/api/campaigns";
import type { Campaign, ChannelAnalytics } from "@/lib/types/campaign";
import { CHANNEL_ICONS } from "./campaign-status";
import { useQuery } from "@tanstack/react-query";
import {
  SignalIcon,
  ExclamationCircleIcon,
  CheckCircleIcon,
  ClockIcon,
  EnvelopeIcon,
  ChatBubbleLeftRightIcon,
  DevicePhoneMobileIcon,
  ArrowTrendingUpIcon,
  UsersIcon,
  SpeakerWaveIcon,
  XCircleIcon,
} from "@heroicons/react/24/outline";
import { useEffect, useState } from "react";

interface CampaignStatusMonitorProps {
  campaignId: string;
  campaign?: Campaign;
  refreshInterval?: number;
  enableWebSocket?: boolean;
}

const STATUS_ICONS = {
  draft: Clock,
  scheduled: Clock,
  active: Activity,
  paused: AlertCircle,
  completed: CheckCircle,
  cancelled: XCircle,
};

const STATUS_COLORS = {
  draft: "text-gray-500",
  scheduled: "text-blue-500",
  active: "text-green-500",
  paused: "text-yellow-500",
  completed: "text-purple-500",
  cancelled: "text-red-500",
};

export function CampaignStatusMonitor({
  campaignId,
  campaign: initialCampaign,
  refreshInterval = 10000, // 10 seconds
  enableWebSocket = true,
}: CampaignStatusMonitorProps) {
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());
  const [connectionStatus, setConnectionStatus] = useState<"connected" | "disconnected" | "error">(
    "disconnected",
  );
  const [realtimeEvents, setRealtimeEvents] = useState<
    Array<{
      id: string;
      timestamp: Date;
      type: "info" | "success" | "warning" | "error";
      message: string;
    }>
  >([]);

  // Fetch campaign data with real-time updates
  const { data: campaign, isLoading } = useQuery({
    queryKey: ["campaign", campaignId],
    queryFn: () => campaignApi.getCampaign(campaignId),
    initialData: initialCampaign,
    refetchInterval: refreshInterval,
    refetchIntervalInBackground: true,
  });

  // Fetch detailed analytics
  const { data: analytics } = useQuery({
    queryKey: ["campaign-analytics", campaignId],
    queryFn: () => campaignApi.getCampaignAnalytics(campaignId),
    refetchInterval: refreshInterval,
    refetchIntervalInBackground: true,
  });

  useEffect(() => {
    setLastUpdate(new Date());
  }, [campaign, analytics]);

  const isActive = campaign?.status === "active";

  // WebSocket connection for real-time updates
  useEffect(() => {
    if (!enableWebSocket || !isActive) return;

    // Simulate WebSocket connection for real-time updates
    // In a real implementation, this would connect to your WebSocket server
    const simulateRealtimeEvents = () => {
      const eventTypes = [
        { type: "info" as const, message: "Campaign is actively sending messages" },
        { type: "success" as const, message: "Batch of 500 emails queued for delivery" },
        { type: "warning" as const, message: "SMS delivery rate: 98.5% (2 failures)" },
        { type: "info" as const, message: "Push notifications sent to 1,234 devices" },
        { type: "success" as const, message: "Email batch completed successfully" },
      ];

      const randomEvent = eventTypes[Math.floor(Math.random() * eventTypes.length)];
      if (!randomEvent) return;

      const newEvent = {
        id: Math.random().toString(36).substr(2, 9),
        timestamp: new Date(),
        type: randomEvent.type,
        message: randomEvent.message,
      };

      setRealtimeEvents((prev) => [newEvent, ...prev.slice(0, 9)]); // Keep last 10 events
      setConnectionStatus("connected");
    };

    // Simulate connection
    setConnectionStatus("connected");
    const interval = setInterval(simulateRealtimeEvents, 15000); // New event every 15 seconds

    return () => {
      clearInterval(interval);
      setConnectionStatus("disconnected");
    };
  }, [enableWebSocket, isActive]);

  // Add error handling for failed API calls
  const handleRetry = () => {
    // Force refetch of campaign data
    window.location.reload();
  };

  if (isLoading || !campaign) {
    return (
      <div className="space-y-4">
        {[...Array(3)].map((_, i) => (
          <Card key={i} className="animate-pulse">
            <CardContent className="p-6">
              <div className="h-4 bg-muted rounded w-1/3 mb-2"></div>
              <div className="h-8 bg-muted rounded w-full"></div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  const StatusIcon = STATUS_ICONS[campaign.status];

  const formatNumber = (num: number) => {
    return new Intl.NumberFormat().format(num);
  };

  const formatPercentage = (num: number) => {
    return `${num.toFixed(1)}%`;
  };

  return (
    <div className="space-y-6">
      {/* Campaign Status Overview */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <StatusIcon className={`w-5 h-5 ${STATUS_COLORS[campaign.status]}`} />
              Campaign Status
              {isActive && (
                <div className="flex items-center gap-1 ml-2">
                  <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
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
            <div className="text-center">
              <div className="text-2xl font-bold">{formatNumber(campaign.analytics.totalSent)}</div>
              <div className="text-sm text-muted-foreground">Total Sent</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold">
                {formatNumber(campaign.analytics.totalDelivered)}
              </div>
              <div className="text-sm text-muted-foreground">Delivered</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold">
                {formatNumber(campaign.analytics.totalOpened)}
              </div>
              <div className="text-sm text-muted-foreground">Opened</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold">
                {formatNumber(campaign.analytics.totalClicked)}
              </div>
              <div className="text-sm text-muted-foreground">Clicked</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Performance Metrics */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ArrowTrendingUpIcon className="w-5 h-5" />
            Performance Metrics
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Delivery Rate */}
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium">Delivery Rate</span>
                <span className="text-sm font-bold">
                  {formatPercentage(campaign.analytics.deliveryRate)}
                </span>
              </div>
              <Progress value={campaign.analytics.deliveryRate} className="h-2" />
            </div>

            {/* Open Rate */}
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium">Open Rate</span>
                <span className="text-sm font-bold">
                  {formatPercentage(campaign.analytics.openRate)}
                </span>
              </div>
              <Progress value={campaign.analytics.openRate} className="h-2" />
            </div>

            {/* Click Rate */}
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium">Click Rate</span>
                <span className="text-sm font-bold">
                  {formatPercentage(campaign.analytics.clickRate)}
                </span>
              </div>
              <Progress value={campaign.analytics.clickRate} className="h-2" />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Channel Breakdown */}
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
                      <Badge variant="outline">{formatNumber(channelData.sent)} sent</Badge>
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {formatPercentage(channelData.deliveryRate)} delivered
                    </div>
                  </div>

                  <div className="grid grid-cols-4 gap-4 text-sm">
                    <div className="text-center">
                      <div className="font-medium">{formatNumber(channelData.delivered)}</div>
                      <div className="text-muted-foreground">Delivered</div>
                      <Progress value={channelData.deliveryRate} className="h-1 mt-1" />
                    </div>
                    <div className="text-center">
                      <div className="font-medium">{formatNumber(channelData.opened)}</div>
                      <div className="text-muted-foreground">Opened</div>
                      <Progress value={channelData.openRate} className="h-1 mt-1" />
                    </div>
                    <div className="text-center">
                      <div className="font-medium">{formatNumber(channelData.clicked)}</div>
                      <div className="text-muted-foreground">Clicked</div>
                      <Progress value={channelData.clickRate} className="h-1 mt-1" />
                    </div>
                    <div className="text-center">
                      <div className="font-medium">{formatNumber(channelData.converted)}</div>
                      <div className="text-muted-foreground">Converted</div>
                      <Progress value={channelData.conversionRate} className="h-1 mt-1" />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Real-time Activity Feed */}
      {isActive && (
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
              ></div>
              <span className="text-xs text-muted-foreground capitalize">{connectionStatus}</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3 max-h-64 overflow-y-auto">
              {realtimeEvents.length > 0 ? (
                realtimeEvents.map((event) => (
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
                    ></div>
                    <span className="text-muted-foreground">
                      {event.timestamp.toLocaleTimeString()}
                    </span>
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
                  <Button size="sm" variant="outline" onClick={handleRetry}>
                    Retry
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
