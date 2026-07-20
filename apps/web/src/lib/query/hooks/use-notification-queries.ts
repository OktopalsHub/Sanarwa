import { notificationApi } from '@/lib/api/notification';
import type {
  BulkNotificationRequest,
  CreateInAppNotificationRequest,
  CreateNotificationRequest,
  InAppNotification,
  NotificationQueryParams,
  NotificationStatusUpdate,
  QueueStatus
} from '@/lib/types/notification';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

// Query hook for notifications with filtering and pagination
export function useNotifications(params?: NotificationQueryParams) {
  return useQuery({
    queryKey: ['notifications', params],
    queryFn: () => notificationApi.getNotifications(params),
    staleTime: 30 * 1000, // 30 seconds - notifications change frequently
    refetchInterval: 60 * 1000, // Refetch every minute for real-time updates
  });
}

// Query hook for in-app notifications
export function useInAppNotifications(params?: {
  page?: number;
  limit?: number;
  status?: string;
  type?: string;
  category?: string;
  unreadOnly?: boolean;
}) {
  return useQuery({
    queryKey: ['notifications', 'in-app', params],
    queryFn: () => notificationApi.getInAppNotifications(params),
    staleTime: 30 * 1000, // 30 seconds
    refetchInterval: 30 * 1000, // Refetch every 30 seconds for real-time updates
  });
}

// Query hook for notification status by ID
export function useNotificationStatus(notificationId: string) {
  return useQuery({
    queryKey: ['notifications', notificationId, 'status'],
    queryFn: () => notificationApi.getNotificationStatus(notificationId),
    enabled: !!notificationId,
    staleTime: 10 * 1000, // 10 seconds - status changes frequently
    refetchInterval: 15 * 1000, // Refetch every 15 seconds for real-time status
  });
}

// Query hook for notification statistics
export function useNotificationStats(startDate?: Date, endDate?: Date) {
  return useQuery({
    queryKey: ['notifications', 'stats', startDate?.toISOString(), endDate?.toISOString()],
    queryFn: () => notificationApi.getNotificationStats(startDate, endDate),
    staleTime: 5 * 60 * 1000, // 5 minutes - stats don't change as frequently
  });
}

// Query hook for delivery metrics
export function useDeliveryMetrics(params?: {
  channel?: string;
  startDate?: Date;
  endDate?: Date;
  groupBy?: 'hour' | 'day' | 'week' | 'month';
}) {
  return useQuery({
    queryKey: ['notifications', 'metrics', 'delivery', params],
    queryFn: () => notificationApi.getDeliveryMetrics(params),
    staleTime: 2 * 60 * 1000, // 2 minutes
  });
}

// Query hook for engagement metrics
export function useEngagementMetrics(params?: {
  channel?: string;
  startDate?: Date;
  endDate?: Date;
  groupBy?: 'hour' | 'day' | 'week' | 'month';
}) {
  return useQuery({
    queryKey: ['notifications', 'metrics', 'engagement', params],
    queryFn: () => notificationApi.getEngagementMetrics(params),
    staleTime: 2 * 60 * 1000, // 2 minutes
  });
}

// Query hook for queue status
export function useQueueStatus() {
  return useQuery({
    queryKey: ['notifications', 'queue', 'status'],
    queryFn: () => notificationApi.getQueueStatus(),
    staleTime: 30 * 1000, // 30 seconds
    refetchInterval: 30 * 1000, // Refetch every 30 seconds for real-time queue monitoring
  });
}

// Query hook for queue statistics
export function useQueueStats() {
  return useQuery({
    queryKey: ['notifications', 'queue', 'stats'],
    queryFn: () => notificationApi.getQueueStats(),
    staleTime: 30 * 1000, // 30 seconds
    refetchInterval: 30 * 1000, // Refetch every 30 seconds
  });
}

