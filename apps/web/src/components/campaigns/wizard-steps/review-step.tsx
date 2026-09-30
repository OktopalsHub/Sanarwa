"use client";

import { CHANNEL_ICONS } from "../campaign-status";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { CampaignWizardData } from "@/lib/types/campaign";
import {
  ExclamationCircleIcon,
  BellIcon,
  CalendarIcon,
  CheckCircleIcon,
  PencilIcon,
  DocumentTextIcon,
  InformationCircleIcon,
  EnvelopeIcon,
  ChatBubbleLeftRightIcon,
  PhoneIcon,
  UsersIcon,
} from "@heroicons/react/24/outline";
import React from "react";

interface ReviewStepProps {
  data: CampaignWizardData["data"];
  onUpdate: (data: any) => void;
}

const CAMPAIGN_TYPE_LABELS = {
  one_time: "One-time Campaign",
  recurring: "Recurring Campaign",
  triggered: "Triggered Campaign",
  drip: "Drip Campaign",
};

const AUDIENCE_TYPE_LABELS = {
  all: "All Users",
  segment: "Saved Segments",
  custom: "Custom Filters",
};

const SCHEDULE_TYPE_LABELS = {
  immediate: "Send Immediately",
  scheduled: "Scheduled",
  recurring: "Recurring",
};

