import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { Campaign } from "@/lib/types/campaign";
import { IconChartBar, IconMail, IconPencil, IconUsers } from "@tabler/icons-react";
import { CampaignControlPanel } from "./campaign-control-panel";
import { CampaignStatusMonitor } from "./campaign-status-monitor";
import { CHANNEL_ICONS, formatCampaignDate } from "./campaign-status";

interface CampaignDetailsBodyProps {
  campaign: Campaign;
  onEdit: () => void;
}

export function CampaignDetailsBody({ campaign, onEdit }: CampaignDetailsBodyProps) {
  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Campaign Overview</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
            <div>
              <h4 className="mb-3 font-medium">Communication Channels</h4>
              <div className="flex flex-col gap-2">
                {campaign.channels.map((channel) => {
                  const Icon = CHANNEL_ICONS[channel];
                  return (
                    <div key={channel} className="flex items-center gap-2">
                      <Icon className="size-4" />
                      <span className="capitalize">{channel}</span>
                    </div>
                  );
                })}
              </div>
            </div>
            <div>
              <h4 className="mb-3 font-medium">Target Audience</h4>
              <div className="flex flex-col gap-2">
                <div className="flex items-center gap-2">
                  <IconUsers className="size-4" />
                  <span className="capitalize">{campaign.audience.type}</span>
                </div>
                {campaign.audience.estimatedSize ? (
                  <div className="text-sm text-muted-foreground">
                    Estimated reach: {campaign.audience.estimatedSize.toLocaleString()} recipients
                  </div>
                ) : null}
              </div>
            </div>
            <div>
              <h4 className="mb-3 font-medium">Schedule</h4>
              <div className="flex flex-col gap-2">
                <div className="capitalize">{campaign.schedule.type}</div>
                {campaign.schedule.scheduledAt ? (
                  <div className="text-sm text-muted-foreground">
                    Scheduled for: {formatCampaignDate(campaign.schedule.scheduledAt, true)}
                  </div>
                ) : null}
                {campaign.schedule.timezone ? (
                  <div className="text-sm text-muted-foreground">
                    Timezone: {campaign.schedule.timezone}
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <Tabs defaultValue="monitoring" className="flex flex-col gap-6">
            <TabsList>
              <TabsTrigger value="monitoring">
                <IconChartBar data-icon="inline-start" />
                Monitoring
              </TabsTrigger>
              <TabsTrigger value="analytics">
                <IconChartBar data-icon="inline-start" />
                Analytics
              </TabsTrigger>
              <TabsTrigger value="templates">
                <IconMail data-icon="inline-start" />
                Templates
              </TabsTrigger>
            </TabsList>
            <TabsContent value="monitoring">
              <CampaignStatusMonitor campaignId={campaign.id} campaign={campaign} />
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
                  <div className="flex flex-col gap-4">
                    {campaign.templates.map((template, index) => {
                      const Icon = CHANNEL_ICONS[template.channel];
                      return (
                        <div key={index} className="rounded-lg border p-4">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <Icon className="size-4" />
                              <span className="font-medium">{template.templateName}</span>
                              <Badge variant="outline" className="capitalize">
                                {template.channel}
                              </Badge>
                            </div>
                            <Button variant="ghost" size="sm">
                              <IconPencil data-icon="inline-start" />
                              Edit Template
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
        <CampaignControlPanel campaign={campaign} onEdit={onEdit} />
      </div>
    </>
  );
}
