"use client";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { Campaign } from "@/lib/types/campaign";
import { toast } from "@/lib/utils/toast";
import {
  IconAlertTriangle,
  IconCalendar,
  IconClock,
  IconCopy,
  IconPencil,
  IconPlayerPause,
  IconPlayerPlay,
  IconPlayerStop,
  IconSend,
  IconUsers,
} from "@tabler/icons-react";
import { useState } from "react";
import { CampaignScheduleDialog, CampaignTestDialog, parseTestEmails } from "./campaign-dialogs";
import { campaignStatusVariant, formatCampaignDate } from "./campaign-status";
import { useCampaignMutations } from "./use-campaign-mutations";

interface CampaignControlPanelProps {
  campaign: Campaign;
  onEdit?: () => void;
}

export function CampaignControlPanel({ campaign, onEdit }: CampaignControlPanelProps) {
  const mutations = useCampaignMutations({ campaignId: campaign.id });
  const [showTestDialog, setShowTestDialog] = useState(false);
  const [showScheduleDialog, setShowScheduleDialog] = useState(false);
  const [testEmails, setTestEmails] = useState("");
  const [scheduleDate, setScheduleDate] = useState("");
  const [scheduleTime, setScheduleTime] = useState("");

  const canStart = campaign.status === "draft" || campaign.status === "scheduled";
  const canPause = campaign.status === "active";
  const canResume = campaign.status === "paused";
  const canStop = campaign.status === "active" || campaign.status === "paused";
  const canTest = campaign.status !== "active";

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <IconUsers className="size-5" />
            Campaign Controls
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex items-center justify-between rounded-lg bg-muted p-3">
            <div className="flex items-center gap-3">
              <span className="text-sm font-medium">Status:</span>
              <Badge variant={campaignStatusVariant(campaign.status)}>{campaign.status}</Badge>
            </div>
            {campaign.schedule.scheduledAt ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <IconCalendar className="size-4" />
                Scheduled: {formatCampaignDate(campaign.schedule.scheduledAt)}
              </div>
            ) : null}
          </div>

          <div className="grid grid-cols-2 gap-2">
            {canStart ? (
              <Button
                onClick={() => mutations.start.mutate(campaign.id)}
                disabled={mutations.start.isPending}
                className="w-full"
              >
                <IconSend data-icon="inline-start" />
                {campaign.status === "scheduled" ? "Start Now" : "Start Campaign"}
              </Button>
            ) : null}
            {canPause ? (
              <Button
                variant="outline"
                onClick={() => mutations.pause.mutate(campaign.id)}
                disabled={mutations.pause.isPending}
                className="w-full"
              >
                <IconPlayerPause data-icon="inline-start" />
                Pause
              </Button>
            ) : null}
            {canResume ? (
              <Button
                onClick={() => mutations.resume.mutate(campaign.id)}
                disabled={mutations.resume.isPending}
                className="w-full"
              >
                <IconPlayerPlay data-icon="inline-start" />
                Resume
              </Button>
            ) : null}
            {canStop ? (
              <Button
                variant="outline"
                onClick={() => {
                  if (
                    confirm(
                      "Are you sure you want to stop this campaign? This action cannot be undone.",
                    )
                  ) {
                    mutations.stop.mutate(campaign.id);
                  }
                }}
                disabled={mutations.stop.isPending}
                className="w-full text-destructive hover:text-destructive"
              >
                <IconPlayerStop data-icon="inline-start" />
                Stop
              </Button>
            ) : null}
            {onEdit ? (
              <Button variant="outline" onClick={onEdit} className="w-full">
                <IconPencil data-icon="inline-start" />
                Edit
              </Button>
            ) : null}
            <Button
              variant="outline"
              onClick={() =>
                mutations.duplicate.mutate({ id: campaign.id, name: `${campaign.name} (Copy)` })
              }
              disabled={mutations.duplicate.isPending}
              className="w-full"
            >
              <IconCopy data-icon="inline-start" />
              Duplicate
            </Button>
            {canTest ? (
              <Button variant="outline" onClick={() => setShowTestDialog(true)} className="w-full">
                <IconSend data-icon="inline-start" />
                Send Test
              </Button>
            ) : null}
            {campaign.status === "draft" ? (
              <Button
                variant="outline"
                onClick={() => setShowScheduleDialog(true)}
                className="w-full"
              >
                <IconClock data-icon="inline-start" />
                Schedule
              </Button>
            ) : null}
          </div>

          <div className="flex flex-col gap-2 border-t pt-4 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Created:</span>
              <span>{formatCampaignDate(campaign.createdAt)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Last Updated:</span>
              <span>{formatCampaignDate(campaign.updatedAt)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Type:</span>
              <span className="capitalize">{campaign.type.replace("_", " ")}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Channels:</span>
              <span>{campaign.channels.length}</span>
            </div>
          </div>

          {campaign.status === "draft" ? (
            <Alert>
              <IconAlertTriangle />
              <AlertTitle>Campaign is in draft mode</AlertTitle>
              <AlertDescription>
                Review your settings and start the campaign when ready.
              </AlertDescription>
            </Alert>
          ) : null}
        </CardContent>
      </Card>

      <CampaignTestDialog
        open={showTestDialog}
        emails={testEmails}
        pending={mutations.sendTest.isPending}
        onOpenChange={setShowTestDialog}
        onEmailsChange={setTestEmails}
        onSend={() => {
          const emails = parseTestEmails(testEmails);
          if (!emails) return;
          mutations.sendTest.mutate(
            { id: campaign.id, emails },
            {
              onSuccess: () => {
                setShowTestDialog(false);
                setTestEmails("");
              },
            },
          );
        }}
      />

      <CampaignScheduleDialog
        open={showScheduleDialog}
        date={scheduleDate}
        time={scheduleTime}
        onOpenChange={setShowScheduleDialog}
        onDateChange={setScheduleDate}
        onTimeChange={setScheduleTime}
        onSchedule={() => {
          toast.success("Campaign scheduled successfully");
          setShowScheduleDialog(false);
        }}
      />
    </>
  );
}
