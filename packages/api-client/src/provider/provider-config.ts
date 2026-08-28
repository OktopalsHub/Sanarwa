import {
  CreateProviderRequest,
  Provider,
  ProviderFailoverConfig,
  ProviderHealthCheck,
  ProviderMetrics,
  ProviderQueryParams,
  ProviderTestData,
  ProviderTestResult,
  ProviderType,
  UpdateProviderRequest,
} from "../types/provider";
import { ApiClientConsumer } from "../internal/api-client-consumer";
export class ProviderConfigClient extends ApiClientConsumer {
  // Core Provider Configuration Methods

  /**
   * Create a new provider configuration
   * @param data Provider configuration data
   * @returns Created provider configuration
   */
  async createProvider(data: CreateProviderRequest): Promise<Provider> {
    return this.apiClient.post<Provider>("/provider-configs", data);
  }

  /**
   * Get all provider configurations for the current tenant
   * @param params Query parameters for filtering and pagination
   * @returns List of provider configurations
   */
  async getProviders(params?: ProviderQueryParams): Promise<{
    data: Provider[];
    pagination?: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
      hasNext: boolean;
      hasPrev: boolean;
    };
  }> {
    return this.apiClient.get("/provider-configs", params);
  }

  /**
   * Get provider configurations for a specific project
   * @param projectId Project ID
   * @param params Query parameters for filtering
   * @returns List of provider configurations for the project
   */
  async getProvidersByProject(
    projectId: string,
    params?: ProviderQueryParams,
  ): Promise<{
    data: Provider[];
    pagination?: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
      hasNext: boolean;
      hasPrev: boolean;
    };
  }> {
    return this.apiClient.get(`/provider-configs/project/${projectId}`, params);
  }

  /**
   * Get a specific provider configuration by ID
   * @param providerId Provider ID
   * @returns Provider configuration details
   */
  async getProvider(providerId: string): Promise<Provider> {
    return this.apiClient.get<Provider>(`/provider-configs/${providerId}`);
  }

  /**
   * Update an existing provider configuration
   * @param providerId Provider ID to update
   * @param data Provider update data
   * @returns Updated provider configuration
   */
  async updateProvider(providerId: string, data: UpdateProviderRequest): Promise<Provider> {
    return this.apiClient.patch<Provider>(`/provider-configs/${providerId}`, data);
  }

  /**
   * Delete a provider configuration
   * @param providerId Provider ID to delete
   */
  async deleteProvider(providerId: string): Promise<void> {
    return this.apiClient.delete<void>(`/provider-configs/${providerId}`);
  }

  // Provider Testing Methods

  /**
   * Test a provider configuration
   * @param providerId Provider ID to test
   * @param testData Optional test data (uses default test if not provided)
   * @returns Test result with success status and response details
   */
  async testProvider(providerId: string, testData?: ProviderTestData): Promise<ProviderTestResult> {
    const payload = testData ? { testData } : {};
    return this.apiClient.post<ProviderTestResult>(`/provider-configs/${providerId}/test`, payload);
  }

  /**
   * Test provider configuration with custom data
   * @param providerId Provider ID to test
   * @param testData Test data specific to provider type
   * @returns Test result
   */
  async testProviderWithData(
    providerId: string,
    testData: ProviderTestData,
  ): Promise<ProviderTestResult> {
    return this.apiClient.post<ProviderTestResult>(`/provider-configs/${providerId}/test`, {
      testData,
    });
  }

  // Provider Status Management Methods

  /**
   * Activate a provider configuration
   * @param providerId Provider ID to activate
   * @returns Updated provider configuration
   */
  async activateProvider(providerId: string): Promise<Provider> {
    return this.apiClient.post<Provider>(`/provider-configs/${providerId}/activate`, {});
  }

  /**
   * Deactivate a provider configuration
   * @param providerId Provider ID to deactivate
   * @returns Updated provider configuration
   */
  async deactivateProvider(providerId: string): Promise<Provider> {
    return this.apiClient.post<Provider>(`/provider-configs/${providerId}/deactivate`, {});
  }

  /**
   * Set a provider as the default for its type
   * @param providerId Provider ID to set as default
   * @returns Updated provider configuration
   */
  async setDefaultProvider(providerId: string): Promise<Provider> {
    return this.updateProvider(providerId, { isDefault: true });
  }

}
