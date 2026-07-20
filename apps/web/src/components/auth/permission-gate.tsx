'use client';

import { usePermissions } from '@/hooks/use-permissions';
import { Permission } from '@/lib/types/permissions';
import React from 'react';

interface PermissionGateProps {
  children: React.ReactNode;
  permissions?: Permission[];
  requireAll?: boolean;
  fallback?: React.ReactNode;
  showReason?: boolean;
}

export function PermissionGate({
  children,
  permissions = [],
  requireAll = false,
  fallback = null,
  showReason = false,
}: PermissionGateProps) {
  const { hasAnyPermission, hasAllPermissions } = usePermissions();

  if (permissions.length === 0) {
    return <>{children}</>;
  }

  const permissionCheck = requireAll
    ? hasAllPermissions(permissions)
    : hasAnyPermission(permissions);

  if (!permissionCheck.hasPermission) {
    if (showReason && permissionCheck.reason) {
      return (
        <div className="p-4 text-sm text-muted-foreground bg-muted/50 rounded-md">
          {permissionCheck.reason}
        </div>
      );
    }
    return <>{fallback}</>;
  }

  return <>{children}</>;
}

interface ConditionalRenderProps {
  children: React.ReactNode;
  condition: boolean;
  fallback?: React.ReactNode;
}

export function ConditionalRender({ children, condition, fallback = null }: ConditionalRenderProps) {
  return condition ? <>{children}</> : <>{fallback}</>;
}

// Higher-order component for permission-based rendering
export function withPermissions<P extends object>(
  Component: React.ComponentType<P>,
  requiredPermissions: Permission[],
  requireAll = false
) {
  return function PermissionWrappedComponent(props: P) {
    return (
      <PermissionGate permissions={requiredPermissions} requireAll={requireAll}>
        <Component {...props} />
      </PermissionGate>
    );
  };
}