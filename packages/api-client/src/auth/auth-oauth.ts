import {
  AuthResponse,
  ChangePasswordRequest,
  EmailVerificationRequest,
  LoginCredentials,
  OAuthLoginRequest,
  PasswordResetConfirm,
  PasswordResetRequest,
  RegisterData,
  TokenResponse,
  User,
} from "../types/auth";
import { ApiClientConsumer } from "../internal/api-client-consumer";
import { RawAuthPayload, toAuthResponse } from "./auth-mappers";
import { AuthEmailClient } from "./auth-email";

export class AuthOAuthClient extends AuthEmailClient {
  // OAuth Methods

  /**
   * Get OAuth authorization URL for provider
   * @param provider OAuth provider name (google, github)
   * @returns Authorization URL to redirect user to
   */
  getOAuthUrl(provider: "google" | "github"): string {
    const baseUrl = this.apiClient["axiosInstance"].defaults.baseURL;
    return `${baseUrl}/auth/oauth/${provider}`;
  }

  /**
   * Handle OAuth callback and exchange code for tokens
   * @param data OAuth login request data
   * @returns Authentication response
   */
  async handleOAuthCallback(data: OAuthLoginRequest): Promise<AuthResponse> {
    // OAuth callback is handled by backend redirect, this is for manual handling if needed
    const response = await this.apiClient.post<{ access_token: string; user?: User }>(
      `/auth/oauth/${data.provider}/callback`,
      {
        code: data.code,
        state: data.state,
        redirectUri: data.redirectUri,
      },
      { tenantScoped: false },
    );

    const authResponse: AuthResponse = {
      user: response.user || ({} as User),
      accessToken: response.access_token,
      refreshToken: "",
      expiresIn: 3600,
      tokenType: "Bearer",
    };

    // Store tokens after successful OAuth login
    if (authResponse.accessToken) {
      this.apiClient.setAuthToken(authResponse.accessToken);
    }

    return authResponse;
  }
}
