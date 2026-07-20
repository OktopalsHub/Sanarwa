'use client';

import { TenantProvider } from '@/contexts/tenant-context';
import { useAuth } from '@/contexts/auth-context';
import { useNavigate, useParams } from '@tanstack/react-router';
import { useEffect, type ReactNode } from 'react';

export function TenantLayoutGuard({ children }: { children: ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();
  const navigate = useNavigate();
  const { tenantSlug } = useParams({ strict: false }) as { tenantSlug?: string };

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      navigate({
        to: '/login',
        search: { redirect: `/${tenantSlug ?? ''}/dashboard` },
      });
    }
  }, [isAuthenticated, isLoading, navigate, tenantSlug]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4" />
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) return null;

  return <TenantProvider>{children}</TenantProvider>;
}
