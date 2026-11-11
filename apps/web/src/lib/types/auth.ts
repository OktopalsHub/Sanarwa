enum UserRole {
  SUPER_ADMIN = "super_admin",
  ADMIN = "admin",
  DEVELOPER = "developer",
  BASIC = "basic",
}

enum UserStatus {
  ACTIVE = "active",
  INACTIVE = "inactive",
  SUSPENDED = "suspended",
}

enum AuthProvider {
  LOCAL = "local",
  GOOGLE = "google",
  GITHUB = "github",
}

export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: UserRole;
  status: UserStatus;
  avatar?: string;
  authProvider: AuthProvider;
  emailVerified: boolean;
  passwordResetToken?: string;
  passwordResetExpires?: Date;
  lastLoginAt?: Date;
  lastLoginIp?: string;
  loginAttempts: number;
  lockedUntil?: Date;
  deletedAt?: Date;
  createdAt: Date;
  updatedAt: Date;

  fullName: string;
  isLocked: boolean;
  preferences?: Record<string, any>;

  tenants?: any[];
  members?: any[];
  userRoles?: any[];
  oauthAccounts?: OAuthAccount[];
}

export interface AuthUser extends User {
  name: string;
}

export interface OAuthAccount {
  id: string;
  userId: string;
  provider: AuthProvider;
  providerId: string;
  email?: string;
  accessToken?: string;
  refreshToken?: string;
  expiresAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface LoginCredentials {
  email: string;
  password: string;
  tenantId?: string;
  rememberMe?: boolean;
}

export interface RegisterData {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  authProvider?: AuthProvider;
  googleId?: string;
  githubId?: string;
  avatar?: string;
  confirmPassword?: string;
}

export interface RegisterCredentials extends RegisterData {}

export interface AuthResponse {
  user: User;
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  tokenType: string;
  tenantSlug?: string;
  tenant?: {
    id: string;
    slug?: string;
    subdomain?: string;
    name?: string;
  };
}

export interface TokenResponse {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  tokenType: string;
}

export interface RefreshTokenRequest {
  refreshToken: string;
}

export interface PasswordResetRequest {
  email: string;
}

export interface PasswordResetConfirm {
  token: string;
  password: string;
  confirmPassword: string;
}

export interface ChangePasswordRequest {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}

export interface EmailVerificationRequest {
  token: string;
}

export interface ResendVerificationRequest {
  email: string;
}

export interface OAuthLoginRequest {
  provider: AuthProvider;
  code: string;
  state?: string;
  redirectUri?: string;
}

export interface OAuthUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  avatar?: string;
  provider: AuthProvider;
}

export interface JwtPayload {
  sub: string;
  email: string;
  role: UserRole;
  tenantId?: string;
  permissions?: string[];
  iat: number;
  exp: number;
}

export interface TokenInfo {
  token: string;
  payload: JwtPayload;
  expiresAt: Date;
  isExpired: boolean;
}

export interface SessionInfo {
  id: string;
  userId: string;
  tenantId?: string;
  ipAddress?: string;
  userAgent?: string;
  lastActivity: Date;
  expiresAt: Date;
  isActive: boolean;
}

export interface PermissionCheck {
  hasPermission: boolean;
  reason?: string;
  requiredRole?: UserRole;
  requiredPermissions?: string[];
}

export interface RoleBasedAccess {
  role: UserRole;
  permissions: string[];
  canAccess: (resource: string, action: string) => boolean;
}

export interface AuthError {
  message: string;
  code: string;
  field?: string;
  statusCode?: number;
}

export interface ValidationError {
  field: string;
  message: string;
  code: string;
}

export interface AuthState {
  user: AuthUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: AuthError | null;
  permissions: string[];
  currentTenantId?: string;
  sessionInfo?: SessionInfo;
}

export interface AuthApiResponse<T = any> {
  data: T;
  success: boolean;
  message?: string;
  errors?: ValidationError[];
}

export interface LoginAttempt {
  id: string;
  email: string;
  ipAddress: string;
  userAgent: string;
  success: boolean;
  failureReason?: string;
  timestamp: Date;
}

export interface SecurityEvent {
  id: string;
  userId?: string;
  type: SecurityEventType;
  description: string;
  ipAddress?: string;
  userAgent?: string;
  metadata?: Record<string, any>;
  timestamp: Date;
}

enum SecurityEventType {
  LOGIN_SUCCESS = "login_success",
  LOGIN_FAILURE = "login_failure",
  LOGOUT = "logout",
  PASSWORD_RESET = "password_reset",
  EMAIL_VERIFICATION = "email_verification",
  ACCOUNT_LOCKED = "account_locked",
  ACCOUNT_UNLOCKED = "account_unlocked",
  PERMISSION_DENIED = "permission_denied",
  SUSPICIOUS_ACTIVITY = "suspicious_activity",
}
