import { useRouter } from "@/compat/next-navigation";
import { useTenantBasePath } from "@/hooks/use-tenant-slug";
import { campaignApi } from "@/lib/api/campaigns";
import type { Campaign } from "@/lib/types/campaign";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { canControlCampaign } from "./campaign-status";
import { useCampaignMutations } from "./use-campaign-mutations";

export function useCampaignList(options?: {
  onEdit?: (campaign: Campaign) => void;
  onDuplicate?: (campaign: Campaign) => void;
}) {
  const router = useRouter();
  const basePath = useTenantBasePath();
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [sortBy, setSortBy] = useState<"name" | "createdAt" | "updatedAt" | "status">("updatedAt");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const mutations = useCampaignMutations({
    onDuplicated: options?.onDuplicate,
    onBulkSettled: () => setSelectedIds([]),
  });

  const { data, isLoading } = useQuery({
    queryKey: [
      "campaigns",
      { search: searchTerm, status: statusFilter, type: typeFilter, sortBy, sortOrder },
    ],
    queryFn: () =>
      campaignApi.getCampaigns({
        search: searchTerm || undefined,
        status: statusFilter !== "all" ? statusFilter : undefined,
        type: typeFilter !== "all" ? typeFilter : undefined,
        sortBy,
        sortOrder,
        limit: 50,
      }),
    refetchInterval: 30_000,
  });

  const campaigns = data?.campaigns ?? [];
  const selectable = campaigns.filter((campaign) => canControlCampaign(campaign.status));
  const allSelected =
    selectable.length > 0 && selectable.every((campaign) => selectedIds.includes(campaign.id));

  const selectedOf = (status: Campaign["status"] | Campaign["status"][]) =>
    selectedIds.filter((id) => {
      const campaign = campaigns.find((item) => item.id === id);
      return Array.isArray(status)
        ? campaign && status.includes(campaign.status)
        : campaign?.status === status;
    });

  return {
    campaigns,
    isLoading,
    searchTerm,
    statusFilter,
    typeFilter,
    sortBy,
    sortOrder,
    setSearchTerm,
    setStatusFilter,
    setTypeFilter,
    setSortBy,
    setSortOrder,
    selectedIds,
    selectable,
    allSelected,
    mutations,
    select: (id: string, selected: boolean) => {
      setSelectedIds((prev) => (selected ? [...prev, id] : prev.filter((item) => item !== id)));
    },
    selectAll: (selected: boolean) => {
      setSelectedIds(selected ? selectable.map((campaign) => campaign.id) : []);
    },
    clearSelection: () => setSelectedIds([]),
    view: (campaign: Campaign) => router.push(`${basePath}/campaigns/${campaign.id}`),
    edit: (campaign: Campaign) => {
      if (options?.onEdit) options.onEdit(campaign);
      else router.push(`${basePath}/campaigns/${campaign.id}/edit`);
    },
    pause: (campaign: Campaign) => {
      if (campaign.status === "active") mutations.pause.mutate(campaign.id);
    },
    resume: (campaign: Campaign) => {
      if (campaign.status === "paused") mutations.resume.mutate(campaign.id);
    },
    stop: (campaign: Campaign) => {
      if (
        (campaign.status === "active" || campaign.status === "paused") &&
        confirm("Are you sure you want to stop this campaign? This action cannot be undone.")
      ) {
        mutations.stop.mutate(campaign.id);
      }
    },
    duplicate: (campaign: Campaign) => {
      mutations.duplicate.mutate({ id: campaign.id, name: `${campaign.name} (Copy)` });
    },
    remove: (campaign: Campaign) => {
      if (confirm("Are you sure you want to delete this campaign? This action cannot be undone.")) {
        mutations.remove.mutate(campaign.id);
      }
    },
    bulkPause: () => {
      const ids = selectedOf("active");
      if (ids.length) mutations.bulkPause.mutate(ids);
    },
    bulkResume: () => {
      const ids = selectedOf("paused");
      if (ids.length) mutations.bulkResume.mutate(ids);
    },
    bulkStop: () => {
      const ids = selectedOf(["active", "paused"]);
      if (
        ids.length &&
        confirm(
          `Are you sure you want to stop ${ids.length} campaigns? This action cannot be undone.`,
        )
      ) {
        mutations.bulkStop.mutate(ids);
      }
    },
    canPauseSelected: selectedOf("active").length > 0,
    canResumeSelected: selectedOf("paused").length > 0,
    canStopSelected: selectedOf(["active", "paused"]).length > 0,
    hasFilters: Boolean(searchTerm) || statusFilter !== "all" || typeFilter !== "all",
  };
}
