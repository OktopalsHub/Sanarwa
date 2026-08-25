"use client";

import { useAuth } from "@/contexts/auth-context";
import { tenantApi } from "@/lib/api/tenant";
import { useNavigate } from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";

interface TenantRouteRedirectProps {
  suffix: string;
  children?: ReactNode;
}

/** Redirects legacy global routes to /{tenantSlug}/{suffix} */
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
      .getTenants()
      .then((tenants) => {
        const first = tenants[0];
        if (first) {
          const slug = first.slug || first.subdomain || first.id;
          navigate({ to: `/${slug}/${suffix}` as any });
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
