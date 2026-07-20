'use client';

import { CampaignDetails } from '@/components/campaigns/campaign-details';
import { useParams } from '@/compat/next-navigation';

export default function CampaignDetailsPage() {
  const { id: campaignId = '' } = useParams({ strict: false }) as { id?: string };

  return <CampaignDetails campaignId={campaignId} />;
}