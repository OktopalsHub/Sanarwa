import { ApiClient } from "./client";
import { AuthHelpersClient } from "./auth/auth-helpers";

export class AuthApiClient extends AuthHelpersClient {
  constructor(apiClient?: ApiClient) {
    super(apiClient);
  }
}

export const authApi = new AuthApiClient();
