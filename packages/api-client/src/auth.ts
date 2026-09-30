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
} from "./types/auth";
import { ApiClient, createApiClient } from "./client";

type RawAuthPayload = {
  accessToken?: string;
  access_token?: string;
  refreshToken?: string;
  refresh_token?: string;
  user?: User & { name?: string; firstName?: string; lastName?: string };
  id?: string;
  email?: string;
  name?: string;
  tenant?: AuthResponse["tenant"];
  tenantSlug?: string;
};

function pickTokens(raw: RawAuthPayload) {
  return {
    accessToken: raw.accessToken || raw.access_token || "",
    refreshToken: raw.refreshToken || raw.refresh_token || "",
  };
}

function toAuthUser(raw: RawAuthPayload): User {
  if (raw.user) {
    const nameParts = (raw.user.name || "").split(" ");
    return {
      ...raw.user,
      firstName: raw.user.firstName || nameParts[0] || "User",
      lastName: raw.user.lastName || nameParts.slice(1).join(" ") || "Account",
    } as User;
  }

  const nameParts = (raw.name || "").split(" ");
  return {
    id: raw.id || "",
    email: raw.email || "",
    firstName: nameParts[0] || "User",
    lastName: nameParts.slice(1).join(" ") || "Account",
    name: raw.name || "",
  } as unknown as User;
}

function toAuthResponse(raw: RawAuthPayload): AuthResponse {
  const tokens = pickTokens(raw);
  return {
    user: toAuthUser(raw),
    accessToken: tokens.accessToken,
    refreshToken: tokens.refreshToken,
    expiresIn: 3600,
    tokenType: "Bearer",
    tenant: raw.tenant,
    tenantSlug: raw.tenantSlug || raw.tenant?.subdomain || raw.tenant?.slug,
  };
}

/**
 * Authentication API client for handling all auth-related operations
 * Implements login, register, logout, password reset, email verification, and OAuth flows
 */
class AuthApiClient {
  private apiClient: ApiClient;

  constructor(apiClient?: ApiClient) {
    // Use provided client or create a new one configured for auth (no tenant scoping)
    this.apiClient = apiClient || createApiClient();
  }

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

    const response = await this.apiClient.post<RawAuthPayload>(
      "/auth/refresh-token",
      { refreshToken },
      { tenantScoped: false },
    );

    const tokens = pickTokens(response);
    const tokenResponse: TokenResponse = {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
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
    const profile = await this.apiClient.get<
      User & { name?: string; firstName?: string; lastName?: string }
    >("/auth/profile", {}, { tenantScoped: false });

    if (profile.firstName && profile.lastName) {
      return profile;
    }

    const nameParts = (profile.name || "").trim().split(/\s+/);
    return {
      ...profile,
      firstName: profile.firstName || nameParts[0] || "User",
      lastName: profile.lastName || nameParts.slice(1).join(" ") || "Account",
    } as User;
  }

  // Password Management Methods

  /**
   * Request password reset email
   * @param data Password reset request data (email)
   */
  async requestPasswordReset(data: PasswordResetRequest): Promise<void> {
    return this.apiClient.post<void>("/auth/forgot-password", data, { tenantScoped: false });
  }

  /**
   * Confirm password reset with token
   * @param data Password reset confirmation data (token, new password)
   */
  async confirmPasswordReset(data: PasswordResetConfirm): Promise<void> {
    return this.apiClient.post<void>(
      "/auth/reset-password",
      {
        token: data.token,
        newPassword: data.password,
      },
      { tenantScoped: false },
    );
  }

  /**
   * Change current user's password
   * @param data Change password request data
   */
  async changePassword(data: ChangePasswordRequest): Promise<void> {
    return this.apiClient.put<void>("/auth/change-password", data, { tenantScoped: false });
  }

  // Email Verification Methods

  /**
   * Verify email address with token
   * @param data Email verification data (token)
   */
  async verifyEmail(data: EmailVerificationRequest): Promise<void> {
    // Note: Backend doesn't have verify-email endpoint implemented yet
    return this.apiClient.post<void>("/auth/verify-email", data, { tenantScoped: false });
  }

  /**
   * Resend email verification email
   */
  async resendVerificationEmail(): Promise<void> {
    // Note: Backend doesn't have resend verification endpoint implemented yet
    return this.apiClient.post<void>("/auth/verify-email/resend", {}, { tenantScoped: false });
  }

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

  // Session Management Methods

  /**
   * Check if user is currently authenticated
   * @returns True if user has valid token
   */
  isAuthenticated(): boolean {
    const token = this.apiClient["tokenStorage"].getAccessToken();
    return !!token;
  }

  /**
   * Get current access token
   * @returns Current access token or null
   */
  getAccessToken(): string | null {
    return this.apiClient["tokenStorage"].getAccessToken();
  }

  /**
   * Get current refresh token
   * @returns Current refresh token or null
   */
  getRefreshToken(): string | null {
    return this.apiClient["tokenStorage"].getRefreshToken();
  }

  /**
   * Clear all stored authentication tokens
   */
  clearTokens(): void {
    this.apiClient.clearTokens();
  }

  // Utility Methods

  /**
   * Set authentication token manually
   * @param token JWT access token
   */
  setAuthToken(token: string): void {
    this.apiClient.setAuthToken(token);
  }

  /**
   * Set refresh token manually
   * @param token JWT refresh token
   */
  setRefreshToken(token: string): void {
    this.apiClient.setRefreshToken(token);
  }
}

export { AuthApiClient };
export const authApi = new AuthApiClient();
