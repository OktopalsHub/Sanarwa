'use client';

import { CampaignDetails } from '@/components/campaigns/campaign-details';
import { AppShell } from '@/components/layout';
import { useParams } from '@/compat/next-navigation';

export default function CampaignDetailsPage() {
  const { id: campaignId = '' } = useParams({ strict: false }) as { id?: string };

  return (
    <AppShell>
      <div className="p-6">
        <CampaignDetails campaignId={campaignId} />
      </div>
    </AppShell>
  );
}