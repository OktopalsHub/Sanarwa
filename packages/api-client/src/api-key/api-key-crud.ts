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
export class ApiKeyCrudClient extends ApiClientConsumer {
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

}
