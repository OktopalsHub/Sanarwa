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
export class ProjectCrudClient extends ApiClientConsumer {
  // Core Project CRUD Operations

  /**
   * Create a new project
   * @param data Project creation data
   * @returns Created project
   */
  async createProject(data: CreateProjectRequest): Promise<Project> {
    return this.apiClient.post<Project>("/tenants/:tenantId/projects", data);
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
    return this.apiClient.get("/tenants/:tenantId/projects", params);
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

}
