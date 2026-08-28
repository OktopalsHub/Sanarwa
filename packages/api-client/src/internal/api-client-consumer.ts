import { ApiClient, createApiClient } from "../client";

export class ApiClientConsumer {
  protected apiClient: ApiClient;

  constructor(apiClient?: ApiClient) {
    this.apiClient = apiClient || createApiClient();
  }
}
