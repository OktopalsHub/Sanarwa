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
} from "../types/provider";
import { ApiClientConsumer } from "../internal/api-client-consumer";
import { ProviderConfigClient } from "./provider-config";

export class ProviderHealthClient extends ProviderConfigClient {
  // Provider Health Monitoring Methods

  /**
   * Check the health status of a specific provider
   * @param providerId Provider ID to check
   * @returns Current health status and details
   */
  async checkProviderHealth(providerId: string): Promise<ProviderHealthCheck> {
    return this.apiClient.get<ProviderHealthCheck>(`/provider-configs/${providerId}/health`);
  }

  /**
   * Get health status for all providers
   * @returns List of health statuses for all providers
   */
  async getAllProviderHealth(): Promise<ProviderHealthCheck[]> {
    return this.apiClient.get<ProviderHealthCheck[]>("/provider-configs/health");
  }

  /**
   * Trigger a manual health check for a provider
   * @param providerId Provider ID to check
   * @returns Updated health status
   */
  async triggerHealthCheck(providerId: string): Promise<ProviderHealthCheck> {
    return this.apiClient.post<ProviderHealthCheck>(
      `/provider-configs/${providerId}/health/check`,
      {},
    );
  }

  /**
   * Get health history for a provider
   * @param providerId Provider ID
   * @param params Query parameters for filtering
   * @returns Historical health check data
   */
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

  // Provider Metrics and Analytics Methods

  /**
   * Get usage metrics for a specific provider
   * @param providerId Provider ID
   * @param params Query parameters for metrics
   * @returns Provider usage metrics and analytics
   */
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

  /**
   * Get aggregated metrics for all providers
   * @param params Query parameters for metrics
   * @returns Aggregated provider metrics
   */
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

  /**
   * Get provider performance comparison
   * @param providerIds Array of provider IDs to compare
   * @param params Query parameters for comparison
   * @returns Comparative metrics for specified providers
   */
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

}
