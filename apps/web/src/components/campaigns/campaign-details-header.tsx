import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { Campaign } from "@/lib/types/campaign";
import {
  IconArrowLeft,
  IconCopy,
  IconDots,
  IconPencil,
  IconPlayerPause,
  IconPlayerPlay,
  IconPlayerStop,
  IconSettings,
} from "@tabler/icons-react";
import { campaignStatusVariant, canControlCampaign, formatCampaignDate } from "./campaign-status";

interface CampaignDetailsHeaderProps {
  campaign: Campaign;
  pausePending: boolean;
  resumePending: boolean;
  stopPending: boolean;
  onBack: () => void;
  onPause: () => void;
  onResume: () => void;
  onStop: () => void;
  onEdit: () => void;
  onDuplicate: () => void;
  onSettings: () => void;
}

export function CampaignDetailsHeader({
  campaign,
  pausePending,
  resumePending,
  stopPending,
  onBack,
  onPause,
  onResume,
  onStop,
  onEdit,
  onDuplicate,
  onSettings,
}: CampaignDetailsHeaderProps) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="flex-1">
        <Button variant="ghost" size="sm" onClick={onBack}>
          <IconArrowLeft data-icon="inline-start" />
          Back to Campaigns
        </Button>
        <div className="mt-2 flex items-center gap-3">
          <h1 className="text-3xl font-bold">{campaign.name}</h1>
          <Badge variant={campaignStatusVariant(campaign.status)}>{campaign.status}</Badge>
        </div>
        {campaign.description ? (
          <p className="mt-2 text-muted-foreground">{campaign.description}</p>
        ) : null}
        <div className="mt-4 flex items-center gap-4 text-sm text-muted-foreground">
          <span>Type: {campaign.type.replace("_", " ")}</span>
          <span>•</span>
          <span>Created: {formatCampaignDate(campaign.createdAt, true)}</span>
          <span>•</span>
          <span>Last updated: {formatCampaignDate(campaign.updatedAt, true)}</span>
        </div>
      </div>

      <div className="flex items-center gap-2">
        {canControlCampaign(campaign.status) ? (
          <>
            {campaign.status === "active" ? (
              <Button variant="outline" onClick={onPause} disabled={pausePending}>
                <IconPlayerPause data-icon="inline-start" />
                Pause
              </Button>
            ) : null}
            {campaign.status === "paused" ? (
              <Button variant="outline" onClick={onResume} disabled={resumePending}>
                <IconPlayerPlay data-icon="inline-start" />
                Resume
              </Button>
            ) : null}
            {campaign.status === "active" || campaign.status === "paused" ? (
              <Button
                variant="outline"
                onClick={onStop}
                disabled={stopPending}
                className="text-destructive hover:text-destructive"
              >
                <IconPlayerStop data-icon="inline-start" />
                Stop
              </Button>
            ) : null}
          </>
        ) : null}

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline">
              <IconDots data-icon="inline-start" />
              More Actions
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuGroup>
              <DropdownMenuItem onClick={onEdit}>
                <IconPencil />
                Edit Campaign
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onDuplicate}>
                <IconCopy />
                Duplicate Campaign
              </DropdownMenuItem>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              <DropdownMenuItem onClick={onSettings}>
                <IconSettings />
                Campaign Settings
              </DropdownMenuItem>
            </DropdownMenuGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}
