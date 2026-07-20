import { notificationApi } from '@/lib/api/notification';
import type {
  CreateInAppNotificationRequest,
  CreateNotificationRequest,
  InAppNotification,
  Notification,
  NotificationChannel,
  NotificationDelivery,
  NotificationMetrics,
  NotificationPriority,
  NotificationQueryParams,
  NotificationQueue,
  NotificationStatus,
  NotificationSubscription,
  QueueStatus
} from '@/lib/types/notification';
import { createAsyncThunk, createSlice, PayloadAction } from '@reduxjs/toolkit';

export interface NotificationState {
  // Notification data
  notifications: Record<string, Notification>; // Notifications by ID
  inAppNotifications: Record<string, InAppNotification>; // In-app notifications by ID
  deliveries: Record<string, NotificationDelivery[]>; // Deliveries by notification ID

  // Notification lists and filtering
  notificationIds: string[]; // Ordered list of notification IDs
  inAppNotificationIds: string[]; // Ordered list of in-app notification IDs
  filteredNotificationIds: string[]; // Filtered notification IDs based on current filters
  currentFilters: NotificationQueryParams;

  // Queue management
  queueStatus: Record<string, QueueStatus>; // Queue status by queue name
  processingQueue: NotificationQueue[];
  failedQueue: NotificationQueue[];

  // Subscriptions
  subscriptions: Record<string, NotificationSubscription>; // Subscriptions by ID
  userSubscriptions: NotificationSubscription[]; // Current user's subscriptions

  // Analytics and metrics
  metrics: NotificationMetrics | null;
  channelMetrics: Record<NotificationChannel, any>;

  // Real-time updates
  realtimeUpdates: boolean;
  lastUpdateTimestamp: Date | null;

  // Pagination
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };

  // Loading states
  isLoading: boolean;
  isLoadingInApp: boolean;
  isLoadingDeliveries: boolean;
  isLoadingQueue: boolean;
  isLoadingMetrics: boolean;
  isLoadingSubscriptions: boolean;
  isSending: boolean;

  // Error states
  error: string | null;
  inAppError: string | null;
  deliveryError: string | null;
  queueError: string | null;
  metricsError: string | null;
  subscriptionError: string | null;
  sendError: string | null;

  // UI state
  selectedNotificationId: string | null;
  isNotificationPanelOpen: boolean;
  unreadCount: number;

  // Bulk operations
  selectedNotificationIds: string[];
  bulkOperationInProgress: boolean;
  bulkOperationError: string | null;
}

const initialState: NotificationState = {
  // Notification data
  notifications: {},
  inAppNotifications: {},
  deliveries: {},

  // Notification lists and filtering
  notificationIds: [],
  inAppNotificationIds: [],
  filteredNotificationIds: [],
  currentFilters: {},

  // Queue management
  queueStatus: {},
  processingQueue: [],
  failedQueue: [],

  // Subscriptions
  subscriptions: {},
  userSubscriptions: [],

  // Analytics and metrics
  metrics: null,
  channelMetrics: {
    email: {},
    sms: {},
    push: {},
    whatsapp: {},
    in_app: {},
    webhook: {},
  },

  // Real-time updates
  realtimeUpdates: false,
  lastUpdateTimestamp: null,

  // Pagination
  pagination: {
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 0,
    hasNext: false,
    hasPrev: false,
  },

  // Loading states
  isLoading: false,
  isLoadingInApp: false,
  isLoadingDeliveries: false,
  isLoadingQueue: false,
  isLoadingMetrics: false,
  isLoadingSubscriptions: false,
  isSending: false,

  // Error states
  error: null,
  inAppError: null,
  deliveryError: null,
  queueError: null,
  metricsError: null,
  subscriptionError: null,
  sendError: null,

  // UI state
  selectedNotificationId: null,
  isNotificationPanelOpen: false,
  unreadCount: 0,

  // Bulk operations
  selectedNotificationIds: [],
  bulkOperationInProgress: false,
  bulkOperationError: null,
};

// Async thunks for notification operations
export const fetchNotifications = createAsyncThunk(
  'notification/fetchNotifications',
  async (params: NotificationQueryParams = {}, { rejectWithValue }) => {
    try {
      const response = await notificationApi.getNotifications(params);
      return response;
    } catch (error: any) {
      return rejectWithValue(error.message || 'Failed to fetch notifications');
    }
  }
);

export const fetchInAppNotifications = createAsyncThunk(
  'notification/fetchInAppNotifications',
  async (params: NotificationQueryParams = {}, { rejectWithValue }) => {
    try {
      const response = await notificationApi.getInAppNotifications(params);
      return response;
    } catch (error: any) {
      return rejectWithValue(error.message || 'Failed to fetch in-app notifications');
    }
  }
);

