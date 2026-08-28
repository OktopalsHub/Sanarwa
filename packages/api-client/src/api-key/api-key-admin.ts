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
import { ApiKeyMonitoringClient } from "./api-key-monitoring";

export class ApiKeyAdminClient extends ApiKeyMonitoringClient {
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

}
