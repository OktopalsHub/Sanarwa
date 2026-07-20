/**
 * Project-related types for the Notifi platform
 */

export enum ProjectStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  ARCHIVED = 'archived',
}

export interface Project {
  id: string;
  name: string;
  description?: string;
  status: ProjectStatus;
  settings?: ProjectSettings;
  metadata?: Record<string, any>;
  tenantId: string;
  brandId?: string;
  createdAt: Date;
  updatedAt: Date;

  // Computed properties
  apiKeysCount?: number;
  providerConfigsCount?: number;
  memberCount?: number;
  lastActivity?: Date;
}

export interface ProjectSettings {
  webhookUrl?: string;
  webhookSecret?: string;
  retryPolicy?: {
    maxRetries?: number;
    retryDelay?: number;
  };
  rateLimiting?: {
    enabled?: boolean;
    requestsPerMinute?: number;
  };
}

export interface CreateProjectRequest {
  name: string;
  description?: string;
  status?: ProjectStatus;
  brandId?: string;
  settings?: ProjectSettings;
  metadata?: Record<string, any>;
}

export interface UpdateProjectRequest {
  name?: string;
  description?: string;
  status?: ProjectStatus;
  brandId?: string;
  settings?: ProjectSettings;
  metadata?: Record<string, any>;
}

export interface ProjectQueryParams {
  status?: ProjectStatus;
  search?: string;
  brandId?: string;
  page?: number;
  limit?: number;
  sortBy?: 'name' | 'createdAt' | 'updatedAt' | 'status';
  sortOrder?: 'asc' | 'desc';
}

export interface ProjectStats {
  totalProjects: number;
  activeProjects: number;
  inactiveProjects: number;
  archivedProjects: number;
  totalApiKeys: number;
  totalProviderConfigs: number;
  recentActivity: Array<{
    projectId: string;
    projectName: string;
    action: string;
    timestamp: Date;
  }>;
}

export interface ProjectActivity {
  id: string;
  projectId: string;
  action: string;
  description: string;
  userId: string;
  userName: string;
  timestamp: Date;
  metadata?: Record<string, any>;
}

export interface ProjectMember {
  id: string;
  projectId: string;
  userId: string;
  userName: string;
  userEmail: string;
  role: ProjectRole;
  permissions: ProjectPermission[];
  addedAt: Date;
  addedBy: string;
}

export enum ProjectRole {
  OWNER = 'owner',
  ADMIN = 'admin',
  DEVELOPER = 'developer',
  VIEWER = 'viewer',
}

export enum ProjectPermission {
  READ = 'read',
  WRITE = 'write',
  DELETE = 'delete',
  MANAGE_API_KEYS = 'manage_api_keys',
  MANAGE_PROVIDERS = 'manage_providers',
  MANAGE_SETTINGS = 'manage_settings',
  MANAGE_MEMBERS = 'manage_members',
}

export interface ProjectInvitation {
  id: string;
  projectId: string;
  email: string;
  role: ProjectRole;
  permissions: ProjectPermission[];
  invitedBy: string;
  invitedAt: Date;
  expiresAt: Date;
  status: 'pending' | 'accepted' | 'declined' | 'expired';
}

export interface ProjectUsage {
  projectId: string;
  period: {
    start: Date;
    end: Date;
  };
  notifications: {
    total: number;
    byChannel: Record<string, number>;
    byStatus: Record<string, number>;
  };
  apiCalls: {
    total: number;
    successful: number;
    failed: number;
    rateLimited: number;
  };
  storage: {
    templates: number;
    assets: number;
    logs: number;
    total: number;
  };
}

export interface ProjectBilling {
  projectId: string;
  plan: 'free' | 'starter' | 'pro' | 'enterprise';
  usage: ProjectUsage;
  limits: {
    notifications: number;
    apiCalls: number;
    storage: number;
    members: number;
  };
  costs: {
    base: number;
    overages: number;
    total: number;
  };
  billingPeriod: {
    start: Date;
    end: Date;
  };
}