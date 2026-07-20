import { createFileRoute } from '@tanstack/react-router';
import TenantDashboardPage from '@/pages/tenantSlug-dashboard';

export const Route = createFileRoute('/$tenantSlug/dashboard')({
  component: TenantDashboardPage,
});
