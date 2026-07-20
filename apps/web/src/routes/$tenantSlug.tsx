import { createFileRoute, Outlet } from '@tanstack/react-router';
import { TenantLayoutGuard } from '@/components/layout/tenant-layout-guard';
import { TenantSlugSync } from '@/components/layout/tenant-slug-sync';

export const Route = createFileRoute('/$tenantSlug')({
  component: TenantLayoutRoute,
});

function TenantLayoutRoute() {
  return (
    <TenantLayoutGuard>
      <TenantSlugSync>
        <Outlet />
      </TenantSlugSync>
    </TenantLayoutGuard>
  );
}
