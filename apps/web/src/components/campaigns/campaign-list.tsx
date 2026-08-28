"use client";

import { Checkbox } from "@/components/ui/checkbox";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Skeleton } from "@/components/ui/skeleton";
import type { Campaign } from "@/lib/types/campaign";
import { IconMail } from "@tabler/icons-react";
import { CampaignBulkBar } from "./campaign-bulk-bar";
import { CampaignFilters } from "./campaign-filters";
import { CampaignTable } from "./campaign-table";
import { useCampaignList } from "./use-campaign-list";

interface CampaignListProps {
  onEdit?: (campaign: Campaign) => void;
  onDuplicate?: (campaign: Campaign) => void;
}

export function CampaignList({ onEdit, onDuplicate }: CampaignListProps) {
  const list = useCampaignList({ onEdit, onDuplicate });

  return (
    <div className="flex flex-col gap-6">
      {list.selectedIds.length > 0 ? (
        <CampaignBulkBar
          count={list.selectedIds.length}
          canPause={list.canPauseSelected}
          canResume={list.canResumeSelected}
          canStop={list.canStopSelected}
          pausePending={list.mutations.bulkPause.isPending}
          resumePending={list.mutations.bulkResume.isPending}
          stopPending={list.mutations.bulkStop.isPending}
          onPause={list.bulkPause}
          onResume={list.bulkResume}
          onStop={list.bulkStop}
          onClear={list.clearSelection}
        />
      ) : null}

      <div className="flex flex-col gap-4">
        {list.selectable.length > 0 ? (
          <div className="flex items-center gap-2">
            <Checkbox
              checked={list.allSelected}
              onCheckedChange={(checked) => list.selectAll(Boolean(checked))}
            />
            <span className="text-sm text-muted-foreground">Select all</span>
          </div>
        ) : null}
        <CampaignFilters
          searchTerm={list.searchTerm}
          statusFilter={list.statusFilter}
          typeFilter={list.typeFilter}
          sortBy={list.sortBy}
          sortOrder={list.sortOrder}
          onSearchChange={list.setSearchTerm}
          onStatusChange={list.setStatusFilter}
          onTypeChange={list.setTypeFilter}
          onSortByChange={list.setSortBy}
          onSortOrderChange={list.setSortOrder}
        />
      </div>

      {list.isLoading ? (
        <div className="flex flex-col gap-3">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
        </div>
      ) : list.campaigns.length === 0 ? (
        <Empty className="border">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <IconMail />
            </EmptyMedia>
            <EmptyTitle>No campaigns found</EmptyTitle>
            <EmptyDescription>
              {list.hasFilters
                ? "Try adjusting your filters to see more campaigns."
                : "Get started by creating your first campaign."}
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <CampaignTable
          campaigns={list.campaigns}
          selectedIds={list.selectedIds}
          onSelect={list.select}
          onView={list.view}
          onEdit={list.edit}
          onDuplicate={list.duplicate}
          onPause={list.pause}
          onResume={list.resume}
          onStop={list.stop}
          onDelete={list.remove}
        />
      )}
    </div>
  );
}
