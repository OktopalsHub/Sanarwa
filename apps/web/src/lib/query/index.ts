export { invalidateQueries, queryClient, queryKeys } from "./query-client";
export { QueryProvider } from "./query-provider";

export {
  getValidationErrors,
  handleApiError,
  isAuthError,
  isNetworkError,
  isPermissionError,
  isValidationError,
  mutationErrorHandler,
  queryErrorHandler,
} from "./error-handling";

export * from "./hooks/use-analytics-queries";
export * from "./hooks/use-auth-queries";
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
  useNotifications,
  useSendNotification as useUpdateNotification,
} from "./hooks/use-notification-queries";
export * from "./hooks/use-provider-queries";
export * from "./hooks/use-tenant-queries";
