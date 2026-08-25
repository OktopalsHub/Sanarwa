"use client";

import { Activity } from "@/lib/icons";

import { DashboardChart } from "@/components/dashboard/dashboard-chart";
import { MetricCard } from "@/components/dashboard/metric-card";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { DateRange, DateRangePicker } from "@/components/ui/date-range-picker";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  BellIcon,
  ArrowDownTrayIcon,
  EnvelopeIcon,
  ChatBubbleLeftRightIcon,
  PhoneIcon,
  DevicePhoneMobileIcon,
  ArrowTrendingDownIcon,
  ArrowTrendingUpIcon,
} from "@heroicons/react/24/outline";
import { useState } from "react";

interface ChannelAnalyticsProps {
  channel?: "email" | "sms" | "push" | "in-app" | "voice";
}

const channelIcons = {
  email: EnvelopeIcon,
  sms: ChatBubbleLeftRightIcon,
  push: BellIcon,
  "in-app": DevicePhoneMobileIcon,
  voice: PhoneIcon,
};

const channelData = {
  email: {
    metrics: {
      sent: 8500,
      delivered: 8415,
      opened: 2040,
      clicked: 267,
      bounced: 85,
      unsubscribed: 8,
      deliveryRate: 99.0,
      openRate: 24.2,
      clickRate: 13.1,
      bounceRate: 1.0,
    },
    performance: [
      { name: "Mon", sent: 1200, delivered: 1188, opened: 287, clicked: 38 },
      { name: "Tue", sent: 1400, delivered: 1386, opened: 335, clicked: 44 },
      { name: "Wed", sent: 1100, delivered: 1089, opened: 263, clicked: 34 },
      { name: "Thu", sent: 1300, delivered: 1287, opened: 311, clicked: 41 },
      { name: "Fri", sent: 1500, delivered: 1485, opened: 359, clicked: 47 },
      { name: "Sat", sent: 1000, delivered: 990, opened: 239, clicked: 31 },
      { name: "Sun", sent: 1000, delivered: 990, opened: 246, clicked: 32 },
    ],
    hourlyActivity: [
      { name: "00:00", value: 12 },
      { name: "02:00", value: 8 },
      { name: "04:00", value: 5 },
      { name: "06:00", value: 15 },
      { name: "08:00", value: 45 },
      { name: "10:00", value: 78 },
      { name: "12:00", value: 95 },
      { name: "14:00", value: 88 },
      { name: "16:00", value: 102 },
      { name: "18:00", value: 85 },
      { name: "20:00", value: 65 },
      { name: "22:00", value: 35 },
    ],
    topPerformers: [
      { subject: "Welcome to our platform!", openRate: 45.2, clickRate: 8.3 },
      { subject: "Your weekly digest", openRate: 38.7, clickRate: 6.1 },
      { subject: "Special offer just for you", openRate: 35.4, clickRate: 12.8 },
      { subject: "Product update announcement", openRate: 32.1, clickRate: 4.9 },
    ],
  },
  sms: {
    metrics: {
      sent: 3200,
      delivered: 3168,
      opened: 2850,
      clicked: 114,
      bounced: 32,
      unsubscribed: 5,
      deliveryRate: 99.0,
      openRate: 89.9,
      clickRate: 4.0,
      bounceRate: 1.0,
    },
    performance: [
      { name: "Mon", sent: 450, delivered: 446, opened: 401, clicked: 16 },
      { name: "Tue", sent: 520, delivered: 515, opened: 463, clicked: 19 },
      { name: "Wed", sent: 380, delivered: 376, opened: 338, clicked: 13 },
      { name: "Thu", sent: 490, delivered: 485, opened: 436, clicked: 17 },
      { name: "Fri", sent: 560, delivered: 554, opened: 498, clicked: 20 },
      { name: "Sat", sent: 400, delivered: 396, opened: 356, clicked: 14 },
      { name: "Sun", sent: 400, delivered: 396, opened: 358, clicked: 15 },
    ],
    hourlyActivity: [
      { name: "00:00", value: 5 },
      { name: "02:00", value: 2 },
      { name: "04:00", value: 1 },
      { name: "06:00", value: 8 },
      { name: "08:00", value: 25 },
      { name: "10:00", value: 35 },
      { name: "12:00", value: 42 },
      { name: "14:00", value: 38 },
      { name: "16:00", value: 45 },
      { name: "18:00", value: 40 },
      { name: "20:00", value: 30 },
      { name: "22:00", value: 18 },
    ],
    topPerformers: [
      { subject: "Your order is ready!", openRate: 95.2, clickRate: 8.3 },
      { subject: "Verification code: 123456", openRate: 98.7, clickRate: 0.1 },
      { subject: "Flash sale - 50% off!", openRate: 85.4, clickRate: 12.8 },
      { subject: "Appointment reminder", openRate: 92.1, clickRate: 2.9 },
    ],
  },
};

