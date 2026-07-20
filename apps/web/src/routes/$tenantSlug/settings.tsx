import { createFileRoute } from '@tanstack/react-router';
import TenantSettingsPage from '@/pages/tenantSlug-settings';

export const Route = createFileRoute('/$tenantSlug/settings')({
  component: TenantSettingsPage,
});
