import { campaignApi } from "@/lib/api/campaigns";
import type { Campaign } from "@/lib/types/campaign";
import { toast } from "@/lib/utils/toast";
import { useMutation, useQueryClient } from "@tanstack/react-query";

function reportBulk(action: string, results: PromiseSettledResult<unknown>[]) {
  const successful = results.filter((result) => result.status === "fulfilled").length;
  const failed = results.filter((result) => result.status === "rejected").length;
  if (failed === 0) {
    toast.success(`Successfully ${action} ${successful} campaigns`);
  } else {
    toast.error(`${action} ${successful} campaigns, ${failed} failed`);
  }
}

export function useCampaignMutations(options?: {
  campaignId?: string;
  onDuplicated?: (campaign: Campaign) => void;
  onBulkSettled?: () => void;
}) {
  const queryClient = useQueryClient();

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["campaigns"] });
    if (options?.campaignId) {
      queryClient.invalidateQueries({ queryKey: ["campaign", options.campaignId] });
    }
  };

  const onError = (error: Error, fallback: string) => {
    toast.error(error.message || fallback);
  };

  const start = useMutation({
    mutationFn: campaignApi.startCampaign,
    onSuccess: () => {
      invalidate();
      toast.success("Campaign started successfully");
    },
    onError: (error: Error) => onError(error, "Failed to start campaign"),
  });

  const pause = useMutation({
    mutationFn: campaignApi.pauseCampaign,
    onSuccess: () => {
      invalidate();
      toast.success("Campaign paused successfully");
    },
    onError: (error: Error) => onError(error, "Failed to pause campaign"),
  });

  const resume = useMutation({
    mutationFn: campaignApi.resumeCampaign,
    onSuccess: () => {
      invalidate();
      toast.success("Campaign resumed successfully");
    },
    onError: (error: Error) => onError(error, "Failed to resume campaign"),
  });

  const stop = useMutation({
    mutationFn: campaignApi.stopCampaign,
    onSuccess: () => {
      invalidate();
      toast.success("Campaign stopped successfully");
    },
    onError: (error: Error) => onError(error, "Failed to stop campaign"),
  });

  const duplicate = useMutation({
    mutationFn: ({ id, name }: { id: string; name: string }) =>
      campaignApi.duplicateCampaign(id, name),
    onSuccess: (campaign) => {
      invalidate();
      toast.success("Campaign duplicated successfully");
      options?.onDuplicated?.(campaign);
    },
    onError: (error: Error) => onError(error, "Failed to duplicate campaign"),
  });

  const remove = useMutation({
    mutationFn: campaignApi.deleteCampaign,
    onSuccess: () => {
      invalidate();
      toast.success("Campaign deleted successfully");
    },
    onError: (error: Error) => onError(error, "Failed to delete campaign"),
  });

  const sendTest = useMutation({
    mutationFn: ({ id, emails }: { id: string; emails: string[] }) =>
      campaignApi.sendTestCampaign(id, emails),
    onSuccess: () => toast.success("Test campaign sent successfully"),
    onError: (error: Error) => onError(error, "Failed to send test campaign"),
  });

  const bulkPause = useMutation({
    mutationFn: (ids: string[]) =>
      Promise.allSettled(ids.map((id) => campaignApi.pauseCampaign(id))),
    onSuccess: (results) => {
      invalidate();
      reportBulk("paused", results);
      options?.onBulkSettled?.();
    },
    onError: () => toast.error("Failed to pause campaigns"),
  });

  const bulkResume = useMutation({
    mutationFn: (ids: string[]) =>
      Promise.allSettled(ids.map((id) => campaignApi.resumeCampaign(id))),
    onSuccess: (results) => {
      invalidate();
      reportBulk("resumed", results);
      options?.onBulkSettled?.();
    },
    onError: () => toast.error("Failed to resume campaigns"),
  });

  const bulkStop = useMutation({
    mutationFn: (ids: string[]) =>
      Promise.allSettled(ids.map((id) => campaignApi.stopCampaign(id))),
    onSuccess: (results) => {
      invalidate();
      reportBulk("stopped", results);
      options?.onBulkSettled?.();
    },
    onError: () => toast.error("Failed to stop campaigns"),
  });

  return {
    start,
    pause,
    resume,
    stop,
    duplicate,
    remove,
    sendTest,
    bulkPause,
    bulkResume,
    bulkStop,
  };
}
