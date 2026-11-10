import {
  ApprovalRequest,
  ApprovalResponse,
  CreateTemplateRequest,
  DuplicateTemplateRequest,
  Template,
  TemplateAnalytics,
  TemplateApproval,
  TemplateLibraryFilter,
  TemplatePreview,
  TemplateVersion,
  UpdateTemplateRequest,
} from "./types/template";
import { ApiClient, apiClient as sharedApiClient } from "./client";

export class TemplateApiClient {
  private apiClient: ApiClient;

  constructor(apiClient?: ApiClient) {
    this.apiClient = apiClient ?? sharedApiClient;
  }

  async createTemplate(data: CreateTemplateRequest): Promise<Template> {
    return this.apiClient.post<Template>("/tenants/:tenantId/templates", data);
  }

  async getTemplates(
    filters?: TemplateLibraryFilter & {
      page?: number;
      limit?: number;
      sortBy?: string;
      sortOrder?: "ASC" | "DESC";
    },
  ): Promise<{
    data: Template[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
      hasNext: boolean;
      hasPrev: boolean;
    };
  }> {
    const queryParams: Record<string, any> = {};

    if (filters?.category) queryParams.category = filters.category;
    if (filters?.channel) queryParams.channel = filters.channel;
    if (filters?.status) queryParams.status = filters.status;
    if (filters?.search) queryParams.search = filters.search;
    if (filters?.createdBy) queryParams.createdBy = filters.createdBy;
    if (filters?.tags) queryParams.tags = filters.tags.join(",");
    if (filters?.dateRange?.from) queryParams.dateFrom = filters.dateRange.from.toISOString();
    if (filters?.dateRange?.to) queryParams.dateTo = filters.dateRange.to.toISOString();
    if (filters?.page) queryParams.page = filters.page;
    if (filters?.limit) queryParams.limit = filters.limit;
    if (filters?.sortBy) queryParams.sortBy = filters.sortBy;
    if (filters?.sortOrder) queryParams.sortOrder = filters.sortOrder;

    return this.apiClient.get("/tenants/:tenantId/templates", queryParams);
  }

  async getTemplate(templateId: string): Promise<Template> {
    return this.apiClient.get<Template>(`/tenants/:tenantId/templates/${templateId}`);
  }

  async updateTemplate(
    templateOrId: string | UpdateTemplateRequest,
    data?: UpdateTemplateRequest,
  ): Promise<Template> {
    if (typeof templateOrId === "object") {
      const { id, ...rest } = templateOrId;
      if (!id) {
        throw new Error("Template id is required");
      }
      return this.updateTemplate(id, rest);
    }

    return this.apiClient.patch<Template>(
      `/tenants/:tenantId/templates/${templateOrId}`,
      data ?? {},
    );
  }

  async deleteTemplate(templateId: string): Promise<void> {
    return this.apiClient.delete<void>(`/tenants/:tenantId/templates/${templateId}`);
  }

  async createTemplateVersion(
    templateId: string,
    data: UpdateTemplateRequest,
  ): Promise<TemplateVersion> {
    return this.apiClient.post<TemplateVersion>(
      `/tenants/:tenantId/templates/${templateId}/versions`,
      data,
    );
  }

  async getTemplateVersions(templateId: string): Promise<TemplateVersion[]> {
    return this.apiClient.get<TemplateVersion[]>(
      `/tenants/:tenantId/templates/${templateId}/versions`,
    );
  }

  async activateTemplateVersion(versionId: string): Promise<Template> {
    return this.apiClient.post<Template>(`/tenants/:tenantId/templates/${versionId}/activate`, {});
  }

  async archiveTemplate(templateId: string): Promise<Template> {
    return this.apiClient.post<Template>(`/tenants/:tenantId/templates/${templateId}/archive`, {});
  }

  async duplicateTemplate(
    requestOrTemplateId: DuplicateTemplateRequest | string,
    newName?: string,
  ): Promise<Template> {
    if (typeof requestOrTemplateId === "string") {
      return this.duplicateTemplate({
        templateId: requestOrTemplateId,
        name: newName ?? "Copy",
      });
    }

    return this.apiClient.post<Template>(
      `/tenants/:tenantId/templates/${requestOrTemplateId.templateId}/duplicate`,
      {
        name: requestOrTemplateId.name,
        description: requestOrTemplateId.description,
      },
    );
  }

  async renderTemplate(
    templateId: string,
    variables: Record<string, any>,
  ): Promise<{
    subject?: string;
    body: string;
    plainText?: string;
    metadata?: Record<string, any>;
  }> {
    return this.apiClient.post("/tenants/:tenantId/templates/render", {
      templateId,
      variables,
    });
  }

