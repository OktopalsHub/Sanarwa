"use client";

import { apiClient } from "@/lib/api/client";
import { getTenantPathSegment, matchesTenantPathSegment } from "@/lib/tenant-path";
import { useTenant } from "@/contexts/tenant-context";
import { useNavigate, useParams } from "@tanstack/react-router";
import { useEffect, useMemo } from "react";

export function useTenantSlug(): string | undefined {
  const params = useParams({ strict: false }) as { tenantSlug?: string };
  return params.tenantSlug;
}

export function useTenantBasePath(): string {
  const { selectedTenant } = useTenant();
  const segment = selectedTenant ? getTenantPathSegment(selectedTenant) : useTenantSlug() || "";
  return segment ? `/${segment}` : "";
}

export function useEnsureTenantFromSlug() {
  const tenantSlug = useTenantSlug();
  const navigate = useNavigate();
  const { tenants, selectedTenant, switchTenant, isLoading } = useTenant();

  const matchedTenant = useMemo(() => {
    if (!tenantSlug) return null;
    return tenants.find((t) => matchesTenantPathSegment(t, tenantSlug)) ?? null;
  }, [tenantSlug, tenants]);

  useEffect(() => {
    if (!matchedTenant || isLoading) return;
    if (!selectedTenant || selectedTenant.id !== matchedTenant.id) {
      apiClient.setTenant(matchedTenant.id);
      switchTenant(matchedTenant.id).catch(console.error);
    } else {
      apiClient.setTenant(matchedTenant.id);
    }
  }, [matchedTenant, selectedTenant, switchTenant, isLoading]);

  useEffect(() => {
    if (!matchedTenant || !tenantSlug || isLoading) return;
    const canonical = getTenantPathSegment(matchedTenant);
    if (canonical && tenantSlug !== canonical) {
      const rest = window.location.pathname.replace(`/${tenantSlug}`, "") || "/dashboard";
      navigate({ to: `/${canonical}${rest}` as any, replace: true });
    }
  }, [matchedTenant, tenantSlug, isLoading, navigate]);

  return { tenantSlug, matchedTenant, isLoading };
}
