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
} from "../types/api-key";
import { ApiClientConsumer } from "../internal/api-client-consumer";
import { ApiKeyCrudClient } from "./api-key-crud";

export class ApiKeyMonitoringClient extends ApiKeyCrudClient {
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

}
