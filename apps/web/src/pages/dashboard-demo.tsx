'use client';

import { Activity, Eye, MessageSquare, Send, TrendingUp } from '@/lib/icons';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { SignalIcon, EyeIcon, ChatBubbleLeftRightIcon, PaperAirplaneIcon, ArrowTrendingUpIcon } from '@heroicons/react/24/outline'

import { Bar, BarChart, CartesianGrid, Cell, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

// Simple demo data
const demoMetrics = {
  totalCampaigns: 47,
  activeCampaigns: 12,
  totalMessages: 28750,
  deliveryRate: 98.7,
  openRate: 26.8,
  clickRate: 4.1,
};

const campaignData = [
  { name: 'Jan', messages: 2400, opens: 643, clicks: 99 },
  { name: 'Feb', messages: 3200, opens: 857, clicks: 131 },
  { name: 'Mar', messages: 2800, opens: 750, clicks: 115 },
  { name: 'Apr', messages: 4100, opens: 1099, clicks: 168 },
  { name: 'May', messages: 3600, opens: 965, clicks: 148 },
  { name: 'Jun', messages: 4800, opens: 1286, clicks: 197 },
];

const channelData = [
  { name: 'Email', value: 18500, color: '#3b82f6' },
  { name: 'SMS', value: 7200, color: '#64748b' },
  { name: 'Push', value: 4100, color: '#8b5cf6' },
  { name: 'In-App', value: 1800, color: '#10b981' },
];

const recentActivity = [
  { name: '00:00', value: 67 },
  { name: '04:00', value: 34 },
  { name: '08:00', value: 156 },
  { name: '12:00', value: 298 },
  { name: '16:00', value: 189 },
  { name: '20:00', value: 123 },
];

function MetricCard({ title, value, icon: Icon, description }: any) {
  return (
    <Card className="p-6">
      <div className="flex items-center justify-between">
        <div className="flex-1">
          <p className="text-sm font-medium text-muted-foreground">{title}</p>
          <p className="text-2xl font-bold">{value}</p>
          {description && (
            <p className="text-xs text-muted-foreground mt-1">{description}</p>
          )}
        </div>
        <div className="ml-4">
          <Icon className="h-8 w-8 text-muted-foreground" />
        </div>
      </div>
    </Card>
  );
}

export default function DashboardDemo() {
  return (
    <div className="min-h-screen bg-background p-8">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold mb-2">Notifi Dashboard Demo</h1>
          <p className="text-muted-foreground">
            This is a demo dashboard with sample data - no authentication required!
          </p>
        </div>

        {/* Metrics */}
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          <MetricCard
            title="Total Campaigns"
            value={demoMetrics.totalCampaigns}
            icon={Send}
            description="All time campaigns"
          />
          <MetricCard
            title="Messages Sent"
            value={demoMetrics.totalMessages.toLocaleString()}
            icon={MessageSquare}
            description="This month"
          />
          <MetricCard
            title="Delivery Rate"
            value={`${demoMetrics.deliveryRate}%`}
            icon={TrendingUp}
            description="Last 30 days"
          />
          <MetricCard
            title="Active Campaigns"
            value={demoMetrics.activeCampaigns}
            icon={Activity}
            description="Currently running"
          />
        </div>

        {/* Engagement Metrics */}
        <div className="grid gap-6 md:grid-cols-2">
          <MetricCard
            title="Open Rate"
            value={`${demoMetrics.openRate}%`}
            icon={Eye}
            description="Average across all channels"
          />
          <MetricCard
            title="Click Rate"
            value={`${demoMetrics.clickRate}%`}
            icon={MessageSquare}
            description="Average across all channels"
          />
        </div>

        {/* Charts */}
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Campaign Performance */}
          <Card className="p-6">
            <CardHeader>
              <CardTitle>Campaign Performance</CardTitle>
              <CardDescription>Monthly message volume and engagement</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={campaignData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" />
                    <YAxis />
                    <Tooltip />
                    <Line type="monotone" dataKey="messages" stroke="#3b82f6" strokeWidth={2} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* Channel Distribution */}
          <Card className="p-6">
            <CardHeader>
              <CardTitle>Channel Distribution</CardTitle>
              <CardDescription>Messages sent by channel</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={channelData}
                      cx="50%"
                      cy="50%"
                      outerRadius={80}
                      dataKey="value"
                      label={(entry: any) => `${entry.name}: ${entry.value.toLocaleString()}`}
                    >
                      {channelData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Recent Activity */}
        <Card className="p-6">
          <CardHeader>
            <CardTitle>Recent Activity (24h)</CardTitle>
            <CardDescription>Hourly message activity</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={recentActivity}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="value" fill="#3b82f6" />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Quick Actions */}
        <Card className="p-6">
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              <button className="flex items-center space-x-3 p-4 rounded-lg border hover:bg-muted/50 transition-colors">
                <PaperAirplaneIcon className="h-5 w-5 text-primary" />
                <div className="text-left">
                  <p className="font-medium">Create Campaign</p>
                  <p className="text-sm text-muted-foreground">Start a new campaign</p>
                </div>
              </button>
              <button className="flex items-center space-x-3 p-4 rounded-lg border hover:bg-muted/50 transition-colors">
                <SignalIcon className="h-5 w-5 text-primary" />
                <div className="text-left">
                  <p className="font-medium">Build Workflow</p>
                  <p className="text-sm text-muted-foreground">Create automation</p>
                </div>
              </button>
              <button className="flex items-center space-x-3 p-4 rounded-lg border hover:bg-muted/50 transition-colors">
                <ChatBubbleLeftRightIcon className="h-5 w-5 text-primary" />
                <div className="text-left">
                  <p className="font-medium">Manage Audience</p>
                  <p className="text-sm text-muted-foreground">Update contacts</p>
                </div>
              </button>
              <button className="flex items-center space-x-3 p-4 rounded-lg border hover:bg-muted/50 transition-colors">
                <EyeIcon className="h-5 w-5 text-primary" />
                <div className="text-left">
                  <p className="font-medium">View Analytics</p>
                  <p className="text-sm text-muted-foreground">Detailed reports</p>
                </div>
              </button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}