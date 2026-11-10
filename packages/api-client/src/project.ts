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
} from "./types/project";
import { ApiClient, apiClient as sharedApiClient } from "./client";

class ProjectApiClient {
  private apiClient: ApiClient;

  constructor(apiClient?: ApiClient) {
    this.apiClient = apiClient ?? sharedApiClient;
  }

  async createProject(data: CreateProjectRequest): Promise<Project> {
    return this.apiClient.post<Project>("/tenants/:tenantId/projects", data);
  }

  async getProjects(params?: ProjectQueryParams): Promise<{
    data: Project[];
    pagination?: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
      hasNext: boolean;
      hasPrev: boolean;
    };
  }> {
    return this.apiClient.get("/tenants/:tenantId/projects", params);
  }

  async getProject(projectId: string): Promise<Project> {
    return this.apiClient.get<Project>(`/tenants/:tenantId/projects/${projectId}`);
  }

  async updateProject(projectId: string, data: UpdateProjectRequest): Promise<Project> {
    return this.apiClient.patch<Project>(`/tenants/:tenantId/projects/${projectId}`, data);
  }

  async deleteProject(projectId: string): Promise<void> {
    return this.apiClient.delete<void>(`/tenants/:tenantId/projects/${projectId}`);
  }

  async archiveProject(projectId: string): Promise<Project> {
    return this.updateProject(projectId, { status: ProjectStatus.ARCHIVED });
  }

  async restoreProject(projectId: string): Promise<Project> {
    return this.updateProject(projectId, { status: ProjectStatus.ACTIVE });
  }

  async activateProject(projectId: string): Promise<Project> {
    return this.apiClient.post<Project>(`/projects/${projectId}/activate`, {});
  }

  async deactivateProject(projectId: string): Promise<Project> {
    return this.apiClient.post<Project>(`/projects/${projectId}/deactivate`, {});
  }

  async getProjectStats(): Promise<ProjectStats> {
    return this.apiClient.get<ProjectStats>("/projects/stats");
  }

  async getProjectUsage(
    projectId: string,
    params?: {
      startDate?: Date;
      endDate?: Date;
      granularity?: "hour" | "day" | "week" | "month";
    },
  ): Promise<ProjectUsage> {
    const queryParams: Record<string, string> = {};
    if (params?.startDate) queryParams.startDate = params.startDate.toISOString();
    if (params?.endDate) queryParams.endDate = params.endDate.toISOString();
    if (params?.granularity) queryParams.granularity = params.granularity;

    return this.apiClient.get<ProjectUsage>(`/projects/${projectId}/usage`, queryParams);
  }

  async getProjectBilling(
    projectId: string,
    billingPeriod?: {
      start: Date;
      end: Date;
    },
  ): Promise<ProjectBilling> {
    const queryParams: Record<string, string> = {};
    if (billingPeriod?.start) queryParams.startDate = billingPeriod.start.toISOString();
    if (billingPeriod?.end) queryParams.endDate = billingPeriod.end.toISOString();

    return this.apiClient.get<ProjectBilling>(`/projects/${projectId}/billing`, queryParams);
  }

  async getProjectActivity(
    projectId: string,
    params?: {
      action?: string;
      userId?: string;
      startDate?: Date;
      endDate?: Date;
      limit?: number;
      offset?: number;
    },
  ): Promise<{
    data: ProjectActivity[];
    total: number;
    hasMore: boolean;
  }> {
    const queryParams: Record<string, string> = {};
    if (params?.action) queryParams.action = params.action;
    if (params?.userId) queryParams.userId = params.userId;
    if (params?.startDate) queryParams.startDate = params.startDate.toISOString();
    if (params?.endDate) queryParams.endDate = params.endDate.toISOString();
    if (params?.limit) queryParams.limit = params.limit.toString();
    if (params?.offset) queryParams.offset = params.offset.toString();

    return this.apiClient.get(`/projects/${projectId}/activity`, queryParams);
  }

  async getProjectMembers(
    projectId: string,
    params?: {
      role?: ProjectRole;
      search?: string;
      limit?: number;
      offset?: number;
    },
  ): Promise<{
    data: ProjectMember[];
    total: number;
    hasMore: boolean;
  }> {
    const queryParams: Record<string, string> = {};
    if (params?.role) queryParams.role = params.role;
    if (params?.search) queryParams.search = params.search;
    if (params?.limit) queryParams.limit = params.limit.toString();
    if (params?.offset) queryParams.offset = params.offset.toString();

    return this.apiClient.get(`/projects/${projectId}/members`, queryParams);
  }

  async addProjectMember(
    projectId: string,
    data: {
      userId: string;
      role: ProjectRole;
      permissions?: ProjectPermission[];
    },
  ): Promise<ProjectMember> {
    return this.apiClient.post<ProjectMember>(`/projects/${projectId}/members`, data);
  }

  async updateProjectMember(
    projectId: string,
    memberId: string,
    data: {
      role?: ProjectRole;
      permissions?: ProjectPermission[];
    },
  ): Promise<ProjectMember> {
    return this.apiClient.patch<ProjectMember>(`/projects/${projectId}/members/${memberId}`, data);
  }

  async removeProjectMember(projectId: string, memberId: string): Promise<void> {
    return this.apiClient.delete<void>(`/projects/${projectId}/members/${memberId}`);
  }

  async inviteToProject(
    projectId: string,
    data: {
      email: string;
      role: ProjectRole;
      permissions?: ProjectPermission[];
      message?: string;
    },
  ): Promise<ProjectInvitation> {
    return this.apiClient.post<ProjectInvitation>(`/projects/${projectId}/invitations`, data);
  }

  async getProjectInvitations(
    projectId: string,
    params?: {
      status?: "pending" | "accepted" | "declined" | "expired";
      limit?: number;
      offset?: number;
    },
  ): Promise<{
    data: ProjectInvitation[];
    total: number;
    hasMore: boolean;
  }> {
    const queryParams: Record<string, string> = {};
    if (params?.status) queryParams.status = params.status;
    if (params?.limit) queryParams.limit = params.limit.toString();
    if (params?.offset) queryParams.offset = params.offset.toString();

    return this.apiClient.get(`/projects/${projectId}/invitations`, queryParams);
  }

  async cancelProjectInvitation(projectId: string, invitationId: string): Promise<void> {
    return this.apiClient.delete<void>(`/projects/${projectId}/invitations/${invitationId}`);
  }

  async resendProjectInvitation(
    projectId: string,
    invitationId: string,
  ): Promise<ProjectInvitation> {
    return this.apiClient.post<ProjectInvitation>(
      `/projects/${projectId}/invitations/${invitationId}/resend`,
      {},
    );
  }

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

  async testProjectWebhook(projectId: string): Promise<{
    success: boolean;
    message: string;
    responseTime?: number;
    statusCode?: number;
  }> {
    return this.apiClient.post(`/projects/${projectId}/webhook/test`, {});
  }

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

  async importProject(data: {
    name: string;
    description?: string;
    config: any;
    overwriteExisting?: boolean;
  }): Promise<Project> {
    return this.apiClient.post<Project>("/projects/import", data);
  }

  validateProjectData(data: CreateProjectRequest | UpdateProjectRequest): {
    isValid: boolean;
    errors: string[];
  } {
    const errors: string[] = [];

    if ("name" in data && data.name) {
      if (data.name.length < 2) {
        errors.push("Project name must be at least 2 characters long");
      }
      if (data.name.length > 255) {
        errors.push("Project name must be less than 255 characters");
      }
      if (!/^[a-zA-Z0-9\s\-_]+$/.test(data.name)) {
        errors.push(
          "Project name can only contain letters, numbers, spaces, hyphens, and underscores",
        );
      }
    }

    if ("description" in data && data.description && data.description.length > 500) {
      errors.push("Project description must be less than 500 characters");
    }

    if ("settings" in data && data.settings?.webhookUrl) {
      try {
        new URL(data.settings.webhookUrl);
      } catch {
        errors.push("Webhook URL must be a valid URL");
      }
    }

    if ("settings" in data && data.settings?.retryPolicy) {
      const { maxRetries, retryDelay } = data.settings.retryPolicy;
      if (maxRetries !== undefined && (maxRetries < 0 || maxRetries > 10)) {
        errors.push("Max retries must be between 0 and 10");
      }
      if (retryDelay !== undefined && (retryDelay < 1000 || retryDelay > 60000)) {
        errors.push("Retry delay must be between 1000ms and 60000ms");
      }
    }

    if ("settings" in data && data.settings?.rateLimiting?.requestsPerMinute) {
      const rpm = data.settings.rateLimiting.requestsPerMinute;
      if (rpm < 1 || rpm > 10000) {
        errors.push("Requests per minute must be between 1 and 10000");
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  formatProjectForDisplay(project: Project): {
    name: string;
    description: string;
    status: string;
    statusColor: string;
    createdAt: string;
    lastActivity: string;
    memberCount: number;
    apiKeyCount: number;
  } {
    const formatDate = (date: Date) => {
      const now = new Date();
      const diffMs = now.getTime() - new Date(date).getTime();
      const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

      if (diffDays === 0) return "Today";
      if (diffDays === 1) return "Yesterday";
      if (diffDays < 7) return `${diffDays} days ago`;
      return new Date(date).toLocaleDateString();
    };

    const getStatusColor = (status: ProjectStatus) => {
      switch (status) {
        case ProjectStatus.ACTIVE:
          return "green";
        case ProjectStatus.INACTIVE:
          return "yellow";
        case ProjectStatus.ARCHIVED:
          return "gray";
        default:
          return "gray";
      }
    };

    return {
      name: project.name,
      description: project.description || "No description",
      status: project.status,
      statusColor: getStatusColor(project.status),
      createdAt: formatDate(project.createdAt),
      lastActivity: project.lastActivity ? formatDate(project.lastActivity) : "No activity",
      memberCount: 0,
      apiKeyCount: project.apiKeysCount || 0,
    };
  }

  generateProjectSlug(name: string): string {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, "")
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-+|-+$/g, "")
      .trim();
  }

  hasProjectPermission(
    project: Project,
    permission: ProjectPermission,
    userRole: ProjectRole,
  ): boolean {
    if (userRole === ProjectRole.OWNER) return true;

    const rolePermissions: Record<ProjectRole, ProjectPermission[]> = {
      [ProjectRole.OWNER]: Object.values(ProjectPermission),
      [ProjectRole.ADMIN]: [
        ProjectPermission.READ,
        ProjectPermission.WRITE,
        ProjectPermission.DELETE,
        ProjectPermission.MANAGE_API_KEYS,
        ProjectPermission.MANAGE_PROVIDERS,
        ProjectPermission.MANAGE_SETTINGS,
      ],
      [ProjectRole.DEVELOPER]: [
        ProjectPermission.READ,
        ProjectPermission.WRITE,
        ProjectPermission.MANAGE_API_KEYS,
        ProjectPermission.MANAGE_PROVIDERS,
      ],
      [ProjectRole.VIEWER]: [ProjectPermission.READ],
    };

    return rolePermissions[userRole]?.includes(permission) || false;
  }
}

export const projectApi = new ProjectApiClient();
