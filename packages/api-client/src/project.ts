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
  UpdateProjectRequest
} from './types/project';
import { ApiClient, createApiClient } from './client';

/**
 * Project Management API client for handling all project-related operations
 * Implements project CRUD operations, member management, and project settings
 */
class ProjectApiClient {
  private apiClient: ApiClient;

  constructor(apiClient?: ApiClient) {
    // Use provided client or create a new one
    this.apiClient = apiClient || createApiClient();
  }

  // Core Project CRUD Operations

  /**
   * Create a new project
   * @param data Project creation data
   * @returns Created project
   */
  async createProject(data: CreateProjectRequest): Promise<Project> {
    return this.apiClient.post<Project>('/tenants/:tenantId/projects', data);
  }

  /**
   * Get all projects for the current tenant
   * @param params Query parameters for filtering and pagination
   * @returns List of projects with pagination info
   */
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
    return this.apiClient.get('/tenants/:tenantId/projects', params);
  }

  /**
   * Get a specific project by ID
   * @param projectId Project ID
   * @returns Project details
   */
  async getProject(projectId: string): Promise<Project> {
    return this.apiClient.get<Project>(`/tenants/:tenantId/projects/${projectId}`);
  }

  /**
   * Update an existing project
   * @param projectId Project ID to update
   * @param data Project update data
   * @returns Updated project
   */
  async updateProject(projectId: string, data: UpdateProjectRequest): Promise<Project> {
    return this.apiClient.patch<Project>(`/tenants/:tenantId/projects/${projectId}`, data);
  }

  /**
   * Delete a project
   * @param projectId Project ID to delete
   */
  async deleteProject(projectId: string): Promise<void> {
    return this.apiClient.delete<void>(`/tenants/:tenantId/projects/${projectId}`);
  }

  /**
   * Archive a project (soft delete)
   * @param projectId Project ID to archive
   * @returns Updated project with archived status
   */
  async archiveProject(projectId: string): Promise<Project> {
    return this.updateProject(projectId, { status: ProjectStatus.ARCHIVED });
  }

  /**
   * Restore an archived project
   * @param projectId Project ID to restore
   * @returns Updated project with active status
   */
  async restoreProject(projectId: string): Promise<Project> {
    return this.updateProject(projectId, { status: ProjectStatus.ACTIVE });
  }

  // Project Status Management

  /**
   * Activate a project
   * @param projectId Project ID to activate
   * @returns Updated project
   */
  async activateProject(projectId: string): Promise<Project> {
    return this.apiClient.post<Project>(`/projects/${projectId}/activate`, {});
  }

  /**
   * Deactivate a project
   * @param projectId Project ID to deactivate
   * @returns Updated project
   */
  async deactivateProject(projectId: string): Promise<Project> {
    return this.apiClient.post<Project>(`/projects/${projectId}/deactivate`, {});
  }

  // Project Statistics and Analytics

  /**
   * Get project statistics for the current tenant
   * @returns Project statistics
   */
  async getProjectStats(): Promise<ProjectStats> {
    return this.apiClient.get<ProjectStats>('/projects/stats');
  }

  /**
   * Get usage statistics for a specific project
   * @param projectId Project ID
   * @param params Query parameters for usage data
   * @returns Project usage statistics
   */
  async getProjectUsage(projectId: string, params?: {
    startDate?: Date;
    endDate?: Date;
    granularity?: 'hour' | 'day' | 'week' | 'month';
  }): Promise<ProjectUsage> {
    const queryParams: Record<string, string> = {};
    if (params?.startDate) queryParams.startDate = params.startDate.toISOString();
    if (params?.endDate) queryParams.endDate = params.endDate.toISOString();
    if (params?.granularity) queryParams.granularity = params.granularity;

    return this.apiClient.get<ProjectUsage>(`/projects/${projectId}/usage`, queryParams);
  }

  /**
   * Get billing information for a project
   * @param projectId Project ID
   * @param billingPeriod Optional billing period
   * @returns Project billing information
   */
  async getProjectBilling(projectId: string, billingPeriod?: {
    start: Date;
    end: Date;
  }): Promise<ProjectBilling> {
    const queryParams: Record<string, string> = {};
    if (billingPeriod?.start) queryParams.startDate = billingPeriod.start.toISOString();
    if (billingPeriod?.end) queryParams.endDate = billingPeriod.end.toISOString();

    return this.apiClient.get<ProjectBilling>(`/projects/${projectId}/billing`, queryParams);
  }

  /**
   * Get activity log for a project
   * @param projectId Project ID
   * @param params Query parameters for activity log
   * @returns Project activity log
   */
  async getProjectActivity(projectId: string, params?: {
    action?: string;
    userId?: string;
    startDate?: Date;
    endDate?: Date;
    limit?: number;
    offset?: number;
  }): Promise<{
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

  // Project Member Management

  /**
   * Get project members
   * @param projectId Project ID
   * @param params Query parameters for member list
   * @returns List of project members
   */
  async getProjectMembers(projectId: string, params?: {
    role?: ProjectRole;
    search?: string;
    limit?: number;
    offset?: number;
  }): Promise<{
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

  /**
   * Add a member to a project
   * @param projectId Project ID
   * @param data Member data
   * @returns Added project member
   */
  async addProjectMember(projectId: string, data: {
    userId: string;
    role: ProjectRole;
    permissions?: ProjectPermission[];
  }): Promise<ProjectMember> {
    return this.apiClient.post<ProjectMember>(`/projects/${projectId}/members`, data);
  }

  /**
   * Update a project member's role and permissions
   * @param projectId Project ID
   * @param memberId Member ID
   * @param data Update data
   * @returns Updated project member
   */
  async updateProjectMember(projectId: string, memberId: string, data: {
    role?: ProjectRole;
    permissions?: ProjectPermission[];
  }): Promise<ProjectMember> {
    return this.apiClient.patch<ProjectMember>(`/projects/${projectId}/members/${memberId}`, data);
  }

  /**
   * Remove a member from a project
   * @param projectId Project ID
   * @param memberId Member ID
   */
  async removeProjectMember(projectId: string, memberId: string): Promise<void> {
    return this.apiClient.delete<void>(`/projects/${projectId}/members/${memberId}`);
  }

  // Project Invitation Management

  /**
   * Invite a user to a project
   * @param projectId Project ID
   * @param data Invitation data
   * @returns Created invitation
   */
  async inviteToProject(projectId: string, data: {
    email: string;
    role: ProjectRole;
    permissions?: ProjectPermission[];
    message?: string;
  }): Promise<ProjectInvitation> {
    return this.apiClient.post<ProjectInvitation>(`/projects/${projectId}/invitations`, data);
  }

  /**
   * Get project invitations
   * @param projectId Project ID
   * @param params Query parameters
   * @returns List of project invitations
   */
  async getProjectInvitations(projectId: string, params?: {
    status?: 'pending' | 'accepted' | 'declined' | 'expired';
    limit?: number;
    offset?: number;
  }): Promise<{
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

  /**
   * Cancel a project invitation
   * @param projectId Project ID
   * @param invitationId Invitation ID
   */
  async cancelProjectInvitation(projectId: string, invitationId: string): Promise<void> {
    return this.apiClient.delete<void>(`/projects/${projectId}/invitations/${invitationId}`);
  }

  /**
   * Resend a project invitation
   * @param projectId Project ID
   * @param invitationId Invitation ID
   * @returns Updated invitation
   */
  async resendProjectInvitation(projectId: string, invitationId: string): Promise<ProjectInvitation> {
    return this.apiClient.post<ProjectInvitation>(`/projects/${projectId}/invitations/${invitationId}/resend`, {});
  }

  // Project Settings Management

  /**
   * Update project settings
   * @param projectId Project ID
   * @param settings Project settings
   * @returns Updated project
   */
  async updateProjectSettings(projectId: string, settings: {
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
  }): Promise<Project> {
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
  async getProjectWebhookLogs(projectId: string, params?: {
    startDate?: Date;
    endDate?: Date;
    status?: 'success' | 'failed' | 'timeout';
    limit?: number;
    offset?: number;
  }): Promise<{
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
  async duplicateProject(projectId: string, data: {
    name: string;
    description?: string;
    includeSettings?: boolean;
    includeMembers?: boolean;
    includeApiKeys?: boolean;
    includeProviders?: boolean;
  }): Promise<Project> {
    return this.apiClient.post<Project>(`/projects/${projectId}/duplicate`, data);
  }

  /**
   * Export project configuration
   * @param projectId Project ID
   * @param options Export options
   * @returns Export data
   */
  async exportProject(projectId: string, options?: {
    includeSettings?: boolean;
    includeMembers?: boolean;
    includeApiKeys?: boolean;
    includeProviders?: boolean;
    format?: 'json' | 'yaml';
  }): Promise<{
    format: string;
    data: any;
    exportedAt: Date;
  }> {
    const queryParams: Record<string, string> = {};
    if (options?.includeSettings !== undefined) queryParams.includeSettings = options.includeSettings.toString();
    if (options?.includeMembers !== undefined) queryParams.includeMembers = options.includeMembers.toString();
    if (options?.includeApiKeys !== undefined) queryParams.includeApiKeys = options.includeApiKeys.toString();
    if (options?.includeProviders !== undefined) queryParams.includeProviders = options.includeProviders.toString();
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
    return this.apiClient.post<Project>('/projects/import', data);
  }

  // Utility Methods

  /**
   * Validate project data before creating/updating
   * @param data Project data
   * @returns Validation result
   */
  validateProjectData(data: CreateProjectRequest | UpdateProjectRequest): {
    isValid: boolean;
    errors: string[];
  } {
    const errors: string[] = [];

    // Validate name
    if ('name' in data && data.name) {
      if (data.name.length < 2) {
        errors.push('Project name must be at least 2 characters long');
      }
      if (data.name.length > 255) {
        errors.push('Project name must be less than 255 characters');
      }
      if (!/^[a-zA-Z0-9\s\-_]+$/.test(data.name)) {
        errors.push('Project name can only contain letters, numbers, spaces, hyphens, and underscores');
      }
    }

    // Validate description
    if ('description' in data && data.description && data.description.length > 500) {
      errors.push('Project description must be less than 500 characters');
    }

    // Validate webhook URL
    if ('settings' in data && data.settings?.webhookUrl) {
      try {
        new URL(data.settings.webhookUrl);
      } catch {
        errors.push('Webhook URL must be a valid URL');
      }
    }

    // Validate retry policy
    if ('settings' in data && data.settings?.retryPolicy) {
      const { maxRetries, retryDelay } = data.settings.retryPolicy;
      if (maxRetries !== undefined && (maxRetries < 0 || maxRetries > 10)) {
        errors.push('Max retries must be between 0 and 10');
      }
      if (retryDelay !== undefined && (retryDelay < 1000 || retryDelay > 60000)) {
        errors.push('Retry delay must be between 1000ms and 60000ms');
      }
    }

    // Validate rate limiting
    if ('settings' in data && data.settings?.rateLimiting?.requestsPerMinute) {
      const rpm = data.settings.rateLimiting.requestsPerMinute;
      if (rpm < 1 || rpm > 10000) {
        errors.push('Requests per minute must be between 1 and 10000');
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  /**
   * Format project for display in UI
   * @param project Project to format
   * @returns Formatted project data
   */
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

      if (diffDays === 0) return 'Today';
      if (diffDays === 1) return 'Yesterday';
      if (diffDays < 7) return `${diffDays} days ago`;
      return new Date(date).toLocaleDateString();
    };

    const getStatusColor = (status: ProjectStatus) => {
      switch (status) {
        case ProjectStatus.ACTIVE: return 'green';
        case ProjectStatus.INACTIVE: return 'yellow';
        case ProjectStatus.ARCHIVED: return 'gray';
        default: return 'gray';
      }
    };

    return {
      name: project.name,
      description: project.description || 'No description',
      status: project.status,
      statusColor: getStatusColor(project.status),
      createdAt: formatDate(project.createdAt),
      lastActivity: project.lastActivity ? formatDate(project.lastActivity) : 'No activity',
      memberCount: 0, // This would be populated from the API
      apiKeyCount: project.apiKeysCount || 0,
    };
  }

  /**
   * Generate project slug from name
   * @param name Project name
   * @returns URL-friendly slug
   */
  generateProjectSlug(name: string): string {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-+|-+$/g, '') // Remove leading and trailing dashes
      .trim();
  }

  /**
   * Check if user has permission for a project action
   * @param project Project
   * @param permission Required permission
   * @param userRole User's role in the project
   * @returns True if user has permission
   */
  hasProjectPermission(
    project: Project,
    permission: ProjectPermission,
    userRole: ProjectRole
  ): boolean {
    // Owner has all permissions
    if (userRole === ProjectRole.OWNER) return true;

    // Define role-based permissions
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