import type { AxiosInstance, AxiosResponse } from "axios";

import type { Template, TemplateVersion } from "../types";

/**
 * Template routes are tenant-scoped: `/tenants/{tenantId}/templates/...`.
 * Version comparison is project-scoped and lives under `/projects/{projectId}/templates/compare`.
 */
export class TemplateComponent {
  constructor(private readonly client: AxiosInstance) {}

  private base(tenantId: string): string {
    return `/tenants/${tenantId}/templates`;
  }

  async list(
    tenantId: string,
    params?: { page?: number; limit?: number; channel?: string; status?: string },
  ): Promise<unknown> {
    const response: AxiosResponse<unknown> = await this.client.get(this.base(tenantId), { params });
    return response.data;
  }

  async get(tenantId: string, templateId: string): Promise<Template> {
    const response: AxiosResponse<Template> = await this.client.get(
      `${this.base(tenantId)}/${templateId}`,
    );
    return response.data;
  }

  async createVersion(
    tenantId: string,
    templateId: string,
    params: { name?: string; subject?: string; data?: string; description?: string },
  ): Promise<TemplateVersion> {
    const response: AxiosResponse<TemplateVersion> = await this.client.post(
      `${this.base(tenantId)}/${templateId}/versions`,
      params,
    );
    return response.data;
  }

  async getVersions(tenantId: string, templateId: string): Promise<unknown> {
    const response: AxiosResponse<unknown> = await this.client.get(
      `${this.base(tenantId)}/${templateId}/versions`,
    );
    return response.data;
  }

  async getActiveVersion(tenantId: string, templateId: string): Promise<Template> {
    return this.get(tenantId, templateId);
  }

  async activateVersion(tenantId: string, templateId: string): Promise<unknown> {
    const response: AxiosResponse<unknown> = await this.client.post(
      `${this.base(tenantId)}/${templateId}/activate`,
    );
    return response.data;
  }

  async archive(tenantId: string, templateId: string): Promise<unknown> {
    const response: AxiosResponse<unknown> = await this.client.post(
      `${this.base(tenantId)}/${templateId}/archive`,
    );
    return response.data;
  }

  async preview(
    tenantId: string,
    params: { templateId: string; variables: Record<string, unknown> },
  ): Promise<unknown> {
    const response: AxiosResponse<unknown> = await this.client.post(
      `${this.base(tenantId)}/render`,
      params,
    );
    return response.data;
  }

  async validateVariables(
    tenantId: string,
    templateId: string,
    variables: Record<string, unknown>,
  ): Promise<unknown> {
    const response: AxiosResponse<unknown> = await this.client.post(
      `${this.base(tenantId)}/${templateId}/validate-data`,
      { variables },
    );
    return response.data;
  }

  async compareVersions(projectId: string, firstTemplateId: string, secondTemplateId: string) {
    const response: AxiosResponse<unknown> = await this.client.get(
      `/projects/${projectId}/templates/compare`,
      { params: { templateId1: firstTemplateId, templateId2: secondTemplateId } },
    );
    return response.data;
  }
}
