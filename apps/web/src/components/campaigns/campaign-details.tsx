'use client';

import { Mail, MessageSquare, Smartphone, Target, Users, Volume2 } from '@/lib/icons';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { campaignApi } from '@/lib/api/campaigns';
import type { Campaign } from '@/lib/types/campaign';
import { toast } from '@/lib/utils/toast';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ChartBarIcon, DocumentDuplicateIcon, PencilIcon, EnvelopeIcon, ChatBubbleLeftRightIcon, EllipsisHorizontalIcon, PauseIcon, PlayIcon, Cog6ToothIcon, DevicePhoneMobileIcon, StopIcon, UsersIcon, SpeakerWaveIcon, ArrowLeftIcon } from '@heroicons/react/24/outline'
import { useRouter } from '@/compat/next-navigation';
import React from 'react';
import { CampaignControlPanel } from './campaign-control-panel';
import { CampaignStatusMonitor } from './campaign-status-monitor';

interface CampaignDetailsProps {
  campaignId: string;
  onEdit?: (campaign: Campaign) => void;
}

const CHANNEL_ICONS = {
  email: Mail,
  sms: MessageSquare,
  push: Smartphone,
  in_app: Users,
  voice: Volume2,
};

const STATUS_COLORS = {
  draft: 'bg-gray-100 text-gray-800',
  scheduled: 'bg-blue-100 text-blue-800',
  active: 'bg-green-100 text-green-800',
  paused: 'bg-yellow-100 text-yellow-800',
  completed: 'bg-purple-100 text-purple-800',
  cancelled: 'bg-red-100 text-red-800',
};

