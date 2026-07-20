import { createFileRoute } from '@tanstack/react-router';
import ProviderDetailPage from '@/pages/tenantSlug-providers-providerId';

export const Route = createFileRoute('/$tenantSlug/providers/$providerId')({
  component: ProviderDetailPage,
});
