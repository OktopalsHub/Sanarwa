"use client";

import { User } from "@/lib/icons";

import { useAuth } from "@/contexts/auth-context";
import { useTenant } from "@/contexts/tenant-context";
import {
  Permission,
  PermissionCheck,
  ROLE_PERMISSIONS,
  type TenantRole,
} from "@/lib/types/permissions";
import { useMemo } from "react";

export function usePermissions() {
  const { user } = useAuth();
  const { currentTenant, myMemberships } = useTenant();

  const currentMembership = useMemo(() => {
    if (!user || !currentTenant) return null;

    return myMemberships.find(
      (membership) =>
        membership.userId === user.id &&
        membership.tenantId === currentTenant.id &&
        (membership.status ?? "active") === "active",
    );
  }, [user, currentTenant, myMemberships]);

  const userRole = useMemo(() => {
    const role = currentMembership?.role;
    return role && role in ROLE_PERMISSIONS ? (role as TenantRole) : null;
  }, [currentMembership]);

  const userPermissions = useMemo(() => {
    if (!userRole) return [];

    return Array.from(new Set(ROLE_PERMISSIONS[userRole].permissions));
  }, [userRole]);

  const hasPermission = (permission: Permission): PermissionCheck => {
    if (!user) {
      return { hasPermission: false, reason: "User not authenticated" };
    }

    if (!currentTenant) {
      return { hasPermission: false, reason: "No tenant selected" };
    }

    if (!currentMembership) {
      return { hasPermission: false, reason: "User is not a member of this tenant" };
    }

    if (currentMembership.status !== "active") {
      return { hasPermission: false, reason: "User membership is not active" };
    }

    if (userPermissions.includes("admin")) {
      return { hasPermission: true };
    }

    if (userPermissions.includes(permission)) {
      return { hasPermission: true };
    }

    return { hasPermission: false, reason: `Missing permission: ${permission}` };
  };

  const hasAnyPermission = (permissions: Permission[]): PermissionCheck => {
    if (!user) {
      return { hasPermission: false, reason: "User not authenticated" };
    }

    if (!currentTenant) {
      return { hasPermission: false, reason: "No tenant selected" };
    }

    if (!currentMembership) {
      return { hasPermission: false, reason: "User is not a member of this tenant" };
    }

    if (currentMembership.status !== "active") {
      return { hasPermission: false, reason: "User membership is not active" };
    }

    if (userPermissions.includes("admin")) {
      return { hasPermission: true };
    }

    const hasAny = permissions.some((permission) => userPermissions.includes(permission));

    if (hasAny) {
      return { hasPermission: true };
    }

    return {
      hasPermission: false,
      reason: `Missing any of permissions: ${permissions.join(", ")}`,
    };
  };

  const hasAllPermissions = (permissions: Permission[]): PermissionCheck => {
    if (!user) {
      return { hasPermission: false, reason: "User not authenticated" };
    }

    if (!currentTenant) {
      return { hasPermission: false, reason: "No tenant selected" };
    }

    if (!currentMembership) {
      return { hasPermission: false, reason: "User is not a member of this tenant" };
    }

    if (currentMembership.status !== "active") {
      return { hasPermission: false, reason: "User membership is not active" };
    }

    if (userPermissions.includes("admin")) {
      return { hasPermission: true };
    }

    const missingPermissions = permissions.filter(
      (permission) => !userPermissions.includes(permission),
    );

    if (missingPermissions.length === 0) {
      return { hasPermission: true };
    }

    return {
      hasPermission: false,
      reason: `Missing permissions: ${missingPermissions.join(", ")}`,
    };
  };

  const canAccessRoute = (routePermissions: Permission[]): PermissionCheck => {
    return hasAnyPermission(routePermissions);
  };

  return {
    user,
    currentTenant,
    currentMembership,
    userRole,
    userPermissions,
    hasPermission,
    hasAnyPermission,
    hasAllPermissions,
    canAccessRoute,
    isOwner: userRole === "owner",
    isAdmin: userRole === "admin" || userRole === "owner",
    isManager: ["manager", "admin", "owner"].includes(userRole || ""),
    isMember: ["member", "manager", "admin", "owner"].includes(userRole || ""),
  };
}