export function CampaignDetails({ campaignId, onEdit }: CampaignDetailsProps) {
  const router = useRouter();
  const queryClient = useQueryClient();

  // Fetch campaign data
  const { data: campaign, isLoading } = useQuery({
    queryKey: ['campaign', campaignId],
    queryFn: () => campaignApi.getCampaign(campaignId),
  });

  // Campaign control mutations
  const pauseCampaignMutation = useMutation({
    mutationFn: campaignApi.pauseCampaign,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['campaign', campaignId] });
      toast.success('Campaign paused successfully');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to pause campaign');
    },
  });

  const resumeCampaignMutation = useMutation({
    mutationFn: campaignApi.resumeCampaign,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['campaign', campaignId] });
      toast.success('Campaign resumed successfully');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to resume campaign');
    },
  });

  const stopCampaignMutation = useMutation({
    mutationFn: campaignApi.stopCampaign,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['campaign', campaignId] });
      toast.success('Campaign stopped successfully');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to stop campaign');
    },
  });

  const duplicateCampaignMutation = useMutation({
    mutationFn: ({ id, name }: { id: string; name: string }) => campaignApi.duplicateCampaign(id, name),
    onSuccess: (newCampaign) => {
      queryClient.invalidateQueries({ queryKey: ['campaigns'] });
      toast.success('Campaign duplicated successfully');
      router.push(`/campaigns/${newCampaign.id}`);
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to duplicate campaign');
    },
  });

  const handlePauseCampaign = () => {
    if (campaign?.status === 'active') {
      pauseCampaignMutation.mutate(campaignId);
    }
  };

  const handleResumeCampaign = () => {
    if (campaign?.status === 'paused') {
      resumeCampaignMutation.mutate(campaignId);
    }
  };

  const handleStopCampaign = () => {
    if (campaign && (campaign.status === 'active' || campaign.status === 'paused')) {
      if (confirm('Are you sure you want to stop this campaign? This action cannot be undone.')) {
        stopCampaignMutation.mutate(campaignId);
      }
    }
  };

  const handleDuplicateCampaign = () => {
    if (campaign) {
      const newName = `${campaign.name} (Copy)`;
      duplicateCampaignMutation.mutate({ id: campaignId, name: newName });
    }
  };

  const handleEditCampaign = () => {
    if (campaign) {
      if (onEdit) {
        onEdit(campaign);
      } else {
        router.push(`/campaigns/${campaignId}/edit`);
      }
    }
  };

  const canControlCampaign = (status: string) => {
    return ['active', 'paused', 'scheduled'].includes(status);
  };

  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(date));
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="animate-pulse">
          <div className="h-8 bg-muted rounded w-1/3 mb-4"></div>
          <div className="h-4 bg-muted rounded w-2/3 mb-6"></div>
        </div>
        {[...Array(3)].map((_, i) => (
          <Card key={i} className="animate-pulse">
            <CardContent className="p-6">
              <div className="h-4 bg-muted rounded w-1/3 mb-2"></div>
              <div className="h-8 bg-muted rounded w-full"></div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (!campaign) {
    return (
      <div className="text-center py-12">
        <h2 className="text-2xl font-bold mb-2">Campaign not found</h2>
        <p className="text-muted-foreground mb-4">
          The campaign you&apos;re looking for doesn&apos;t exist or you don&apos;t have access to it.
        </p>
        <Button onClick={() => router.push('/campaigns')}>
          <ArrowLeftIcon className="w-4 h-4 mr-2" />
          Back to Campaigns
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => router.push('/campaigns')}
            >
              <ArrowLeftIcon className="w-4 h-4 mr-2" />
              Back to Campaigns
            </Button>
          </div>

          <div className="flex items-center gap-3 mb-2">
            <h1 className="text-3xl font-bold">{campaign.name}</h1>
            <Badge className={STATUS_COLORS[campaign.status]}>
              {campaign.status}
            </Badge>
          </div>

          {campaign.description && (
            <p className="text-muted-foreground mb-4">{campaign.description}</p>
          )}

          <div className="flex items-center gap-4 text-sm text-muted-foreground">
            <span>Type: {campaign.type.replace('_', ' ')}</span>
            <span>•</span>
            <span>Created: {formatDate(campaign.createdAt)}</span>
            <span>•</span>
            <span>Last updated: {formatDate(campaign.updatedAt)}</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Campaign Control Buttons */}
          {canControlCampaign(campaign.status) && (
            <>
              {campaign.status === 'active' && (
                <Button
                  variant="outline"
                  onClick={handlePauseCampaign}
                  disabled={pauseCampaignMutation.isPending}
                >
                  <PauseIcon className="w-4 h-4 mr-2" />
                  Pause
                </Button>
              )}

              {campaign.status === 'paused' && (
                <Button
                  variant="outline"
                  onClick={handleResumeCampaign}
                  disabled={resumeCampaignMutation.isPending}
                >
                  <PlayIcon className="w-4 h-4 mr-2" />
                  Resume
                </Button>
              )}

              {(campaign.status === 'active' || campaign.status === 'paused') && (
                <Button
                  variant="outline"
                  onClick={handleStopCampaign}
                  disabled={stopCampaignMutation.isPending}
                  className="text-red-600 hover:text-red-700"
                >
                  <StopIcon className="w-4 h-4 mr-2" />
                  Stop
                </Button>
              )}
            </>
          )}

          {/* More Actions Menu */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline">
                <EllipsisHorizontalIcon className="w-4 h-4 mr-2" />
                More Actions
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={handleEditCampaign}>
                <PencilIcon className="w-4 h-4 mr-2" />
                Edit Campaign
              </DropdownMenuItem>

              <DropdownMenuItem onClick={handleDuplicateCampaign}>
                <DocumentDuplicateIcon className="w-4 h-4 mr-2" />
                Duplicate Campaign
              </DropdownMenuItem>

              <DropdownMenuSeparator />

              <DropdownMenuItem onClick={() => router.push(`/campaigns/${campaignId}/settings`)}>
                <Cog6ToothIcon className="w-4 h-4 mr-2" />
                Campaign Settings
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Campaign Overview */}
      <Card>
        <CardHeader>
          <CardTitle>Campaign Overview</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Channels */}
            <div>
              <h4 className="font-medium mb-3">Communication Channels</h4>
              <div className="space-y-2">
                {campaign.channels.map((channel) => {
                  const Icon = CHANNEL_ICONS[channel];
                  return (
                    <div key={channel} className="flex items-center gap-2">
                      <Icon className="w-4 h-4" />
                      <span className="capitalize">{channel}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Audience */}
            <div>
              <h4 className="font-medium mb-3">Target Audience</h4>
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <UsersIcon className="w-4 h-4" />
                  <span className="capitalize">{campaign.audience.type}</span>
                </div>
                {campaign.audience.estimatedSize && (
                  <div className="text-sm text-muted-foreground">
                    Estimated reach: {campaign.audience.estimatedSize.toLocaleString()} recipients
                  </div>
                )}
              </div>
            </div>

            {/* Schedule */}
            <div>
              <h4 className="font-medium mb-3">Schedule</h4>
              <div className="space-y-2">
                <div className="capitalize">{campaign.schedule.type}</div>
                {campaign.schedule.scheduledAt && (
                  <div className="text-sm text-muted-foreground">
                    Scheduled for: {formatDate(campaign.schedule.scheduledAt)}
                  </div>
                )}
                {campaign.schedule.timezone && (
                  <div className="text-sm text-muted-foreground">
                    Timezone: {campaign.schedule.timezone}
                  </div>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="lg:col-span-2">
          <Tabs defaultValue="monitoring" className="space-y-6">
            <TabsList>
              <TabsTrigger value="monitoring">
                <ChartBarIcon className="w-4 h-4 mr-2" />
                Monitoring
              </TabsTrigger>
              <TabsTrigger value="analytics">
                <ChartBarIcon className="w-4 h-4 mr-2" />
                Analytics
              </TabsTrigger>
              <TabsTrigger value="templates">
                <EnvelopeIcon className="w-4 h-4 mr-2" />
                Templates
              </TabsTrigger>
            </TabsList>

            <TabsContent value="monitoring">
              <CampaignStatusMonitor campaignId={campaignId} campaign={campaign} />
            </TabsContent>

            <TabsContent value="analytics">
              <Card>
                <CardHeader>
                  <CardTitle>Detailed Analytics</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground">
                    Detailed analytics charts and reports will be displayed here.
                  </p>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="templates">
              <Card>
                <CardHeader>
                  <CardTitle>Campaign Templates</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {campaign.templates.map((template, index) => (
                      <div key={index} className="border rounded-lg p-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            {React.createElement(CHANNEL_ICONS[template.channel], { className: "w-4 h-4" })}
                            <span className="font-medium">{template.templateName}</span>
                            <Badge variant="outline" className="capitalize">
                              {template.channel}
                            </Badge>
                          </div>
                          <Button variant="ghost" size="sm">
                            <PencilIcon className="w-4 h-4 mr-2" />
                            Edit Template
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          <CampaignControlPanel
            campaign={campaign}
            onEdit={handleEditCampaign}
          />
        </div>
      </div>
    </div>
  );
}