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
import { AuthPasswordClient } from "./auth-password";

export class AuthEmailClient extends AuthPasswordClient {
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
}
