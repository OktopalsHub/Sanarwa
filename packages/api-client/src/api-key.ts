import { ApiClient } from "./client";
import { ApiKeyHelpersClient } from "./api-key/api-key-helpers";

export class ApiKeyApiClient extends ApiKeyHelpersClient {
  constructor(apiClient?: ApiClient) {
    super(apiClient);
  }
}

export const apiKeyApi = new ApiKeyApiClient();
