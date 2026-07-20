import { createFileRoute } from '@tanstack/react-router';
import { TenantRouteRedirect } from '@/components/layout/tenant-route-redirect';

export const Route = createFileRoute('/campaigns')({
  component: () => <TenantRouteRedirect suffix="campaigns" />,
});
