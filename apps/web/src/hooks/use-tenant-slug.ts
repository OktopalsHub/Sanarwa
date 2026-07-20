'use client';

import { apiClient } from '@/lib/api/client';
import { useTenant } from '@/contexts/tenant-context';
import { useParams } from '@tanstack/react-router';
import { useEffect, useMemo } from 'react';

export function useTenantSlug(): string | undefined {
  const params = useParams({ strict: false }) as { tenantSlug?: string };
  return params.tenantSlug;
}

export function useTenantBasePath(): string {
  const slug = useTenantSlug();
  const { selectedTenant } = useTenant();
  const resolved =
    slug ||
    selectedTenant?.subdomain ||
    selectedTenant?.slug ||
    selectedTenant?.id ||
    '';
  return resolved ? `/${resolved}` : '';
}

export function useEnsureTenantFromSlug() {
  const tenantSlug = useTenantSlug();
  const { tenants, selectedTenant, switchTenant, isLoading } = useTenant();

  const matchedTenant = useMemo(() => {
    if (!tenantSlug) return null;
    return tenants.find(
      (t) =>
        t.slug === tenantSlug ||
        t.subdomain === tenantSlug ||
        t.id === tenantSlug,
    );
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

  return { tenantSlug, matchedTenant, isLoading };
}
