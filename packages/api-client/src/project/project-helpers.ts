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
import { ProjectSettingsClient } from "./project-settings";

export class ProjectHelpersClient extends ProjectSettingsClient {
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

    // Validate description
    if ("description" in data && data.description && data.description.length > 500) {
      errors.push("Project description must be less than 500 characters");
    }

    // Validate webhook URL
    if ("settings" in data && data.settings?.webhookUrl) {
      try {
        new URL(data.settings.webhookUrl);
      } catch {
        errors.push("Webhook URL must be a valid URL");
      }
    }

    // Validate retry policy
    if ("settings" in data && data.settings?.retryPolicy) {
      const { maxRetries, retryDelay } = data.settings.retryPolicy;
      if (maxRetries !== undefined && (maxRetries < 0 || maxRetries > 10)) {
        errors.push("Max retries must be between 0 and 10");
      }
      if (retryDelay !== undefined && (retryDelay < 1000 || retryDelay > 60000)) {
        errors.push("Retry delay must be between 1000ms and 60000ms");
      }
    }

    // Validate rate limiting
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
      .replace(/[^a-z0-9\s-]/g, "")
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-+|-+$/g, "") // Remove leading and trailing dashes
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
    userRole: ProjectRole,
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
