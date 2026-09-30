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
import { ApiClient, createApiClient } from "./client";

/**
 * API Key Management API client for handling all API key-related operations
 * Implements API key generation, management, monitoring, and security features
 */
class ApiKeyApiClient {
  private apiClient: ApiClient;

  constructor(apiClient?: ApiClient) {
    // Use provided client or create a new one
    this.apiClient = apiClient || createApiClient();
  }

  // Core API Key CRUD Operations

  /**
   * Create a new API key
   * @param data API key creation data
   * @returns Created API key with secret (only shown once)
   */
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

  /**
   * Get all API keys for the current tenant (aggregates across projects when projectId omitted)
   */
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

  /**
   * Get API keys for a specific project
   * @param projectId Project ID
   * @param params Query parameters for filtering
   * @returns List of API keys for the project
   */
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
    return this.apiClient.get("/tenants/:tenantId/projects/:projectId/api-keys", params, {
      projectId,
    });
  }

  /**
   * Get a specific API key by ID
   */
  async getApiKey(projectId: string, apiKeyId: string): Promise<ApiKey> {
    return this.apiClient.get<ApiKey>(
      `/tenants/:tenantId/projects/:projectId/api-keys/${apiKeyId}`,
      {},
      { projectId },
    );
  }

  /**
   * Update an existing API key
   */
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

  /**
   * Delete an API key
   */
  async deleteApiKey(projectId: string, apiKeyId: string): Promise<void> {
    return this.apiClient.delete<void>(
      `/tenants/:tenantId/projects/:projectId/api-keys/${apiKeyId}`,
      { projectId },
    );
  }

  // API Key Status Management

  /**
   * Activate an API key
   * @param apiKeyId API key ID to activate
   * @returns Updated API key
   */
  async activateApiKey(apiKeyId: string): Promise<ApiKey> {
    return this.apiClient.post<ApiKey>(`/api-keys/${apiKeyId}/activate`, {});
  }

  /**
   * Deactivate an API key
   * @param apiKeyId API key ID to deactivate
   * @returns Updated API key
   */
  async deactivateApiKey(apiKeyId: string): Promise<ApiKey> {
    return this.apiClient.post<ApiKey>(`/api-keys/${apiKeyId}/deactivate`, {});
  }

  /**
   * Revoke an API key (permanent deactivation)
   * @param apiKeyId API key ID to revoke
   * @param reason Reason for revocation
   * @returns Updated API key
   */
  async revokeApiKey(apiKeyId: string, reason?: string): Promise<ApiKey> {
    return this.apiClient.post<ApiKey>(`/api-keys/${apiKeyId}/revoke`, { reason });
  }

  /**
   * Regenerate an API key (creates new key, revokes old one)
   * @param apiKeyId API key ID to regenerate
   * @returns New API key with secret
   */
  async regenerateApiKey(apiKeyId: string): Promise<ApiKeyWithSecret> {
    return this.apiClient.post<ApiKeyWithSecret>(`/api-keys/${apiKeyId}/regenerate`, {});
  }

  // API Key Usage and Analytics

  /**
   * Get usage statistics for a specific API key
   * @param apiKeyId API key ID
   * @param params Query parameters for usage data
   * @returns API key usage statistics
   */
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

  /**
   * Get API key statistics for the current tenant
   * @returns API key statistics
   */
  async getApiKeyStats(): Promise<ApiKeyStats> {
    return this.apiClient.get<ApiKeyStats>("/api-keys/stats");
  }

  /**
   * Get activity log for a specific API key
   * @param apiKeyId API key ID
   * @param params Query parameters for activity log
   * @returns API key activity log
   */
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

  /**
   * Get all API key activity for the tenant
   * @param params Query parameters for activity log
   * @returns Tenant API key activity log
   */
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

  // API Key Security and Monitoring

  /**
   * Get security settings for API keys
   * @returns API key security settings
   */
  async getSecuritySettings(): Promise<ApiKeySecuritySettings> {
    return this.apiClient.get<ApiKeySecuritySettings>("/api-keys/security/settings");
  }

  /**
   * Update security settings for API keys
   * @param settings Security settings to update
   * @returns Updated security settings
   */
  async updateSecuritySettings(
    settings: Partial<ApiKeySecuritySettings>,
  ): Promise<ApiKeySecuritySettings> {
    return this.apiClient.patch<ApiKeySecuritySettings>("/api-keys/security/settings", settings);
  }

  /**
   * Get alerts for API keys
   * @param params Query parameters for alerts
   * @returns API key alerts
   */
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

  /**
   * Acknowledge an API key alert
   * @param alertId Alert ID
   * @returns Updated alert
   */
  async acknowledgeAlert(alertId: string): Promise<ApiKeyAlert> {
    return this.apiClient.post<ApiKeyAlert>(`/api-keys/alerts/${alertId}/acknowledge`, {});
  }

  /**
   * Resolve an API key alert
   * @param alertId Alert ID
   * @returns Updated alert
   */
  async resolveAlert(alertId: string): Promise<ApiKeyAlert> {
    return this.apiClient.post<ApiKeyAlert>(`/api-keys/alerts/${alertId}/resolve`, {});
  }

  // API Key Rotation Management

  /**
   * Get rotation history for an API key
   * @param apiKeyId API key ID
   * @returns Rotation history
   */
  async getRotationHistory(apiKeyId: string): Promise<ApiKeyRotation[]> {
    return this.apiClient.get<ApiKeyRotation[]>(`/api-keys/${apiKeyId}/rotations`);
  }

  /**
   * Schedule API key rotation
   * @param apiKeyId API key ID
   * @param data Rotation schedule data
   * @returns Scheduled rotation
   */
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

  /**
   * Cancel scheduled rotation
   * @param apiKeyId API key ID
   * @param rotationId Rotation ID
   */
  async cancelRotation(apiKeyId: string, rotationId: string): Promise<void> {
    return this.apiClient.delete<void>(`/api-keys/${apiKeyId}/rotations/${rotationId}`);
  }

  // API Key Templates and Permissions

  /**
   * Get available API key templates
   * @returns List of API key templates
   */
  async getApiKeyTemplates(): Promise<ApiKeyTemplate[]> {
    return this.apiClient.get<ApiKeyTemplate[]>("/api-keys/templates");
  }

  /**
   * Create API key from template
   * @param templateId Template ID
   * @param data Additional data for the API key
   * @returns Created API key with secret
   */
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

  /**
   * Get available permissions for API keys
   * @returns List of available permissions
   */
  async getAvailablePermissions(): Promise<ApiKeyPermission[]> {
    return this.apiClient.get<ApiKeyPermission[]>("/api-keys/permissions");
  }

  /**
   * Validate API key permissions
   * @param permissions Permissions to validate
   * @returns Validation result
   */
  async validatePermissions(permissions: string[]): Promise<{
    valid: string[];
    invalid: string[];
    warnings: string[];
  }> {
    return this.apiClient.post("/api-keys/permissions/validate", { permissions });
  }

  // Bulk Operations

  /**
   * Perform bulk operation on multiple API keys
   * @param operation Bulk operation to perform
   * @returns Operation results
   */
  async bulkOperation(operation: ApiKeyBulkOperation): Promise<ApiKeyBulkOperationResult> {
    return this.apiClient.post<ApiKeyBulkOperationResult>("/api-keys/bulk", operation);
  }

  /**
   * Bulk activate API keys
   * @param apiKeyIds Array of API key IDs
   * @returns Operation results
   */
  async bulkActivate(apiKeyIds: string[]): Promise<ApiKeyBulkOperationResult> {
    return this.bulkOperation({
      operation: "activate",
      apiKeyIds,
    });
  }

  /**
   * Bulk deactivate API keys
   * @param apiKeyIds Array of API key IDs
   * @returns Operation results
   */
  async bulkDeactivate(apiKeyIds: string[]): Promise<ApiKeyBulkOperationResult> {
    return this.bulkOperation({
      operation: "deactivate",
      apiKeyIds,
    });
  }

  /**
   * Bulk revoke API keys
   * @param apiKeyIds Array of API key IDs
   * @param reason Reason for revocation
   * @returns Operation results
   */
  async bulkRevoke(apiKeyIds: string[], reason?: string): Promise<ApiKeyBulkOperationResult> {
    return this.bulkOperation({
      operation: "revoke",
      apiKeyIds,
      parameters: { reason },
    });
  }

  /**
   * Bulk delete API keys
   * @param apiKeyIds Array of API key IDs
   * @returns Operation results
   */
  async bulkDelete(apiKeyIds: string[]): Promise<ApiKeyBulkOperationResult> {
    return this.bulkOperation({
      operation: "delete",
      apiKeyIds,
    });
  }

  // Utility Methods

  /**
   * Validate API key data before creating/updating
   * @param data API key data
   * @returns Validation result
   */
  validateApiKeyData(data: CreateApiKeyRequest | UpdateApiKeyRequest): {
    isValid: boolean;
    errors: string[];
  } {
    const errors: string[] = [];

    // Validate name
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

    // Validate rate limit
    if ("rateLimit" in data && data.rateLimit !== undefined) {
      if (data.rateLimit < 1 || data.rateLimit > 10000) {
        errors.push("Rate limit must be between 1 and 10000 requests per minute");
      }
    }

    // Validate expiry date
    if ("expiresAt" in data && data.expiresAt) {
      const now = new Date();
      if (data.expiresAt <= now) {
        errors.push("Expiry date must be in the future");
      }

      const maxExpiry = new Date();
      maxExpiry.setFullYear(maxExpiry.getFullYear() + 5); // Max 5 years
      if (data.expiresAt > maxExpiry) {
        errors.push("Expiry date cannot be more than 5 years in the future");
      }
    }

    // Validate IP whitelist
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

  /**
   * Format API key for display in UI
   * @param apiKey API key to format
   * @returns Formatted API key data
   */
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

  /**
   * Generate secure API key name suggestion
   * @param type API key type
   * @param projectName Optional project name
   * @returns Suggested API key name
   */
  generateApiKeyName(type: ApiKeyType, projectName?: string): string {
    const timestamp = new Date().toISOString().slice(0, 10);
    const typeLabel = type.replace("_", " ").toLowerCase();

    if (projectName) {
      return `${projectName} ${typeLabel} key (${timestamp})`;
    }

    return `${typeLabel} key (${timestamp})`;
  }

  /**
   * Check if API key is expiring soon
   * @param apiKey API key to check
   * @param warningDays Days before expiry to warn (default: 30)
   * @returns True if expiring soon
   */
  isExpiringSoon(apiKey: ApiKey, warningDays: number = 30): boolean {
    if (!apiKey.expiresAt) return false;

    const now = new Date();
    const expiryDate = new Date(apiKey.expiresAt);
    const diffMs = expiryDate.getTime() - now.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    return diffDays <= warningDays && diffDays > 0;
  }

  /**
   * Calculate API key security score
   * @param apiKey API key to evaluate
   * @returns Security score (0-100)
   */
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
