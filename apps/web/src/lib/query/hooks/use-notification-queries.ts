import { notificationApi } from "@sanarwa/api-client";
import type {
  BulkNotificationRequest,
  CreateInAppNotificationRequest,
  CreateNotificationRequest,
  InAppNotification,
  NotificationQueryParams,
  NotificationStatusUpdate,
  QueueStatus,
} from "@/lib/types/notification";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

export function useNotifications(params?: NotificationQueryParams) {
  return useQuery({
    queryKey: ["notifications", params],
    queryFn: () => notificationApi.getNotifications(params),
    staleTime: 30 * 1000,
    refetchInterval: 60 * 1000,
  });
}

export function useInAppNotifications(params?: {
  page?: number;
  limit?: number;
  status?: string;
  type?: string;
  category?: string;
  unreadOnly?: boolean;
}) {
  return useQuery({
    queryKey: ["notifications", "in-app", params],
    queryFn: () => notificationApi.getInAppNotifications(params),
    staleTime: 30 * 1000,
    refetchInterval: 30 * 1000,
  });
}

export function useNotificationStatus(notificationId: string) {
  return useQuery({
    queryKey: ["notifications", notificationId, "status"],
    queryFn: () => notificationApi.getNotificationStatus(notificationId),
    enabled: !!notificationId,
    staleTime: 10 * 1000,
    refetchInterval: 15 * 1000,
  });
}

export function useNotificationStats(startDate?: Date, endDate?: Date) {
  return useQuery({
    queryKey: ["notifications", "stats", startDate?.toISOString(), endDate?.toISOString()],
    queryFn: () => notificationApi.getNotificationStats(startDate, endDate),
    staleTime: 5 * 60 * 1000,
  });
}

export function useDeliveryMetrics(params?: {
  channel?: string;
  startDate?: Date;
  endDate?: Date;
  groupBy?: "hour" | "day" | "week" | "month";
}) {
  return useQuery({
    queryKey: ["notifications", "metrics", "delivery", params],
    queryFn: () => notificationApi.getDeliveryMetrics(params),
    staleTime: 2 * 60 * 1000,
  });
}

export function useEngagementMetrics(params?: {
  channel?: string;
  startDate?: Date;
  endDate?: Date;
  groupBy?: "hour" | "day" | "week" | "month";
}) {
  return useQuery({
    queryKey: ["notifications", "metrics", "engagement", params],
    queryFn: () => notificationApi.getEngagementMetrics(params),
    staleTime: 2 * 60 * 1000,
  });
}

export function useQueueStatus() {
  return useQuery({
    queryKey: ["notifications", "queue", "status"],
    queryFn: () => notificationApi.getQueueStatus(),
    staleTime: 30 * 1000,
    refetchInterval: 30 * 1000,
  });
}

export function useQueueStats() {
  return useQuery({
    queryKey: ["notifications", "queue", "stats"],
    queryFn: () => notificationApi.getQueueStats(),
    staleTime: 30 * 1000,
    refetchInterval: 30 * 1000,
  });
}

export function useSendNotification() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateNotificationRequest) => notificationApi.sendNotification(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
      queryClient.invalidateQueries({ queryKey: ["notifications", "stats"] });
      queryClient.invalidateQueries({ queryKey: ["notifications", "metrics"] });
    },
    onError: (error) => {
      console.error("Send notification failed:", error);
    },
  });
}

export function useSendBulkNotifications() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: BulkNotificationRequest) => notificationApi.sendBulkNotifications(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
      queryClient.invalidateQueries({ queryKey: ["notifications", "stats"] });
      queryClient.invalidateQueries({ queryKey: ["notifications", "metrics"] });
    },
    onError: (error) => {
      console.error("Send bulk notifications failed:", error);
    },
  });
}

export function useCreateInAppNotification() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateInAppNotificationRequest) =>
      notificationApi.createInAppNotification(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications", "in-app"] });
    },
    onError: (error) => {
      console.error("Create in-app notification failed:", error);
    },
  });
}

export function useCreateBulkInAppNotifications() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: { notifications: CreateInAppNotificationRequest[] }) =>
      notificationApi.createBulkInAppNotifications(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications", "in-app"] });
    },
    onError: (error) => {
      console.error("Create bulk in-app notifications failed:", error);
    },
  });
}

export function useRetryNotification() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (notificationId: string) => notificationApi.retryNotification(notificationId),
    onSuccess: (data, notificationId) => {
      queryClient.invalidateQueries({ queryKey: ["notifications", notificationId, "status"] });
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
      queryClient.invalidateQueries({ queryKey: ["notifications", "queue"] });
    },
    onError: (error) => {
      console.error("Retry notification failed:", error);
    },
  });
}

