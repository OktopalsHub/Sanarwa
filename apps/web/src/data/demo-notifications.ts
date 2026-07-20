import { User } from '@/lib/icons';
export interface DemoNotification {
  id: string;
  title: string;
  message: string;
  type: 'email' | 'sms' | 'push' | 'in_app' | 'whatsapp';
  status: 'draft' | 'scheduled' | 'sending' | 'sent' | 'delivered' | 'failed';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  recipientCount: number;
  deliveredCount: number;
  openedCount: number;
  clickedCount: number;
  failedCount: number;
  scheduledAt?: string;
  sentAt?: string;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  tenantId: string;
  campaignId?: string;
  templateId?: string;
  metadata?: Record<string, any>;
}

export interface DemoCampaign {
  id: string;
  name: string;
  description?: string;
  status: 'draft' | 'active' | 'paused' | 'completed' | 'archived';
  type: 'one_time' | 'recurring' | 'triggered';
  channels: ('email' | 'sms' | 'push' | 'in_app' | 'whatsapp')[];
  targetAudience: {
    segmentId?: string;
    criteria?: Record<string, any>;
    estimatedSize: number;
  };
  schedule?: {
    startDate: string;
    endDate?: string;
    frequency?: 'daily' | 'weekly' | 'monthly';
    timezone: string;
  };
  metrics: {
    sent: number;
    delivered: number;
    opened: number;
    clicked: number;
    failed: number;
    unsubscribed: number;
  };
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  tenantId: string;
}

export const demoNotifications: DemoNotification[] = [
  {
    id: 'notif-1',
    title: 'Welcome Email Campaign',
    message: 'Welcome to our platform! Get started with these helpful tips.',
    type: 'email',
    status: 'delivered',
    priority: 'medium',
    recipientCount: 1250,
    deliveredCount: 1235,
    openedCount: 342,
    clickedCount: 89,
    failedCount: 15,
    sentAt: '2024-12-10T09:00:00Z',
    createdAt: '2024-12-09T14:30:00Z',
    updatedAt: '2024-12-10T09:15:00Z',
    createdBy: 'user-1',
    tenantId: 'tenant-1',
    campaignId: 'campaign-1',
    templateId: 'template-1',
  },
  {
    id: 'notif-2',
    title: 'Flash Sale Alert',
    message: '🔥 24-hour flash sale! Up to 50% off selected items.',
    type: 'push',
    status: 'sent',
    priority: 'high',
    recipientCount: 3200,
    deliveredCount: 3180,
    openedCount: 892,
    clickedCount: 234,
    failedCount: 20,
    sentAt: '2024-12-10T12:00:00Z',
    createdAt: '2024-12-10T11:45:00Z',
    updatedAt: '2024-12-10T12:05:00Z',
    createdBy: 'user-2',
    tenantId: 'tenant-1',
    campaignId: 'campaign-2',
  },
  {
    id: 'notif-3',
    title: 'Order Confirmation',
    message: 'Your order #12345 has been confirmed and is being processed.',
    type: 'sms',
    status: 'delivered',
    priority: 'medium',
    recipientCount: 1,
    deliveredCount: 1,
    openedCount: 1,
    clickedCount: 0,
    failedCount: 0,
    sentAt: '2024-12-10T13:22:00Z',
    createdAt: '2024-12-10T13:22:00Z',
    updatedAt: '2024-12-10T13:23:00Z',
    createdBy: 'system',
    tenantId: 'tenant-1',
    templateId: 'template-3',
  },
  {
    id: 'notif-4',
    title: 'Weekly Newsletter',
    message: 'This week in tech: AI breakthroughs, startup funding, and more.',
    type: 'email',
    status: 'scheduled',
    priority: 'low',
    recipientCount: 5600,
    deliveredCount: 0,
    openedCount: 0,
    clickedCount: 0,
    failedCount: 0,
    scheduledAt: '2024-12-11T08:00:00Z',
    createdAt: '2024-12-09T16:00:00Z',
    updatedAt: '2024-12-10T10:30:00Z',
    createdBy: 'user-3',
    tenantId: 'tenant-1',
    campaignId: 'campaign-3',
    templateId: 'template-2',
  },
  {
    id: 'notif-5',
    title: 'Security Alert',
    message: 'New login detected from San Francisco, CA. Was this you?',
    type: 'in_app',
    status: 'delivered',
    priority: 'urgent',
    recipientCount: 1,
    deliveredCount: 1,
    openedCount: 1,
    clickedCount: 1,
    failedCount: 0,
    sentAt: '2024-12-10T14:15:00Z',
    createdAt: '2024-12-10T14:15:00Z',
    updatedAt: '2024-12-10T14:16:00Z',
    createdBy: 'system',
    tenantId: 'tenant-1',
  },
];

