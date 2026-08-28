"use client";

import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty";
import { Skeleton } from "@/components/ui/skeleton";
import { useRouter } from "@/compat/next-navigation";
import { useTenantBasePath } from "@/hooks/use-tenant-slug";
import { campaignApi } from "@/lib/api/campaigns";
import type { Campaign } from "@/lib/types/campaign";
import { IconArrowLeft } from "@tabler/icons-react";
import { useQuery } from "@tanstack/react-query";
import { CampaignDetailsBody } from "./campaign-details-body";
import { CampaignDetailsHeader } from "./campaign-details-header";
import { useCampaignMutations } from "./use-campaign-mutations";

interface CampaignDetailsProps {
  campaignId: string;
  onEdit?: (campaign: Campaign) => void;
}

export function CampaignDetails({ campaignId, onEdit }: CampaignDetailsProps) {
  const router = useRouter();
  const basePath = useTenantBasePath();
  const campaignsHref = `${basePath}/campaigns`;

  const { data: campaign, isLoading } = useQuery({
    queryKey: ["campaign", campaignId],
    queryFn: () => campaignApi.getCampaign(campaignId),
  });

  const mutations = useCampaignMutations({
    campaignId,
    onDuplicated: (copy) => router.push(`${campaignsHref}/${copy.id}`),
  });

  if (isLoading) {
    return (
      <div className="flex flex-col gap-6">
        <Skeleton className="h-8 w-1/3" />
        <Skeleton className="h-4 w-2/3" />
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  if (!campaign) {
    return (
      <Empty>
        <EmptyHeader>
          <EmptyTitle>Campaign not found</EmptyTitle>
          <EmptyDescription>
            The campaign you&apos;re looking for doesn&apos;t exist or you don&apos;t have access to
            it.
          </EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <Button onClick={() => router.push(campaignsHref)}>
            <IconArrowLeft data-icon="inline-start" />
            Back to Campaigns
          </Button>
        </EmptyContent>
      </Empty>
    );
  }

  const edit = () => {
    if (onEdit) onEdit(campaign);
    else router.push(`${campaignsHref}/${campaignId}/edit`);
  };

  return (
    <div className="flex flex-col gap-6">
      <CampaignDetailsHeader
        campaign={campaign}
        pausePending={mutations.pause.isPending}
        resumePending={mutations.resume.isPending}
        stopPending={mutations.stop.isPending}
        onBack={() => router.push(campaignsHref)}
        onPause={() => {
          if (campaign.status === "active") mutations.pause.mutate(campaignId);
        }}
        onResume={() => {
          if (campaign.status === "paused") mutations.resume.mutate(campaignId);
        }}
        onStop={() => {
          if (
            (campaign.status === "active" || campaign.status === "paused") &&
            confirm("Are you sure you want to stop this campaign? This action cannot be undone.")
          ) {
            mutations.stop.mutate(campaignId);
          }
        }}
        onEdit={edit}
        onDuplicate={() =>
          mutations.duplicate.mutate({ id: campaignId, name: `${campaign.name} (Copy)` })
        }
        onSettings={() => router.push(`${campaignsHref}/${campaignId}`)}
      />
      <CampaignDetailsBody campaign={campaign} onEdit={edit} />
    </div>
  );
}