export function ReviewStep({ data }: ReviewStepProps) {
  const { basic, channels, audience, schedule, templates } = data;

  const getValidationIssues = () => {
    const issues = [];

    if (!basic?.name) issues.push("Campaign name is required");
    if (!basic?.type) issues.push("Campaign type is required");
    if (!channels?.selectedChannels?.length) issues.push("At least one channel must be selected");
    if (!audience?.type) issues.push("Audience targeting is required");
    if (!schedule?.type) issues.push("Schedule configuration is required");

    if (schedule?.type === "scheduled" && !schedule?.scheduledAt) {
      issues.push("Scheduled date and time is required");
    }

    if (schedule?.type === "recurring" && !schedule?.recurring) {
      issues.push("Recurring configuration is required");
    }

    return issues;
  };

  const formatScheduleDisplay = () => {
    if (!schedule) return "Not configured";

    if (schedule.type === "immediate") {
      return "Send immediately after creation";
    }

    if (schedule.type === "scheduled" && schedule.scheduledAt) {
      const date = new Date(schedule.scheduledAt);
      return `${date.toLocaleDateString()} at ${date.toLocaleTimeString()} (${schedule.timezone || "UTC"})`;
    }

    if (schedule.type === "recurring" && schedule.recurring) {
      const { frequency, interval, daysOfWeek } = schedule.recurring;

      if (frequency === "daily") {
        return `Every ${interval === 1 ? "day" : `${interval} days`}`;
      }

      if (frequency === "weekly" && daysOfWeek) {
        const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
        const days = daysOfWeek.map((d) => dayNames[d]).join(", ");
        return `Every ${interval === 1 ? "week" : `${interval} weeks`} on ${days}`;
      }

      if (frequency === "monthly") {
        return `Every ${interval === 1 ? "month" : `${interval} months`}`;
      }

      if (frequency === "yearly") {
        return `Every ${interval === 1 ? "year" : `${interval} years`}`;
      }
    }

    return "Configuration incomplete";
  };

  const formatAudienceDisplay = () => {
    if (!audience) return "Not configured";

    if (audience.type === "all") {
      return "All users in your database";
    }

    if (audience.type === "segment" && audience.segmentIds) {
      return `${audience.segmentIds.length} saved segment${audience.segmentIds.length > 1 ? "s" : ""}`;
    }

    if (audience.type === "custom" && audience.customFilters) {
      return `${audience.customFilters.length} custom filter${audience.customFilters.length > 1 ? "s" : ""}`;
    }

    return "Configuration incomplete";
  };

  const validationIssues = getValidationIssues();
  const hasIssues = validationIssues.length > 0;

  return (
    <div className="space-y-6">
      {/* Validation Status */}
      {hasIssues ? (
        <Card className="border-destructive bg-destructive/5">
          <CardContent className="pt-6">
            <div className="flex items-start gap-3">
              <ExclamationCircleIcon className="w-5 h-5 text-destructive mt-0.5" />
              <div>
                <h4 className="font-medium text-destructive">Configuration Issues</h4>
                <p className="text-sm text-destructive/80 mt-1">
                  Please resolve the following issues before launching:
                </p>
                <ul className="list-disc list-inside text-sm text-destructive/80 mt-2 space-y-1">
                  {validationIssues.map((issue, index) => (
                    <li key={index}>{issue}</li>
                  ))}
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card className="border-green-200 bg-green-50 dark:bg-green-950/20 dark:border-green-800">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <CheckCircleIcon className="w-5 h-5 text-green-600 dark:text-green-400" />
              <div>
                <h4 className="font-medium text-green-700 dark:text-green-400">Ready to Launch</h4>
                <p className="text-sm text-green-600 dark:text-green-500">
                  Your campaign is properly configured and ready to be created.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Campaign Overview */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <DocumentTextIcon className="w-5 h-5" />
            Campaign Overview
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <Label className="text-sm font-medium text-muted-foreground">Campaign Name</Label>
              <p className="text-lg font-medium">{basic?.name || "Not set"}</p>
            </div>

            <div>
              <Label className="text-sm font-medium text-muted-foreground">Campaign Type</Label>
              <p className="text-lg font-medium">
                {basic?.type ? CAMPAIGN_TYPE_LABELS[basic.type] : "Not set"}
              </p>
            </div>
          </div>

          {basic?.description && (
            <div>
              <Label className="text-sm font-medium text-muted-foreground">Description</Label>
              <p className="text-sm">{basic.description}</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Channels */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <EnvelopeIcon className="w-5 h-5" />
            Communication Channels
          </CardTitle>
        </CardHeader>
        <CardContent>
          {channels?.selectedChannels?.length ? (
            <div className="space-y-4">
              <div className="flex flex-wrap gap-2">
                {channels.selectedChannels.map((channel) => {
                  const Icon = CHANNEL_ICONS[channel];
                  return (
                    <Badge key={channel} variant="secondary" className="flex items-center gap-2">
                      <Icon className="w-3 h-3" />
                      {channel.toUpperCase()}
                    </Badge>
                  );
                })}
              </div>

              {/* Channel Configurations */}
              {Object.entries(channels.channelConfigs || {}).map(([channel, config]) => (
                <div key={channel} className="p-3 bg-muted/50 rounded-lg">
                  <h5 className="font-medium capitalize mb-2">{channel} Configuration</h5>
                  <div className="text-sm text-muted-foreground space-y-1">
                    {Object.entries(config).map(([key, value]) => (
                      <div key={key} className="flex justify-between">
                        <span className="capitalize">
                          {key.replace(/([A-Z])/g, " $1").toLowerCase()}:
                        </span>
                        <span>{String(value)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-muted-foreground">No channels selected</p>
          )}
        </CardContent>
      </Card>

      {/* Audience */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <UsersIcon className="w-5 h-5" />
            Target Audience
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label className="text-sm font-medium text-muted-foreground">Audience Type</Label>
            <p className="font-medium">
              {audience?.type ? AUDIENCE_TYPE_LABELS[audience.type] : "Not configured"}
            </p>
            <p className="text-sm text-muted-foreground mt-1">{formatAudienceDisplay()}</p>
          </div>

          {audience?.estimatedSize && (
            <div>
              <Label className="text-sm font-medium text-muted-foreground">Estimated Reach</Label>
              <p className="text-2xl font-bold text-primary">
                {audience.estimatedSize.toLocaleString()} users
              </p>
            </div>
          )}

          {audience?.type === "custom" && audience.customFilters && (
            <div>
              <Label className="text-sm font-medium text-muted-foreground">Custom Filters</Label>
              <div className="space-y-2 mt-2">
                {audience.customFilters.map((filter, index) => (
                  <div key={index} className="p-2 bg-muted/50 rounded text-sm">
                    <span className="font-medium">{filter.field}</span>
                    <span className="mx-2 text-muted-foreground">{filter.operator}</span>
                    <span>{String(filter.value)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Schedule */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CalendarIcon className="w-5 h-5" />
            Schedule
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label className="text-sm font-medium text-muted-foreground">Schedule Type</Label>
            <p className="font-medium">
              {schedule?.type ? SCHEDULE_TYPE_LABELS[schedule.type] : "Not configured"}
            </p>
          </div>

          <div>
            <Label className="text-sm font-medium text-muted-foreground">Details</Label>
            <p className="text-sm">{formatScheduleDisplay()}</p>
          </div>

          {schedule?.timezone && (
            <div>
              <Label className="text-sm font-medium text-muted-foreground">Timezone</Label>
              <p className="text-sm">{schedule.timezone}</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Templates */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <DocumentTextIcon className="w-5 h-5" />
            Templates
          </CardTitle>
        </CardHeader>
        <CardContent>
          {templates && templates.length > 0 ? (
            <div className="space-y-3">
              {templates.map((template, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between p-3 bg-muted/50 rounded-lg"
                >
                  <div className="flex items-center gap-3">
                    {React.createElement(CHANNEL_ICONS[template.channel], { className: "w-4 h-4" })}
                    <div>
                      <p className="font-medium">{template.templateName}</p>
                      <p className="text-sm text-muted-foreground capitalize">{template.channel}</p>
                    </div>
                  </div>
                  <Button variant="ghost" size="sm">
                    <PencilIcon className="w-4 h-4" />
                  </Button>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-6">
              <DocumentTextIcon className="w-8 h-8 mx-auto text-muted-foreground mb-2" />
              <p className="text-muted-foreground">No templates selected</p>
              <p className="text-sm text-muted-foreground">
                Templates will be selected in the next step after campaign creation
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Important Notes */}
      <Card className="bg-blue-50 border-blue-200 dark:bg-blue-950/20 dark:border-blue-800">
        <CardContent className="pt-6">
          <div className="flex items-start gap-3">
            <InformationCircleIcon className="w-5 h-5 text-blue-600 dark:text-blue-400 mt-0.5" />
            <div className="text-sm">
              <h4 className="font-medium text-blue-700 dark:text-blue-400 mb-2">
                Before You Launch
              </h4>
              <ul className="space-y-1 text-blue-600 dark:text-blue-500">
                <li>
                  • Double-check your audience targeting to ensure you're reaching the right users
                </li>
                <li>• Verify your schedule settings, especially timezone configurations</li>
                <li>• You can save as draft to make changes later, or launch immediately</li>
                <li>• Templates can be selected and configured after campaign creation</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function Label({ className, children, ...props }: React.ComponentProps<"label">) {
  return (
    <label className={`text-sm font-medium ${className || ""}`} {...props}>
      {children}
    </label>
  );
}
