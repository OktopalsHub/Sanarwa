import { createFileRoute } from '@tanstack/react-router';
import TenantSettingsPage from '@/pages/settings-tenant';

export const Route = createFileRoute('/settings/tenant')({
  component: TenantSettingsPage,
});