// Mutation hook for sending a single notification
export function useSendNotification() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateNotificationRequest) => notificationApi.sendNotification(data),
    onSuccess: () => {
      // Invalidate notifications list to show new notification
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      // Invalidate stats to update metrics
      queryClient.invalidateQueries({ queryKey: ['notifications', 'stats'] });
      queryClient.invalidateQueries({ queryKey: ['notifications', 'metrics'] });
    },
    onError: (error) => {
      console.error('Send notification failed:', error);
    },
  });
}

// Mutation hook for sending bulk notifications
export function useSendBulkNotifications() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: BulkNotificationRequest) => notificationApi.sendBulkNotifications(data),
    onSuccess: () => {
      // Invalidate notifications list and stats
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      queryClient.invalidateQueries({ queryKey: ['notifications', 'stats'] });
      queryClient.invalidateQueries({ queryKey: ['notifications', 'metrics'] });
    },
    onError: (error) => {
      console.error('Send bulk notifications failed:', error);
    },
  });
}

// Mutation hook for creating in-app notifications
export function useCreateInAppNotification() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateInAppNotificationRequest) => notificationApi.createInAppNotification(data),
    onSuccess: () => {
      // Invalidate in-app notifications list
      queryClient.invalidateQueries({ queryKey: ['notifications', 'in-app'] });
    },
    onError: (error) => {
      console.error('Create in-app notification failed:', error);
    },
  });
}

// Mutation hook for creating bulk in-app notifications
export function useCreateBulkInAppNotifications() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: { notifications: CreateInAppNotificationRequest[] }) =>
      notificationApi.createBulkInAppNotifications(data),
    onSuccess: () => {
      // Invalidate in-app notifications list
      queryClient.invalidateQueries({ queryKey: ['notifications', 'in-app'] });
    },
    onError: (error) => {
      console.error('Create bulk in-app notifications failed:', error);
    },
  });
}

// Mutation hook for retrying failed notifications
export function useRetryNotification() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (notificationId: string) => notificationApi.retryNotification(notificationId),
    onSuccess: (data, notificationId) => {
      // Invalidate specific notification status
      queryClient.invalidateQueries({ queryKey: ['notifications', notificationId, 'status'] });
      // Invalidate notifications list
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      // Invalidate queue status
      queryClient.invalidateQueries({ queryKey: ['notifications', 'queue'] });
    },
    onError: (error) => {
      console.error('Retry notification failed:', error);
    },
  });
}

// Mutation hook for marking notification as read
export function useMarkNotificationAsRead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (notificationId: string) => notificationApi.markNotificationAsRead(notificationId),
    onSuccess: () => {
      // Invalidate in-app notifications to update read status
      queryClient.invalidateQueries({ queryKey: ['notifications', 'in-app'] });
    },
    // Optimistic update for better UX
    onMutate: async (notificationId) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: ['notifications', 'in-app'] });

      // Snapshot previous value
      const previousNotifications = queryClient.getQueryData(['notifications', 'in-app']);

      // Optimistically update
      queryClient.setQueryData(['notifications', 'in-app'], (old: any) => {
        if (!old?.data) return old;

        return {
          ...old,
          data: old.data.map((notification: InAppNotification) =>
            notification.id === notificationId
              ? { ...notification, readAt: new Date(), status: 'read' }
              : notification
          ),
        };
      });

      return { previousNotifications };
    },
    // Rollback on error
    onError: (error, notificationId, context) => {
      console.error('Mark notification as read failed:', error);
      if (context?.previousNotifications) {
        queryClient.setQueryData(['notifications', 'in-app'], context.previousNotifications);
      }
    },
  });
}

