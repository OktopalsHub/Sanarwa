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
import { ProjectCrudClient } from "./project-crud";

export class ProjectAnalyticsClient extends ProjectCrudClient {
  // Project Statistics and Analytics

  /**
   * Get project statistics for the current tenant
   * @returns Project statistics
   */
  async getProjectStats(): Promise<ProjectStats> {
    return this.apiClient.get<ProjectStats>("/projects/stats");
  }

  /**
   * Get usage statistics for a specific project
   * @param projectId Project ID
   * @param params Query parameters for usage data
   * @returns Project usage statistics
   */
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

  /**
   * Get billing information for a project
   * @param projectId Project ID
   * @param billingPeriod Optional billing period
   * @returns Project billing information
   */
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

  /**
   * Get activity log for a project
   * @param projectId Project ID
   * @param params Query parameters for activity log
   * @returns Project activity log
   */
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

}
