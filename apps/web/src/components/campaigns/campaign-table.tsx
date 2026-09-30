import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { Campaign } from "@/lib/types/campaign";
import {
  IconChartBar,
  IconCopy,
  IconDots,
  IconMail,
  IconPencil,
  IconPlayerPause,
  IconPlayerPlay,
  IconPlayerStop,
  IconTrash,
} from "@tabler/icons-react";
import {
  canControlCampaign,
  CHANNEL_ICONS,
  campaignStatusVariant,
  formatCampaignDate,
} from "./campaign-status";

interface CampaignTableProps {
  campaigns: Campaign[];
  selectedIds: string[];
  onSelect: (id: string, selected: boolean) => void;
  onView: (campaign: Campaign) => void;
  onEdit: (campaign: Campaign) => void;
  onDuplicate: (campaign: Campaign) => void;
  onPause: (campaign: Campaign) => void;
  onResume: (campaign: Campaign) => void;
  onStop: (campaign: Campaign) => void;
  onDelete: (campaign: Campaign) => void;
}

export function CampaignTable({
  campaigns,
  selectedIds,
  onSelect,
  onView,
  onEdit,
  onDuplicate,
  onPause,
  onResume,
  onStop,
  onDelete,
}: CampaignTableProps) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="w-10" />
          <TableHead>Campaign</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Channels</TableHead>
          <TableHead className="text-right">Sent</TableHead>
          <TableHead className="text-right">Delivered</TableHead>
          <TableHead className="w-10" />
        </TableRow>
      </TableHeader>
      <TableBody>
        {campaigns.map((campaign) => (
          <TableRow key={campaign.id}>
            <TableCell>
              {canControlCampaign(campaign.status) ? (
                <Checkbox
                  checked={selectedIds.includes(campaign.id)}
                  onCheckedChange={(checked) => onSelect(campaign.id, Boolean(checked))}
                />
              ) : null}
            </TableCell>
            <TableCell>
              <button
                type="button"
                className="text-left font-medium hover:text-primary"
                onClick={() => onView(campaign)}
              >
                {campaign.name}
              </button>
              <div className="text-xs text-muted-foreground">
                {campaign.type.replace("_", " ")} · {formatCampaignDate(campaign.updatedAt)}
              </div>
            </TableCell>
            <TableCell>
              <Badge variant={campaignStatusVariant(campaign.status)}>{campaign.status}</Badge>
            </TableCell>
            <TableCell>
              <div className="flex gap-1">
                {campaign.channels.map((channel) => {
                  const Icon = CHANNEL_ICONS[channel] ?? IconMail;
                  return (
                    <span
                      key={channel}
                      className="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-1 text-xs"
                    >
                      <Icon className="size-3" />
                      {channel}
                    </span>
                  );
                })}
              </div>
            </TableCell>
            <TableCell className="text-right">
              {campaign.analytics.totalSent.toLocaleString()}
            </TableCell>
            <TableCell className="text-right">
              {campaign.analytics.deliveryRate.toFixed(1)}%
            </TableCell>
            <TableCell>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon">
                    <IconDots />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuGroup>
                    <DropdownMenuItem onClick={() => onView(campaign)}>
                      <IconChartBar />
                      View Details
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => onEdit(campaign)}>
                      <IconPencil />
                      Edit Campaign
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => onDuplicate(campaign)}>
                      <IconCopy />
                      Duplicate
                    </DropdownMenuItem>
                  </DropdownMenuGroup>
                  {canControlCampaign(campaign.status) ? (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuGroup>
                        {campaign.status === "active" ? (
                          <DropdownMenuItem onClick={() => onPause(campaign)}>
                            <IconPlayerPause />
                            Pause Campaign
                          </DropdownMenuItem>
                        ) : null}
                        {campaign.status === "paused" ? (
                          <DropdownMenuItem onClick={() => onResume(campaign)}>
                            <IconPlayerPlay />
                            Resume Campaign
                          </DropdownMenuItem>
                        ) : null}
                        {campaign.status === "active" || campaign.status === "paused" ? (
                          <DropdownMenuItem
                            onClick={() => onStop(campaign)}
                            className="text-destructive"
                          >
                            <IconPlayerStop />
                            Stop Campaign
                          </DropdownMenuItem>
                        ) : null}
                      </DropdownMenuGroup>
                    </>
                  ) : null}
                  {campaign.status === "draft" ? (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuGroup>
                        <DropdownMenuItem
                          onClick={() => onDelete(campaign)}
                          className="text-destructive"
                        >
                          <IconTrash />
                          Delete Campaign
                        </DropdownMenuItem>
                      </DropdownMenuGroup>
                    </>
                  ) : null}
                </DropdownMenuContent>
              </DropdownMenu>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
