import { createFileRoute } from '@tanstack/react-router';
import CampaignDetailsPage from '@/pages/campaigns-id';

export const Route = createFileRoute('/$tenantSlug/campaigns/$id')({
  component: CampaignDetailsPage,
});
