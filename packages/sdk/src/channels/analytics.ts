import type { AxiosInstance, AxiosResponse } from "axios";

export interface AnalyticsRange {
  startDate?: string;
  endDate?: string;
}

export class AnalyticsComponent {
  constructor(private readonly client: AxiosInstance) {}

  async getDeliveryMetrics(params?: AnalyticsRange): Promise<unknown> {
    const response: AxiosResponse<unknown> = await this.client.get("/analytics/delivery-rates", {
      params,
    });
    return response.data;
  }

  async getChannelMetrics(params?: AnalyticsRange): Promise<unknown> {
    const response: AxiosResponse<unknown> = await this.client.get("/analytics/channels", {
      params,
    });
    return response.data;
  }

  async getDeliveryTrends(params?: AnalyticsRange): Promise<unknown> {
    const response: AxiosResponse<unknown> = await this.client.get("/analytics/trends", {
      params,
    });
    return response.data;
  }

  async getTimeSeries(params?: AnalyticsRange): Promise<unknown> {
    const response: AxiosResponse<unknown> = await this.client.get("/analytics/time-series", {
      params,
    });
    return response.data;
  }

  async getDashboard(params?: AnalyticsRange): Promise<unknown> {
    const response: AxiosResponse<unknown> = await this.client.get("/analytics/dashboard", {
      params,
    });
    return response.data;
  }

  async getProviders(params?: AnalyticsRange): Promise<unknown> {
    const response: AxiosResponse<unknown> = await this.client.get("/analytics/providers", {
      params,
    });
    return response.data;
  }

  async getABTestResults(testId: string): Promise<unknown> {
    const response: AxiosResponse<unknown> = await this.client.get(
      `/routing-optimizer/ab-test/${testId}`,
    );
    return response.data;
  }
}
