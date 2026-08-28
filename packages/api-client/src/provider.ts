import { ApiClient } from "./client";
import { ProviderHelpersClient } from "./provider/provider-helpers";

export class ProviderApiClient extends ProviderHelpersClient {
  constructor(apiClient?: ApiClient) {
    super(apiClient);
  }
}

export const providerApi = new ProviderApiClient();