export const sendNotification = createAsyncThunk(
  'notification/sendNotification',
  async (notificationData: CreateNotificationRequest, { rejectWithValue }) => {
    try {
      const notification = await notificationApi.sendNotification(notificationData);
      return notification;
    } catch (error: any) {
      return rejectWithValue(error.message || 'Failed to send notification');
    }
  }
);

export const createInAppNotification = createAsyncThunk(
  'notification/createInAppNotification',
  async (notificationData: CreateInAppNotificationRequest, { rejectWithValue }) => {
    try {
      const notification = await notificationApi.createInAppNotification(notificationData);
      return notification;
    } catch (error: any) {
      return rejectWithValue(error.message || 'Failed to create in-app notification');
    }
  }
);

export const fetchNotificationDeliveries = createAsyncThunk(
  'notification/fetchNotificationDeliveries',
  async (notificationId: string, { rejectWithValue }) => {
    try {
      const deliveries = await notificationApi.getNotificationDeliveries(notificationId);
      return { notificationId, deliveries };
    } catch (error: any) {
      return rejectWithValue(error.message || 'Failed to fetch notification deliveries');
    }
  }
);

export const retryFailedNotification = createAsyncThunk(
  'notification/retryFailedNotification',
  async (notificationId: string, { rejectWithValue }) => {
    try {
      const result = await notificationApi.retryNotification(notificationId);
      return { notificationId, ...result };
    } catch (error: any) {
      return rejectWithValue(error.message || 'Failed to retry notification');
    }
  }
);

export const fetchQueueStatus = createAsyncThunk(
  'notification/fetchQueueStatus',
  async (_, { rejectWithValue }) => {
    try {
      const queueStatus = await notificationApi.getQueueStatus();
      return queueStatus;
    } catch (error: any) {
      return rejectWithValue(error.message || 'Failed to fetch queue status');
    }
  }
);

export const fetchNotificationMetrics = createAsyncThunk(
  'notification/fetchNotificationMetrics',
  async (filters: any = {}, { rejectWithValue }) => {
    try {
      const metrics = await notificationApi.getNotificationMetrics(filters);
      return metrics;
    } catch (error: any) {
      return rejectWithValue(error.message || 'Failed to fetch notification metrics');
    }
  }
);

export const fetchUserSubscriptions = createAsyncThunk(
  'notification/fetchUserSubscriptions',
  async (_, { rejectWithValue }) => {
    try {
      const subscriptions = await notificationApi.getUserSubscriptions();
      return subscriptions;
    } catch (error: any) {
      return rejectWithValue(error.message || 'Failed to fetch user subscriptions');
    }
  }
);

export const updateSubscription = createAsyncThunk(
  'notification/updateSubscription',
  async ({ subscriptionId, updates }: { subscriptionId: string; updates: Partial<NotificationSubscription> }, { rejectWithValue }) => {
    try {
      const subscription = await notificationApi.updateSubscription(subscriptionId, updates);
      return { subscriptionId, subscription };
    } catch (error: any) {
      return rejectWithValue(error.message || 'Failed to update subscription');
    }
  }
);

export const markNotificationAsRead = createAsyncThunk(
  'notification/markNotificationAsRead',
  async (notificationId: string, { rejectWithValue }) => {
    try {
      await notificationApi.markAsRead(notificationId);
      return notificationId;
    } catch (error: any) {
      return rejectWithValue(error.message || 'Failed to mark notification as read');
    }
  }
);

export const markAllNotificationsAsRead = createAsyncThunk(
  'notification/markAllNotificationsAsRead',
  async (_, { rejectWithValue }) => {
    try {
      await notificationApi.markAllAsRead();
      return true;
    } catch (error: any) {
      return rejectWithValue(error.message || 'Failed to mark all notifications as read');
    }
  }
);

export const deleteNotification = createAsyncThunk(
  'notification/deleteNotification',
  async (notificationId: string, { rejectWithValue }) => {
    try {
      await notificationApi.deleteInAppNotification(notificationId);
      return notificationId;
    } catch (error: any) {
      return rejectWithValue(error.message || 'Failed to delete notification');
    }
  }
);

export const bulkDeleteNotifications = createAsyncThunk(
  'notification/bulkDeleteNotifications',
  async (notificationIds: string[], { rejectWithValue }) => {
    try {
      await notificationApi.bulkDeleteNotifications(notificationIds);
      return notificationIds;
    } catch (error: any) {
      return rejectWithValue(error.message || 'Failed to delete notifications');
    }
  }
);

