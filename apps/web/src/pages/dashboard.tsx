'use client';

import { AppShell } from '@/components/layout';
import { useAuth } from '@/contexts/auth-context';
import { TenantProvider, useTenant } from '@/contexts/tenant-context';
import { useRouter } from '@/compat/next-navigation';
import { useEffect } from 'react';

function DashboardContent() {
  const { isAuthenticated } = useAuth();
  const { tenants, isLoading } = useTenant();
  const router = useRouter();

  useEffect(() => {
    if (!isAuthenticated) {
      router.push('/login');
      return;
    }

    // If user has tenants, redirect to first tenant's dashboard
    if (!isLoading && tenants.length > 0) {
      const firstTenant = tenants[0];
      if (firstTenant) {
        const tenantSlug = firstTenant.slug || firstTenant.subdomain || firstTenant.id;
        router.push(`/${tenantSlug}/dashboard`);
      }
    }
  }, [isAuthenticated, tenants, isLoading, router]);

  if (!isAuthenticated || isLoading) {
    return (
      <AppShell>
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-muted-foreground">Loading...</p>
          </div>
        </div>
      </AppShell>
    );
  }

  // Show general dashboard if no tenants
  return (
    <AppShell>
      <div className="p-6">
        <div className="max-w-7xl mx-auto space-y-6">
          <div className="space-y-2">
            <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
              Dashboard
            </h1>
            <p className="text-muted-foreground">
              Welcome! Create your first tenant to get started with notifications.
            </p>
          </div>

          <div className="text-center py-12">
            <h2 className="text-xl font-semibold mb-4">No Tenants Found</h2>
            <p className="text-muted-foreground mb-6">
              Create your first tenant to start managing notifications.
            </p>
            <button
              onClick={() => router.push('/onboarding')}
              className="px-6 py-3 bg-primary text-primary-foreground rounded-md hover:bg-primary/90"
            >
              Create Tenant
            </button>
          </div>
        </div>
      </div>
    </AppShell>
  );
}

export default function DashboardPage() {
  return (
    <TenantProvider>
      <DashboardContent />
    </TenantProvider>
  );
}