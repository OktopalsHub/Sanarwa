import { useAuth } from "@/contexts/auth-context";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import React from "react";
import { queryKeys } from "../query-client";

export function useCurrentUser() {
  const { user, isLoading } = useAuth();

  return useQuery({
    queryKey: queryKeys.auth.user(),
    queryFn: async () => user,
    enabled: true,
    staleTime: 5 * 60 * 1000,
  });
}

function useLogin() {
  const queryClient = useQueryClient();
  const { login } = useAuth();

  return useMutation({
    mutationFn: (credentials: { email: string; password: string }) => login(credentials),
    onSuccess: (data: any) => {
      if (data?.user) {
        queryClient.setQueryData(queryKeys.auth.user(), data.user);
      }
      void queryClient.invalidateQueries();
    },
  });
}

function useRegister() {
  const queryClient = useQueryClient();
  const { register } = useAuth();

  return useMutation({
    mutationFn: (credentials: {
      email: string;
      password: string;
      name?: string;
      firstName?: string;
      lastName?: string;
    }) => register(credentials),
    onSuccess: (data: any) => {
      if (data?.user) {
        queryClient.setQueryData(queryKeys.auth.user(), data.user);
      }
      void queryClient.invalidateQueries();
    },
  });
}

function useLogout() {
  const queryClient = useQueryClient();
  const { logout } = useAuth();

  return useMutation({
    mutationFn: async () => logout(),
    onSuccess: async () => {
      queryClient.clear();
    },
    onError: async () => {
      queryClient.clear();
    },
  });
}

function usePasswordResetRequest() {
  return useMutation({
    mutationFn: async () => {
      return Promise.resolve();
    },
  });
}

function usePasswordResetConfirm() {
  return useMutation({
    mutationFn: async () => {
      return Promise.resolve();
    },
  });
}

function useEmailVerification() {
  const queryClient = useQueryClient();
  const { refreshUser } = useAuth();

  return useMutation({
    mutationFn: async () => {
      await refreshUser();
      await queryClient.invalidateQueries({ queryKey: queryKeys.auth.user() });
    },
  });
}

function useResendVerificationEmail() {
  const queryClient = useQueryClient();
  const { refreshUser } = useAuth();

  return useMutation({
    mutationFn: async () => {
      await refreshUser();
      await queryClient.invalidateQueries({ queryKey: queryKeys.auth.user() });
    },
  });
}

function useIsAuthenticated() {
  const { user, isLoading } = useAuth();

  return {
    isAuthenticated: !!user,
    isLoading,
    user,
  };
}

function usePermissions(tenantId?: string) {
  return useQuery({
    queryKey: queryKeys.auth.permissions(tenantId),
    queryFn: async () => {
      if (!tenantId) return [] as Array<{ code: string; message: string }>;
      return [] as Array<{ code: string; message: string }>;
    },
    enabled: !!tenantId,
    staleTime: 5 * 60 * 1000,
  });
}

function useRoleBasedAccess(tenantId?: string) {
  const { user } = useAuth();
  const { data: permissions = [] } = usePermissions(tenantId);

  const hasPermission = (permission: string | { code: string; message: string }): boolean => {
    const code = typeof permission === "string" ? permission : permission.code;
    return permissions.some((p) => p.code === code);
  };

  const hasAnyPermission = (
    requiredPermissions: Array<string | { code: string; message: string }>,
  ): boolean => {
    return requiredPermissions.some((permission) => hasPermission(permission));
  };

  const hasAllPermissions = (
    requiredPermissions: Array<string | { code: string; message: string }>,
  ): boolean => {
    return requiredPermissions.every((permission) => hasPermission(permission));
  };

  const canAccess = (
    resource: string,
    action: string,
  ): { hasPermission: boolean; reason?: string } => {
    const permissionKey = `${resource}:${action}`;
    const hasAccess =
      permissions.some((p) => p.code === permissionKey) || user?.role === "super-admin";
    return {
      hasPermission: hasAccess,
      reason: hasAccess ? undefined : `Missing permission: ${permissionKey}`,
    };
  };

  const isOwner = (): boolean => user?.role === "super-admin";
  const isAdmin = (): boolean => user?.role === "super-admin" || user?.role === "developer";
  const canManageMembers = (): boolean => hasPermission("members:write") || isAdmin();
  const canInviteMembers = (): boolean => hasPermission("members:invite") || isAdmin();
  const canManageBilling = (): boolean => hasPermission("billing") || isOwner();

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
    userRole: (user?.role as string | undefined) ?? undefined,
  };
}

function useSession() {
  const { user, refreshUser, isAuthenticated } = useAuth();

  const getTokenInfo = (): { token: string | null; isExpired: boolean } => {
    if (!user) return { token: null, isExpired: true };
    return { token: user.id || null, isExpired: false };
  };

  const isTokenExpired = (): boolean => !isAuthenticated;
  const getTimeUntilExpiry = (): number => 0;

  return {
    refreshSession: refreshUser,
    getTokenInfo,
    isTokenExpired,
    getTimeUntilExpiry,
    isAuthenticated,
  };
}

function useAutoTokenRefresh() {
  const { refreshSession, isTokenExpired } = useSession();
  const { data: user } = useCurrentUser();

  React.useEffect(() => {
    if (!user || isTokenExpired()) return;
    const timeUntilExpiry = 0;
    const refreshThreshold = 5 * 60 * 1000;
    if (timeUntilExpiry <= refreshThreshold) {
      void refreshSession();
      return;
    }
    const timer = setTimeout(() => {
      void refreshSession();
    }, timeUntilExpiry - refreshThreshold);
    return () => clearTimeout(timer);
  }, [user, refreshSession, isTokenExpired]);

  return {
    isRefreshing: false,
    refreshError: null,
  };
}
