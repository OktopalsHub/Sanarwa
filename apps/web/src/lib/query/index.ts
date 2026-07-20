// Query client and provider
export { invalidateQueries, queryClient, queryKeys } from './query-client';
export { QueryProvider } from './query-provider';

// Error handling utilities
export {
  getValidationErrors, handleApiError, isAuthError, isNetworkError, isPermissionError,
  isValidationError, mutationErrorHandler, queryErrorHandler
} from './error-handling';

// Query hooks
export * from './hooks/use-analytics-queries';
export * from './hooks/use-auth-queries';
// Export notification hooks with explicit naming to avoid conflicts
export {
  useSendBulkNotifications as useBulkOperations,
  useSendNotification as useCreateNotification,
  useDeleteInAppNotification as useDeleteNotification,
  useInAppNotifications,
  useMarkAllNotificationsAsRead as useMarkAllAsRead,
  useMarkNotificationAsRead as useMarkAsRead,
  useDeliveryMetrics as useNotificationDeliveryMetrics,
  useEngagementMetrics as useNotificationEngagementMetrics,
  useNotificationStatus,
  useRealtimeNotifications as useNotificationSubscriptions,
  useNotifications,
  useSendNotification as useUpdateNotification
} from './hooks/use-notification-queries';
export * from './hooks/use-provider-queries';
export * from './hooks/use-template-queries';
export * from './hooks/use-tenant-queries';

