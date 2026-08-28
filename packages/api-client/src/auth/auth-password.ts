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
import { AuthCoreClient } from "./auth-core";

export class AuthPasswordClient extends AuthCoreClient {
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
}
