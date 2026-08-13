'use client';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { campaignApi } from '@/lib/api/campaigns';
import type { Campaign, CampaignStatus } from '@/lib/types/campaign';
import { toast } from '@/lib/utils/toast';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ChartBarIcon, DocumentDuplicateIcon, PencilIcon, EnvelopeIcon, ChatBubbleLeftRightIcon, EllipsisHorizontalIcon, PauseIcon, PlayIcon, DevicePhoneMobileIcon, StopIcon, TrashIcon, UsersIcon, SpeakerWaveIcon, XMarkIcon } from '@heroicons/react/24/outline'
import { useRouter } from '@/compat/next-navigation';
import { CampaignFilters } from './campaign-filters';
import { useState } from 'react';
import { useTenantBasePath } from '@/hooks/use-tenant-slug';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

interface CampaignListProps {
  onEdit?: (campaign: Campaign) => void;
  onDuplicate?: (campaign: Campaign) => void;
}

const CHANNEL_ICONS = {
  email: EnvelopeIcon,
  sms: ChatBubbleLeftRightIcon,
  push: DevicePhoneMobileIcon,
  in_app: UsersIcon,
  voice: SpeakerWaveIcon,
  whatsapp: ChatBubbleLeftRightIcon,
};

const STATUS_COLORS = {
  draft: 'bg-gray-100 text-gray-800',
  scheduled: 'bg-blue-100 text-blue-800',
  active: 'bg-green-100 text-green-800',
  paused: 'bg-yellow-100 text-yellow-800',
  completed: 'bg-purple-100 text-purple-800',
  cancelled: 'bg-red-100 text-red-800',
};

