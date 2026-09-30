"use client";

import { Eye, MousePointer, Send, TrendingUp } from "@/lib/icons";

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
  ArrowDownTrayIcon,
  EyeIcon,
  FunnelIcon,
  PaperAirplaneIcon,
  ArrowTrendingUpIcon,
  CursorArrowRaysIcon,
} from "@heroicons/react/24/outline";
import { useState } from "react";

interface CampaignAnalyticsProps {
  campaignId?: string;
}

// Mock data for campaign analytics
const mockCampaignData = {
  overview: {
    totalSent: 15420,
    delivered: 15187,
    opened: 3745,
    clicked: 493,
    deliveryRate: 98.5,
    openRate: 24.3,
    clickRate: 3.2,
    unsubscribed: 12,
  },
  performance: [
    { name: "Week 1", sent: 2200, delivered: 2167, opened: 520, clicked: 68 },
    { name: "Week 2", sent: 2400, delivered: 2364, opened: 580, clicked: 77 },
    { name: "Week 3", sent: 2100, delivered: 2079, opened: 510, clicked: 67 },
    { name: "Week 4", sent: 2300, delivered: 2265, opened: 545, clicked: 71 },
    { name: "Week 5", sent: 2500, delivered: 2463, opened: 595, clicked: 78 },
    { name: "Week 6", sent: 1920, delivered: 1849, opened: 495, clicked: 65 },
  ],
  channelBreakdown: [
    { name: "Email", sent: 8500, delivered: 8415, opened: 2040, clicked: 267 },
    { name: "SMS", sent: 3200, delivered: 3168, opened: 950, clicked: 114 },
    { name: "Push", sent: 2100, delivered: 2058, opened: 515, clicked: 72 },
    { name: "In-App", sent: 1620, delivered: 1546, opened: 240, clicked: 40 },
  ],
  deviceBreakdown: [
    { name: "Mobile", value: 65 },
    { name: "Desktop", value: 28 },
    { name: "Tablet", value: 7 },
  ],
  geographicData: [
    { name: "United States", value: 45 },
    { name: "United Kingdom", value: 18 },
    { name: "Canada", value: 12 },
    { name: "Australia", value: 8 },
    { name: "Germany", value: 7 },
    { name: "Others", value: 10 },
  ],
};

export function CampaignAnalytics({ campaignId }: CampaignAnalyticsProps) {
  const [dateRange, setDateRange] = useState<DateRange>({
    from: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
    to: new Date(),
  });
  const [selectedChannel, setSelectedChannel] = useState<string>("all");
  const [selectedCampaign, setSelectedCampaign] = useState<string>(campaignId || "all");

  const data = mockCampaignData;

  const handleExport = () => {
    // TODO: Implement data export functionality
    alert("Export functionality will be implemented soon");
  };

  return (
    <div className="space-y-6">
      {/* Filters */}
      <Card className="p-6">
        <div className="flex flex-col space-y-4 md:flex-row md:space-y-0 md:space-x-4 md:items-end">
          <div className="flex-1">
            <label className="text-sm font-medium mb-2 block">Date Range</label>
            <DateRangePicker value={dateRange} onChange={setDateRange} className="w-full md:w-64" />
          </div>
          <div className="flex-1">
            <label className="text-sm font-medium mb-2 block">Campaign</label>
            <Select value={selectedCampaign} onValueChange={setSelectedCampaign}>
              <SelectTrigger className="w-full md:w-48">
                <SelectValue placeholder="Select campaign" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Campaigns</SelectItem>
                <SelectItem value="welcome-series">Welcome Series</SelectItem>
                <SelectItem value="product-launch">Product Launch</SelectItem>
                <SelectItem value="newsletter">Newsletter</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex-1">
            <label className="text-sm font-medium mb-2 block">Channel</label>
            <Select value={selectedChannel} onValueChange={setSelectedChannel}>
              <SelectTrigger className="w-full md:w-32">
                <SelectValue placeholder="Channel" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="email">Email</SelectItem>
                <SelectItem value="sms">SMS</SelectItem>
                <SelectItem value="push">Push</SelectItem>
                <SelectItem value="in-app">In-App</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex space-x-2">
            <Button variant="outline" size="sm">
              <FunnelIcon className="h-4 w-4 mr-2" />
              More Filters
            </Button>
            <Button variant="outline" size="sm" onClick={handleExport}>
              <ArrowDownTrayIcon className="h-4 w-4 mr-2" />
              Export
            </Button>
          </div>
        </div>
      </Card>

      {/* Overview Metrics */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          title="Messages Sent"
          value={data.overview.totalSent.toLocaleString()}
          icon={Send}
          description="Total messages sent"
        />
        <MetricCard
          title="Delivery Rate"
          value={`${data.overview.deliveryRate}%`}
          icon={TrendingUp}
          description={`${data.overview.delivered.toLocaleString()} delivered`}
        />
        <MetricCard
          title="Open Rate"
          value={`${data.overview.openRate}%`}
          icon={Eye}
          description={`${data.overview.opened.toLocaleString()} opened`}
        />
        <MetricCard
          title="Click Rate"
          value={`${data.overview.clickRate}%`}
          icon={MousePointer}
          description={`${data.overview.clicked.toLocaleString()} clicked`}
        />
      </div>

      {/* Performance Charts */}
      <div className="grid gap-6 lg:grid-cols-2">
        <DashboardChart
          title="Campaign Performance Over Time"
          data={data.performance.map((item) => ({ ...item, value: item.opened }))}
          type="line"
          dataKey="opened"
          height={300}
        />
        <DashboardChart
          title="Channel Performance"
          data={data.channelBreakdown.map((item) => ({ ...item, value: item.opened }))}
          type="bar"
          dataKey="opened"
          height={300}
        />
      </div>

      {/* Additional Analytics */}
      <div className="grid gap-6 lg:grid-cols-2">
        <DashboardChart
          title="Device Breakdown"
          data={data.deviceBreakdown}
          type="pie"
          height={300}
        />
        <DashboardChart
          title="Geographic Distribution"
          data={data.geographicData}
          type="pie"
          height={300}
        />
      </div>

      {/* Detailed Performance Table */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-4">Channel Performance Details</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b">
                <th className="text-left py-2">Channel</th>
                <th className="text-right py-2">Sent</th>
                <th className="text-right py-2">Delivered</th>
                <th className="text-right py-2">Delivery Rate</th>
                <th className="text-right py-2">Opened</th>
                <th className="text-right py-2">Open Rate</th>
                <th className="text-right py-2">Clicked</th>
                <th className="text-right py-2">Click Rate</th>
              </tr>
            </thead>
            <tbody>
              {data.channelBreakdown.map((channel) => (
                <tr key={channel.name} className="border-b">
                  <td className="py-2 font-medium">{channel.name}</td>
                  <td className="text-right py-2">{channel.sent.toLocaleString()}</td>
                  <td className="text-right py-2">{channel.delivered.toLocaleString()}</td>
                  <td className="text-right py-2">
                    {((channel.delivered / channel.sent) * 100).toFixed(1)}%
                  </td>
                  <td className="text-right py-2">{channel.opened.toLocaleString()}</td>
                  <td className="text-right py-2">
                    {((channel.opened / channel.delivered) * 100).toFixed(1)}%
                  </td>
                  <td className="text-right py-2">{channel.clicked.toLocaleString()}</td>
                  <td className="text-right py-2">
                    {((channel.clicked / channel.opened) * 100).toFixed(1)}%
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
