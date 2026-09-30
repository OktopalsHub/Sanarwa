import { authApi } from "@/lib/api/auth";
import type {
  AuthResponse,
  EmailVerificationRequest,
  JwtPayload,
  LoginCredentials,
  PasswordResetConfirm,
  PasswordResetRequest,
  RegisterCredentials,
} from "@/lib/types/auth";
import { UserRole } from "@/lib/types/auth";
import type { Permission, PermissionCheck, TenantRole } from "@/lib/types/permissions";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import React from "react";
import { invalidateQueries, queryKeys } from "../query-client";

// Query hook for current user
export function useCurrentUser() {
  return useQuery({
    queryKey: queryKeys.auth.user(),
    queryFn: () => authApi.getCurrentUser(),
    staleTime: 5 * 60 * 1000, // 5 minutes
    retry: (failureCount, error: any) => {
      // Don't retry on 401 (unauthorized) - user needs to login
      if (error?.status === 401) {
        return false;
      }
      return failureCount < 3;
    },
  });
}

// Mutation hook for login
export function useLogin() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (credentials: LoginCredentials) => authApi.login(credentials),
    onSuccess: (data: AuthResponse) => {
      // Update user data in cache
      if (data.user) {
        queryClient.setQueryData(queryKeys.auth.user(), data.user);
      }
      // Invalidate all queries to refresh data with new auth context
      queryClient.invalidateQueries();
    },
    onError: (error) => {
      console.error("Login failed:", error);
    },
  });
}

// Mutation hook for registration
export function useRegister() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (credentials: RegisterCredentials) => authApi.register(credentials),
    onSuccess: (data: AuthResponse) => {
      // Update user data in cache
      if (data.user) {
        queryClient.setQueryData(queryKeys.auth.user(), data.user);
      }
      // Invalidate all queries to refresh data with new auth context
      queryClient.invalidateQueries();
    },
    onError: (error) => {
      console.error("Registration failed:", error);
    },
  });
}

// Mutation hook for logout
export function useLogout() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => authApi.logout(),
    onSuccess: () => {
      // Clear all cached data
      queryClient.clear();
      // Redirect to login page
      if (typeof window !== "undefined") {
        window.location.href = "/login";
      }
    },
    onError: (error) => {
      console.error("Logout failed:", error);
      // Even if logout fails on server, clear local cache
      queryClient.clear();
      if (typeof window !== "undefined") {
        window.location.href = "/login";
      }
    },
  });
}

// Mutation hook for password reset request
export function usePasswordResetRequest() {
  return useMutation({
    mutationFn: (data: PasswordResetRequest) => authApi.requestPasswordReset(data),
    onError: (error) => {
      console.error("Password reset request failed:", error);
    },
  });
}

// Mutation hook for password reset confirmation
export function usePasswordResetConfirm() {
  return useMutation({
    mutationFn: (data: PasswordResetConfirm) => authApi.confirmPasswordReset(data),
    onError: (error) => {
      console.error("Password reset confirmation failed:", error);
    },
  });
}

// Mutation hook for email verification
export function useEmailVerification() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: EmailVerificationRequest) => authApi.verifyEmail(data),
    onSuccess: () => {
      // Refresh user data to get updated verification status
      invalidateQueries.auth();
    },
    onError: (error) => {
      console.error("Email verification failed:", error);
    },
  });
}

// Mutation hook for resending verification email
export function useResendVerificationEmail() {
  return useMutation({
    mutationFn: () => authApi.resendVerificationEmail(),
    onError: (error) => {
      console.error("Resend verification email failed:", error);
    },
  });
}

// Hook to check if user is authenticated
export function useIsAuthenticated() {
  const { data: user, isLoading, error } = useCurrentUser();

  return {
    isAuthenticated: !!user && !error,
    isLoading,
    user,
  };
}

