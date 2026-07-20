import { useCallback, useEffect, useRef, useState } from 'react';
import type { Notification } from '../types/notification';
import type {
  NotificationUpdate,
  QueueStatus,
  SystemHealth
} from '../types/websocket';
import { useWebSocketSubscription } from './use-websocket';

interface RealtimeNotificationState {
  notifications: Notification[];
  queueStatus: QueueStatus[];
  systemHealth: SystemHealth | null;
  isConnected: boolean;
  lastUpdate: Date | null;
}

interface UseRealtimeNotificationsOptions {
  enabled?: boolean;
  maxNotifications?: number;
  autoConnect?: boolean;
}

interface UseRealtimeNotificationsReturn extends RealtimeNotificationState {
  updateNotification: (update: NotificationUpdate) => void;
  addNotification: (notification: Notification) => void;
  removeNotification: (notificationId: string) => void;
  clearNotifications: () => void;
  getNotificationById: (id: string) => Notification | undefined;
  getNotificationsByStatus: (status: string) => Notification[];
}

/**
 * Hook for managing real-time notification updates
 */
export function useRealtimeNotifications(
  options: UseRealtimeNotificationsOptions = {}
): UseRealtimeNotificationsReturn {
  const {
    enabled = true,
    maxNotifications = 1000,
    autoConnect = true
  } = options;

  const [state, setState] = useState<RealtimeNotificationState>({
    notifications: [],
    queueStatus: [],
    systemHealth: null,
    isConnected: false,
    lastUpdate: null
  });

  const notificationsRef = useRef<Map<string, Notification>>(new Map());

  // Subscribe to notification updates
  const { isConnected: wsConnected } = useWebSocketSubscription(
    'notifications',
    useCallback((update: NotificationUpdate) => {
      setState(prevState => {
        const existingNotification = notificationsRef.current.get(update.id);
        if (!existingNotification) {
          console.warn('Received update for unknown notification:', update.id);
          return prevState;
        }

        const updatedNotification: Notification = {
          ...existingNotification,
          status: update.status as any,
          metadata: {
            ...existingNotification.metadata,
            ...update.metadata,
            failureReason: update.failureReason,
            deliveredAt: update.deliveredAt
          }
        };

        notificationsRef.current.set(update.id, updatedNotification);

        const updatedNotifications = Array.from(notificationsRef.current.values())
          .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
          .slice(0, maxNotifications);

        return {
          ...prevState,
          notifications: updatedNotifications,
          lastUpdate: new Date()
        };
      });
    }, [maxNotifications]),
    { enabled: enabled && autoConnect }
  );

  // Subscribe to queue status updates
  useWebSocketSubscription(
    'queue-status',
    useCallback((queueUpdate: QueueStatus) => {
      setState(prevState => {
        const existingQueueIndex = prevState.queueStatus.findIndex(
          q => q.channel === queueUpdate.channel
        );

        let updatedQueueStatus: QueueStatus[];
        if (existingQueueIndex >= 0) {
          updatedQueueStatus = [...prevState.queueStatus];
          updatedQueueStatus[existingQueueIndex] = queueUpdate;
        } else {
          updatedQueueStatus = [...prevState.queueStatus, queueUpdate];
        }

        return {
          ...prevState,
          queueStatus: updatedQueueStatus,
          lastUpdate: new Date()
        };
      });
    }, []),
    { enabled: enabled && autoConnect }
  );

  // Subscribe to system health updates
  useWebSocketSubscription(
    'system-health',
    useCallback((healthUpdate: SystemHealth) => {
      setState(prevState => ({
        ...prevState,
        systemHealth: healthUpdate,
        lastUpdate: new Date()
      }));
    }, []),
    { enabled: enabled && autoConnect }
  );

  // Update connection state
  useEffect(() => {
    setState(prevState => ({
      ...prevState,
      isConnected: wsConnected
    }));
  }, [wsConnected]);

  // Notification management functions
  const updateNotification = useCallback((update: NotificationUpdate) => {
    const existingNotification = notificationsRef.current.get(update.id);
    if (!existingNotification) return;

    const updatedNotification: Notification = {
      ...existingNotification,
      status: update.status as any,
      metadata: {
        ...existingNotification.metadata,
        ...update.metadata,
        failureReason: update.failureReason,
        deliveredAt: update.deliveredAt
      }
    };

    notificationsRef.current.set(update.id, updatedNotification);

    setState(prevState => ({
      ...prevState,
      notifications: Array.from(notificationsRef.current.values())
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
        .slice(0, maxNotifications),
      lastUpdate: new Date()
    }));
  }, [maxNotifications]);

  const addNotification = useCallback((notification: Notification) => {
    notificationsRef.current.set(notification.id, notification);

    setState(prevState => {
      const updatedNotifications = Array.from(notificationsRef.current.values())
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
        .slice(0, maxNotifications);

      return {
        ...prevState,
        notifications: updatedNotifications,
        lastUpdate: new Date()
      };
    });
  }, [maxNotifications]);

  const removeNotification = useCallback((notificationId: string) => {
    notificationsRef.current.delete(notificationId);

    setState(prevState => ({
      ...prevState,
      notifications: prevState.notifications.filter(n => n.id !== notificationId),
      lastUpdate: new Date()
    }));
  }, []);

  const clearNotifications = useCallback(() => {
    notificationsRef.current.clear();

    setState(prevState => ({
      ...prevState,
      notifications: [],
      lastUpdate: new Date()
    }));
  }, []);

  const getNotificationById = useCallback((id: string): Notification | undefined => {
    return notificationsRef.current.get(id);
  }, []);

  const getNotificationsByStatus = useCallback((status: string): Notification[] => {
    return Array.from(notificationsRef.current.values()).filter(n => n.status === status);
  }, []);

  return {
    ...state,
    updateNotification,
    addNotification,
    removeNotification,
    clearNotifications,
    getNotificationById,
    getNotificationsByStatus
  };
}

