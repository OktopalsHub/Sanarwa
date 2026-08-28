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
import { AuthSessionClient } from "./auth-session";

export class AuthHelpersClient extends AuthSessionClient {
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