export const notificationSlice = createSlice({
  name: 'notification',
  initialState,
  reducers: {
    // Notification data management
    setNotifications: (state, action: PayloadAction<{ notifications: Notification[]; pagination?: any }>) => {
      const { notifications, pagination } = action.payload;
      state.notifications = {};
      state.notificationIds = [];

      notifications.forEach(notification => {
        state.notifications[notification.id] = notification;
        state.notificationIds.push(notification.id);
      });

      if (pagination) {
        state.pagination = pagination;
      }
    },

    addNotification: (state, action: PayloadAction<Notification>) => {
      const notification = action.payload;
      state.notifications[notification.id] = notification;

      // Add to beginning of list for newest first
      state.notificationIds = state.notificationIds.filter(id => id !== notification.id);
      state.notificationIds.unshift(notification.id);
    },

    updateNotification: (state, action: PayloadAction<{ id: string; updates: Partial<Notification> }>) => {
      const { id, updates } = action.payload;
      if (state.notifications[id]) {
        state.notifications[id] = { ...state.notifications[id], ...updates };
      }
    },

    removeNotification: (state, action: PayloadAction<string>) => {
      const notificationId = action.payload;
      delete state.notifications[notificationId];
      state.notificationIds = state.notificationIds.filter(id => id !== notificationId);
      state.filteredNotificationIds = state.filteredNotificationIds.filter(id => id !== notificationId);

      // Clear selection if removed notification was selected
      if (state.selectedNotificationId === notificationId) {
        state.selectedNotificationId = null;
      }

      // Remove from bulk selection
      state.selectedNotificationIds = state.selectedNotificationIds.filter(id => id !== notificationId);
    },

    // In-app notifications
    setInAppNotifications: (state, action: PayloadAction<InAppNotification[]>) => {
      state.inAppNotifications = {};
      state.inAppNotificationIds = [];

      action.payload.forEach(notification => {
        state.inAppNotifications[notification.id] = notification;
        state.inAppNotificationIds.push(notification.id);
      });

      // Update unread count
      state.unreadCount = action.payload.filter(n => !n.readAt).length;
    },

    addInAppNotification: (state, action: PayloadAction<InAppNotification>) => {
      const notification = action.payload;
      state.inAppNotifications[notification.id] = notification;

      // Add to beginning of list
      state.inAppNotificationIds = state.inAppNotificationIds.filter(id => id !== notification.id);
      state.inAppNotificationIds.unshift(notification.id);

      // Update unread count if notification is unread
      if (!notification.readAt) {
        state.unreadCount += 1;
      }
    },

    updateInAppNotification: (state, action: PayloadAction<{ id: string; updates: Partial<InAppNotification> }>) => {
      const { id, updates } = action.payload;
      if (state.inAppNotifications[id]) {
        const wasUnread = !state.inAppNotifications[id].readAt;
        state.inAppNotifications[id] = { ...state.inAppNotifications[id], ...updates };

        // Update unread count if read status changed
        const isNowRead = !!updates.readAt;
        if (wasUnread && isNowRead) {
          state.unreadCount = Math.max(0, state.unreadCount - 1);
        }
      }
    },

    // Deliveries
    setNotificationDeliveries: (state, action: PayloadAction<{ notificationId: string; deliveries: NotificationDelivery[] }>) => {
      const { notificationId, deliveries } = action.payload;
      state.deliveries[notificationId] = deliveries;
    },

    // Queue management
    setQueueStatus: (state, action: PayloadAction<Record<string, QueueStatus>>) => {
      state.queueStatus = action.payload;
    },

    updateQueueStatus: (state, action: PayloadAction<{ queueName: string; status: QueueStatus }>) => {
      const { queueName, status } = action.payload;
      state.queueStatus[queueName] = status;
    },

    // Filtering and search
    setCurrentFilters: (state, action: PayloadAction<NotificationQueryParams>) => {
      state.currentFilters = action.payload;

      // Apply filters to notification list
      let filteredIds = state.notificationIds;

      if (action.payload.status) {
        filteredIds = filteredIds.filter(id =>
          state.notifications[id]?.status === action.payload.status
        );
      }

      if (action.payload.channel) {
        filteredIds = filteredIds.filter(id =>
          state.notifications[id]?.channels?.includes(action.payload.channel!)
        );
      }

      if (action.payload.priority) {
        filteredIds = filteredIds.filter(id =>
          state.notifications[id]?.priority === action.payload.priority
        );
      }

      state.filteredNotificationIds = filteredIds;
    },

    clearFilters: (state) => {
      state.currentFilters = {};
      state.filteredNotificationIds = state.notificationIds;
    },

    // Metrics
    setNotificationMetrics: (state, action: PayloadAction<NotificationMetrics>) => {
      state.metrics = action.payload;
    },

    setChannelMetrics: (state, action: PayloadAction<Record<NotificationChannel, any>>) => {
      state.channelMetrics = action.payload;
    },

    // Subscriptions
    setUserSubscriptions: (state, action: PayloadAction<NotificationSubscription[]>) => {
      state.userSubscriptions = action.payload;
      state.subscriptions = {};

      action.payload.forEach(subscription => {
        state.subscriptions[subscription.id] = subscription;
      });
    },

    updateUserSubscription: (state, action: PayloadAction<{ id: string; updates: Partial<NotificationSubscription> }>) => {
      const { id, updates } = action.payload;
      if (state.subscriptions[id]) {
        state.subscriptions[id] = { ...state.subscriptions[id], ...updates };

        // Update in user subscriptions array
        const index = state.userSubscriptions.findIndex(sub => sub.id === id);
        if (index !== -1) {
          state.userSubscriptions[index] = state.subscriptions[id];
        }
      }
    },

    // Real-time updates
    enableRealtimeUpdates: (state) => {
      state.realtimeUpdates = true;
    },

    disableRealtimeUpdates: (state) => {
      state.realtimeUpdates = false;
    },

    setLastUpdateTimestamp: (state, action: PayloadAction<Date>) => {
      state.lastUpdateTimestamp = action.payload;
    },

    // UI state
    setSelectedNotification: (state, action: PayloadAction<string | null>) => {
      state.selectedNotificationId = action.payload;
    },

    openNotificationPanel: (state) => {
      state.isNotificationPanelOpen = true;
    },

    closeNotificationPanel: (state) => {
      state.isNotificationPanelOpen = false;
    },

    setUnreadCount: (state, action: PayloadAction<number>) => {
      state.unreadCount = Math.max(0, action.payload);
    },

    // Bulk operations
    selectNotification: (state, action: PayloadAction<string>) => {
      const notificationId = action.payload;
      if (!state.selectedNotificationIds.includes(notificationId)) {
        state.selectedNotificationIds.push(notificationId);
      }
    },

    deselectNotification: (state, action: PayloadAction<string>) => {
      const notificationId = action.payload;
      state.selectedNotificationIds = state.selectedNotificationIds.filter(id => id !== notificationId);
    },

    selectAllNotifications: (state) => {
      state.selectedNotificationIds = [...state.filteredNotificationIds];
    },

    deselectAllNotifications: (state) => {
      state.selectedNotificationIds = [];
    },

    // Loading states
    setLoading: (state, action: PayloadAction<boolean>) => {
      state.isLoading = action.payload;
    },

    setInAppLoading: (state, action: PayloadAction<boolean>) => {
      state.isLoadingInApp = action.payload;
    },

    setDeliveriesLoading: (state, action: PayloadAction<boolean>) => {
      state.isLoadingDeliveries = action.payload;
    },

    setQueueLoading: (state, action: PayloadAction<boolean>) => {
      state.isLoadingQueue = action.payload;
    },

    setMetricsLoading: (state, action: PayloadAction<boolean>) => {
      state.isLoadingMetrics = action.payload;
    },

    setSubscriptionsLoading: (state, action: PayloadAction<boolean>) => {
      state.isLoadingSubscriptions = action.payload;
    },

    setSending: (state, action: PayloadAction<boolean>) => {
      state.isSending = action.payload;
    },

    setBulkOperationInProgress: (state, action: PayloadAction<boolean>) => {
      state.bulkOperationInProgress = action.payload;
    },

    // Error states
    setError: (state, action: PayloadAction<string | null>) => {
      state.error = action.payload;
      if (action.payload) {
        state.isLoading = false;
      }
    },

    setInAppError: (state, action: PayloadAction<string | null>) => {
      state.inAppError = action.payload;
      if (action.payload) {
        state.isLoadingInApp = false;
      }
    },

    setDeliveryError: (state, action: PayloadAction<string | null>) => {
      state.deliveryError = action.payload;
      if (action.payload) {
        state.isLoadingDeliveries = false;
      }
    },

    setQueueError: (state, action: PayloadAction<string | null>) => {
      state.queueError = action.payload;
      if (action.payload) {
        state.isLoadingQueue = false;
      }
    },

    setMetricsError: (state, action: PayloadAction<string | null>) => {
      state.metricsError = action.payload;
      if (action.payload) {
        state.isLoadingMetrics = false;
      }
    },

    setSubscriptionError: (state, action: PayloadAction<string | null>) => {
      state.subscriptionError = action.payload;
      if (action.payload) {
        state.isLoadingSubscriptions = false;
      }
    },

    setSendError: (state, action: PayloadAction<string | null>) => {
      state.sendError = action.payload;
      if (action.payload) {
        state.isSending = false;
      }
    },

    setBulkOperationError: (state, action: PayloadAction<string | null>) => {
      state.bulkOperationError = action.payload;
      if (action.payload) {
        state.bulkOperationInProgress = false;
      }
    },

    // Clear all notification data (on logout)
    clearNotificationData: (state) => {
      state.notifications = {};
      state.inAppNotifications = {};
      state.deliveries = {};
      state.notificationIds = [];
      state.inAppNotificationIds = [];
      state.filteredNotificationIds = [];
      state.currentFilters = {};
      state.queueStatus = {};
      state.processingQueue = [];
      state.failedQueue = [];
      state.subscriptions = {};
      state.userSubscriptions = [];
      state.metrics = null;
      state.channelMetrics = {
        email: {},
        sms: {},
        push: {},
        whatsapp: {},
        in_app: {},
        webhook: {},
      };
      state.selectedNotificationId = null;
      state.selectedNotificationIds = [];
      state.unreadCount = 0;
      state.pagination = {
        page: 1,
        limit: 20,
        total: 0,
        totalPages: 0,
        hasNext: false,
        hasPrev: false,
      };

      // Clear errors and loading states
      state.error = null;
      state.inAppError = null;
      state.deliveryError = null;
      state.queueError = null;
      state.metricsError = null;
      state.subscriptionError = null;
      state.sendError = null;
      state.bulkOperationError = null;

      state.isLoading = false;
      state.isLoadingInApp = false;
      state.isLoadingDeliveries = false;
      state.isLoadingQueue = false;
      state.isLoadingMetrics = false;
      state.isLoadingSubscriptions = false;
      state.isSending = false;
      state.bulkOperationInProgress = false;
    },

    // Clear all errors
    clearAllErrors: (state) => {
      state.error = null;
      state.inAppError = null;
      state.deliveryError = null;
      state.queueError = null;
      state.metricsError = null;
      state.subscriptionError = null;
      state.sendError = null;
      state.bulkOperationError = null;
    },
  },
  extraReducers: (builder) => {
    // Fetch notifications
    builder
      .addCase(fetchNotifications.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(fetchNotifications.fulfilled, (state, action) => {
        state.isLoading = false;
        const { data, pagination } = action.payload;

        state.notifications = {};
        state.notificationIds = [];

        data.forEach((notification: any) => {
          state.notifications[notification.id] = notification;
          state.notificationIds.push(notification.id);
        });

        if (pagination) {
          state.pagination = pagination;
        }

        state.filteredNotificationIds = state.notificationIds;
        state.error = null;
      })
      .addCase(fetchNotifications.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      });

    // Fetch in-app notifications
    builder
      .addCase(fetchInAppNotifications.pending, (state) => {
        state.isLoadingInApp = true;
        state.inAppError = null;
      })
      .addCase(fetchInAppNotifications.fulfilled, (state, action) => {
        state.isLoadingInApp = false;
        const { data } = action.payload;

        state.inAppNotifications = {};
        state.inAppNotificationIds = [];

        data.forEach((notification: InAppNotification) => {
          state.inAppNotifications[notification.id] = notification;
          state.inAppNotificationIds.push(notification.id);
        });

        // Update unread count
        state.unreadCount = data.filter((n: InAppNotification) => !n.readAt).length;
        state.inAppError = null;
      })
      .addCase(fetchInAppNotifications.rejected, (state, action) => {
        state.isLoadingInApp = false;
        state.inAppError = action.payload as string;
      });

    // Send notification
    builder
      .addCase(sendNotification.pending, (state) => {
        state.isSending = true;
        state.sendError = null;
      })
      .addCase(sendNotification.fulfilled, (state, action) => {
        state.isSending = false;
        const notification = action.payload;

        // Add new notification to the beginning of the list
        state.notifications[notification.id] = {
          ...notification,
          data: (notification as any).data || {},
          priority: (notification as any).priority || 'normal',
          retryCount: (notification as any).retryCount || 0,
          updatedAt: (notification as any).updatedAt || new Date().toISOString()
        } as any;
        state.notificationIds = state.notificationIds.filter(id => id !== notification.id);
        state.notificationIds.unshift(notification.id);

        state.sendError = null;
      })
      .addCase(sendNotification.rejected, (state, action) => {
        state.isSending = false;
        state.sendError = action.payload as string;
      });

    // Create in-app notification
    builder
      .addCase(createInAppNotification.pending, (state) => {
        state.isSending = true;
        state.sendError = null;
      })
      .addCase(createInAppNotification.fulfilled, (state, action) => {
        state.isSending = false;
        const notification = action.payload;

        // Add new in-app notification
        state.inAppNotifications[notification.id] = notification;
        state.inAppNotificationIds = state.inAppNotificationIds.filter(id => id !== notification.id);
        state.inAppNotificationIds.unshift(notification.id);

        // Update unread count if notification is unread
        if (!notification.readAt) {
          state.unreadCount += 1;
        }

        state.sendError = null;
      })
      .addCase(createInAppNotification.rejected, (state, action) => {
        state.isSending = false;
        state.sendError = action.payload as string;
      });

    // Fetch notification deliveries
    builder
      .addCase(fetchNotificationDeliveries.pending, (state) => {
        state.isLoadingDeliveries = true;
        state.deliveryError = null;
      })
      .addCase(fetchNotificationDeliveries.fulfilled, (state, action) => {
        state.isLoadingDeliveries = false;
        const { notificationId, deliveries } = action.payload;
        state.deliveries[notificationId] = deliveries;
        state.deliveryError = null;
      })
      .addCase(fetchNotificationDeliveries.rejected, (state, action) => {
        state.isLoadingDeliveries = false;
        state.deliveryError = action.payload as string;
      });

    // Retry failed notification
    builder
      .addCase(retryFailedNotification.pending, (state) => {
        state.isSending = true;
        state.sendError = null;
      })
      .addCase(retryFailedNotification.fulfilled, (state, action) => {
        state.isSending = false;
        const { notificationId } = action.payload;

        // Update notification status
        if (state.notifications[notificationId]) {
          state.notifications[notificationId].status = 'processing' as NotificationStatus;
          state.notifications[notificationId].retryCount += 1;
        }

        state.sendError = null;
      })
      .addCase(retryFailedNotification.rejected, (state, action) => {
        state.isSending = false;
        state.sendError = action.payload as string;
      });

    // Fetch queue status
    builder
      .addCase(fetchQueueStatus.pending, (state) => {
        state.isLoadingQueue = true;
        state.queueError = null;
      })
      .addCase(fetchQueueStatus.fulfilled, (state, action) => {
        state.isLoadingQueue = false;
        // Convert array to record indexed by queue name
        state.queueStatus = action.payload.reduce((acc: Record<string, QueueStatus>, status: QueueStatus) => {
          acc[(status as any).queueName || (status as any).id || 'default'] = status;
          return acc;
        }, {});
        state.queueError = null;
      })
      .addCase(fetchQueueStatus.rejected, (state, action) => {
        state.isLoadingQueue = false;
        state.queueError = action.payload as string;
      });

    // Fetch notification metrics
    builder
      .addCase(fetchNotificationMetrics.pending, (state) => {
        state.isLoadingMetrics = true;
        state.metricsError = null;
      })
      .addCase(fetchNotificationMetrics.fulfilled, (state, action) => {
        state.isLoadingMetrics = false;
        state.metrics = action.payload;
        state.metricsError = null;
      })
      .addCase(fetchNotificationMetrics.rejected, (state, action) => {
        state.isLoadingMetrics = false;
        state.metricsError = action.payload as string;
      });

    // Fetch user subscriptions
    builder
      .addCase(fetchUserSubscriptions.pending, (state) => {
        state.isLoadingSubscriptions = true;
        state.subscriptionError = null;
      })
      .addCase(fetchUserSubscriptions.fulfilled, (state, action) => {
        state.isLoadingSubscriptions = false;
        state.userSubscriptions = action.payload;

        state.subscriptions = {};
        action.payload.forEach((subscription: NotificationSubscription) => {
          state.subscriptions[subscription.id] = subscription;
        });

        state.subscriptionError = null;
      })
      .addCase(fetchUserSubscriptions.rejected, (state, action) => {
        state.isLoadingSubscriptions = false;
        state.subscriptionError = action.payload as string;
      });

    // Update subscription
    builder
      .addCase(updateSubscription.pending, (state) => {
        state.isLoadingSubscriptions = true;
        state.subscriptionError = null;
      })
      .addCase(updateSubscription.fulfilled, (state, action) => {
        state.isLoadingSubscriptions = false;
        const { subscriptionId, subscription } = action.payload;

        state.subscriptions[subscriptionId] = subscription;

        // Update in user subscriptions array
        const index = state.userSubscriptions.findIndex(sub => sub.id === subscriptionId);
        if (index !== -1) {
          state.userSubscriptions[index] = subscription;
        }

        state.subscriptionError = null;
      })
      .addCase(updateSubscription.rejected, (state, action) => {
        state.isLoadingSubscriptions = false;
        state.subscriptionError = action.payload as string;
      });

    // Mark notification as read
    builder
      .addCase(markNotificationAsRead.pending, (state) => {
        // Don't show loading for individual mark as read
      })
      .addCase(markNotificationAsRead.fulfilled, (state, action) => {
        const notificationId = action.payload;

        // Update in-app notification if it exists
        if (state.inAppNotifications[notificationId]) {
          const wasUnread = !state.inAppNotifications[notificationId].readAt;
          state.inAppNotifications[notificationId].readAt = new Date();

          // Update unread count
          if (wasUnread) {
            state.unreadCount = Math.max(0, state.unreadCount - 1);
          }
        }
      })
      .addCase(markNotificationAsRead.rejected, (state, action) => {
        // Handle error silently or show toast
      });

    // Mark all notifications as read
    builder
      .addCase(markAllNotificationsAsRead.pending, (state) => {
        state.isLoadingInApp = true;
      })
      .addCase(markAllNotificationsAsRead.fulfilled, (state) => {
        state.isLoadingInApp = false;

        // Mark all in-app notifications as read
        Object.keys(state.inAppNotifications).forEach(id => {
          if (state.inAppNotifications[id] && !state.inAppNotifications[id].readAt) {
            state.inAppNotifications[id].readAt = new Date();
          }
        });

        // Reset unread count
        state.unreadCount = 0;
      })
      .addCase(markAllNotificationsAsRead.rejected, (state, action) => {
        state.isLoadingInApp = false;
        state.inAppError = action.payload as string;
      });

    // Delete notification
    builder
      .addCase(deleteNotification.pending, (state) => {
        // Don't show loading for individual delete
      })
      .addCase(deleteNotification.fulfilled, (state, action) => {
        const notificationId = action.payload;

        // Remove from notifications
        delete state.notifications[notificationId];
        state.notificationIds = state.notificationIds.filter(id => id !== notificationId);
        state.filteredNotificationIds = state.filteredNotificationIds.filter(id => id !== notificationId);

        // Remove from in-app notifications
        if (state.inAppNotifications[notificationId]) {
          const wasUnread = !state.inAppNotifications[notificationId].readAt;
          delete state.inAppNotifications[notificationId];
          state.inAppNotificationIds = state.inAppNotificationIds.filter(id => id !== notificationId);

          // Update unread count
          if (wasUnread) {
            state.unreadCount = Math.max(0, state.unreadCount - 1);
          }
        }

        // Clear selection if deleted notification was selected
        if (state.selectedNotificationId === notificationId) {
          state.selectedNotificationId = null;
        }

        // Remove from bulk selection
        state.selectedNotificationIds = state.selectedNotificationIds.filter(id => id !== notificationId);
      })
      .addCase(deleteNotification.rejected, (state, action) => {
        // Handle error silently or show toast
      });

    // Bulk delete notifications
    builder
      .addCase(bulkDeleteNotifications.pending, (state) => {
        state.bulkOperationInProgress = true;
        state.bulkOperationError = null;
      })
      .addCase(bulkDeleteNotifications.fulfilled, (state, action) => {
        state.bulkOperationInProgress = false;
        const notificationIds = action.payload;

        // Remove all deleted notifications
        notificationIds.forEach(id => {
          delete state.notifications[id];

          if (state.inAppNotifications[id]) {
            const wasUnread = !state.inAppNotifications[id].readAt;
            delete state.inAppNotifications[id];

            // Update unread count
            if (wasUnread) {
              state.unreadCount = Math.max(0, state.unreadCount - 1);
            }
          }
        });

        // Update ID arrays
        state.notificationIds = state.notificationIds.filter(id => !notificationIds.includes(id));
        state.inAppNotificationIds = state.inAppNotificationIds.filter(id => !notificationIds.includes(id));
        state.filteredNotificationIds = state.filteredNotificationIds.filter(id => !notificationIds.includes(id));

        // Clear selections
        state.selectedNotificationIds = [];
        if (notificationIds.includes(state.selectedNotificationId!)) {
          state.selectedNotificationId = null;
        }

        state.bulkOperationError = null;
      })
      .addCase(bulkDeleteNotifications.rejected, (state, action) => {
        state.bulkOperationInProgress = false;
        state.bulkOperationError = action.payload as string;
      });
  },
});

