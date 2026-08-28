import {
  CreateProjectRequest,
  Project,
  ProjectActivity,
  ProjectBilling,
  ProjectInvitation,
  ProjectMember,
  ProjectPermission,
  ProjectQueryParams,
  ProjectRole,
  ProjectStats,
  ProjectStatus,
  ProjectUsage,
  UpdateProjectRequest,
} from "../types/project";
import { ApiClientConsumer } from "../internal/api-client-consumer";
import { ProjectMembersClient } from "./project-members";

export class ProjectSettingsClient extends ProjectMembersClient {
  // Project Settings Management

  /**
   * Update project settings
   * @param projectId Project ID
   * @param settings Project settings
   * @returns Updated project
   */
  async updateProjectSettings(
    projectId: string,
    settings: {
      webhookUrl?: string;
      webhookSecret?: string;
      retryPolicy?: {
        maxRetries?: number;
        retryDelay?: number;
      };
      rateLimiting?: {
        enabled?: boolean;
        requestsPerMinute?: number;
      };
    },
  ): Promise<Project> {
    return this.updateProject(projectId, { settings });
  }

  /**
   * Test project webhook configuration
   * @param projectId Project ID
   * @returns Test result
   */
  async testProjectWebhook(projectId: string): Promise<{
    success: boolean;
    message: string;
    responseTime?: number;
    statusCode?: number;
  }> {
    return this.apiClient.post(`/projects/${projectId}/webhook/test`, {});
  }

  /**
   * Get project webhook logs
   * @param projectId Project ID
   * @param params Query parameters
   * @returns Webhook logs
   */
  async getProjectWebhookLogs(
    projectId: string,
    params?: {
      startDate?: Date;
      endDate?: Date;
      status?: "success" | "failed" | "timeout";
      limit?: number;
      offset?: number;
    },
  ): Promise<{
    data: Array<{
      id: string;
      url: string;
      method: string;
      status: string;
      statusCode?: number;
      responseTime: number;
      payload: any;
      response?: any;
      error?: string;
      timestamp: Date;
    }>;
    total: number;
    hasMore: boolean;
  }> {
    const queryParams: Record<string, string> = {};
    if (params?.startDate) queryParams.startDate = params.startDate.toISOString();
    if (params?.endDate) queryParams.endDate = params.endDate.toISOString();
    if (params?.status) queryParams.status = params.status;
    if (params?.limit) queryParams.limit = params.limit.toString();
    if (params?.offset) queryParams.offset = params.offset.toString();

    return this.apiClient.get(`/projects/${projectId}/webhook/logs`, queryParams);
  }

  // Project Duplication and Templates

  /**
   * Duplicate a project
   * @param projectId Project ID to duplicate
   * @param data Duplication options
   * @returns New project
   */
  async duplicateProject(
    projectId: string,
    data: {
      name: string;
      description?: string;
      includeSettings?: boolean;
      includeMembers?: boolean;
      includeApiKeys?: boolean;
      includeProviders?: boolean;
    },
  ): Promise<Project> {
    return this.apiClient.post<Project>(`/projects/${projectId}/duplicate`, data);
  }

  /**
   * Export project configuration
   * @param projectId Project ID
   * @param options Export options
   * @returns Export data
   */
  async exportProject(
    projectId: string,
    options?: {
      includeSettings?: boolean;
      includeMembers?: boolean;
      includeApiKeys?: boolean;
      includeProviders?: boolean;
      format?: "json" | "yaml";
    },
  ): Promise<{
    format: string;
    data: any;
    exportedAt: Date;
  }> {
    const queryParams: Record<string, string> = {};
    if (options?.includeSettings !== undefined)
      queryParams.includeSettings = options.includeSettings.toString();
    if (options?.includeMembers !== undefined)
      queryParams.includeMembers = options.includeMembers.toString();
    if (options?.includeApiKeys !== undefined)
      queryParams.includeApiKeys = options.includeApiKeys.toString();
    if (options?.includeProviders !== undefined)
      queryParams.includeProviders = options.includeProviders.toString();
    if (options?.format) queryParams.format = options.format;

    return this.apiClient.get(`/projects/${projectId}/export`, queryParams);
  }

  /**
   * Import project configuration
   * @param data Import data
   * @returns Imported project
   */
  async importProject(data: {
    name: string;
    description?: string;
    config: any;
    overwriteExisting?: boolean;
  }): Promise<Project> {
    return this.apiClient.post<Project>("/projects/import", data);
  }

}
