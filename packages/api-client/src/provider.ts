import {
  CreateProviderRequest,
  Provider,
  ProviderFailoverConfig,
  ProviderHealthCheck,
  ProviderMetrics,
  ProviderQueryParams,
  ProviderTestData,
  ProviderTestResult,
  ProviderType,
  UpdateProviderRequest,
} from "./types/provider";
import { ApiClient, apiClient as sharedApiClient } from "./client";
import { paginated } from "./paginated";

class ProviderApiClient {
  private apiClient: ApiClient;

  constructor(apiClient?: ApiClient) {
    this.apiClient = apiClient ?? sharedApiClient;
  }

  async createProvider(data: CreateProviderRequest): Promise<Provider> {
    return this.apiClient.post<Provider>("/provider-configs", data);
  }

  async getProviders(params?: ProviderQueryParams): Promise<{
    data: Provider[];
    pagination?: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
      hasNext: boolean;
      hasPrev: boolean;
    };
  }> {
    const response = await this.apiClient.get<unknown>("/provider-configs", params);
    return paginated<Provider>(response, "configs");
  }

  async getProvidersByProject(
    projectId: string,
    params?: ProviderQueryParams,
  ): Promise<{
    data: Provider[];
    pagination?: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
      hasNext: boolean;
      hasPrev: boolean;
    };
  }> {
    const response = await this.apiClient.get<unknown>(
      `/tenants/:tenantId/projects/${projectId}/provider-configs`,
      params,
    );
    return paginated<Provider>(response, "configs");
  }

  async getProvider(providerId: string): Promise<Provider> {
    return this.apiClient.get<Provider>(`/provider-configs/${providerId}`);
  }

  async updateProvider(providerId: string, data: UpdateProviderRequest): Promise<Provider> {
    return this.apiClient.patch<Provider>(`/provider-configs/${providerId}`, data);
  }

  async deleteProvider(providerId: string): Promise<void> {
    return this.apiClient.delete<void>(`/provider-configs/${providerId}`);
  }

  async testProvider(providerId: string, testData?: ProviderTestData): Promise<ProviderTestResult> {
    const payload = testData ? { testData } : {};
    return this.apiClient.post<ProviderTestResult>(`/provider-configs/${providerId}/test`, payload);
  }

  async testProviderWithData(
    providerId: string,
    testData: ProviderTestData,
  ): Promise<ProviderTestResult> {
    return this.apiClient.post<ProviderTestResult>(`/provider-configs/${providerId}/test`, {
      testData,
    });
  }

  async activateProvider(providerId: string): Promise<Provider> {
    return this.apiClient.post<Provider>(`/provider-configs/${providerId}/activate`, {});
  }

  async deactivateProvider(providerId: string): Promise<Provider> {
    return this.apiClient.post<Provider>(`/provider-configs/${providerId}/deactivate`, {});
  }

  async setDefaultProvider(providerId: string): Promise<Provider> {
    return this.updateProvider(providerId, { isDefault: true });
  }

  async checkProviderHealth(providerId: string): Promise<ProviderHealthCheck> {
    return this.apiClient.get<ProviderHealthCheck>(`/provider-configs/${providerId}/health`);
  }

  async getAllProviderHealth(): Promise<ProviderHealthCheck[]> {
    return this.apiClient.get<ProviderHealthCheck[]>("/provider-configs/health");
  }

  async triggerHealthCheck(providerId: string): Promise<ProviderHealthCheck> {
    return this.apiClient.post<ProviderHealthCheck>(
      `/provider-configs/${providerId}/health/check`,
      {},
    );
  }

  async getProviderHealthHistory(
    providerId: string,
    params?: {
      startDate?: Date;
      endDate?: Date;
      limit?: number;
    },
  ): Promise<ProviderHealthCheck[]> {
    const queryParams: Record<string, string> = {};
    if (params?.startDate) queryParams.startDate = params.startDate.toISOString();
    if (params?.endDate) queryParams.endDate = params.endDate.toISOString();
    if (params?.limit) queryParams.limit = params.limit.toString();

    return this.apiClient.get<ProviderHealthCheck[]>(
      `/provider-configs/${providerId}/health/history`,
      queryParams,
    );
  }

  async getProviderMetrics(
    providerId: string,
    params?: {
      startDate?: Date;
      endDate?: Date;
      groupBy?: "hour" | "day" | "week" | "month";
    },
  ): Promise<ProviderMetrics> {
    const queryParams: Record<string, string> = {};
    if (params?.startDate) queryParams.startDate = params.startDate.toISOString();
    if (params?.endDate) queryParams.endDate = params.endDate.toISOString();
    if (params?.groupBy) queryParams.groupBy = params.groupBy;

    return this.apiClient.get<ProviderMetrics>(
      `/provider-configs/${providerId}/metrics`,
      queryParams,
    );
  }

  async getAllProviderMetrics(params?: {
    type?: ProviderType;
    startDate?: Date;
    endDate?: Date;
    groupBy?: "hour" | "day" | "week" | "month";
  }): Promise<ProviderMetrics[]> {
    const queryParams: Record<string, string> = {};
    if (params?.type) queryParams.type = params.type;
    if (params?.startDate) queryParams.startDate = params.startDate.toISOString();
    if (params?.endDate) queryParams.endDate = params.endDate.toISOString();
    if (params?.groupBy) queryParams.groupBy = params.groupBy;

    return this.apiClient.get<ProviderMetrics[]>("/provider-configs/metrics", queryParams);
  }

  async compareProviders(
    providerIds: string[],
    params?: {
      startDate?: Date;
      endDate?: Date;
      metrics?: ("success_rate" | "response_time" | "usage_count")[];
    },
  ): Promise<{
    providers: ProviderMetrics[];
    comparison: {
      bestPerforming: string;
      worstPerforming: string;
      averageSuccessRate: number;
      averageResponseTime: number;
    };
  }> {
    const queryParams: Record<string, any> = {
      providerIds: providerIds.join(","),
    };
    if (params?.startDate) queryParams.startDate = params.startDate.toISOString();
    if (params?.endDate) queryParams.endDate = params.endDate.toISOString();
    if (params?.metrics) queryParams.metrics = params.metrics.join(",");

    return this.apiClient.get("/provider-configs/compare", queryParams);
  }

  async getFailoverConfig(channel: ProviderType): Promise<ProviderFailoverConfig> {
    return this.apiClient.get<ProviderFailoverConfig>(`/provider-configs/failover/${channel}`);
  }

  async updateFailoverConfig(
    channel: ProviderType,
    config: Partial<ProviderFailoverConfig>,
  ): Promise<ProviderFailoverConfig> {
    return this.apiClient.put<ProviderFailoverConfig>(
      `/provider-configs/failover/${channel}`,
      config,
    );
  }

  async triggerFailover(
    channel: ProviderType,
    fromProviderId: string,
    toProviderId: string,
  ): Promise<{
    success: boolean;
    message: string;
    timestamp: Date;
  }> {
    return this.apiClient.post(`/provider-configs/failover/${channel}/trigger`, {
      fromProviderId,
      toProviderId,
    });
  }

  validateProviderConfig(data: CreateProviderRequest | UpdateProviderRequest): {
    isValid: boolean;
    errors: string[];
  } {
    const errors: string[] = [];

    if ("name" in data && data.name) {
      if (data.name.length < 2) {
        errors.push("Provider name must be at least 2 characters long");
      }
      if (data.name.length > 100) {
        errors.push("Provider name must be less than 100 characters");
      }
    }

    if ("priority" in data && data.priority !== undefined) {
      if (data.priority < 0 || data.priority > 100) {
        errors.push("Priority must be between 0 and 100");
      }
    }

    if ("config" in data && data.config) {
      const configErrors = this.validateProviderCredentials(data.config);
      errors.push(...configErrors);
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  private validateProviderCredentials(config: any): string[] {
    const errors: string[] = [];

    if (!config.credentials) {
      errors.push("Provider credentials are required");
      return errors;
    }

    const { credentials } = config;

    switch (credentials.type) {
      case "aws_ses":
        if (!credentials.config.region) errors.push("AWS SES region is required");
        if (!credentials.config.accessKeyId) errors.push("AWS SES access key ID is required");
        if (!credentials.config.secretAccessKey)
          errors.push("AWS SES secret access key is required");
        if (!credentials.config.fromEmail) errors.push("AWS SES from email is required");
        break;

      case "sendgrid":
        if (!credentials.config.apiKey) errors.push("SendGrid API key is required");
        if (!credentials.config.fromEmail) errors.push("SendGrid from email is required");
        break;

      case "twilio":
        if (!credentials.config.accountSid) errors.push("Twilio account SID is required");
        if (!credentials.config.authToken) errors.push("Twilio auth token is required");
        if (!credentials.config.fromNumber) errors.push("Twilio from number is required");
        break;

      case "firebase":
        if (!credentials.config.projectId) errors.push("Firebase project ID is required");
        if (!credentials.config.privateKey) errors.push("Firebase private key is required");
        if (!credentials.config.clientEmail) errors.push("Firebase client email is required");
        break;
    }

    return errors;
  }

  async getRecommendedProvider(channel: ProviderType): Promise<{
    providerId: string;
    providerName: string;
    reason: string;
    confidence: number;
    alternatives: Array<{
      providerId: string;
      providerName: string;
      reason: string;
    }>;
  }> {
    return this.apiClient.get(`/provider-configs/recommendations/${channel}`);
  }

  async checkProviderFeatureSupport(
    providerId: string,
    feature: string,
  ): Promise<{
    supported: boolean;
    details?: string;
    alternatives?: string[];
  }> {
    return this.apiClient.get(`/provider-configs/${providerId}/features/${feature}`);
  }

  getProviderConfigTemplate(
    type: ProviderType,
    subtype: string,
  ): {
    requiredFields: string[];
    optionalFields: string[];
    example: any;
    documentation?: string;
  } {
    const templates: Record<string, any> = {
      "email.aws_ses": {
        requiredFields: ["region", "accessKeyId", "secretAccessKey", "fromEmail"],
        optionalFields: ["fromName", "replyToEmail", "configurationSet"],
        example: {
          region: "us-east-1",
          accessKeyId: "YOUR_ACCESS_KEY_ID",
          secretAccessKey: "YOUR_SECRET_ACCESS_KEY",
          fromEmail: "noreply@yourdomain.com",
          fromName: "Your App Name",
        },
        documentation: "https://docs.aws.amazon.com/ses/",
      },
      "email.sendgrid": {
        requiredFields: ["apiKey", "fromEmail"],
        optionalFields: ["fromName", "replyToEmail", "templateId"],
        example: {
          apiKey: "SG.YOUR_API_KEY",
          fromEmail: "noreply@yourdomain.com",
          fromName: "Your App Name",
        },
        documentation: "https://docs.sendgrid.com/",
      },
      "sms.twilio": {
        requiredFields: ["accountSid", "authToken", "fromNumber"],
        optionalFields: ["messagingServiceSid"],
        example: {
          accountSid: "AC_YOUR_ACCOUNT_SID",
          authToken: "YOUR_AUTH_TOKEN",
          fromNumber: "+1234567890",
        },
        documentation: "https://www.twilio.com/docs/",
      },
    };

    const key = `${type}.${subtype}`;
    return (
      templates[key] || {
        requiredFields: [],
        optionalFields: [],
        example: {},
      }
    );
  }

  formatProviderForDisplay(provider: Provider): {
    name: string;
    type: string;
    status: string;
    health: string;
    successRate: string;
    lastUsed: string;
    isDefault: boolean;
    statusColor: string;
    healthColor: string;
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
        case "inactive":
          return "gray";
        case "testing":
          return "yellow";
        case "error":
          return "red";
        case "maintenance":
          return "orange";
        default:
          return "gray";
      }
    };

    const getHealthColor = (health: string) => {
      switch (health) {
        case "healthy":
          return "green";
        case "degraded":
          return "yellow";
        case "unhealthy":
          return "red";
        case "unknown":
          return "gray";
        default:
          return "gray";
      }
    };

    return {
      name: provider.name,
      type: `${provider.type} (${provider.subtype})`,
      status: provider.status,
      health: provider.healthStatus,
      successRate: `${(provider.successRate * 100).toFixed(1)}%`,
      lastUsed: formatDate(provider.lastUsed),
      isDefault: provider.isDefault,
      statusColor: getStatusColor(provider.status),
      healthColor: getHealthColor(provider.healthStatus),
    };
  }
}

export const providerApi = new ProviderApiClient();

export { ProviderApiClient };
