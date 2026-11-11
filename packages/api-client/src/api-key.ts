import {
  ApiKey,
  ApiKeyAction,
  ApiKeyActivity,
  ApiKeyAlert,
  ApiKeyAlertType,
  ApiKeyBulkOperation,
  ApiKeyBulkOperationResult,
  ApiKeyPermission,
  ApiKeyQueryParams,
  ApiKeyRotation,
  ApiKeySecuritySettings,
  ApiKeyStats,
  ApiKeyStatus,
  ApiKeyTemplate,
  ApiKeyType,
  ApiKeyUsage,
  ApiKeyWithSecret,
  CreateApiKeyRequest,
  UpdateApiKeyRequest,
} from "./types/api-key";
import { ApiClient, apiClient as sharedApiClient } from "./client";
import { paginated } from "./paginated";

class ApiKeyApiClient {
  private apiClient: ApiClient;

  constructor(apiClient?: ApiClient) {
    this.apiClient = apiClient ?? sharedApiClient;
  }

  async createApiKey(data: CreateApiKeyRequest): Promise<ApiKeyWithSecret> {
    if (!data.projectId) {
      throw new Error("projectId is required to create an API key");
    }
    const { projectId, ...body } = data;
    return this.apiClient.post<ApiKeyWithSecret>(
      "/tenants/:tenantId/projects/:projectId/api-keys",
      body,
      { projectId },
    );
  }

