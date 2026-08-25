export type Environment = "development" | "staging" | "production" | "test";

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

export interface ApiErrorDetail {
  field?: string;
  code: string;
  message: string;
}

export interface ApiResponse<T> {
  data: T;
  success: boolean;
  message?: string;
  errors?: ApiErrorDetail[];
  pagination?: PaginationMeta;
}

export interface TenantSummary {
  id: string;
  name: string;
  slug: string;
  status: string;
}

export interface ProjectSummary {
  id: string;
  name: string;
  slug: string;
  tenantId: string;
}

export interface CampaignStatus {
  id: string;
  name: string;
  status: "draft" | "scheduled" | "running" | "paused" | "completed" | "cancelled";
}

export interface TemplateChannel {
  type: "email" | "sms" | "push" | "in_app" | "voice" | "whatsapp";
  enabled: boolean;
}

export interface ProviderType {
  type: "email" | "sms" | "push" | "voice" | "whatsapp";
  name: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface UserProfile {
  id: string;
  email: string;
  name?: string;
  role?: string;
}
