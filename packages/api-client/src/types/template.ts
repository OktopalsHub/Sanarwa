export type TemplateCategory =
  | "welcome"
  | "promotional"
  | "transactional"
  | "notification"
  | "reminder"
  | "custom";
export type TemplateStatus = "draft" | "active" | "archived";
export type ApprovalStatus = "pending" | "approved" | "rejected" | "needs_review";

export interface Template {
  id: string;
  name: string;
  description?: string;
  category: TemplateCategory;
  channel: CommunicationChannel;
  content: TemplateContent;
  variables: TemplateVariable[];
  branding: string;
  version: number;
  status: TemplateStatus;
  approvalStatus: ApprovalStatus;
  isActive: boolean;
  tags: string[];
  createdAt: Date;
  updatedAt: Date;
  createdBy: string;
  tenantId: string;
  parentTemplateId?: string;
  usageCount: number;
  lastUsed?: Date;
}

export interface TemplateContent {
  subject?: string;
  preheader?: string;
  body: string;
  plainText?: string;
  metadata?: Record<string, any>;
  pushTitle?: string;
  pushBody?: string;
  smsBody?: string;
  voiceScript?: string;
}

export interface TemplateVariable {
  name: string;
  type: "text" | "number" | "date" | "boolean" | "url" | "email" | "image";
  required: boolean;
  defaultValue?: any;
  description?: string;
  validation?: VariableValidation;
}

export interface VariableValidation {
  minLength?: number;
  maxLength?: number;
  pattern?: string;
  options?: string[];
}

export interface TemplateVersion {
  id: string;
  templateId: string;
  version: number;
  content: TemplateContent;
  variables: TemplateVariable[];
  createdAt: Date;
  createdBy: string;
  changeLog?: string;
  isActive: boolean;
}

export interface TemplateLibraryFilter {
  category?: TemplateCategory;
  channel?: CommunicationChannel;
  status?: TemplateStatus;
  tags?: string[];
  search?: string;
  createdBy?: string;
  dateRange?: {
    from: Date;
    to: Date;
  };
}

export interface TemplatePreview {
  templateId: string;
  variables: Record<string, any>;
  channel: CommunicationChannel;
  renderedContent: TemplateContent;
  previewUrl?: string;
}

export interface CreateTemplateRequest {
  name: string;
  description?: string;
  category: TemplateCategory;
  channel: CommunicationChannel;
  content: TemplateContent;
  variables: TemplateVariable[];
  tags?: string[];
  brandingId?: string;
}

export interface UpdateTemplateRequest extends Partial<CreateTemplateRequest> {
  id?: string;
  changeLog?: string;
  status?: TemplateStatus;
}

export interface DuplicateTemplateRequest {
  templateId: string;
  name: string;
  description?: string;
}

export interface TemplateApproval {
  id: string;
  templateId: string;
  version: number;
  status: ApprovalStatus;
  reviewerId?: string;
  reviewerName?: string;
  reviewedAt?: Date;
  comments?: string;
  requestedBy: string;
  requestedAt: Date;
}

export interface ApprovalRequest {
  templateId: string;
  comments?: string;
}

export interface ApprovalResponse {
  approvalId: string;
  status: ApprovalStatus;
  comments?: string;
}

export interface TemplateAnalytics {
  templateId: string;
  totalUsage: number;
  successRate: number;
  openRate?: number;
  clickRate?: number;
  conversionRate?: number;
  lastUsed?: Date;
  usageByChannel: Record<CommunicationChannel, number>;
  usageOverTime: Array<{
    date: Date;
    count: number;
  }>;
}

import type { NotificationChannel } from "./notification";
/** Template editor subset: email, sms, push, in_app, voice. Keeps raw-string assignability. */
export type CommunicationChannel = `${Exclude<
  NotificationChannel,
  NotificationChannel.WHATSAPP | NotificationChannel.WEBHOOK | NotificationChannel.CHAT
>}`;
