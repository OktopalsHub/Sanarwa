import type { AxiosInstance, AxiosResponse } from "axios";

export class AnalyticsComponent {
  constructor(private client: AxiosInstance) {}

  /**
   * Get delivery metrics
   */
  async getDeliveryMetrics(params?: { startDate?: string; endDate?: string }): Promise<any> {
    const response: AxiosResponse<any> = await this.client.get("/analytics/delivery-metrics", {
      params,
    });
    return response.data;
  }

  /**
   * Get channel metrics
   */
  async getChannelMetrics(params?: { startDate?: string; endDate?: string }): Promise<any> {
    const response: AxiosResponse<any> = await this.client.get("/analytics/channel-metrics", {
      params,
    });
    return response.data;
  }

  /**
   * Get engagement metrics
   */
  async getEngagementMetrics(params?: { startDate?: string; endDate?: string }): Promise<any> {
    const response: AxiosResponse<any> = await this.client.get("/analytics/engagement-metrics", {
      params,
    });
    return response.data;
  }

  /**
   * Get subscriber engagement scores
   */
  async getSubscriberEngagement(params?: { limit?: number }): Promise<any> {
    const response: AxiosResponse<any> = await this.client.get("/analytics/subscriber-engagement", {
      params,
    });
    return response.data;
  }

  /**
   * Get delivery trends
   */
  async getDeliveryTrends(params?: { days?: number }): Promise<any> {
    const response: AxiosResponse<any> = await this.client.get("/analytics/delivery-trends", {
      params,
    });
    return response.data;
  }

  /**
   * Get A/B test results
   */
  async getABTestResults(testId: string): Promise<any> {
    const response: AxiosResponse<any> = await this.client.get(`/analytics/ab-tests/${testId}`);
    return response.data;
  }
}
