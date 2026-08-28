import { TenantMemberRole, TenantMemberStatus, TenantStatus } from "./enums";
import {
  Tenant,
  TenantBillingInfo,
  TenantContactInfo,
  TenantMember,
  TenantQuotas,
  TenantSettings,
} from "./models";

export interface CreateTenantRequest {
  name: string;
  description?: string;
  subdomain?: string;
  slug?: string;
  quotas?: Partial<TenantQuotas>;
  settings?: Partial<TenantSettings>;
  billingInfo?: Partial<TenantBillingInfo>;
  contactInfo?: Partial<TenantContactInfo>;
}

export interface UpdateTenantRequest {
  name?: string;
  description?: string;
  subdomain?: string;
  slug?: string;
  status?: TenantStatus;
  quotas?: Partial<TenantQuotas>;
  settings?: Partial<TenantSettings>;
  billingInfo?: Partial<TenantBillingInfo>;
  contactInfo?: Partial<TenantContactInfo>;
}

export interface CreateTenantMemberRequest {
  role?: TenantMemberRole;
  permissions?: string[];
  metadata?: Record<string, any>;
}

export interface UpdateTenantMemberRequest {
  role?: TenantMemberRole;
  status?: TenantMemberStatus;
  permissions?: string[];
  metadata?: Record<string, any>;
}

export interface InviteMemberRequest {
  email: string;
  role: TenantMemberRole;
  permissions?: string[];
  message?: string;
  metadata?: Record<string, any>;
}

export interface AcceptInviteRequest {
  token: string;
}

export interface TenantQueryParams {
  status?: TenantStatus;
  search?: string;
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: "ASC" | "DESC";
}

