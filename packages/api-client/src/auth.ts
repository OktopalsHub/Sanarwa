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
import { ApiClient, apiClient as sharedApiClient } from "./client";

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

class AuthApiClient {
  private apiClient: ApiClient;

  constructor(apiClient?: ApiClient) {
    this.apiClient = apiClient ?? sharedApiClient;
  }

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

    if (authResponse.accessToken) {
      this.apiClient.setAuthToken(authResponse.accessToken);
    }
    if (authResponse.refreshToken) {
      this.apiClient.setRefreshToken(authResponse.refreshToken);
    }

    return authResponse;
  }

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

    if (authResponse.accessToken) {
      this.apiClient.setAuthToken(authResponse.accessToken);
    }
    if (authResponse.refreshToken) {
      this.apiClient.setRefreshToken(authResponse.refreshToken);
    }

    return authResponse;
  }

  async logout(): Promise<void> {
    try {
    } finally {
      this.apiClient.clearTokens();
    }
  }

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

    if (tokenResponse.accessToken) {
      this.apiClient.setAuthToken(tokenResponse.accessToken);
    }
    if (tokenResponse.refreshToken) {
      this.apiClient.setRefreshToken(tokenResponse.refreshToken);
    }

    return tokenResponse;
  }

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

  async requestPasswordReset(data: PasswordResetRequest): Promise<void> {
    return this.apiClient.post<void>("/auth/forgot-password", data, { tenantScoped: false });
  }

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

  async changePassword(data: ChangePasswordRequest): Promise<void> {
    return this.apiClient.put<void>("/auth/change-password", data, { tenantScoped: false });
  }

  async verifyEmail(data: EmailVerificationRequest): Promise<void> {
    return this.apiClient.post<void>("/auth/verify-email", data, { tenantScoped: false });
  }

  async resendVerificationEmail(): Promise<void> {
    return this.apiClient.post<void>("/auth/verify-email/resend", {}, { tenantScoped: false });
  }

  getOAuthUrl(provider: "google" | "github"): string {
    const baseUrl = this.apiClient["axiosInstance"].defaults.baseURL;
    return `${baseUrl}/auth/oauth/${provider}`;
  }

  async handleOAuthCallback(data: OAuthLoginRequest): Promise<AuthResponse> {
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

    if (authResponse.accessToken) {
      this.apiClient.setAuthToken(authResponse.accessToken);
    }

    return authResponse;
  }

  isAuthenticated(): boolean {
    const token = this.apiClient["tokenStorage"].getAccessToken();
    return !!token;
  }

  getAccessToken(): string | null {
    return this.apiClient["tokenStorage"].getAccessToken();
  }

  getRefreshToken(): string | null {
    return this.apiClient["tokenStorage"].getRefreshToken();
  }

  clearTokens(): void {
    this.apiClient.clearTokens();
  }

  setAuthToken(token: string): void {
    this.apiClient.setAuthToken(token);
  }

  setRefreshToken(token: string): void {
    this.apiClient.setRefreshToken(token);
  }
}

export const authApi = new AuthApiClient();