export function CampaignList({ onEdit, onDuplicate }: CampaignListProps) {
  const router = useRouter();
  const basePath = useTenantBasePath();
  const queryClient = useQueryClient();

  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'name' | 'createdAt' | 'updatedAt' | 'status'>('updatedAt');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  // Fetch campaigns with filters
  const { data: campaignsData, isLoading } = useQuery({
    queryKey: ['campaigns', { search: searchTerm, status: statusFilter, type: typeFilter, sortBy, sortOrder }],
    queryFn: () => campaignApi.getCampaigns({
      search: searchTerm || undefined,
      status: statusFilter !== 'all' ? statusFilter : undefined,
      type: typeFilter !== 'all' ? typeFilter : undefined,
      sortBy,
      sortOrder,
      limit: 50,
    }),
    refetchInterval: 30000, // Refetch every 30 seconds for real-time updates
  });

  // Campaign control mutations
  const pauseCampaignMutation = useMutation({
    mutationFn: campaignApi.pauseCampaign,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['campaigns'] });
      toast.success('Campaign paused successfully');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to pause campaign');
    },
  });

  const resumeCampaignMutation = useMutation({
    mutationFn: campaignApi.resumeCampaign,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['campaigns'] });
      toast.success('Campaign resumed successfully');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to resume campaign');
    },
  });

  const stopCampaignMutation = useMutation({
    mutationFn: campaignApi.stopCampaign,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['campaigns'] });
      toast.success('Campaign stopped successfully');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to stop campaign');
    },
  });

  const duplicateCampaignMutation = useMutation({
    mutationFn: ({ id, name }: { id: string; name: string }) => campaignApi.duplicateCampaign(id, name),
    onSuccess: (campaign) => {
      queryClient.invalidateQueries({ queryKey: ['campaigns'] });
      toast.success('Campaign duplicated successfully');
      if (onDuplicate) {
        onDuplicate(campaign);
      }
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to duplicate campaign');
    },
  });

  // Bulk operations
  const [selectedCampaigns, setSelectedCampaigns] = useState<string[]>([]);

  const bulkPauseMutation = useMutation({
    mutationFn: async (campaignIds: string[]) => {
      const results = await Promise.allSettled(
        campaignIds.map(id => campaignApi.pauseCampaign(id))
      );
      return results;
    },
    onSuccess: (results) => {
      const successful = results.filter(r => r.status === 'fulfilled').length;
      const failed = results.filter(r => r.status === 'rejected').length;

      queryClient.invalidateQueries({ queryKey: ['campaigns'] });

      if (failed === 0) {
        toast.success(`Successfully paused ${successful} campaigns`);
      } else {
        toast.error(`Paused ${successful} campaigns, ${failed} failed`);
      }

      setSelectedCampaigns([]);
    },
    onError: () => {
      toast.error('Failed to pause campaigns');
    },
  });

  const bulkResumeMutation = useMutation({
    mutationFn: async (campaignIds: string[]) => {
      const results = await Promise.allSettled(
        campaignIds.map(id => campaignApi.resumeCampaign(id))
      );
      return results;
    },
    onSuccess: (results) => {
      const successful = results.filter(r => r.status === 'fulfilled').length;
      const failed = results.filter(r => r.status === 'rejected').length;

      queryClient.invalidateQueries({ queryKey: ['campaigns'] });

      if (failed === 0) {
        toast.success(`Successfully resumed ${successful} campaigns`);
      } else {
        toast.error(`Resumed ${successful} campaigns, ${failed} failed`);
      }

      setSelectedCampaigns([]);
    },
    onError: () => {
      toast.error('Failed to resume campaigns');
    },
  });

  const bulkStopMutation = useMutation({
    mutationFn: async (campaignIds: string[]) => {
      const results = await Promise.allSettled(
        campaignIds.map(id => campaignApi.stopCampaign(id))
      );
      return results;
    },
    onSuccess: (results) => {
      const successful = results.filter(r => r.status === 'fulfilled').length;
      const failed = results.filter(r => r.status === 'rejected').length;

      queryClient.invalidateQueries({ queryKey: ['campaigns'] });

      if (failed === 0) {
        toast.success(`Successfully stopped ${successful} campaigns`);
      } else {
        toast.error(`Stopped ${successful} campaigns, ${failed} failed`);
      }

      setSelectedCampaigns([]);
    },
    onError: () => {
      toast.error('Failed to stop campaigns');
    },
  });

  const deleteCampaignMutation = useMutation({
    mutationFn: campaignApi.deleteCampaign,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['campaigns'] });
      toast.success('Campaign deleted successfully');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to delete campaign');
    },
  });

  const handlePauseCampaign = (campaign: Campaign) => {
    if (campaign.status === 'active') {
      pauseCampaignMutation.mutate(campaign.id);
    }
  };

  const handleResumeCampaign = (campaign: Campaign) => {
    if (campaign.status === 'paused') {
      resumeCampaignMutation.mutate(campaign.id);
    }
  };

  const handleStopCampaign = (campaign: Campaign) => {
    if (campaign.status === 'active' || campaign.status === 'paused') {
      if (confirm('Are you sure you want to stop this campaign? This action cannot be undone.')) {
        stopCampaignMutation.mutate(campaign.id);
      }
    }
  };

  const handleDuplicateCampaign = (campaign: Campaign) => {
    const newName = `${campaign.name} (Copy)`;
    duplicateCampaignMutation.mutate({ id: campaign.id, name: newName });
  };

  const handleDeleteCampaign = (campaign: Campaign) => {
    if (confirm('Are you sure you want to delete this campaign? This action cannot be undone.')) {
      deleteCampaignMutation.mutate(campaign.id);
    }
  };

  const handleSelectCampaign = (campaignId: string, selected: boolean) => {
    if (selected) {
      setSelectedCampaigns(prev => [...prev, campaignId]);
    } else {
      setSelectedCampaigns(prev => prev.filter(id => id !== campaignId));
    }
  };

  const handleSelectAll = (selected: boolean) => {
    if (selected) {
      const selectableCampaigns = campaigns
        .filter(c => canControlCampaign(c.status))
        .map(c => c.id);
      setSelectedCampaigns(selectableCampaigns);
    } else {
      setSelectedCampaigns([]);
    }
  };

  const handleBulkPause = () => {
    const pausableCampaigns = selectedCampaigns.filter(id => {
      const campaign = campaigns.find(c => c.id === id);
      return campaign?.status === 'active';
    });

    if (pausableCampaigns.length > 0) {
      bulkPauseMutation.mutate(pausableCampaigns);
    }
  };

  const handleBulkResume = () => {
    const resumableCampaigns = selectedCampaigns.filter(id => {
      const campaign = campaigns.find(c => c.id === id);
      return campaign?.status === 'paused';
    });

    if (resumableCampaigns.length > 0) {
      bulkResumeMutation.mutate(resumableCampaigns);
    }
  };

  const handleBulkStop = () => {
    const stoppableCampaigns = selectedCampaigns.filter(id => {
      const campaign = campaigns.find(c => c.id === id);
      return campaign?.status === 'active' || campaign?.status === 'paused';
    });

    if (stoppableCampaigns.length > 0 &&
      confirm(`Are you sure you want to stop ${stoppableCampaigns.length} campaigns? This action cannot be undone.`)) {
      bulkStopMutation.mutate(stoppableCampaigns);
    }
  };

  const handleEditCampaign = (campaign: Campaign) => {
    if (onEdit) {
      onEdit(campaign);
    } else {
      router.push(`${basePath}/campaigns/${campaign.id}/edit`);
    }
  };

  const canControlCampaign = (status: CampaignStatus) => {
    return ['active', 'paused', 'scheduled'].includes(status);
  };

  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(date));
  };

  const campaigns = campaignsData?.campaigns || [];
  const selectableCampaigns = campaigns.filter(c => canControlCampaign(c.status));
  const allSelectableSelected = selectableCampaigns.length > 0 &&
    selectableCampaigns.every(c => selectedCampaigns.includes(c.id));

  // Show bulk actions when campaigns are selected
  const showBulkActionsBar = selectedCampaigns.length > 0;

  return (
    <div className="space-y-6">
      {/* Bulk Actions Bar */}
      {showBulkActionsBar && (
        <Card className="border-orange-200 bg-orange-50">
          <CardContent className="py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <span className="text-sm font-medium">
                  {selectedCampaigns.length} campaign{selectedCampaigns.length !== 1 ? 's' : ''} selected
                </span>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleBulkPause}
                    disabled={bulkPauseMutation.isPending ||
                      !selectedCampaigns.some(id => campaigns.find(c => c.id === id)?.status === 'active')}
                  >
                    <PauseIcon className="w-4 h-4 mr-2" />
                    Pause Selected
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleBulkResume}
                    disabled={bulkResumeMutation.isPending ||
                      !selectedCampaigns.some(id => campaigns.find(c => c.id === id)?.status === 'paused')}
                  >
                    <PlayIcon className="w-4 h-4 mr-2" />
                    Resume Selected
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleBulkStop}
                    disabled={bulkStopMutation.isPending ||
                      !selectedCampaigns.some(id => {
                        const campaign = campaigns.find(c => c.id === id);
                        return campaign?.status === 'active' || campaign?.status === 'paused';
                      })}
                    className="text-red-600 hover:text-red-700"
                  >
                    <StopIcon className="w-4 h-4 mr-2" />
                    Stop Selected
                  </Button>
                </div>
              </div>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setSelectedCampaigns([])}
              >
                <XMarkIcon className="w-4 h-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Filters and Search */}
      <div className="space-y-4">
        {selectableCampaigns.length > 0 && (
          <div className="flex items-center gap-2">
            <Checkbox
              checked={allSelectableSelected}
              onCheckedChange={handleSelectAll}
            />
            <span className="text-sm text-muted-foreground">Select all</span>
          </div>
        )}
        <CampaignFilters
          searchTerm={searchTerm}
          statusFilter={statusFilter}
          typeFilter={typeFilter}
          sortBy={sortBy}
          sortOrder={sortOrder}
          onSearchChange={setSearchTerm}
          onStatusChange={setStatusFilter}
          onTypeChange={setTypeFilter}
          onSortByChange={setSortBy}
          onSortOrderChange={setSortOrder}
        />
      </div>

      {/* Campaign List */}
      {isLoading ? (
        <div className="grid gap-4">
          {[...Array(3)].map((_, i) => (
            <Card key={i} className="animate-pulse">
              <CardContent className="p-6">
                <div className="h-4 bg-muted rounded w-1/3 mb-2"></div>
                <div className="h-3 bg-muted rounded w-2/3 mb-4"></div>
                <div className="flex gap-2">
                  <div className="h-6 bg-muted rounded w-16"></div>
                  <div className="h-6 bg-muted rounded w-20"></div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : campaigns.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="pt-12 pb-12 text-center">
            <EnvelopeIcon className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No campaigns found</h3>
            <p className="text-muted-foreground mb-6">
              {searchTerm || statusFilter !== 'all' || typeFilter !== 'all'
                ? 'Try adjusting your filters to see more campaigns.'
                : 'Get started by creating your first campaign.'}
            </p>
          </CardContent>
        </Card>
      ) : (
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
                      checked={selectedCampaigns.includes(campaign.id)}
                      onCheckedChange={(checked) =>
                        handleSelectCampaign(campaign.id, checked as boolean)
                      }
                    />
                  ) : null}
                </TableCell>
                <TableCell>
                  <button
                    type="button"
                    className="text-left font-medium hover:text-primary"
                    onClick={() => router.push(`${basePath}/campaigns/${campaign.id}`)}
                  >
                    {campaign.name}
                  </button>
                  <div className="text-xs text-muted-foreground">
                    {campaign.type.replace('_', ' ')} · {formatDate(campaign.updatedAt)}
                  </div>
                </TableCell>
                <TableCell>
                  <Badge className={STATUS_COLORS[campaign.status]}>{campaign.status}</Badge>
                </TableCell>
                <TableCell>
                  <div className="flex gap-1">
                    {campaign.channels.map((channel) => {
                      const Icon = CHANNEL_ICONS[channel] ?? EnvelopeIcon;
                      return (
                        <span
                          key={channel}
                          className="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-1 text-xs"
                        >
                          <Icon className="h-3 w-3" />
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
                      <Button variant="ghost" size="sm">
                        <EllipsisHorizontalIcon className="w-4 h-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => router.push(`${basePath}/campaigns/${campaign.id}`)}>
                        <ChartBarIcon className="w-4 h-4 mr-2" />
                        View Details
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleEditCampaign(campaign)}>
                        <PencilIcon className="w-4 h-4 mr-2" />
                        Edit Campaign
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleDuplicateCampaign(campaign)}>
                        <DocumentDuplicateIcon className="w-4 h-4 mr-2" />
                        Duplicate
                      </DropdownMenuItem>
                      {canControlCampaign(campaign.status) && (
                        <>
                          <DropdownMenuSeparator />
                          {campaign.status === 'active' && (
                            <DropdownMenuItem onClick={() => handlePauseCampaign(campaign)}>
                              <PauseIcon className="w-4 h-4 mr-2" />
                              Pause Campaign
                            </DropdownMenuItem>
                          )}
                          {campaign.status === 'paused' && (
                            <DropdownMenuItem onClick={() => handleResumeCampaign(campaign)}>
                              <PlayIcon className="w-4 h-4 mr-2" />
                              Resume Campaign
                            </DropdownMenuItem>
                          )}
                          {(campaign.status === 'active' || campaign.status === 'paused') && (
                            <DropdownMenuItem
                              onClick={() => handleStopCampaign(campaign)}
                              className="text-red-600"
                            >
                              <StopIcon className="w-4 h-4 mr-2" />
                              Stop Campaign
                            </DropdownMenuItem>
                          )}
                        </>
                      )}
                      {campaign.status === 'draft' && (
                        <>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            onClick={() => handleDeleteCampaign(campaign)}
                            className="text-red-600"
                          >
                            <TrashIcon className="w-4 h-4 mr-2" />
                            Delete Campaign
                          </DropdownMenuItem>
                        </>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}