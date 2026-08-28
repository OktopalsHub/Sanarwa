import { ApiClient } from "./client";
import { AnalyticsInsightsClient } from "./analytics/analytics-insights";

export class AnalyticsApiClient extends AnalyticsInsightsClient {
  constructor(apiClient?: ApiClient) {
    super(apiClient);
  }
}

export const analyticsApi = new AnalyticsApiClient();