export const {
  setNotifications,
  addNotification,
  updateNotification,
  removeNotification,
  setInAppNotifications,
  addInAppNotification,
  updateInAppNotification,
  setNotificationDeliveries,
  setQueueStatus,
  updateQueueStatus,
  setCurrentFilters,
  clearFilters,
  setNotificationMetrics,
  setChannelMetrics,
  setUserSubscriptions,
  updateUserSubscription,
  enableRealtimeUpdates,
  disableRealtimeUpdates,
  setLastUpdateTimestamp,
  setSelectedNotification,
  openNotificationPanel,
  closeNotificationPanel,
  setUnreadCount,
  selectNotification,
  deselectNotification,
  selectAllNotifications,
  deselectAllNotifications,
  setLoading,
  setInAppLoading,
  setDeliveriesLoading,
  setQueueLoading,
  setMetricsLoading,
  setSubscriptionsLoading,
  setSending,
  setBulkOperationInProgress,
  setError,
  setInAppError,
  setDeliveryError,
  setQueueError,
  setMetricsError,
  setSubscriptionError,
  setSendError,
  setBulkOperationError,
  clearNotificationData,
  clearAllErrors,
} = notificationSlice.actions;

// Selectors
export const selectNotificationState = (state: { notification: NotificationState }) => state.notification;
export const selectNotifications = (state: { notification: NotificationState }) =>
  state.notification.notificationIds.map(id => state.notification.notifications[id]);