  async previewTemplate(
    templateId: string,
    variables?: Record<string, any>,
  ): Promise<TemplatePreview> {
    const template = await this.getTemplate(templateId);

    const previewVariables = variables || this.generateSampleVariables(template.variables);

    const renderedContent = await this.renderTemplate(templateId, previewVariables);

    return {
      templateId,
      variables: previewVariables,
      channel: template.channel,
      renderedContent,
    };
  }

  async validateTemplate(templateId: string): Promise<{
    isValid: boolean;
    errors: Array<{
      field: string;
      message: string;
      severity: "error" | "warning";
    }>;
    warnings: Array<{
      field: string;
      message: string;
    }>;
  }> {
    return this.apiClient.post(`/tenants/:tenantId/templates/${templateId}/validate`, {});
  }

  async validateTemplateData(
    templateId: string,
    data: Record<string, any>,
  ): Promise<{
    isValid: boolean;
    errors: Array<{
      variable: string;
      message: string;
    }>;
    missingRequired: string[];
  }> {
    return this.apiClient.post(`/tenants/:tenantId/templates/${templateId}/validate-data`, {
      data,
    });
  }

  async getTemplatesByChannel(channel: string): Promise<Template[]> {
    return this.apiClient.get<Template[]>(`/tenants/:tenantId/templates/channel/${channel}`);
  }

  async getDefaultTemplate(channel: string): Promise<Template | null> {
    try {
      return await this.apiClient.get<Template>(
        `/tenants/:tenantId/templates/channel/${channel}/default`,
      );
    } catch (error: any) {
      if (error.status === 404) {
        return null;
      }
      throw error;
    }
  }

  async searchTemplates(
    query: string,
    filters?: TemplateLibraryFilter,
  ): Promise<{
    templates: Template[];
    totalResults: number;
    searchTime: number;
  }> {
    const searchFilters = {
      ...filters,
      search: query,
    };

    const result = await this.getTemplates(searchFilters);

    return {
      templates: result.data,
      totalResults: result.pagination.total,
      searchTime: 0,
    };
  }

  async getTemplateAnalytics(
    templateId: string,
    startDate?: Date,
    endDate?: Date,
  ): Promise<TemplateAnalytics> {
    const queryParams: Record<string, string> = {};
    if (startDate) queryParams.startDate = startDate.toISOString();
    if (endDate) queryParams.endDate = endDate.toISOString();

    return this.apiClient.get<TemplateAnalytics>(
      `/tenants/:tenantId/templates/${templateId}/analytics`,
      queryParams,
    );
  }

  async getTemplateUsageStats(filters?: {
    channel?: string;
    category?: string;
    startDate?: Date;
    endDate?: Date;
  }): Promise<{
    totalTemplates: number;
    activeTemplates: number;
    totalUsage: number;
    topTemplates: Array<{
      templateId: string;
      templateName: string;
      usageCount: number;
      successRate: number;
    }>;
    usageByChannel: Record<string, number>;
    usageByCategory: Record<string, number>;
  }> {
    const queryParams: Record<string, string> = {};
    if (filters?.channel) queryParams.channel = filters.channel;
    if (filters?.category) queryParams.category = filters.category;
    if (filters?.startDate) queryParams.startDate = filters.startDate.toISOString();
    if (filters?.endDate) queryParams.endDate = filters.endDate.toISOString();

    return this.apiClient.get("/tenants/:tenantId/templates/analytics/usage", queryParams);
  }

  private generateSampleVariables(variables: any[]): Record<string, any> {
    const sampleData: Record<string, any> = {};

    variables.forEach((variable) => {
      switch (variable.type) {
        case "text":
          sampleData[variable.name] = variable.defaultValue || `Sample ${variable.name}`;
          break;
        case "number":
          sampleData[variable.name] = variable.defaultValue || 42;
          break;
        case "date":
          sampleData[variable.name] = variable.defaultValue || new Date().toISOString();
          break;
        case "boolean":
          sampleData[variable.name] =
            variable.defaultValue !== undefined ? variable.defaultValue : true;
          break;
        case "url":
          sampleData[variable.name] = variable.defaultValue || "https://example.com";
          break;
        case "email":
          sampleData[variable.name] = variable.defaultValue || "user@example.com";
          break;
        case "image":
          sampleData[variable.name] =
            variable.defaultValue || "https://via.placeholder.com/300x200";
          break;
        default:
          sampleData[variable.name] = variable.defaultValue || "Sample value";
      }
    });

    return sampleData;
  }

