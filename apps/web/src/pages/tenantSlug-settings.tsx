'use client';

import { AppShell } from '@/components/layout';
import { useEnsureTenantFromSlug } from '@/hooks/use-tenant-slug';
import { useTenant } from '@/contexts/tenant-context';

export default function TenantSettingsPage() {
  const { matchedTenant, isLoading } = useEnsureTenantFromSlug();
  const { selectedTenant } = useTenant();
  const tenant = selectedTenant || matchedTenant;

  if (isLoading) {
    return (
      <AppShell>
        <div className="flex items-center justify-center min-h-screen">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto" />
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="p-6 max-w-3xl mx-auto space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
          <p className="text-muted-foreground">Workspace settings for {tenant?.name}</p>
        </div>
        <p className="text-sm text-muted-foreground">
          Slug: <code className="font-mono">{tenant?.subdomain || tenant?.slug || tenant?.id}</code>
        </p>
      </div>
    </AppShell>
  );
}
