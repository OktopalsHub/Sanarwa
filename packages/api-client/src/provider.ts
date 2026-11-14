import {
  CreateProviderConfigRequest,
  ProviderConfigRecord,
  ProviderSchema,
  ProviderTemplate,
  UpdateProviderConfigRequest,
} from "./types/provider";
import { ApiClient, apiClient as sharedApiClient } from "./client";
import { paginated } from "./paginated";

class ProviderApiClient {
  private apiClient: ApiClient;

  constructor(apiClient?: ApiClient) {
    this.apiClient = apiClient ?? sharedApiClient;
  }

  private configPath(projectId: string): string {
    return `/tenants/:tenantId/projects/${projectId}/provider-configs`;
  }

  async listProviders(
    projectId: string,
    params?: { page?: number; limit?: number; channel?: string },
  ): Promise<{ data: ProviderConfigRecord[] }> {
    const response = await this.apiClient.get<unknown>(this.configPath(projectId), params);
    return paginated<ProviderConfigRecord>(response, "configs");
  }

  async createProvider(
    projectId: string,
    data: CreateProviderConfigRequest,
  ): Promise<ProviderConfigRecord> {
    return this.apiClient.post<ProviderConfigRecord>(this.configPath(projectId), data);
  }

  async updateProvider(
    projectId: string,
    providerConfigId: string,
    data: UpdateProviderConfigRequest,
  ): Promise<ProviderConfigRecord> {
    return this.apiClient.patch<ProviderConfigRecord>(
      `${this.configPath(projectId)}/${providerConfigId}`,
      data,
    );
  }

  async deleteProvider(projectId: string, providerConfigId: string): Promise<void> {
    return this.apiClient.delete<void>(`${this.configPath(projectId)}/${providerConfigId}`);
  }

  async activateProvider(projectId: string, providerConfigId: string): Promise<void> {
    await this.apiClient.post(`${this.configPath(projectId)}/${providerConfigId}/activate`, {});
  }

  async deactivateProvider(projectId: string, providerConfigId: string): Promise<void> {
    await this.apiClient.post(`${this.configPath(projectId)}/${providerConfigId}/deactivate`, {});
  }

  async getSchemas(projectId: string): Promise<ProviderSchema[]> {
    const response = await this.apiClient.get<{ schemas: ProviderSchema[] }>(
      `${this.configPath(projectId)}/schemas`,
    );
    return response.schemas ?? [];
  }

  async getTemplates(projectId: string): Promise<ProviderTemplate[]> {
    const response = await this.apiClient.get<
      ProviderTemplate[] | { templates: ProviderTemplate[] }
    >(`/tenants/:tenantId/projects/${projectId}/byop/templates`);
    return Array.isArray(response) ? response : (response.templates ?? []);
  }
}

export const providerApi = new ProviderApiClient();
export { ProviderApiClient };
