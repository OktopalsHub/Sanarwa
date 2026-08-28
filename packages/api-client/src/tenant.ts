import { ApiClient } from "./client";
import { TenantHelpersClient } from "./tenant/tenant-helpers";

export class TenantApiClient extends TenantHelpersClient {
  constructor(apiClient?: ApiClient) {
    super(apiClient);
  }
}

export const tenantApi = new TenantApiClient();
