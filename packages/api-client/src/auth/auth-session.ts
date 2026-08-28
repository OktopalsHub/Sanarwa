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
import { AuthOAuthClient } from "./auth-oauth";

export class AuthSessionClient extends AuthOAuthClient {
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
}