export const selectFilteredNotifications = (state: { notification: NotificationState }) =>
  state.notification.filteredNotificationIds.map(id => state.notification.notifications[id]);
export const selectNotificationById = (notificationId: string) => (state: { notification: NotificationState }) =>
  state.notification.notifications[notificationId];
export const selectInAppNotifications = (state: { notification: NotificationState }) =>
  state.notification.inAppNotificationIds.map(id => state.notification.inAppNotifications[id]);
export const selectUnreadInAppNotifications = (state: { notification: NotificationState }) =>
  state.notification.inAppNotificationIds
    .map(id => state.notification.inAppNotifications[id])
    .filter(notification => notification && !notification.readAt);
export const selectNotificationDeliveries = (notificationId: string) => (state: { notification: NotificationState }) =>
  state.notification.deliveries[notificationId] || [];
export const selectQueueStatus = (state: { notification: NotificationState }) => state.notification.queueStatus;
export const selectNotificationMetrics = (state: { notification: NotificationState }) => state.notification.metrics;
export const selectChannelMetrics = (state: { notification: NotificationState }) => state.notification.channelMetrics;
export const selectUserSubscriptions = (state: { notification: NotificationState }) => state.notification.userSubscriptions;
export const selectCurrentFilters = (state: { notification: NotificationState }) => state.notification.currentFilters;
export const selectPagination = (state: { notification: NotificationState }) => state.notification.pagination;
export const selectSelectedNotification = (state: { notification: NotificationState }) => {
  const { selectedNotificationId, notifications } = state.notification;
  return selectedNotificationId ? notifications[selectedNotificationId] : null;
};
export const selectSelectedNotificationIds = (state: { notification: NotificationState }) => state.notification.selectedNotificationIds;
export const selectUnreadCount = (state: { notification: NotificationState }) => state.notification.unreadCount;
export const selectIsNotificationPanelOpen = (state: { notification: NotificationState }) => state.notification.isNotificationPanelOpen;
export const selectRealtimeUpdates = (state: { notification: NotificationState }) => state.notification.realtimeUpdates;
export const selectLastUpdateTimestamp = (state: { notification: NotificationState }) => state.notification.lastUpdateTimestamp;