// Query hook for user permissions in a specific tenant
export function usePermissions(tenantId?: string) {
  return useQuery({
    queryKey: queryKeys.auth.permissions(tenantId),
    queryFn: async () => {
      // Get user's role and permissions for the tenant
      // This would typically come from the backend
      const user = await authApi.getCurrentUser();
      if (!user || !tenantId) return [];

      // For now, return permissions based on user role
      // In a real implementation, this would fetch from backend
      const userRole = user.role as TenantRole;
      // TODO: Implement role permissions mapping
      const defaultPermissions: Permission[] = [];
      return defaultPermissions;
    },
    enabled: !!tenantId,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

// Hook for role-based access control
export function useRoleBasedAccess(tenantId?: string) {
  const { data: user } = useCurrentUser();
  const { data: permissions = [] } = usePermissions(tenantId);

  const hasPermission = (permission: Permission): boolean => {
    return permissions.includes(permission);
  };

  const hasAnyPermission = (requiredPermissions: Permission[]): boolean => {
    return requiredPermissions.some((permission) => permissions.includes(permission));
  };

  const hasAllPermissions = (requiredPermissions: Permission[]): boolean => {
    return requiredPermissions.every((permission) => permissions.includes(permission));
  };

  const canAccess = (resource: string, action: string): PermissionCheck => {
    const permissionKey = `${resource}:${action}` as Permission;
    const hasAccess = hasPermission(permissionKey) || hasPermission("admin");

    return {
      hasPermission: hasAccess,
      reason: hasAccess ? undefined : `Missing permission: ${permissionKey}`,
    };
  };

  const isOwner = (): boolean => {
    return user?.role === UserRole.SUPER_ADMIN;
  };

  const isAdmin = (): boolean => {
    return user?.role === UserRole.SUPER_ADMIN || user?.role === UserRole.DEVELOPER;
  };

  const canManageMembers = (): boolean => {
    return hasPermission("members:write") || hasPermission("admin");
  };

  const canInviteMembers = (): boolean => {
    return hasPermission("members:invite") || hasPermission("admin");
  };

  const canManageBilling = (): boolean => {
    return hasPermission("billing") || isOwner();
  };

  return {
    permissions,
    hasPermission,
    hasAnyPermission,
    hasAllPermissions,
    canAccess,
    isOwner,
    isAdmin,
    canManageMembers,
    canInviteMembers,
    canManageBilling,
    userRole: user?.role as TenantRole,
  };
}

// Hook for session management
export function useSession() {
  const queryClient = useQueryClient();

  const refreshSession = useMutation({
    mutationFn: () => authApi.refreshToken(),
    onSuccess: (tokenResponse) => {
      // Update token in storage
      authApi.setAuthToken(tokenResponse.accessToken);
      if (tokenResponse.refreshToken) {
        authApi.setRefreshToken(tokenResponse.refreshToken);
      }
      // Invalidate user query to refresh with new token
      invalidateQueries.auth();
    },
    onError: (error) => {
      console.error("Session refresh failed:", error);
      // Clear tokens and redirect to login
      authApi.clearTokens();
      if (typeof window !== "undefined") {
        window.location.href = "/login";
      }
    },
  });

  const getTokenInfo = (): { token: string | null; isExpired: boolean } => {
    const token = authApi.getAccessToken();
    if (!token) return { token: null, isExpired: true };

    try {
      // Decode JWT to check expiration
      const tokenPart = token.split(".")[1];
      if (!tokenPart) return { token, isExpired: true };
      const payload = JSON.parse(atob(tokenPart)) as JwtPayload;
      const isExpired = Date.now() >= payload.exp * 1000;
      return { token, isExpired };
    } catch {
      return { token, isExpired: true };
    }
  };

  const isTokenExpired = (): boolean => {
    return getTokenInfo().isExpired;
  };

  const getTimeUntilExpiry = (): number => {
    const token = authApi.getAccessToken();
    if (!token) return 0;

    try {
      const tokenPart = token.split(".")[1];
      if (!tokenPart) return 0;
      const payload = JSON.parse(atob(tokenPart)) as JwtPayload;
      return Math.max(0, payload.exp * 1000 - Date.now());
    } catch {
      return 0;
    }
  };

  return {
    refreshSession,
    getTokenInfo,
    isTokenExpired,
    getTimeUntilExpiry,
    isAuthenticated: authApi.isAuthenticated(),
  };
}

// Hook for automatic token refresh
export function useAutoTokenRefresh() {
  const { refreshSession, getTimeUntilExpiry, isTokenExpired } = useSession();
  const { data: user } = useCurrentUser();

  React.useEffect(() => {
    if (!user || isTokenExpired()) return;

    const timeUntilExpiry = getTimeUntilExpiry();
    const refreshThreshold = 5 * 60 * 1000; // 5 minutes before expiry

    if (timeUntilExpiry <= refreshThreshold) {
      // Token expires soon, refresh immediately
      refreshSession.mutate();
      return;
    }

    // Set timer to refresh token before it expires
    const refreshTime = timeUntilExpiry - refreshThreshold;
    const timer = setTimeout(() => {
      refreshSession.mutate();
    }, refreshTime);

    return () => clearTimeout(timer);
  }, [user, refreshSession, getTimeUntilExpiry, isTokenExpired]);

  return {
    isRefreshing: refreshSession.isPending,
    refreshError: refreshSession.error,
  };
}
