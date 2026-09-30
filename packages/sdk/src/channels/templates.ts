import type { AxiosInstance, AxiosResponse } from "axios";

export class TemplateComponent {
  constructor(private client: AxiosInstance) {}

  /**
   * Create a new template version
   */
  async createVersion(params: {
    templateId: string;
    name: string;
    content: string;
    subject?: string;
    htmlContent?: string;
    variables?: Record<string, any>;
    channels?: string[];
    changeLog?: string;
  }): Promise<any> {
    const response: AxiosResponse<any> = await this.client.post("/templates/versions", params);
    return response.data;
  }

  /**
   * Get template versions
   */
  async getVersions(templateId: string): Promise<any> {
    const response: AxiosResponse<any> = await this.client.get(`/templates/${templateId}/versions`);
    return response.data;
  }

  /**
   * Get active version
   */
  async getActiveVersion(templateId: string): Promise<any> {
    const response: AxiosResponse<any> = await this.client.get(
      `/templates/${templateId}/versions/active`,
    );
    return response.data;
  }

  /**
   * Activate a version
   */
  async activateVersion(versionId: string): Promise<any> {
    const response: AxiosResponse<any> = await this.client.post(
      `/templates/versions/${versionId}/activate`,
    );
    return response.data;
  }

  /**
   * Preview template with variables
   */
  async previewTemplate(versionId: string, variables: Record<string, any>): Promise<any> {
    const response: AxiosResponse<any> = await this.client.post(
      `/templates/versions/${versionId}/preview`,
      { variables },
    );
    return response.data;
  }

  /**
   * Validate template variables
   */
  async validateVariables(versionId: string, variables: Record<string, any>): Promise<any> {
    const response: AxiosResponse<any> = await this.client.post(
      `/templates/versions/${versionId}/validate`,
      { variables },
    );
    return response.data;
  }

  /**
   * Compare two versions
   */
  async compareVersions(versionId1: string, versionId2: string): Promise<any> {
    const response: AxiosResponse<any> = await this.client.get(`/templates/versions/compare`, {
      params: { v1: versionId1, v2: versionId2 },
    });
    return response.data;
  }

  /**
   * Rollback to a previous version
   */
  async rollbackToVersion(versionId: string): Promise<any> {
    const response: AxiosResponse<any> = await this.client.post(
      `/templates/versions/${versionId}/rollback`,
    );
    return response.data;
  }

  /**
   * Get version history
   */
  async getVersionHistory(templateId: string): Promise<any> {
    const response: AxiosResponse<any> = await this.client.get(`/templates/${templateId}/history`);
    return response.data;
  }
}
