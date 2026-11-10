export enum ApiKeyStatus {
  ACTIVE = "active",
  INACTIVE = "inactive",
  REVOKED = "revoked",
}

export enum ApiKeyType {
  PROJECT = "project",
  SERVICE = "service",
  TENANT = "tenant",
  USER = "user",
}

export interface ApiKey {
  id: string;
  name: string;
  keyPrefix: string;
  type: ApiKeyType;
  status: ApiKeyStatus;
  permissions?: string[];
  ipWhitelist?: string[];
  expiresAt?: Date;
  lastUsedAt?: Date;
  lastUsedIp?: string;
  usageCount: number;
  rateLimit?: number;
  metadata?: Record<string, any>;
  projectId?: string;
  tenantId: string;
  createdById?: string;
  createdAt: Date;
  updatedAt: Date;

  isExpired: boolean;
  isActive: boolean;
  daysUntilExpiry?: number;
  usageToday?: number;
  usageThisMonth?: number;
}

export interface ApiKeyWithSecret extends ApiKey {
  key: string;
}

export interface CreateApiKeyRequest {
  name: string;
  type?: ApiKeyType;
  projectId?: string;
  permissions?: string[];
  ipWhitelist?: string[];
  expiresAt?: Date;
  rateLimit?: number;
  metadata?: Record<string, any>;
}

export interface UpdateApiKeyRequest {
  name?: string;
  status?: ApiKeyStatus;
  permissions?: string[];
  ipWhitelist?: string[];
  expiresAt?: Date;
  rateLimit?: number;
  metadata?: Record<string, any>;
}

export interface ApiKeyQueryParams {
  type?: ApiKeyType;
  status?: ApiKeyStatus;
  projectId?: string;
  search?: string;
  page?: number;
  limit?: number;
  sortBy?: "name" | "createdAt" | "lastUsedAt" | "usageCount" | "expiresAt";
  sortOrder?: "asc" | "desc";
  includeExpired?: boolean;
}

export interface ApiKeyUsage {
  apiKeyId: string;
  period: {
    start: Date;
    end: Date;
  };
  requests: {
    total: number;
    successful: number;
    failed: number;
    rateLimited: number;
  };
  endpoints: Array<{
    path: string;
    method: string;
    count: number;
    averageResponseTime: number;
  }>;
  ipAddresses: Array<{
    ip: string;
    count: number;
    lastUsed: Date;
  }>;
  timeSeriesData: Array<{
    timestamp: Date;
    requests: number;
    errors: number;
  }>;
}

export interface ApiKeyStats {
  totalKeys: number;
  activeKeys: number;
  inactiveKeys: number;
  revokedKeys: number;
  expiredKeys: number;
  expiringKeys: number;
  totalUsage: number;
  averageUsage: number;
  topKeys: Array<{
    id: string;
    name: string;
    usageCount: number;
    lastUsed: Date;
  }>;
}

export interface ApiKeyActivity {
  id: string;
  apiKeyId: string;
  action: ApiKeyAction;
  description: string;
  ipAddress?: string;
  userAgent?: string;
  userId?: string;
  userName?: string;
  timestamp: Date;
  metadata?: Record<string, any>;
}

export enum ApiKeyAction {
  CREATED = "created",
  UPDATED = "updated",
  ACTIVATED = "activated",
  DEACTIVATED = "deactivated",
  REVOKED = "revoked",
  USED = "used",
  RATE_LIMITED = "rate_limited",
  EXPIRED = "expired",
  REGENERATED = "regenerated",
}

export interface ApiKeyPermission {
  id: string;
  name: string;
  description: string;
  category: string;
  isDefault: boolean;
}

export interface ApiKeyTemplate {
  id: string;
  name: string;
  description: string;
  type: ApiKeyType;
  permissions: string[];
  defaultRateLimit?: number;
  defaultExpiry?: number;
  isRecommended: boolean;
}

export interface ApiKeySecuritySettings {
  requireIpWhitelist: boolean;
  maxExpiryDays: number;
  defaultRateLimit: number;
  allowedPermissions: string[];
  requireRotation: boolean;
  rotationIntervalDays: number;
  notifyBeforeExpiry: boolean;
  notifyDaysBeforeExpiry: number;
}

export interface ApiKeyRotation {
  id: string;
  apiKeyId: string;
  oldKeyPrefix: string;
  newKeyPrefix: string;
  rotatedAt: Date;
  rotatedBy: string;
  reason: string;
  status: "pending" | "completed" | "failed";
}

export interface ApiKeyAlert {
  id: string;
  apiKeyId: string;
  type: ApiKeyAlertType;
  severity: "low" | "medium" | "high" | "critical";
  message: string;
  triggeredAt: Date;
  acknowledgedAt?: Date;
  acknowledgedBy?: string;
  resolved: boolean;
  resolvedAt?: Date;
  metadata?: Record<string, any>;
}

export enum ApiKeyAlertType {
  EXPIRING_SOON = "expiring_soon",
  EXPIRED = "expired",
  HIGH_USAGE = "high_usage",
  RATE_LIMITED = "rate_limited",
  SUSPICIOUS_ACTIVITY = "suspicious_activity",
  UNAUTHORIZED_IP = "unauthorized_ip",
  PERMISSION_DENIED = "permission_denied",
}

export interface ApiKeyBulkOperation {
  operation: "activate" | "deactivate" | "revoke" | "delete" | "update_permissions";
  apiKeyIds: string[];
  parameters?: Record<string, any>;
}

export interface ApiKeyBulkOperationResult {
  operation: string;
  totalRequested: number;
  successful: number;
  failed: number;
  results: Array<{
    apiKeyId: string;
    success: boolean;
    error?: string;
  }>;
}