// Mutation hook for marking all notifications as read
export function useMarkAllNotificationsAsRead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => notificationApi.markAllNotificationsAsRead(),
    onSuccess: () => {
      // Invalidate in-app notifications to update read status
      queryClient.invalidateQueries({ queryKey: ['notifications', 'in-app'] });
    },
    // Optimistic update
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: ['notifications', 'in-app'] });

      const previousNotifications = queryClient.getQueryData(['notifications', 'in-app']);

      queryClient.setQueryData(['notifications', 'in-app'], (old: any) => {
        if (!old?.data) return old;

        return {
          ...old,
          data: old.data.map((notification: InAppNotification) => ({
            ...notification,
            readAt: new Date(),
            status: 'read'
          })),
        };
      });

      return { previousNotifications };
    },
    onError: (error, variables, context) => {
      console.error('Mark all notifications as read failed:', error);
      if (context?.previousNotifications) {
        queryClient.setQueryData(['notifications', 'in-app'], context.previousNotifications);
      }
    },
  });
}

// Mutation hook for deleting in-app notifications
export function useDeleteInAppNotification() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (notificationId: string) => notificationApi.deleteInAppNotification(notificationId),
    onSuccess: () => {
      // Invalidate in-app notifications list
      queryClient.invalidateQueries({ queryKey: ['notifications', 'in-app'] });
    },
    // Optimistic update
    onMutate: async (notificationId) => {
      await queryClient.cancelQueries({ queryKey: ['notifications', 'in-app'] });

      const previousNotifications = queryClient.getQueryData(['notifications', 'in-app']);

      queryClient.setQueryData(['notifications', 'in-app'], (old: any) => {
        if (!old?.data) return old;

        return {
          ...old,
          data: old.data.filter((notification: InAppNotification) => notification.id !== notificationId),
        };
      });

      return { previousNotifications, notificationId };
    },
    onError: (error, notificationId, context) => {
      console.error('Delete in-app notification failed:', error);
      if (context?.previousNotifications) {
        queryClient.setQueryData(['notifications', 'in-app'], context.previousNotifications);
      }
    },
  });
}

// Mutation hook for pausing queue
export function usePauseQueue() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (channel: string) => notificationApi.pauseQueue(channel),
    onSuccess: () => {
      // Invalidate queue status
      queryClient.invalidateQueries({ queryKey: ['notifications', 'queue'] });
    },
    onError: (error) => {
      console.error('Pause queue failed:', error);
    },
  });
}

// Mutation hook for resuming queue
export function useResumeQueue() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (channel: string) => notificationApi.resumeQueue(channel),
    onSuccess: () => {
      // Invalidate queue status
      queryClient.invalidateQueries({ queryKey: ['notifications', 'queue'] });
    },
    onError: (error) => {
      console.error('Resume queue failed:', error);
    },
  });
}

// Mutation hook for clearing failed jobs
export function useClearFailedJobs() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (channel: string) => notificationApi.clearFailedJobs(channel),
    onSuccess: () => {
      // Invalidate queue status and stats
      queryClient.invalidateQueries({ queryKey: ['notifications', 'queue'] });
    },
    onError: (error) => {
      console.error('Clear failed jobs failed:', error);
    },
  });
}

// Hook for real-time notification updates (to be used with WebSocket)
export function useRealtimeNotifications() {
  const queryClient = useQueryClient();

  const handleNotificationUpdate = (update: NotificationStatusUpdate) => {
    // Update specific notification status in cache
    queryClient.setQueryData(
      ['notifications', update.id, 'status'],
      update
    );

    // Invalidate notifications list to refresh
    queryClient.invalidateQueries({ queryKey: ['notifications'] });
  };

  const handleNewInAppNotification = (notification: InAppNotification) => {
    // Add new notification to in-app notifications cache
    queryClient.setQueryData(['notifications', 'in-app'], (old: any) => {
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
    // Update queue status in cache
    queryClient.setQueryData(['notifications', 'queue', 'status'], queueStatus);
  };

  return {
    handleNotificationUpdate,
    handleNewInAppNotification,
    handleQueueUpdate,
  };
}

// Hook for notification validation
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

// Hook for unread notification count
export function useUnreadNotificationCount() {
  const { data: notifications } = useInAppNotifications({ unreadOnly: true });

  return {
    count: notifications?.pagination?.total || 0,
    hasUnread: (notifications?.pagination?.total || 0) > 0,
  };
}