export function useMarkNotificationAsRead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (notificationId: string) => notificationApi.markNotificationAsRead(notificationId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications", "in-app"] });
    },
    onMutate: async (notificationId) => {
      await queryClient.cancelQueries({ queryKey: ["notifications", "in-app"] });

      const previousNotifications = queryClient.getQueryData(["notifications", "in-app"]);

      queryClient.setQueryData(["notifications", "in-app"], (old: any) => {
        if (!old?.data) return old;

        return {
          ...old,
          data: old.data.map((notification: InAppNotification) =>
            notification.id === notificationId
              ? { ...notification, readAt: new Date(), status: "read" }
              : notification,
          ),
        };
      });

      return { previousNotifications };
    },
    onError: (error, notificationId, context) => {
      console.error("Mark notification as read failed:", error);
      if (context?.previousNotifications) {
        queryClient.setQueryData(["notifications", "in-app"], context.previousNotifications);
      }
    },
  });
}

export function useMarkAllNotificationsAsRead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => notificationApi.markAllNotificationsAsRead(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications", "in-app"] });
    },
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: ["notifications", "in-app"] });

      const previousNotifications = queryClient.getQueryData(["notifications", "in-app"]);

      queryClient.setQueryData(["notifications", "in-app"], (old: any) => {
        if (!old?.data) return old;

        return {
          ...old,
          data: old.data.map((notification: InAppNotification) => ({
            ...notification,
            readAt: new Date(),
            status: "read",
          })),
        };
      });

      return { previousNotifications };
    },
    onError: (error, variables, context) => {
      console.error("Mark all notifications as read failed:", error);
      if (context?.previousNotifications) {
        queryClient.setQueryData(["notifications", "in-app"], context.previousNotifications);
      }
    },
  });
}

export function useDeleteInAppNotification() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (notificationId: string) => notificationApi.deleteInAppNotification(notificationId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications", "in-app"] });
    },
    onMutate: async (notificationId) => {
      await queryClient.cancelQueries({ queryKey: ["notifications", "in-app"] });

      const previousNotifications = queryClient.getQueryData(["notifications", "in-app"]);

      queryClient.setQueryData(["notifications", "in-app"], (old: any) => {
        if (!old?.data) return old;

        return {
          ...old,
          data: old.data.filter(
            (notification: InAppNotification) => notification.id !== notificationId,
          ),
        };
      });

      return { previousNotifications, notificationId };
    },
    onError: (error, notificationId, context) => {
      console.error("Delete in-app notification failed:", error);
      if (context?.previousNotifications) {
        queryClient.setQueryData(["notifications", "in-app"], context.previousNotifications);
      }
    },
  });
}

export function usePauseQueue() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (channel: string) => notificationApi.pauseQueue(channel),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications", "queue"] });
    },
    onError: (error) => {
      console.error("Pause queue failed:", error);
    },
  });
}

export function useResumeQueue() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (channel: string) => notificationApi.resumeQueue(channel),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications", "queue"] });
    },
    onError: (error) => {
      console.error("Resume queue failed:", error);
    },
  });
}

export function useClearFailedJobs() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (channel: string) => notificationApi.clearFailedJobs(channel),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications", "queue"] });
    },
    onError: (error) => {
      console.error("Clear failed jobs failed:", error);
    },
  });
}

export function useRealtimeNotifications() {
  const queryClient = useQueryClient();

  const handleNotificationUpdate = (update: NotificationStatusUpdate) => {
    queryClient.setQueryData(["notifications", update.id, "status"], update);

    queryClient.invalidateQueries({ queryKey: ["notifications"] });
  };

  const handleNewInAppNotification = (notification: InAppNotification) => {
    queryClient.setQueryData(["notifications", "in-app"], (old: any) => {
      if (!old?.data) return old;

      return {
        ...old,
        data: [notification, ...old.data],
        pagination: {
          ...old.pagination,
          total: old.pagination.total + 1,
        },
      };
    });
  };

  const handleQueueUpdate = (queueStatus: QueueStatus[]) => {
    queryClient.setQueryData(["notifications", "queue", "status"], queueStatus);
  };

  return {
    handleNotificationUpdate,
    handleNewInAppNotification,
    handleQueueUpdate,
  };
}

export function useNotificationValidation() {
  const validateNotification = (data: CreateNotificationRequest) => {
    return notificationApi.validateNotificationData(data);
  };

  const validateInAppNotification = (data: CreateInAppNotificationRequest) => {
    return notificationApi.validateInAppNotificationData(data);
  };

  const canRetryNotification = (status: string, retryCount: number, maxRetries?: number) => {
    return notificationApi.canRetryNotification(status, retryCount, maxRetries);
  };

  return {
    validateNotification,
    validateInAppNotification,
    canRetryNotification,
  };
}

export function useUnreadNotificationCount() {
  const { data: notifications } = useInAppNotifications({ unreadOnly: true });

  return {
    count: notifications?.pagination?.total || 0,
    hasUnread: (notifications?.pagination?.total || 0) > 0,
  };
}
