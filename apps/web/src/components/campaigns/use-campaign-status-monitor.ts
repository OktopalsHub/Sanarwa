import { campaignApi } from "@/lib/api/campaigns";
import type { Campaign } from "@/lib/types/campaign";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";

export type RealtimeEvent = {
  id: string;
  timestamp: Date;
  type: "info" | "success" | "warning" | "error";
  message: string;
};

export function useCampaignStatusMonitor(
  campaignId: string,
  initialCampaign: Campaign | undefined,
  refreshInterval: number,
  enableWebSocket: boolean,
) {
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());
  const [connectionStatus, setConnectionStatus] = useState<"connected" | "disconnected" | "error">(
    "disconnected",
  );
  const [realtimeEvents, setRealtimeEvents] = useState<RealtimeEvent[]>([]);

  const { data: campaign, isLoading } = useQuery({
    queryKey: ["campaign", campaignId],
    queryFn: () => campaignApi.getCampaign(campaignId),
    initialData: initialCampaign,
    refetchInterval: refreshInterval,
    refetchIntervalInBackground: true,
  });

  const { data: analytics } = useQuery({
    queryKey: ["campaign-analytics", campaignId],
    queryFn: () => campaignApi.getCampaignAnalytics(campaignId),
    refetchInterval: refreshInterval,
    refetchIntervalInBackground: true,
  });

  useEffect(() => {
    setLastUpdate(new Date());
  }, [campaign, analytics]);

  const isActive = campaign?.status === "active";

  useEffect(() => {
    if (!enableWebSocket || !isActive) return;

    const eventTypes: RealtimeEvent["type"][] = ["info", "success", "warning", "error"];
    const messages = [
      "Campaign is actively sending messages",
      "Batch of 500 emails queued for delivery",
      "SMS delivery rate: 98.5% (2 failures)",
      "Push notifications sent to 1,234 devices",
      "Email batch completed successfully",
    ];

    setConnectionStatus("connected");
    const interval = setInterval(() => {
      const type = eventTypes[Math.floor(Math.random() * eventTypes.length)]!;
      const message = messages[Math.floor(Math.random() * messages.length)]!;
      setRealtimeEvents((prev) => [
        {
          id: Math.random().toString(36).slice(2, 11),
          timestamp: new Date(),
          type,
          message,
        },
        ...prev.slice(0, 9),
      ]);
    }, 15000);

    return () => {
      clearInterval(interval);
      setConnectionStatus("disconnected");
    };
  }, [enableWebSocket, isActive]);

  return {
    campaign,
    analytics,
    isLoading,
    isActive,
    lastUpdate,
    connectionStatus,
    realtimeEvents,
  };
}