  async getApiKeys(params?: ApiKeyQueryParams & { projectId?: string }): Promise<{
    data: ApiKey[];
    pagination?: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
      hasNext: boolean;
      hasPrev: boolean;
    };
  }> {
    if (!params?.projectId) {
      return { data: [] };
    }
    return this.getApiKeysByProject(params.projectId, params);
  }

  async getApiKeysByProject(
    projectId: string,
    params?: ApiKeyQueryParams,
  ): Promise<{
    data: ApiKey[];
    pagination?: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
      hasNext: boolean;
      hasPrev: boolean;
    };
  }> {
    const response = await this.apiClient.get<unknown>(
      "/tenants/:tenantId/projects/:projectId/api-keys",
      params,
      {
        projectId,
      },
    );
    return paginated<ApiKey>(response);
  }

  async getApiKey(projectId: string, apiKeyId: string): Promise<ApiKey> {
    return this.apiClient.get<ApiKey>(
      `/tenants/:tenantId/projects/:projectId/api-keys/${apiKeyId}`,
      {},
      { projectId },
    );
  }

  async updateApiKey(
    projectId: string,
    apiKeyId: string,
    data: UpdateApiKeyRequest,
  ): Promise<ApiKey> {
    return this.apiClient.patch<ApiKey>(
      `/tenants/:tenantId/projects/:projectId/api-keys/${apiKeyId}`,
      data,
      { projectId },
    );
  }

  async deleteApiKey(projectId: string, apiKeyId: string): Promise<void> {
    return this.apiClient.delete<void>(
      `/tenants/:tenantId/projects/:projectId/api-keys/${apiKeyId}`,
      { projectId },
    );
  }

  async activateApiKey(apiKeyId: string): Promise<ApiKey> {
    return this.apiClient.post<ApiKey>(`/api-keys/${apiKeyId}/activate`, {});
  }

  async deactivateApiKey(apiKeyId: string): Promise<ApiKey> {
    return this.apiClient.post<ApiKey>(`/api-keys/${apiKeyId}/deactivate`, {});
  }

  async revokeApiKey(apiKeyId: string, reason?: string): Promise<ApiKey> {
    return this.apiClient.post<ApiKey>(`/api-keys/${apiKeyId}/revoke`, { reason });
  }

  async regenerateApiKey(apiKeyId: string): Promise<ApiKeyWithSecret> {
    return this.apiClient.post<ApiKeyWithSecret>(`/api-keys/${apiKeyId}/regenerate`, {});
  }

  async getApiKeyUsage(
    apiKeyId: string,
    params?: {
      startDate?: Date;
      endDate?: Date;
      granularity?: "hour" | "day" | "week" | "month";
    },
  ): Promise<ApiKeyUsage> {
    const queryParams: Record<string, string> = {};
    if (params?.startDate) queryParams.startDate = params.startDate.toISOString();
    if (params?.endDate) queryParams.endDate = params.endDate.toISOString();
    if (params?.granularity) queryParams.granularity = params.granularity;

    return this.apiClient.get<ApiKeyUsage>(`/api-keys/${apiKeyId}/usage`, queryParams);
  }

  async getApiKeyStats(): Promise<ApiKeyStats> {
    return this.apiClient.get<ApiKeyStats>("/api-keys/stats");
  }

  async getApiKeyActivity(
    apiKeyId: string,
    params?: {
      action?: ApiKeyAction;
      startDate?: Date;
      endDate?: Date;
      limit?: number;
      offset?: number;
    },
  ): Promise<{
    data: ApiKeyActivity[];
    total: number;
    hasMore: boolean;
  }> {
    const queryParams: Record<string, string> = {};
    if (params?.action) queryParams.action = params.action;
    if (params?.startDate) queryParams.startDate = params.startDate.toISOString();
    if (params?.endDate) queryParams.endDate = params.endDate.toISOString();
    if (params?.limit) queryParams.limit = params.limit.toString();
    if (params?.offset) queryParams.offset = params.offset.toString();

    return this.apiClient.get(`/api-keys/${apiKeyId}/activity`, queryParams);
  }

  async getAllApiKeyActivity(params?: {
    apiKeyId?: string;
    action?: ApiKeyAction;
    startDate?: Date;
    endDate?: Date;
    limit?: number;
    offset?: number;
  }): Promise<{
    data: ApiKeyActivity[];
    total: number;
    hasMore: boolean;
  }> {
    const queryParams: Record<string, string> = {};
    if (params?.apiKeyId) queryParams.apiKeyId = params.apiKeyId;
    if (params?.action) queryParams.action = params.action;
    if (params?.startDate) queryParams.startDate = params.startDate.toISOString();
    if (params?.endDate) queryParams.endDate = params.endDate.toISOString();
    if (params?.limit) queryParams.limit = params.limit.toString();
    if (params?.offset) queryParams.offset = params.offset.toString();

    return this.apiClient.get("/api-keys/activity", queryParams);
  }

  async getSecuritySettings(): Promise<ApiKeySecuritySettings> {
    return this.apiClient.get<ApiKeySecuritySettings>("/api-keys/security/settings");
  }

  async updateSecuritySettings(
    settings: Partial<ApiKeySecuritySettings>,
  ): Promise<ApiKeySecuritySettings> {
    return this.apiClient.patch<ApiKeySecuritySettings>("/api-keys/security/settings", settings);
  }

  async getApiKeyAlerts(params?: {
    apiKeyId?: string;
    type?: ApiKeyAlertType;
    severity?: "low" | "medium" | "high" | "critical";
    resolved?: boolean;
    limit?: number;
    offset?: number;
  }): Promise<{
    data: ApiKeyAlert[];
    total: number;
    hasMore: boolean;
  }> {
    const queryParams: Record<string, string> = {};
    if (params?.apiKeyId) queryParams.apiKeyId = params.apiKeyId;
    if (params?.type) queryParams.type = params.type;
    if (params?.severity) queryParams.severity = params.severity;
    if (params?.resolved !== undefined) queryParams.resolved = params.resolved.toString();
    if (params?.limit) queryParams.limit = params.limit.toString();
    if (params?.offset) queryParams.offset = params.offset.toString();

    return this.apiClient.get("/api-keys/alerts", queryParams);
  }

  async acknowledgeAlert(alertId: string): Promise<ApiKeyAlert> {
    return this.apiClient.post<ApiKeyAlert>(`/api-keys/alerts/${alertId}/acknowledge`, {});
  }

  async resolveAlert(alertId: string): Promise<ApiKeyAlert> {
    return this.apiClient.post<ApiKeyAlert>(`/api-keys/alerts/${alertId}/resolve`, {});
  }

  async getRotationHistory(apiKeyId: string): Promise<ApiKeyRotation[]> {
    return this.apiClient.get<ApiKeyRotation[]>(`/api-keys/${apiKeyId}/rotations`);
  }

  async scheduleRotation(
    apiKeyId: string,
    data: {
      rotateAt: Date;
      reason: string;
      notifyUsers?: boolean;
    },
  ): Promise<ApiKeyRotation> {
    return this.apiClient.post<ApiKeyRotation>(`/api-keys/${apiKeyId}/rotations/schedule`, data);
  }

  async cancelRotation(apiKeyId: string, rotationId: string): Promise<void> {
    return this.apiClient.delete<void>(`/api-keys/${apiKeyId}/rotations/${rotationId}`);
  }

  async getApiKeyTemplates(): Promise<ApiKeyTemplate[]> {
    return this.apiClient.get<ApiKeyTemplate[]>("/api-keys/templates");
  }

  async createFromTemplate(
    templateId: string,
    data: {
      name: string;
      projectId?: string;
      customPermissions?: string[];
      customRateLimit?: number;
      customExpiry?: Date;
    },
  ): Promise<ApiKeyWithSecret> {
    return this.apiClient.post<ApiKeyWithSecret>(`/api-keys/templates/${templateId}/create`, data);
  }

  async getAvailablePermissions(): Promise<ApiKeyPermission[]> {
    return this.apiClient.get<ApiKeyPermission[]>("/api-keys/permissions");
  }

  async validatePermissions(permissions: string[]): Promise<{
    valid: string[];
    invalid: string[];
    warnings: string[];
  }> {
    return this.apiClient.post("/api-keys/permissions/validate", { permissions });
  }

  async bulkOperation(operation: ApiKeyBulkOperation): Promise<ApiKeyBulkOperationResult> {
    return this.apiClient.post<ApiKeyBulkOperationResult>("/api-keys/bulk", operation);
  }

  async bulkActivate(apiKeyIds: string[]): Promise<ApiKeyBulkOperationResult> {
    return this.bulkOperation({
      operation: "activate",
      apiKeyIds,
    });
  }

  async bulkDeactivate(apiKeyIds: string[]): Promise<ApiKeyBulkOperationResult> {
    return this.bulkOperation({
      operation: "deactivate",
      apiKeyIds,
    });
  }

  async bulkRevoke(apiKeyIds: string[], reason?: string): Promise<ApiKeyBulkOperationResult> {
    return this.bulkOperation({
      operation: "revoke",
      apiKeyIds,
      parameters: { reason },
    });
  }

  async bulkDelete(apiKeyIds: string[]): Promise<ApiKeyBulkOperationResult> {
    return this.bulkOperation({
      operation: "delete",
      apiKeyIds,
    });
  }

  validateApiKeyData(data: CreateApiKeyRequest | UpdateApiKeyRequest): {
    isValid: boolean;
    errors: string[];
  } {
    const errors: string[] = [];

    if ("name" in data && data.name) {
      if (data.name.length < 2) {
        errors.push("API key name must be at least 2 characters long");
      }
      if (data.name.length > 100) {
        errors.push("API key name must be less than 100 characters");
      }
      if (!/^[a-zA-Z0-9\s\-_]+$/.test(data.name)) {
        errors.push(
          "API key name can only contain letters, numbers, spaces, hyphens, and underscores",
        );
      }
    }

    if ("rateLimit" in data && data.rateLimit !== undefined) {
      if (data.rateLimit < 1 || data.rateLimit > 10000) {
        errors.push("Rate limit must be between 1 and 10000 requests per minute");
      }
    }

    if ("expiresAt" in data && data.expiresAt) {
      const now = new Date();
      if (data.expiresAt <= now) {
        errors.push("Expiry date must be in the future");
      }

      const maxExpiry = new Date();
      maxExpiry.setFullYear(maxExpiry.getFullYear() + 5);
      if (data.expiresAt > maxExpiry) {
        errors.push("Expiry date cannot be more than 5 years in the future");
      }
    }

    if ("ipWhitelist" in data && data.ipWhitelist) {
      const ipRegex =
        /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)(?:\/(?:[0-9]|[1-2][0-9]|3[0-2]))?$/;

      for (const ip of data.ipWhitelist) {
        if (!ipRegex.test(ip)) {
          errors.push(`Invalid IP address or CIDR notation: ${ip}`);
        }
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  formatApiKeyForDisplay(apiKey: ApiKey): {
    name: string;
    keyPrefix: string;
    type: string;
    status: string;
    statusColor: string;
    expiryStatus: string;
    expiryColor: string;
    lastUsed: string;
    usageCount: string;
    rateLimit: string;
  } {
    const formatDate = (date?: Date) => {
      if (!date) return "Never";
      const now = new Date();
      const diffMs = now.getTime() - new Date(date).getTime();
      const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

      if (diffDays === 0) return "Today";
      if (diffDays === 1) return "Yesterday";
      if (diffDays < 7) return `${diffDays} days ago`;
      return new Date(date).toLocaleDateString();
    };

    const getStatusColor = (status: ApiKeyStatus) => {
      switch (status) {
        case ApiKeyStatus.ACTIVE:
          return "green";
        case ApiKeyStatus.INACTIVE:
          return "yellow";
        case ApiKeyStatus.REVOKED:
          return "red";
        default:
          return "gray";
      }
    };

    const getExpiryStatus = () => {
      if (!apiKey.expiresAt) return "No expiry";

      const now = new Date();
      const expiryDate = new Date(apiKey.expiresAt);
      const diffMs = expiryDate.getTime() - now.getTime();
      const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

      if (diffMs <= 0) return "Expired";
      if (diffDays <= 7) return `Expires in ${diffDays} days`;
      if (diffDays <= 30) return `Expires in ${Math.ceil(diffDays / 7)} weeks`;
      return `Expires ${expiryDate.toLocaleDateString()}`;
    };

    const getExpiryColor = () => {
      if (!apiKey.expiresAt) return "gray";

      const now = new Date();
      const expiryDate = new Date(apiKey.expiresAt);
      const diffMs = expiryDate.getTime() - now.getTime();
      const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

      if (diffMs <= 0) return "red";
      if (diffDays <= 7) return "red";
      if (diffDays <= 30) return "yellow";
      return "green";
    };

    return {
      name: apiKey.name,
      keyPrefix: `${apiKey.keyPrefix}...`,
      type: apiKey.type.replace("_", " ").toUpperCase(),
      status: apiKey.status.charAt(0).toUpperCase() + apiKey.status.slice(1),
      statusColor: getStatusColor(apiKey.status),
      expiryStatus: getExpiryStatus(),
      expiryColor: getExpiryColor(),
      lastUsed: formatDate(apiKey.lastUsedAt),
      usageCount: apiKey.usageCount.toLocaleString(),
      rateLimit: apiKey.rateLimit ? `${apiKey.rateLimit}/min` : "No limit",
    };
  }

  generateApiKeyName(type: ApiKeyType, projectName?: string): string {
    const timestamp = new Date().toISOString().slice(0, 10);
    const typeLabel = type.replace("_", " ").toLowerCase();

    if (projectName) {
      return `${projectName} ${typeLabel} key (${timestamp})`;
    }

    return `${typeLabel} key (${timestamp})`;
  }

  isExpiringSoon(apiKey: ApiKey, warningDays: number = 30): boolean {
    if (!apiKey.expiresAt) return false;

    const now = new Date();
    const expiryDate = new Date(apiKey.expiresAt);
    const diffMs = expiryDate.getTime() - now.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    return diffDays <= warningDays && diffDays > 0;
  }

  calculateSecurityScore(apiKey: ApiKey): {
    score: number;
    factors: Array<{
      factor: string;
      score: number;
      weight: number;
      recommendation?: string;
    }>;
  } {
    const factors = [
      {
        factor: "Has expiry date",
        score: apiKey.expiresAt ? 100 : 0,
        weight: 20,
        recommendation: !apiKey.expiresAt ? "Set an expiry date for better security" : undefined,
      },
      {
        factor: "IP whitelist configured",
        score: apiKey.ipWhitelist && apiKey.ipWhitelist.length > 0 ? 100 : 0,
        weight: 25,
        recommendation: !apiKey.ipWhitelist?.length
          ? "Configure IP whitelist to restrict access"
          : undefined,
      },
      {
        factor: "Rate limit configured",
        score: apiKey.rateLimit ? 100 : 0,
        weight: 15,
        recommendation: !apiKey.rateLimit ? "Set a rate limit to prevent abuse" : undefined,
      },
      {
        factor: "Limited permissions",
        score: apiKey.permissions && apiKey.permissions.length < 10 ? 100 : 50,
        weight: 20,
        recommendation: !apiKey.permissions?.length
          ? "Limit permissions to minimum required"
          : undefined,
      },
      {
        factor: "Recent usage",
        score:
          apiKey.lastUsedAt &&
          new Date(apiKey.lastUsedAt) > new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
            ? 100
            : 0,
        weight: 10,
        recommendation: !apiKey.lastUsedAt ? "Consider revoking unused API keys" : undefined,
      },
      {
        factor: "Not expired",
        score: !apiKey.isExpired ? 100 : 0,
        weight: 10,
        recommendation: apiKey.isExpired ? "Regenerate or remove expired API key" : undefined,
      },
    ];

    const totalScore = factors.reduce(
      (sum, factor) => sum + (factor.score * factor.weight) / 100,
      0,
    );
    const maxScore = factors.reduce((sum, factor) => sum + factor.weight, 0);

    return {
      score: Math.round((totalScore / maxScore) * 100),
      factors,
    };
  }
}

export const apiKeyApi = new ApiKeyApiClient();