  validateTemplateContent(content: any): {
    isValid: boolean;
    errors: string[];
  } {
    const errors: string[] = [];

    if (!content.body || content.body.trim().length === 0) {
      errors.push("Template body is required");
    }

    if (content.subject !== undefined && content.subject.trim().length === 0) {
      errors.push("Email subject cannot be empty");
    }

    if (content.body && content.body.length > 100000) {
      errors.push("Template body is too long (max 100,000 characters)");
    }

    if (content.subject && content.subject.length > 200) {
      errors.push("Email subject is too long (max 200 characters)");
    }

    if (content.body) {
      const variablePattern = /\{\{\s*([^}]+)\s*\}\}/g;
      const matches = content.body.match(variablePattern);

      if (matches) {
        matches.forEach((match: string) => {
          const variableName = match.replace(/[{}]/g, "").trim();
          if (!variableName) {
            errors.push(`Empty variable placeholder found: ${match}`);
          }
        });
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  extractVariablesFromContent(content: string): string[] {
    const variablePattern = /\{\{\s*([^}]+)\s*\}\}/g;
    const variables: string[] = [];
    let match;

    while ((match = variablePattern.exec(content)) !== null) {
      const variableName = match[1]?.trim();
      if (variableName && !variables.includes(variableName)) {
        variables.push(variableName);
      }
    }

    return variables;
  }

  formatTemplateForDisplay(template: Template): {
    name: string;
    category: string;
    channel: string;
    status: string;
    lastUsed: string;
    usageCount: number;
    version: number;
    statusColor: string;
    isActive: boolean;
  } {
    const formatDate = (date?: Date) => {
      if (!date) return "Never";
      const now = new Date();
      const diffMs = now.getTime() - new Date(date).getTime();
      const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

      if (diffDays === 0) return "Today";
      if (diffDays === 1) return "Yesterday";
      if (diffDays < 7) return `${diffDays} days ago`;
      return new Date(date).toLocaleDateString();
    };

    const getStatusColor = (status: string) => {
      switch (status) {
        case "active":
          return "green";
        case "draft":
          return "yellow";
        case "archived":
          return "gray";
        default:
          return "gray";
      }
    };

    return {
      name: template.name,
      category: template.category,
      channel: template.channel,
      status: template.status,
      lastUsed: formatDate(template.lastUsed),
      usageCount: template.usageCount,
      version: template.version,
      statusColor: getStatusColor(template.status),
      isActive: template.isActive,
    };
  }

  canEditTemplate(template: Template): boolean {
    return template.status === "draft" || template.status === "active";
  }

  canDeleteTemplate(template: Template): boolean {
    return template.status !== "active" || template.usageCount === 0;
  }

  async restoreVersion(templateId: string, version: number | string): Promise<Template> {
    void version;
    return this.getTemplate(templateId);
  }

  async getCategories(): Promise<string[]> {
    return [];
  }

  async getTags(): Promise<string[]> {
    return [];
  }

  async getRecentTemplates(limit = 10): Promise<Template[]> {
    const result = await this.getTemplates({ limit, sortBy: "updatedAt", sortOrder: "DESC" });
    return result.data.slice(0, limit);
  }

  async getPopularTemplates(limit = 10): Promise<Template[]> {
    const result = await this.getTemplates({ limit, sortBy: "usageCount", sortOrder: "DESC" });
    return result.data.slice(0, limit);
  }

  async getTemplateApprovals(templateId?: string): Promise<TemplateApproval[]> {
    void templateId;
    return [];
  }

  async requestApproval(request: ApprovalRequest): Promise<TemplateApproval> {
    return {
      id: "approval-stub",
      templateId: request.templateId,
      version: 1,
      status: "pending",
      requestedBy: "",
      requestedAt: new Date(),
      comments: request.comments,
    };
  }

  async reviewTemplate(approvalId: string, response: ApprovalResponse): Promise<TemplateApproval> {
    return {
      id: approvalId,
      templateId: "",
      version: 1,
      status: response.status,
      requestedBy: "",
      requestedAt: new Date(),
      comments: response.comments,
    };
  }

  async bulkDelete(templateIds: string[]): Promise<{ deleted: number }> {
    await Promise.all(templateIds.map((id) => this.deleteTemplate(id)));
    return { deleted: templateIds.length };
  }

  async bulkUpdateStatus(templateIds: string[], status: string): Promise<{ updated: number }> {
    await Promise.all(
      templateIds.map((id) => this.updateTemplate(id, { status: status as Template["status"] })),
    );
    return { updated: templateIds.length };
  }

  validateTemplateContentOnly(content: Record<string, unknown>): {
    isValid: boolean;
    errors: string[];
  } {
    return this.validateTemplateContent(content);
  }
}

export const templateApi = new TemplateApiClient();
