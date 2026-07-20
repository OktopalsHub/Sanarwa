export interface Campaign {
  id: string;
  name: string;
  description: string;
  status: 'draft' | 'scheduled' | 'active' | 'paused' | 'completed' | 'failed';
  channels: ('email' | 'sms' | 'push' | 'in-app')[];
  recipients: number;
  sent: number;
  delivered: number;
  opened: number;
  clicked: number;
  bounced: number;
  createdAt: string;
  scheduledAt?: string;
  startedAt?: string;
  completedAt?: string;
  createdBy: string;
  tags: string[];
}

export const mockCampaigns: Campaign[] = [
  {
    id: '1',
    name: 'Welcome Series',
    description: 'Automated welcome email series for new users',
    status: 'active',
    channels: ['email', 'push'],
    recipients: 1234,
    sent: 1234,
    delivered: 1210,
    opened: 520,
    clicked: 230,
    bounced: 24,
    createdAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
    startedAt: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000).toISOString(),
    createdBy: 'John Doe',
    tags: ['onboarding', 'automated'],
  },
  {
    id: '2',
    name: 'Weekly Newsletter',
    description: 'Weekly product updates and tips',
    status: 'completed',
    channels: ['email'],
    recipients: 5678,
    sent: 5678,
    delivered: 5590,
    opened: 2450,
    clicked: 890,
    bounced: 88,
    createdAt: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString(),
    startedAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
    completedAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
    createdBy: 'Marketing Team',
    tags: ['newsletter', 'recurring'],
  },
  {
    id: '3',
    name: 'Flash Sale Alert',
    description: '24-hour flash sale notification',
    status: 'scheduled',
    channels: ['email', 'sms', 'push'],
    recipients: 3456,
    sent: 0,
    delivered: 0,
    opened: 0,
    clicked: 0,
    bounced: 0,
    createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
    scheduledAt: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
    createdBy: 'Sales Team',
    tags: ['promotional', 'urgent'],
  },
  {
    id: '4',
    name: 'Product Launch',
    description: 'New feature announcement campaign',
    status: 'draft',
    channels: ['email', 'in-app'],
    recipients: 0,
    sent: 0,
    delivered: 0,
    opened: 0,
    clicked: 0,
    bounced: 0,
    createdAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
    createdBy: 'Product Team',
    tags: ['product', 'announcement'],
  },
  {
    id: '5',
    name: 'Cart Abandonment',
    description: 'Automated cart recovery emails',
    status: 'active',
    channels: ['email', 'sms'],
    recipients: 892,
    sent: 892,
    delivered: 875,
    opened: 380,
    clicked: 145,
    bounced: 17,
    createdAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
    startedAt: new Date(Date.now() - 28 * 24 * 60 * 60 * 1000).toISOString(),
    createdBy: 'E-commerce Team',
    tags: ['automated', 'recovery'],
  },
  {
    id: '6',
    name: 'Customer Feedback',
    description: 'Post-purchase feedback request',
    status: 'active',
    channels: ['email', 'in-app'],
    recipients: 2345,
    sent: 2345,
    delivered: 2310,
    opened: 1020,
    clicked: 450,
    bounced: 35,
    createdAt: new Date(Date.now() - 21 * 24 * 60 * 60 * 1000).toISOString(),
    startedAt: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000).toISOString(),
    createdBy: 'Customer Success',
    tags: ['feedback', 'automated'],
  },
  {
    id: '7',
    name: 'Holiday Promotion',
    description: 'Special holiday offers and discounts',
    status: 'paused',
    channels: ['email', 'sms', 'push'],
    recipients: 4567,
    sent: 2000,
    delivered: 1960,
    opened: 850,
    clicked: 320,
    bounced: 40,
    createdAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(),
    startedAt: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString(),
    createdBy: 'Marketing Team',
    tags: ['promotional', 'seasonal'],
  },
  {
    id: '8',
    name: 'Security Alert',
    description: 'Account security notification',
    status: 'failed',
    channels: ['email', 'sms'],
    recipients: 150,
    sent: 75,
    delivered: 60,
    opened: 55,
    clicked: 50,
    bounced: 15,
    createdAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
    startedAt: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString(),
    createdBy: 'Security Team',
    tags: ['security', 'urgent'],
  },
];

export const getCampaignsByStatus = (status: Campaign['status']): Campaign[] => {
  return mockCampaigns.filter(c => c.status === status);
};

export const getActiveCampaignsCount = (): number => {
  return mockCampaigns.filter(c => c.status === 'active').length;
};

export const getMockCampaigns = async (delay = 400): Promise<Campaign[]> => {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve(mockCampaigns);
    }, delay);
  });
};