export interface Notification {
  id: string;
  title: string;
  message: string;
  type: 'info' | 'success' | 'warning' | 'error';
  timestamp: string;
  read: boolean;
  actionUrl?: string;
  actionLabel?: string;
  metadata?: Record<string, any>;
}

export const mockNotifications: Notification[] = [
  {
    id: '1',
    title: 'Campaign Completed Successfully',
    message: 'Your "Welcome Series" campaign has been sent to all 1,234 recipients.',
    type: 'success',
    timestamp: new Date(Date.now() - 10 * 60 * 1000).toISOString(),
    read: false,
    actionUrl: '/campaigns/welcome-series',
    actionLabel: 'View Campaign',
    metadata: { campaignId: 'welcome-series', recipients: 1234 },
  },
  {
    id: '2',
    title: 'Low Delivery Rate Alert',
    message: 'Your email delivery rate has dropped below 95%. Please check your sender reputation.',
    type: 'warning',
    timestamp: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
    read: false,
    actionUrl: '/analytics/delivery-rates',
    actionLabel: 'View Analytics',
    metadata: { deliveryRate: 93.5 },
  },
  {
    id: '3',
    title: 'New Template Available',
    message: 'A new "Product Launch" template has been added to your library.',
    type: 'info',
    timestamp: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
    read: true,
    actionUrl: '/templates/product-launch',
    actionLabel: 'View Template',
    metadata: { templateId: 'product-launch' },
  },
  {
    id: '4',
    title: 'Provider Configuration Failed',
    message: 'Failed to configure SendGrid provider. Please check your API credentials.',
    type: 'error',
    timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
    read: true,
    actionUrl: '/settings/providers',
    actionLabel: 'Fix Configuration',
    metadata: { provider: 'SendGrid', error: 'Invalid API key' },
  },
  {
    id: '5',
    title: 'Monthly Report Ready',
    message: 'Your January performance report is ready to download.',
    type: 'info',
    timestamp: new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString(),
    read: true,
    actionUrl: '/reports/january-2024',
    actionLabel: 'Download Report',
    metadata: { month: 'January', year: 2024 },
  },
  {
    id: '6',
    title: 'API Rate Limit Warning',
    message: 'You have used 80% of your monthly API quota. Consider upgrading your plan.',
    type: 'warning',
    timestamp: new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString(),
    read: true,
    actionUrl: '/settings/billing',
    actionLabel: 'Upgrade Plan',
    metadata: { usage: 80, limit: 100000 },
  },
  {
    id: '7',
    title: 'Scheduled Campaign Starting',
    message: 'Your "Flash Sale" campaign will start in 1 hour.',
    type: 'info',
    timestamp: new Date(Date.now() - 8 * 60 * 60 * 1000).toISOString(),
    read: true,
    actionUrl: '/campaigns/flash-sale',
    actionLabel: 'View Campaign',
    metadata: { campaignId: 'flash-sale', startTime: new Date(Date.now() + 60 * 60 * 1000).toISOString() },
  },
  {
    id: '8',
    title: 'Domain Verification Required',
    message: 'Please verify your domain to improve email deliverability.',
    type: 'warning',
    timestamp: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
    read: true,
    actionUrl: '/settings/domains',
    actionLabel: 'Verify Domain',
    metadata: { domain: 'example.com' },
  },
];

export const getUnreadCount = (): number => {
  return mockNotifications.filter(n => !n.read).length;
};

export const getMockNotifications = async (delay = 300): Promise<Notification[]> => {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve(mockNotifications);
    }, delay);
  });
};