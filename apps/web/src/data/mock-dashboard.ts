import { Activity } from '@/lib/icons';
export interface DashboardMetrics {
  totalCampaigns: number;
  campaignsChange: number;
  totalMessages: number;
  messagesChange: number;
  deliveryRate: number;
  deliveryRateChange: number;
  activeCampaigns: number;
  openRate: number;
  clickRate: number;
  bounceRate: number;
}

export interface CampaignPerformance {
  date: string;
  sent: number;
  delivered: number;
  opened: number;
  clicked: number;
  bounced: number;
}

export interface ChannelDistribution {
  channel: string;
  value: number;
  percentage: number;
  color: string;
}

export interface RecentActivity {
  id: string;
  type: 'campaign_sent' | 'template_created' | 'provider_configured' | 'notification_delivered' | 'notification_failed';
  title: string;
  description: string;
  timestamp: string;
  status: 'success' | 'warning' | 'error' | 'info';
  metadata?: Record<string, any>;
}

export interface DashboardData {
  metrics: DashboardMetrics;
  campaignPerformance: CampaignPerformance[];
  channelDistribution: ChannelDistribution[];
  recentActivity: RecentActivity[];
}

// Mock Dashboard Metrics
export const mockMetrics: DashboardMetrics = {
  totalCampaigns: 156,
  campaignsChange: 12.5,
  totalMessages: 45678,
  messagesChange: 8.3,
  deliveryRate: 98.5,
  deliveryRateChange: 2.1,
  activeCampaigns: 8,
  openRate: 42.3,
  clickRate: 18.7,
  bounceRate: 1.5,
};

// Mock Campaign Performance Data (Last 30 days)
export const mockCampaignPerformance: CampaignPerformance[] = [
  { date: '2024-01-01', sent: 1200, delivered: 1180, opened: 520, clicked: 230, bounced: 20 },
  { date: '2024-01-02', sent: 1350, delivered: 1330, opened: 580, clicked: 260, bounced: 20 },
  { date: '2024-01-03', sent: 1100, delivered: 1085, opened: 470, clicked: 210, bounced: 15 },
  { date: '2024-01-04', sent: 1450, delivered: 1425, opened: 620, clicked: 280, bounced: 25 },
  { date: '2024-01-05', sent: 1600, delivered: 1575, opened: 690, clicked: 310, bounced: 25 },
  { date: '2024-01-06', sent: 1250, delivered: 1230, opened: 540, clicked: 240, bounced: 20 },
  { date: '2024-01-07', sent: 1400, delivered: 1380, opened: 600, clicked: 270, bounced: 20 },
  { date: '2024-01-08', sent: 1550, delivered: 1525, opened: 670, clicked: 300, bounced: 25 },
  { date: '2024-01-09', sent: 1300, delivered: 1280, opened: 560, clicked: 250, bounced: 20 },
  { date: '2024-01-10', sent: 1500, delivered: 1475, opened: 650, clicked: 290, bounced: 25 },
  { date: '2024-01-11', sent: 1650, delivered: 1620, opened: 710, clicked: 320, bounced: 30 },
  { date: '2024-01-12', sent: 1400, delivered: 1380, opened: 600, clicked: 270, bounced: 20 },
  { date: '2024-01-13', sent: 1200, delivered: 1180, opened: 520, clicked: 230, bounced: 20 },
  { date: '2024-01-14', sent: 1350, delivered: 1330, opened: 580, clicked: 260, bounced: 20 },
  { date: '2024-01-15', sent: 1550, delivered: 1525, opened: 670, clicked: 300, bounced: 25 },
  { date: '2024-01-16', sent: 1450, delivered: 1425, opened: 620, clicked: 280, bounced: 25 },
  { date: '2024-01-17', sent: 1600, delivered: 1575, opened: 690, clicked: 310, bounced: 25 },
  { date: '2024-01-18', sent: 1300, delivered: 1280, opened: 560, clicked: 250, bounced: 20 },
  { date: '2024-01-19', sent: 1500, delivered: 1475, opened: 650, clicked: 290, bounced: 25 },
  { date: '2024-01-20', sent: 1700, delivered: 1670, opened: 730, clicked: 330, bounced: 30 },
  { date: '2024-01-21', sent: 1400, delivered: 1380, opened: 600, clicked: 270, bounced: 20 },
  { date: '2024-01-22', sent: 1550, delivered: 1525, opened: 670, clicked: 300, bounced: 25 },
  { date: '2024-01-23', sent: 1650, delivered: 1620, opened: 710, clicked: 320, bounced: 30 },
  { date: '2024-01-24', sent: 1450, delivered: 1425, opened: 620, clicked: 280, bounced: 25 },
  { date: '2024-01-25', sent: 1600, delivered: 1575, opened: 690, clicked: 310, bounced: 25 },
  { date: '2024-01-26', sent: 1500, delivered: 1475, opened: 650, clicked: 290, bounced: 25 },
  { date: '2024-01-27', sent: 1400, delivered: 1380, opened: 600, clicked: 270, bounced: 20 },
  { date: '2024-01-28', sent: 1700, delivered: 1670, opened: 730, clicked: 330, bounced: 30 },
  { date: '2024-01-29', sent: 1550, delivered: 1525, opened: 670, clicked: 300, bounced: 25 },
  { date: '2024-01-30', sent: 1650, delivered: 1620, opened: 710, clicked: 320, bounced: 30 },
];