// Loading selectors
export const selectNotificationLoading = (state: { notification: NotificationState }) => state.notification.isLoading;
export const selectInAppLoading = (state: { notification: NotificationState }) => state.notification.isLoadingInApp;
export const selectDeliveriesLoading = (state: { notification: NotificationState }) => state.notification.isLoadingDeliveries;
export const selectQueueLoading = (state: { notification: NotificationState }) => state.notification.isLoadingQueue;
export const selectMetricsLoading = (state: { notification: NotificationState }) => state.notification.isLoadingMetrics;
export const selectSubscriptionsLoading = (state: { notification: NotificationState }) => state.notification.isLoadingSubscriptions;
export const selectIsSending = (state: { notification: NotificationState }) => state.notification.isSending;
export const selectBulkOperationInProgress = (state: { notification: NotificationState }) => state.notification.bulkOperationInProgress;

// Error selectors
export const selectNotificationError = (state: { notification: NotificationState }) => state.notification.error;
export const selectInAppError = (state: { notification: NotificationState }) => state.notification.inAppError;
export const selectDeliveryError = (state: { notification: NotificationState }) => state.notification.deliveryError;
export const selectQueueError = (state: { notification: NotificationState }) => state.notification.queueError;
export const selectMetricsError = (state: { notification: NotificationState }) => state.notification.metricsError;
export const selectSubscriptionError = (state: { notification: NotificationState }) => state.notification.subscriptionError;
export const selectSendError = (state: { notification: NotificationState }) => state.notification.sendError;
export const selectBulkOperationError = (state: { notification: NotificationState }) => state.notification.bulkOperationError;

