export interface DemoDashboardMetrics {
  totalCampaigns: number;
  activeCampaigns: number;
  totalMessages: number;
  deliveryRate: number;
  openRate: number;
  clickRate: number;
  campaignsChange: number;
  messagesChange: number;
  deliveryRateChange: number;
}

export interface DemoChartData {
  name: string;
  value: number;
  [key: string]: string | number;
}

export interface DemoDashboardData {
  metrics: DemoDashboardMetrics;
  campaignPerformance: DemoChartData[];
  channelDistribution: DemoChartData[];
  recentActivity: DemoChartData[];
}

export const demoDashboardData: DemoDashboardData = {
  metrics: {
    totalCampaigns: 47,
    activeCampaigns: 12,
    totalMessages: 28750,
    deliveryRate: 98.7,
    openRate: 26.8,
    clickRate: 4.1,
    campaignsChange: 18.2,
    messagesChange: 12.5,
    deliveryRateChange: 1.2,
  },
  campaignPerformance: [
    { name: 'Jan', value: 2400, messages: 2400, opens: 643, clicks: 99 },
    { name: 'Feb', value: 3200, messages: 3200, opens: 857, clicks: 131 },
    { name: 'Mar', value: 2800, messages: 2800, opens: 750, clicks: 115 },
    { name: 'Apr', value: 4100, messages: 4100, opens: 1099, clicks: 168 },
    { name: 'May', value: 3600, messages: 3600, opens: 965, clicks: 148 },
    { name: 'Jun', value: 4800, messages: 4800, opens: 1286, clicks: 197 },
    { name: 'Jul', value: 4200, messages: 4200, opens: 1125, clicks: 172 },
    { name: 'Aug', value: 3900, messages: 3900, opens: 1045, clicks: 160 },
    { name: 'Sep', value: 5100, messages: 5100, opens: 1367, clicks: 209 },
    { name: 'Oct', value: 4700, messages: 4700, opens: 1260, clicks: 193 },
    { name: 'Nov', value: 5300, messages: 5300, opens: 1420, clicks: 217 },
    { name: 'Dec', value: 4850, messages: 4850, opens: 1300, clicks: 199 },
  ],
  channelDistribution: [
    { name: 'Email', value: 18500, percentage: 64.3 },
    { name: 'SMS', value: 7200, percentage: 25.0 },
    { name: 'Push', value: 4100, percentage: 14.3 },
    { name: 'In-App', value: 1800, percentage: 6.3 },
    { name: 'WhatsApp', value: 950, percentage: 3.3 },
  ],
  recentActivity: [
    { name: '00:00', value: 67, hour: 0 },
    { name: '02:00', value: 34, hour: 2 },
    { name: '04:00', value: 28, hour: 4 },
    { name: '06:00', value: 89, hour: 6 },
    { name: '08:00', value: 156, hour: 8 },
    { name: '10:00', value: 234, hour: 10 },
    { name: '12:00', value: 298, hour: 12 },
    { name: '14:00', value: 267, hour: 14 },
    { name: '16:00', value: 189, hour: 16 },
    { name: '18:00', value: 145, hour: 18 },
    { name: '20:00', value: 123, hour: 20 },
    { name: '22:00', value: 98, hour: 22 },
  ],
};

export const getDashboardData = (tenantId?: string): DemoDashboardData => {
  // In a real app, this would vary by tenant
  // For demo purposes, we'll return the same data with slight variations
  if (tenantId === 'tenant-2') {
    return {
      ...demoDashboardData,
      metrics: {
        ...demoDashboardData.metrics,
        totalCampaigns: 23,
        activeCampaigns: 6,
        totalMessages: 14200,
        deliveryRate: 97.8,
        openRate: 24.1,
        clickRate: 3.7,
      },
    };
  }

  if (tenantId === 'tenant-3') {
    return {
      ...demoDashboardData,
      metrics: {
        ...demoDashboardData.metrics,
        totalCampaigns: 89,
        activeCampaigns: 18,
        totalMessages: 52300,
        deliveryRate: 99.1,
        openRate: 28.9,
        clickRate: 4.8,
      },
    };
  }

  return demoDashboardData;
};