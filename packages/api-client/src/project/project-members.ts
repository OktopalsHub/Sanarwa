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
import { ProjectAnalyticsClient } from "./project-analytics";

export class ProjectMembersClient extends ProjectAnalyticsClient {
  // Project Member Management

  /**
   * Get project members
   * @param projectId Project ID
   * @param params Query parameters for member list
   * @returns List of project members
   */
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

  /**
   * Add a member to a project
   * @param projectId Project ID
   * @param data Member data
   * @returns Added project member
   */
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

  /**
   * Update a project member's role and permissions
   * @param projectId Project ID
   * @param memberId Member ID
   * @param data Update data
   * @returns Updated project member
   */
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

  /**
   * Get project invitations
   * @param projectId Project ID
   * @param params Query parameters
   * @returns List of project invitations
   */
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
  async resendProjectInvitation(
    projectId: string,
    invitationId: string,
  ): Promise<ProjectInvitation> {
    return this.apiClient.post<ProjectInvitation>(
      `/projects/${projectId}/invitations/${invitationId}/resend`,
      {},
    );
  }

}
