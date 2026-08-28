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
export class AuthCoreClient extends ApiClientConsumer {
  // Core Authentication Methods

  /**
   * Authenticate user with email and password
   * @param credentials Login credentials (email, password, optional tenantId)
   * @returns Authentication response with user data and tokens
   */
  async login(credentials: LoginCredentials): Promise<AuthResponse> {
    const loginData = {
      email: credentials.email,
      password: credentials.password,
      ...(credentials.tenantId && { tenantId: credentials.tenantId }),
    };

    const response = await this.apiClient.post<RawAuthPayload>("/auth/login", loginData, {
      tenantScoped: false,
    });

    const authResponse = toAuthResponse(response);

    // Store tokens after successful login
    if (authResponse.accessToken) {
      this.apiClient.setAuthToken(authResponse.accessToken);
    }
    if (authResponse.refreshToken) {
      this.apiClient.setRefreshToken(authResponse.refreshToken);
    }

    return authResponse;
  }

  /**
   * Register new user account
   * @param userData Registration data (email, password, firstName, lastName, etc.)
   * @returns Authentication response with user data and tokens
   */
  async register(userData: RegisterData): Promise<AuthResponse> {
    const registerData = {
      email: userData.email,
      password: userData.password,
      name: [userData.firstName, userData.lastName].filter(Boolean).join(" ").trim() || undefined,
      ...(userData.authProvider && { authProvider: userData.authProvider }),
      ...(userData.googleId && { googleId: userData.googleId }),
      ...(userData.githubId && { githubId: userData.githubId }),
      ...(userData.avatar && { avatar: userData.avatar }),
    };

    const response = await this.apiClient.post<RawAuthPayload>("/auth/register", registerData, {
      tenantScoped: false,
    });

    const authResponse = toAuthResponse(response);

    // Store tokens after successful registration
    if (authResponse.accessToken) {
      this.apiClient.setAuthToken(authResponse.accessToken);
    }
    if (authResponse.refreshToken) {
      this.apiClient.setRefreshToken(authResponse.refreshToken);
    }

    return authResponse;
  }

  /**
   * Logout current user and clear tokens
   */
  async logout(): Promise<void> {
    try {
      // Note: Backend doesn't have logout endpoint implemented yet
      // await this.apiClient.post<void>('/auth/logout', {}, { tenantScoped: false });
    } finally {
      // Always clear tokens, even if logout request fails
      this.apiClient.clearTokens();
    }
  }

  /**
   * Refresh authentication token
   * @returns New token response
   */
  async refreshToken(): Promise<TokenResponse> {
    const refreshToken = this.apiClient["tokenStorage"].getRefreshToken();

    if (!refreshToken) {
      throw new Error("No refresh token available");
    }

    const response = await this.apiClient.post<{ access_token: string; refresh_token: string }>(
      "/auth/refresh",
      { refreshToken },
      { tenantScoped: false },
    );

    const tokenResponse: TokenResponse = {
      accessToken: response.access_token,
      refreshToken: response.refresh_token,
      expiresIn: 3600,
      tokenType: "Bearer",
    };

    // Update stored tokens
    if (tokenResponse.accessToken) {
      this.apiClient.setAuthToken(tokenResponse.accessToken);
    }
    if (tokenResponse.refreshToken) {
      this.apiClient.setRefreshToken(tokenResponse.refreshToken);
    }

    return tokenResponse;
  }

  /**
   * Get current authenticated user profile
   * @returns Current user data
   */
  async getCurrentUser(): Promise<User> {
    // Backend has profile endpoint implemented
    return this.apiClient.get<User>("/auth/profile", {}, { tenantScoped: false });
  }
}
