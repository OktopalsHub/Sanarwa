"use client";

import { useAuth } from "@/contexts/auth-context";
import { tenantApi } from "@/lib/api/tenant";
import { getTenantPathSegment } from "@/lib/tenant-path";
import { useNavigate } from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";

interface TenantRouteRedirectProps {
  suffix: string;
  children?: ReactNode;
}

/** Redirects legacy global routes to /{subdomain}/{suffix} */
export function TenantRouteRedirect({ suffix, children }: TenantRouteRedirectProps) {
  const navigate = useNavigate();
  const { isAuthenticated, isLoading } = useAuth();

  useEffect(() => {
    if (isLoading) return;

    if (!isAuthenticated) {
      navigate({ to: "/login", search: { redirect: `/${suffix}` } });
      return;
    }

    tenantApi
      .getMyTenants({ limit: 50 })
      .then((tenants) => {
        const first = tenants[0];
        if (first) {
          navigate({ to: `/${getTenantPathSegment(first)}/${suffix}` as any });
        } else {
          navigate({ to: "/onboarding" });
        }
      })
      .catch(() => navigate({ to: "/onboarding" }));
  }, [isAuthenticated, isLoading, navigate, suffix]);

  if (children) return <>{children}</>;

  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
    </div>
  );
}
