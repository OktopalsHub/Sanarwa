// Campaign management types

export type CampaignType = 'one_time' | 'recurring' | 'triggered' | 'drip';
export type CampaignStatus = 'draft' | 'scheduled' | 'active' | 'paused' | 'completed' | 'cancelled';
export type CommunicationChannel = 'email' | 'sms' | 'push' | 'in_app' | 'voice';

export interface Campaign {
  id: string;
  name: string;
  description?: string;
  type: CampaignType;
  status: CampaignStatus;
  channels: CommunicationChannel[];
  audience: AudienceConfig;
  schedule: ScheduleConfig;
  templates: TemplateAssignment[];
  analytics: CampaignAnalytics;
  createdAt: Date;
  updatedAt: Date;
  createdBy: string;
  tenantId: string;
}

export interface AudienceConfig {
  type: 'all' | 'segment' | 'custom';
  segmentIds?: string[];
  customFilters?: AudienceFilter[];
  estimatedSize?: number;
}

export interface AudienceFilter {
  field: string;
  operator: 'equals' | 'not_equals' | 'contains' | 'not_contains' | 'greater_than' | 'less_than' | 'in' | 'not_in';
  value: any;
}

export interface ScheduleConfig {
  type: 'immediate' | 'scheduled' | 'recurring';
  scheduledAt?: Date;
  timezone?: string;
  recurring?: RecurringConfig;
}

export interface RecurringConfig {
  frequency: 'daily' | 'weekly' | 'monthly' | 'yearly';
  interval: number; // Every N days/weeks/months/years
  daysOfWeek?: number[]; // For weekly (0 = Sunday, 6 = Saturday)
  dayOfMonth?: number; // For monthly
  endDate?: Date;
  maxOccurrences?: number;
}

export interface TemplateAssignment {
  channel: CommunicationChannel;
  templateId: string;
  templateName: string;
  variables?: Record<string, any>;
}

export interface CampaignAnalytics {
  totalSent: number;
  totalDelivered: number;
  totalOpened: number;
  totalClicked: number;
  totalConverted: number;
  deliveryRate: number;
  openRate: number;
  clickRate: number;
  conversionRate: number;
  channelBreakdown: ChannelAnalytics[];
  lastUpdated: Date;
}

export interface ChannelAnalytics {
  channel: CommunicationChannel;
  sent: number;
  delivered: number;
  opened: number;
  clicked: number;
  converted: number;
  deliveryRate: number;
  openRate: number;
  clickRate: number;
  conversionRate: number;
}

// Campaign creation/update DTOs
export interface CreateCampaignRequest {
  name: string;
  description?: string;
  type: CampaignType;
  channels: CommunicationChannel[];
  audience: AudienceConfig;
  schedule: ScheduleConfig;
  templates: TemplateAssignment[];
}

export interface UpdateCampaignRequest extends Partial<CreateCampaignRequest> {
  id: string;
}

// Campaign wizard step data
export interface CampaignWizardData {
  step: number;
  totalSteps: number;
  data: {
    basic?: {
      name: string;
      description?: string;
      type: CampaignType;
    };
    channels?: {
      selectedChannels: CommunicationChannel[];
      channelConfigs: Record<CommunicationChannel, any>;
    };
    audience?: AudienceConfig;
    templates?: TemplateAssignment[];
    schedule?: ScheduleConfig;
  };
}

// Audience segment types
export interface AudienceSegment {
  id: string;
  name: string;
  description?: string;
  filters: AudienceFilter[];
  size: number;
  createdAt: Date;
  updatedAt: Date;
}

// Template assignment for campaigns (simplified version)
export interface CampaignTemplate {
  id: string;
  name: string;
  channel: CommunicationChannel;
}