export const demoCampaigns: DemoCampaign[] = [
  {
    id: 'campaign-1',
    name: 'New User Onboarding',
    description: 'Welcome series for new users',
    status: 'active',
    type: 'triggered',
    channels: ['email', 'in_app'],
    targetAudience: {
      criteria: { userStatus: 'new' },
      estimatedSize: 1250,
    },
    metrics: {
      sent: 1250,
      delivered: 1235,
      opened: 342,
      clicked: 89,
      failed: 15,
      unsubscribed: 3,
    },
    createdAt: '2024-11-15T10:00:00Z',
    updatedAt: '2024-12-10T09:15:00Z',
    createdBy: 'user-1',
    tenantId: 'tenant-1',
  },
  {
    id: 'campaign-2',
    name: 'Flash Sale Promotion',
    description: '24-hour flash sale across all channels',
    status: 'completed',
    type: 'one_time',
    channels: ['email', 'sms', 'push'],
    targetAudience: {
      segmentId: 'segment-1',
      estimatedSize: 8500,
    },
    schedule: {
      startDate: '2024-12-10T12:00:00Z',
      endDate: '2024-12-11T12:00:00Z',
      timezone: 'America/New_York',
    },
    metrics: {
      sent: 8500,
      delivered: 8420,
      opened: 2105,
      clicked: 567,
      failed: 80,
      unsubscribed: 12,
    },
    createdAt: '2024-12-09T15:30:00Z',
    updatedAt: '2024-12-10T12:05:00Z',
    createdBy: 'user-2',
    tenantId: 'tenant-1',
  },
  {
    id: 'campaign-3',
    name: 'Weekly Tech Newsletter',
    description: 'Weekly newsletter with tech updates',
    status: 'active',
    type: 'recurring',
    channels: ['email'],
    targetAudience: {
      segmentId: 'segment-2',
      estimatedSize: 5600,
    },
    schedule: {
      startDate: '2024-11-01T08:00:00Z',
      frequency: 'weekly',
      timezone: 'America/Los_Angeles',
    },
    metrics: {
      sent: 22400, // 4 weeks * 5600
      delivered: 22176,
      opened: 5988,
      clicked: 1344,
      failed: 224,
      unsubscribed: 89,
    },
    createdAt: '2024-10-25T14:00:00Z',
    updatedAt: '2024-12-10T10:30:00Z',
    createdBy: 'user-3',
    tenantId: 'tenant-1',
  },
];

export const getNotifications = (tenantId?: string): DemoNotification[] => {
  if (tenantId) {
    return demoNotifications.filter(notif => notif.tenantId === tenantId);
  }
  return demoNotifications;
};

export const getCampaigns = (tenantId?: string): DemoCampaign[] => {
  if (tenantId) {
    return demoCampaigns.filter(campaign => campaign.tenantId === tenantId);
  }
  return demoCampaigns;
};

export const getNotificationById = (id: string): DemoNotification | undefined => {
  return demoNotifications.find(notif => notif.id === id);
};

export const getCampaignById = (id: string): DemoCampaign | undefined => {
  return demoCampaigns.find(campaign => campaign.id === id);
};