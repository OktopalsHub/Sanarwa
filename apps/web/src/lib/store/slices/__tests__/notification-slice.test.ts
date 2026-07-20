import type { Notification, NotificationChannel, NotificationStatus } from '@/lib/types/notification';
import { configureStore } from '@reduxjs/toolkit';
import { notificationSlice, NotificationState } from '../notification-slice';

// Test data
const mockNotification: Notification = {
  id: 'notif-1',
  tenantId: 'tenant-1',
  channels: ['email' as NotificationChannel],
  recipients: [{ id: 'recipient-1', email: 'test@example.com' }],
  data: { message: 'Test notification' },
  status: 'sent' as NotificationStatus,
  priority: 'normal' as any,
  retryCount: 0,
  createdAt: new Date(),
  updatedAt: new Date(),
};

// Helper function to create store
const createTestStore = (initialState?: Partial<NotificationState>) => {
  return configureStore({
    reducer: {
      notification: notificationSlice.reducer,
    },
    preloadedState: {
      notification: {
        notifications: {},
        inAppNotifications: {},
        deliveries: {},
        notificationIds: [],
        inAppNotificationIds: [],
        filteredNotificationIds: [],
        currentFilters: {},
        queueStatus: {},
        processingQueue: [],
        failedQueue: [],
        subscriptions: {},
        userSubscriptions: [],
        metrics: null,
        channelMetrics: {
          email: {},
          sms: {},
          push: {},
          whatsapp: {},
          in_app: {},
          webhook: {},
        },
        realtimeUpdates: false,
        lastUpdateTimestamp: null,
        pagination: {
          page: 1,
          limit: 20,
          total: 0,
          totalPages: 0,
          hasNext: false,
          hasPrev: false,
        },
        isLoading: false,
        isLoadingInApp: false,
        isLoadingDeliveries: false,
        isLoadingQueue: false,
        isLoadingMetrics: false,
        isLoadingSubscriptions: false,
        isSending: false,
        error: null,
        inAppError: null,
        deliveryError: null,
        queueError: null,
        metricsError: null,
        subscriptionError: null,
        sendError: null,
        selectedNotificationId: null,
        isNotificationPanelOpen: false,
        unreadCount: 0,
        selectedNotificationIds: [],
        bulkOperationInProgress: false,
        bulkOperationError: null,
        ...initialState,
      },
    },
  });
};

describe('notificationSlice', () => {
  describe('initial state', () => {
    it('should have correct initial state', () => {
      const store = createTestStore();
      const state = store.getState().notification;

      expect(state.notifications).toEqual({});
      expect(state.notificationIds).toEqual([]);
      expect(state.unreadCount).toBe(0);
      expect(state.isLoading).toBe(false);
      expect(state.error).toBeNull();
    });
  });

  describe('synchronous actions', () => {
    it('should add notification', () => {
      const store = createTestStore();

      store.dispatch(notificationSlice.actions.addNotification(mockNotification));
      const state = store.getState().notification;

      expect(state.notifications['notif-1']).toEqual(mockNotification);
      expect(state.notificationIds).toEqual(['notif-1']);
    });

    it('should update notification', () => {
      const store = createTestStore({
        notifications: { 'notif-1': mockNotification },
        notificationIds: ['notif-1'],
      });

      const updates = { status: 'delivered' as NotificationStatus };
      store.dispatch(notificationSlice.actions.updateNotification({ id: 'notif-1', updates }));
      const state = store.getState().notification;

      expect(state.notifications['notif-1']?.status).toBe('delivered');
    });

    it('should remove notification', () => {
      const store = createTestStore({
        notifications: { 'notif-1': mockNotification },
        notificationIds: ['notif-1'],
        selectedNotificationId: 'notif-1',
      });

      store.dispatch(notificationSlice.actions.removeNotification('notif-1'));
      const state = store.getState().notification;

      expect(state.notifications['notif-1']).toBeUndefined();
      expect(state.notificationIds).toEqual([]);
      expect(state.selectedNotificationId).toBeNull();
    });

    it('should set unread count', () => {
      const store = createTestStore();

      store.dispatch(notificationSlice.actions.setUnreadCount(5));
      const state = store.getState().notification;

      expect(state.unreadCount).toBe(5);
    });

    it('should clear notification data', () => {
      const store = createTestStore({
        notifications: { 'notif-1': mockNotification },
        notificationIds: ['notif-1'],
        unreadCount: 5,
        error: 'Some error',
      });

      store.dispatch(notificationSlice.actions.clearNotificationData());
      const state = store.getState().notification;

      expect(state.notifications).toEqual({});
      expect(state.notificationIds).toEqual([]);
      expect(state.unreadCount).toBe(0);
      expect(state.error).toBeNull();
    });
  });
});