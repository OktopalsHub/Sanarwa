"use client";

import { Activity } from "@/lib/icons";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  ChartBarIcon,
  ArrowTrendingUpIcon,
  ArrowTrendingDownIcon,
  SignalIcon,
  UsersIcon,
  ChatBubbleLeftRightIcon,
} from "@heroicons/react/24/outline";

interface ProjectAnalyticsProps {
  projectId: string;
}

// Mock analytics data
const mockAnalytics = {
  overview: {
    totalMessages: 12543,
    deliveryRate: 98.5,
    openRate: 24.3,
    clickRate: 3.2,
    bounceRate: 1.5,
  },
  trends: {
    messages: { value: 12543, change: 12.5, trend: "up" },
    delivered: { value: 12356, change: 11.8, trend: "up" },
    opened: { value: 3048, change: -2.1, trend: "down" },
    clicked: { value: 401, change: 5.3, trend: "up" },
  },
  channels: [
    { name: "Email", messages: 8234, deliveryRate: 99.1 },
    { name: "SMS", messages: 3456, deliveryRate: 97.8 },
    { name: "Push", messages: 853, deliveryRate: 95.2 },
  ],
};

export function ProjectAnalytics({ projectId }: ProjectAnalyticsProps) {
  const [timeRange, setTimeRange] = useState("7d");

  // Mock query - replace with actual API call
  const { data: analytics = mockAnalytics, isLoading } = useQuery({
    queryKey: ["project-analytics", projectId, timeRange],
    queryFn: async () => {
      // Replace with actual API call
      return mockAnalytics;
    },
  });

  const formatNumber = (num: number) => {
    if (num >= 1000000) return (num / 1000000).toFixed(1) + "M";
    if (num >= 1000) return (num / 1000).toFixed(1) + "K";
    return num.toString();
  };

  const formatPercentage = (num: number) => {
    return num.toFixed(1) + "%";
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <Card key={i} className="animate-pulse">
              <CardContent className="pt-6">
                <div className="space-y-2">
                  <div className="h-4 bg-muted rounded w-1/2"></div>
                  <div className="h-6 bg-muted rounded w-3/4"></div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Analytics Overview</h3>
          <p className="text-sm text-muted-foreground">
            Track your project's messaging performance and engagement metrics
          </p>
        </div>
        <Select value={timeRange} onValueChange={setTimeRange}>
          <SelectTrigger className="w-[180px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="24h">Last 24 hours</SelectItem>
            <SelectItem value="7d">Last 7 days</SelectItem>
            <SelectItem value="30d">Last 30 days</SelectItem>
            <SelectItem value="90d">Last 90 days</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Total Messages</p>
                <p className="text-2xl font-bold">
                  {formatNumber(analytics.trends.messages.value)}
                </p>
              </div>
              <div className="flex items-center gap-1">
                {analytics.trends.messages.trend === "up" ? (
                  <ArrowTrendingUpIcon className="h-4 w-4 text-green-500" />
                ) : (
                  <ArrowTrendingDownIcon className="h-4 w-4 text-red-500" />
                )}
                <span
                  className={`text-sm ${analytics.trends.messages.trend === "up" ? "text-green-500" : "text-red-500"}`}
                >
                  {Math.abs(analytics.trends.messages.change)}%
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Delivery Rate</p>
                <p className="text-2xl font-bold">
                  {formatPercentage(analytics.overview.deliveryRate)}
                </p>
              </div>
              <SignalIcon className="h-8 w-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Open Rate</p>
                <p className="text-2xl font-bold">
                  {formatPercentage(analytics.overview.openRate)}
                </p>
              </div>
              <div className="flex items-center gap-1">
                {analytics.trends.opened.trend === "up" ? (
                  <ArrowTrendingUpIcon className="h-4 w-4 text-green-500" />
                ) : (
                  <ArrowTrendingDownIcon className="h-4 w-4 text-red-500" />
                )}
                <span
                  className={`text-sm ${analytics.trends.opened.trend === "up" ? "text-green-500" : "text-red-500"}`}
                >
                  {Math.abs(analytics.trends.opened.change)}%
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Click Rate</p>
                <p className="text-2xl font-bold">
                  {formatPercentage(analytics.overview.clickRate)}
                </p>
              </div>
              <div className="flex items-center gap-1">
                {analytics.trends.clicked.trend === "up" ? (
                  <ArrowTrendingUpIcon className="h-4 w-4 text-green-500" />
                ) : (
                  <ArrowTrendingDownIcon className="h-4 w-4 text-red-500" />
                )}
                <span
                  className={`text-sm ${analytics.trends.clicked.trend === "up" ? "text-green-500" : "text-red-500"}`}
                >
                  {Math.abs(analytics.trends.clicked.change)}%
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Channel Performance */}
      <Card>
        <CardHeader>
          <CardTitle>Channel Performance</CardTitle>
          <CardDescription>
            Message volume and delivery rates by communication channel
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {analytics.channels.map((channel) => (
              <div
                key={channel.name}
                className="flex items-center justify-between p-4 border rounded-lg"
              >
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-2">
                    <ChatBubbleLeftRightIcon className="h-5 w-5 text-muted-foreground" />
                    <span className="font-medium">{channel.name}</span>
                  </div>
                  <Badge variant="outline">{formatNumber(channel.messages)} messages</Badge>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">Delivery Rate:</span>
                  <Badge variant={channel.deliveryRate >= 95 ? "default" : "secondary"}>
                    {formatPercentage(channel.deliveryRate)}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Recent Activity */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Activity</CardTitle>
          <CardDescription>Latest messaging activity for this project</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            <ChartBarIcon className="h-8 w-8 mx-auto mb-2" />
            <p>Detailed analytics coming soon</p>
            <p className="text-sm">We're working on more detailed charts and insights</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
