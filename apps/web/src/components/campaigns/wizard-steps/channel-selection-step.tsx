"use client";

import { Card, CardContent } from "@/components/ui/card";
import type { CommunicationChannel } from "@/lib/types/campaign";
import { useState } from "react";
import { ChannelCard } from "./channel-card";
import { CHANNELS } from "./channel-options";

interface ChannelSelectionStepProps {
  data?: {
    selectedChannels: CommunicationChannel[];
    channelConfigs: Partial<Record<CommunicationChannel, any>>;
  };
  onUpdate: (data: {
    selectedChannels: CommunicationChannel[];
    channelConfigs: Partial<Record<CommunicationChannel, any>>;
  }) => void;
}

export function ChannelSelectionStep({ data, onUpdate }: ChannelSelectionStepProps) {
  const [selectedChannels, setSelectedChannels] = useState<CommunicationChannel[]>(
    data?.selectedChannels || [],
  );
  const [channelConfigs, setChannelConfigs] = useState<Partial<Record<CommunicationChannel, any>>>(
    data?.channelConfigs || {},
  );
  const [expandedConfigs, setExpandedConfigs] = useState<Set<CommunicationChannel>>(new Set());

  const handleChannelToggle = (channelId: CommunicationChannel, checked: boolean) => {
    const nextSelected = checked
      ? [...selectedChannels, channelId]
      : selectedChannels.filter((id) => id !== channelId);
    const nextConfigs = { ...channelConfigs };
    if (!checked) delete nextConfigs[channelId];

    setSelectedChannels(nextSelected);
    if (!checked) setChannelConfigs(nextConfigs);
    onUpdate({
      selectedChannels: nextSelected,
      channelConfigs: checked ? channelConfigs : nextConfigs,
    });
  };

  const updateChannelConfig = (
    channelId: CommunicationChannel,
    config: Record<string, unknown>,
  ) => {
    const nextConfigs = {
      ...channelConfigs,
      [channelId]: { ...channelConfigs[channelId], ...config },
    };
    setChannelConfigs(nextConfigs);
    onUpdate({ selectedChannels, channelConfigs: nextConfigs });
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="text-sm text-muted-foreground">
        Select the communication channels you want to use for this campaign. You can configure each
        channel&apos;s specific settings after selection.
      </div>

      <div className="grid gap-4">
        {CHANNELS.map((channel) => (
          <ChannelCard
            key={channel.id}
            channel={channel}
            selected={selectedChannels.includes(channel.id)}
            expanded={expandedConfigs.has(channel.id)}
            config={channelConfigs[channel.id] || {}}
            onToggle={(checked) => handleChannelToggle(channel.id, checked)}
            onExpand={() => {
              const next = new Set(expandedConfigs);
              if (next.has(channel.id)) next.delete(channel.id);
              else next.add(channel.id);
              setExpandedConfigs(next);
            }}
            onConfigChange={(config) => updateChannelConfig(channel.id, config)}
          />
        ))}
      </div>

      {selectedChannels.length > 0 ? (
        <Card className="border-primary/30 bg-primary/5">
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-primary">
              <div className="size-2 rounded-full bg-primary" />
              <span className="font-medium">
                {selectedChannels.length} channel{selectedChannels.length > 1 ? "s" : ""} selected
              </span>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              Your campaign will be sent through: {selectedChannels.join(", ")}
            </p>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