// Computed selectors
export const selectNotificationsByStatus = (status: NotificationStatus) => (state: { notification: NotificationState }) =>
  state.notification.notificationIds
    .map(id => state.notification.notifications[id])
    .filter(notification => notification && notification.status === status);

export const selectNotificationsByChannel = (channel: NotificationChannel) => (state: { notification: NotificationState }) =>
  state.notification.notificationIds
    .map(id => state.notification.notifications[id])
    .filter(notification => notification && notification.channels?.includes(channel));

export const selectNotificationsByPriority = (priority: NotificationPriority) => (state: { notification: NotificationState }) =>
  state.notification.notificationIds
    .map(id => state.notification.notifications[id])
    .filter(notification => notification && notification.priority === priority as any);

export const selectFailedNotifications = (state: { notification: NotificationState }) =>
  state.notification.notificationIds
    .map(id => state.notification.notifications[id])
    .filter(notification => notification && notification.status === 'failed');

export const selectPendingNotifications = (state: { notification: NotificationState }) =>
  state.notification.notificationIds
    .map(id => state.notification.notifications[id])
    .filter(notification => notification && notification.status === 'pending');

export const selectHasSelectedNotifications = (state: { notification: NotificationState }) =>
  state.notification.selectedNotificationIds.length > 0;

export const selectSelectedNotificationsCount = (state: { notification: NotificationState }) =>
  state.notification.selectedNotificationIds.length;

export default notificationSlice.reducer;