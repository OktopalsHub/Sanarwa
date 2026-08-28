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
import { ProviderHealthClient } from "./provider-health";

export class ProviderFailoverClient extends ProviderHealthClient {
  // Provider Failover Management Methods

  /**
   * Get failover configuration for a channel
   * @param channel Provider type/channel
   * @returns Failover configuration
   */
  async getFailoverConfig(channel: ProviderType): Promise<ProviderFailoverConfig> {
    return this.apiClient.get<ProviderFailoverConfig>(`/provider-configs/failover/${channel}`);
  }

  /**
   * Update failover configuration for a channel
   * @param channel Provider type/channel
   * @param config Failover configuration
   * @returns Updated failover configuration
   */
  async updateFailoverConfig(
    channel: ProviderType,
    config: Partial<ProviderFailoverConfig>,
  ): Promise<ProviderFailoverConfig> {
    return this.apiClient.put<ProviderFailoverConfig>(
      `/provider-configs/failover/${channel}`,
      config,
    );
  }

  /**
   * Trigger manual failover for a channel
   * @param channel Provider type/channel
   * @param fromProviderId Current provider ID
   * @param toProviderId Target provider ID
   * @returns Failover result
   */
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

}
