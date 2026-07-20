import { createFileRoute } from '@tanstack/react-router';
import BrandingSettingsPage from '@/pages/settings-branding';

export const Route = createFileRoute('/settings/branding')({
  component: BrandingSettingsPage,
});
