"use client";

import { CampaignList } from "@/components/campaigns/campaign-list";
import { CampaignWizard } from "@/components/campaigns/campaign-wizard";
import { AppShell } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { campaignApi } from "@/lib/api/campaigns";
import type { Campaign } from "@/lib/types/campaign";
import { useQuery } from "@tanstack/react-query";
import { ChartBarIcon, EnvelopeIcon, PlusIcon, UsersIcon } from "@heroicons/react/24/outline";

import { useState } from "react";

export default function CampaignsPage() {
  const [showWizard, setShowWizard] = useState(false);
  const [editingCampaign, setEditingCampaign] = useState<Campaign | null>(null);

  // Fetch campaign stats for the header
  const { data: campaignsData } = useQuery({
    queryKey: ["campaigns", { limit: 1000 }], // Get all campaigns for stats
    queryFn: () => campaignApi.getCampaigns({ limit: 1000 }),
  });

  const campaigns = campaignsData?.campaigns || [];
  const totalCampaigns = campaigns.length;
  const activeCampaigns = campaigns.filter((c) => c.status === "active").length;
  const totalReach = campaigns.reduce((sum, c) => sum + c.analytics.totalSent, 0);
  const avgOpenRate =
    campaigns.length > 0
      ? campaigns.reduce((sum, c) => sum + c.analytics.openRate, 0) / campaigns.length
      : 0;

  const handleEditCampaign = (campaign: Campaign) => {
    setEditingCampaign(campaign);
    setShowWizard(true);
  };

  const handleCloseWizard = () => {
    setShowWizard(false);
    setEditingCampaign(null);
  };

  if (showWizard) {
    return (
      <AppShell>
        <CampaignWizard
          onClose={handleCloseWizard}
          initialData={
            editingCampaign
              ? {
                  data: {
                    basic: {
                      name: editingCampaign.name,
                      description: editingCampaign.description,
                      type: editingCampaign.type,
                    },
                    channels: {
                      selectedChannels: editingCampaign.channels,
                      channelConfigs: editingCampaign.channels.reduce(
                        (acc, channel) => {
                          acc[channel] = {};
                          return acc;
                        },
                        {} as Record<string, any>,
                      ),
                    },
                    audience: editingCampaign.audience,
                    schedule: editingCampaign.schedule,
                    templates: editingCampaign.templates,
                  },
                }
              : undefined
          }
        />
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="container mx-auto p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Campaigns</h1>
            <p className="text-muted-foreground">
              Create and manage your multi-channel communication campaigns
            </p>
          </div>
          <Button onClick={() => setShowWizard(true)}>
            <PlusIcon className="w-4 h-4 mr-2" />
            Create Campaign
          </Button>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-2">
                <EnvelopeIcon className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm font-medium">Total Campaigns</span>
              </div>
              <p className="text-2xl font-bold mt-2">{totalCampaigns}</p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-2">
                <ChartBarIcon className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm font-medium">Active</span>
              </div>
              <p className="text-2xl font-bold mt-2">{activeCampaigns}</p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-2">
                <UsersIcon className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm font-medium">Total Reach</span>
              </div>
              <p className="text-2xl font-bold mt-2">
                {totalReach > 1000 ? `${(totalReach / 1000).toFixed(1)}K` : totalReach}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-2">
                <ChartBarIcon className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm font-medium">Avg. Open Rate</span>
              </div>
              <p className="text-2xl font-bold mt-2">{avgOpenRate.toFixed(1)}%</p>
            </CardContent>
          </Card>
        </div>

        {/* Campaign List */}
        <CampaignList
          onEdit={handleEditCampaign}
          onDuplicate={(_campaign) => {
            // Handle duplicate - could navigate to the new campaign or show a success message
          }}
        />
      </div>
    </AppShell>
  );
}