/**
 * Hook for monitoring notification queue status
 */
export function useNotificationQueueStatus(options: { enabled?: boolean } = {}) {
  const { enabled = true } = options;
  const [queueStatus, setQueueStatus] = useState<QueueStatus[]>([]);
  const [isConnected, setIsConnected] = useState(false);

  const { isConnected: wsConnected } = useWebSocketSubscription(
    'queue-status',
    useCallback((queueUpdate: QueueStatus) => {
      setQueueStatus(prevStatus => {
        const existingIndex = prevStatus.findIndex(q => q.channel === queueUpdate.channel);

        if (existingIndex >= 0) {
          const updated = [...prevStatus];
          updated[existingIndex] = queueUpdate;
          return updated;
        } else {
          return [...prevStatus, queueUpdate];
        }
      });
    }, []),
    { enabled }
  );

  useEffect(() => {
    setIsConnected(wsConnected);
  }, [wsConnected]);

  const getTotalPending = useCallback(() => {
    return queueStatus.reduce((total, queue) => total + queue.pending, 0);
  }, [queueStatus]);

  const getTotalProcessing = useCallback(() => {
    return queueStatus.reduce((total, queue) => total + queue.processing, 0);
  }, [queueStatus]);

  const getTotalFailed = useCallback(() => {
    return queueStatus.reduce((total, queue) => total + queue.failed, 0);
  }, [queueStatus]);

  const getQueueByChannel = useCallback((channel: string) => {
    return queueStatus.find(q => q.channel === channel);
  }, [queueStatus]);

  const getAverageProcessingTime = useCallback(() => {
    if (queueStatus.length === 0) return 0;

    const totalTime = queueStatus.reduce((total, queue) => total + queue.averageProcessingTime, 0);
    return totalTime / queueStatus.length;
  }, [queueStatus]);

  return {
    queueStatus,
    isConnected,
    getTotalPending,
    getTotalProcessing,
    getTotalFailed,
    getQueueByChannel,
    getAverageProcessingTime
  };
}

/**
 * Hook for monitoring system health
 */
export function useSystemHealth(options: { enabled?: boolean } = {}) {
  const { enabled = true } = options;
  const [systemHealth, setSystemHealth] = useState<SystemHealth | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);

  const { isConnected: wsConnected } = useWebSocketSubscription(
    'system-health',
    useCallback((healthUpdate: SystemHealth) => {
      setSystemHealth(healthUpdate);
      setLastUpdate(new Date());
    }, []),
    { enabled }
  );

  useEffect(() => {
    setIsConnected(wsConnected);
  }, [wsConnected]);

  const isHealthy = useCallback(() => {
    return systemHealth?.status === 'healthy';
  }, [systemHealth]);

  const isDegraded = useCallback(() => {
    return systemHealth?.status === 'degraded';
  }, [systemHealth]);

  const isDown = useCallback(() => {
    return systemHealth?.status === 'down';
  }, [systemHealth]);

  const getServiceStatus = useCallback((serviceName: string) => {
    return systemHealth?.services[serviceName as keyof typeof systemHealth.services];
  }, [systemHealth]);

  const getMetrics = useCallback(() => {
    return systemHealth?.metrics;
  }, [systemHealth]);

  return {
    systemHealth,
    isConnected,
    lastUpdate,
    isHealthy,
    isDegraded,
    isDown,
    getServiceStatus,
    getMetrics
  };
}