// Mock Channel Distribution
export const mockChannelDistribution: ChannelDistribution[] = [
  { channel: 'Email', value: 18500, percentage: 45, color: 'hsl(var(--primary))' },
  { channel: 'SMS', value: 12300, percentage: 30, color: 'hsl(var(--accent))' },
  { channel: 'Push', value: 6150, percentage: 15, color: 'hsl(var(--chart-3))' },
  { channel: 'In-App', value: 4100, percentage: 10, color: 'hsl(var(--chart-4))' },
];

// Mock Recent Activity
export const mockRecentActivity: RecentActivity[] = [
  {
    id: '1',
    type: 'campaign_sent',
    title: 'Welcome Campaign Sent',
    description: 'Sent to 1,234 recipients across email and SMS channels',
    timestamp: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
    status: 'success',
    metadata: { recipients: 1234, channels: ['email', 'sms'] },
  },
  {
    id: '2',
    type: 'notification_delivered',
    title: 'Order Confirmation Delivered',
    description: 'Push notification delivered successfully to 456 users',
    timestamp: new Date(Date.now() - 15 * 60 * 1000).toISOString(),
    status: 'success',
    metadata: { recipients: 456, channel: 'push' },
  },
  {
    id: '3',
    type: 'template_created',
    title: 'New Template Created',
    description: 'Password Reset Email template created by John Doe',
    timestamp: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
    status: 'info',
    metadata: { templateName: 'Password Reset Email', createdBy: 'John Doe' },
  },
  {
    id: '4',
    type: 'notification_failed',
    title: 'SMS Delivery Failed',
    description: '12 SMS messages failed due to invalid phone numbers',
    timestamp: new Date(Date.now() - 45 * 60 * 1000).toISOString(),
    status: 'error',
    metadata: { failedCount: 12, reason: 'Invalid phone numbers' },
  },
  {
    id: '5',
    type: 'provider_configured',
    title: 'Twilio Provider Configured',
    description: 'SMS provider successfully configured and tested',
    timestamp: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
    status: 'success',
    metadata: { provider: 'Twilio', channel: 'SMS' },
  },
  {
    id: '6',
    type: 'campaign_sent',
    title: 'Weekly Newsletter Sent',
    description: 'Sent to 5,678 subscribers via email',
    timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
    status: 'success',
    metadata: { recipients: 5678, channel: 'email' },
  },
  {
    id: '7',
    type: 'notification_delivered',
    title: 'Payment Reminder Sent',
    description: 'In-app notification delivered to 234 users',
    timestamp: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(),
    status: 'success',
    metadata: { recipients: 234, channel: 'in-app' },
  },
  {
    id: '8',
    type: 'template_created',
    title: 'Promotional Email Template',
    description: 'New promotional template created for holiday campaign',
    timestamp: new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString(),
    status: 'info',
    metadata: { templateName: 'Holiday Promotion', createdBy: 'Marketing Team' },
  },
];

// Mock Dashboard Data
export const mockDashboardData: DashboardData = {
  metrics: mockMetrics,
  campaignPerformance: mockCampaignPerformance,
  channelDistribution: mockChannelDistribution,
  recentActivity: mockRecentActivity,
};

// Helper function to get mock data with delay (simulating API call)
export const getMockDashboardData = async (delay = 500): Promise<DashboardData> => {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve(mockDashboardData);
    }, delay);
  });
};