export function ChannelAnalytics({ channel = "email" }: ChannelAnalyticsProps) {
  const [dateRange, setDateRange] = useState<DateRange>({
    from: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
    to: new Date(),
  });
  const [selectedChannel, setSelectedChannel] = useState<
    "email" | "sms" | "push" | "in-app" | "voice"
  >(channel);

  const data = channelData[selectedChannel as keyof typeof channelData] || channelData.email;
  const Icon = channelIcons[selectedChannel as keyof typeof channelIcons];

  const handleExport = () => {
    // TODO: Implement data export functionality
    alert(`Export functionality for ${selectedChannel} will be implemented soon`);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <Icon className="h-8 w-8 text-primary" />
          <div>
            <h1 className="text-2xl font-bold capitalize">{selectedChannel} Analytics</h1>
            <p className="text-muted-foreground">
              Detailed performance metrics for {selectedChannel} communications
            </p>
          </div>
        </div>
        <Button onClick={handleExport} variant="outline">
          <ArrowDownTrayIcon className="h-4 w-4 mr-2" />
          Export Data
        </Button>
      </div>

      {/* Filters */}
      <Card className="p-6">
        <div className="flex flex-col space-y-4 md:flex-row md:space-y-0 md:space-x-4 md:items-end">
          <div className="flex-1">
            <label className="text-sm font-medium mb-2 block">Channel</label>
            <Select
              value={selectedChannel}
              onValueChange={(value) =>
                setSelectedChannel(value as "email" | "sms" | "push" | "in-app" | "voice")
              }
            >
              <SelectTrigger className="w-full md:w-48">
                <SelectValue placeholder="Select channel" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="email">Email</SelectItem>
                <SelectItem value="sms">SMS</SelectItem>
                <SelectItem value="push">Push Notifications</SelectItem>
                <SelectItem value="in-app">In-App Messages</SelectItem>
                <SelectItem value="voice">Voice Calls</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex-1">
            <label className="text-sm font-medium mb-2 block">Date Range</label>
            <DateRangePicker value={dateRange} onChange={setDateRange} className="w-full md:w-64" />
          </div>
        </div>
      </Card>

      {/* Key Metrics */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          title="Messages Sent"
          value={data.metrics.sent.toLocaleString()}
          icon={Icon}
          description="Total messages sent"
        />
        <MetricCard
          title="Delivery Rate"
          value={`${data.metrics.deliveryRate}%`}
          change={{
            value: 0.5,
            type: "increase",
          }}
          icon={ArrowTrendingUpIcon}
          description={`${data.metrics.delivered.toLocaleString()} delivered`}
        />
        <MetricCard
          title="Open Rate"
          value={`${data.metrics.openRate}%`}
          change={{
            value: 2.1,
            type: "increase",
          }}
          icon={ArrowTrendingUpIcon}
          description={`${data.metrics.opened.toLocaleString()} opened`}
        />
        <MetricCard
          title="Click Rate"
          value={`${data.metrics.clickRate}%`}
          change={{
            value: 0.3,
            type: "decrease",
          }}
          icon={ArrowTrendingDownIcon}
          description={`${data.metrics.clicked.toLocaleString()} clicked`}
        />
      </div>

      {/* Performance Charts */}
      <div className="grid gap-6 lg:grid-cols-2">
        <DashboardChart
          title="Daily Performance"
          data={data.performance.map((item) => ({ ...item, value: item.opened }))}
          type="line"
          dataKey="opened"
          height={300}
        />
        <DashboardChart
          title="Hourly Activity"
          data={data.hourlyActivity}
          type="bar"
          dataKey="value"
          height={300}
        />
      </div>

      {/* Detailed Metrics */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="p-6">
          <h3 className="text-lg font-semibold mb-4">Performance Breakdown</h3>
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Bounce Rate</span>
              <span className="font-medium">{data.metrics.bounceRate}%</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Unsubscribe Rate</span>
              <span className="font-medium">
                {((data.metrics.unsubscribed / data.metrics.sent) * 100).toFixed(2)}%
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Click-to-Open Rate</span>
              <span className="font-medium">
                {((data.metrics.clicked / data.metrics.opened) * 100).toFixed(1)}%
              </span>
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <h3 className="text-lg font-semibold mb-4">Top Performing Messages</h3>
          <div className="space-y-3">
            {data.topPerformers.map((message, index) => (
              <div key={index} className="flex justify-between items-start">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{message.subject}</p>
                  <div className="flex space-x-4 text-xs text-muted-foreground">
                    <span>Open: {message.openRate}%</span>
                    <span>Click: {message.clickRate}%</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
