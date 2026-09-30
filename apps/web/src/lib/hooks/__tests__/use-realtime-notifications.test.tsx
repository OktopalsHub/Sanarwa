import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Notification } from "../../types/notification";
import { NotificationChannel, NotificationStatus, Priority } from "../../types/notification";
import type { NotificationUpdate, QueueStatus, SystemHealth } from "../../types/websocket";
import {
  useNotificationQueueStatus,
  useRealtimeNotifications,
  useSystemHealth,
} from "../use-realtime-notifications";

// Helper to create mock notifications with proper structure
const createMockNotification = (overrides: Partial<Notification> = {}): Notification => ({
  id: "1",
  tenantId: "tenant1",
  templateId: "template-1",
  channels: [NotificationChannel.EMAIL],
  recipients: [{ id: "recipient-1", email: "test@example.com" }],
  data: {},
  status: NotificationStatus.PENDING,
  priority: Priority.NORMAL,
  retryCount: 0,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

// Mock the WebSocket subscription hook
vi.mock("../use-websocket", () => ({
  useWebSocketSubscription: vi.fn((channel, callback, options) => {
    // Store the callback for later use in tests
    (global as any).mockWebSocketCallbacks = (global as any).mockWebSocketCallbacks || {};
    (global as any).mockWebSocketCallbacks[channel] = callback;

    return {
      isConnected: true,
      isSubscribed: true,
      connectionState: { status: "connected", reconnectAttempts: 0 },
    };
  }),
}));

describe("useRealtimeNotifications", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (global as any).mockWebSocketCallbacks = {};
  });

  it("should initialize with empty state", () => {
    const { result } = renderHook(() => useRealtimeNotifications());

    expect(result.current.notifications).toEqual([]);
    expect(result.current.queueStatus).toEqual([]);
    expect(result.current.systemHealth).toBeNull();
    expect(result.current.isConnected).toBe(true);
    expect(result.current.lastUpdate).toBeNull();
  });

  it("should add notifications", () => {
    const { result } = renderHook(() => useRealtimeNotifications());

    const notification = createMockNotification();

    act(() => {
      result.current.addNotification(notification);
    });

    expect(result.current.notifications).toHaveLength(1);
    expect(result.current.notifications[0]).toEqual(notification);
    expect(result.current.lastUpdate).toBeInstanceOf(Date);
  });

  it("should update notification status via WebSocket", () => {
    const { result } = renderHook(() => useRealtimeNotifications());

    const notification = createMockNotification();

    // Add notification first
    act(() => {
      result.current.addNotification(notification);
    });

    // Simulate WebSocket update
    const update: NotificationUpdate = {
      id: "1",
      status: "delivered",
      deliveredAt: new Date(),
      metadata: { provider: "sendgrid" },
    };

    act(() => {
      const callback = (global as any).mockWebSocketCallbacks["notifications"];
      callback(update);
    });

    const updatedNotification = result.current.getNotificationById("1");
    expect(updatedNotification?.status).toBe("delivered");
    expect(updatedNotification?.metadata?.deliveredAt).toEqual(update.deliveredAt);
    expect(updatedNotification?.metadata?.provider).toBe("sendgrid");
  });

  it("should handle queue status updates", () => {
    const { result } = renderHook(() => useRealtimeNotifications());

    const queueUpdate: QueueStatus = {
      channel: "email",
      pending: 10,
      processing: 2,
      failed: 1,
      processed: 100,
      averageProcessingTime: 1500,
      lastProcessed: new Date(),
    };

    act(() => {
      const callback = (global as any).mockWebSocketCallbacks["queue-status"];
      callback(queueUpdate);
    });

    expect(result.current.queueStatus).toHaveLength(1);
    expect(result.current.queueStatus[0]).toEqual(queueUpdate);
  });

  it("should handle system health updates", () => {
    const { result } = renderHook(() => useRealtimeNotifications());

    const healthUpdate: SystemHealth = {
      status: "healthy",
      services: {
        database: "up",
        redis: "up",
        providers: {
          sendgrid: "up",
          twilio: "down",
        },
      },
      metrics: {
        cpu: 45,
        memory: 60,
        activeConnections: 150,
      },
      timestamp: new Date(),
    };

    act(() => {
      const callback = (global as any).mockWebSocketCallbacks["system-health"];
      callback(healthUpdate);
    });

    expect(result.current.systemHealth).toEqual(healthUpdate);
  });

  it("should remove notifications", () => {
    const { result } = renderHook(() => useRealtimeNotifications());

    const notification = createMockNotification();

    act(() => {
      result.current.addNotification(notification);
    });

    expect(result.current.notifications).toHaveLength(1);

    act(() => {
      result.current.removeNotification("1");
    });

    expect(result.current.notifications).toHaveLength(0);
  });

  it("should clear all notifications", () => {
    const { result } = renderHook(() => useRealtimeNotifications());

    const notifications: Notification[] = [
      createMockNotification({ id: "1" }),
      createMockNotification({ id: "2", status: NotificationStatus.SENT }),
    ];

    act(() => {
      notifications.forEach((n) => result.current.addNotification(n));
    });

    expect(result.current.notifications).toHaveLength(2);

    act(() => {
      result.current.clearNotifications();
    });

    expect(result.current.notifications).toHaveLength(0);
  });

  it("should get notifications by status", () => {
    const { result } = renderHook(() => useRealtimeNotifications());

    const notifications: Notification[] = [
      createMockNotification({ id: "1", status: NotificationStatus.PENDING }),
      createMockNotification({ id: "2", status: NotificationStatus.DELIVERED }),
      createMockNotification({ id: "3", status: NotificationStatus.PENDING }),
    ];

    act(() => {
      notifications.forEach((n) => result.current.addNotification(n));
    });

    const pendingNotifications = result.current.getNotificationsByStatus(
      NotificationStatus.PENDING,
    );
    const deliveredNotifications = result.current.getNotificationsByStatus(
      NotificationStatus.DELIVERED,
    );

    expect(pendingNotifications).toHaveLength(2);
    expect(deliveredNotifications).toHaveLength(1);
    expect(pendingNotifications.every((n) => n.status === NotificationStatus.PENDING)).toBe(true);
    expect(deliveredNotifications.every((n) => n.status === NotificationStatus.DELIVERED)).toBe(
      true,
    );
  });

  it("should respect maxNotifications limit", () => {
    const { result } = renderHook(() => useRealtimeNotifications({ maxNotifications: 2 }));

    const notifications: Notification[] = Array.from({ length: 5 }, (_, i) => ({
      id: `${i + 1}`,
      tenantId: "tenant1",
      templateId: "template-1",
      channels: [NotificationChannel.EMAIL],
      recipients: [{ id: `recipient-${i + 1}`, email: `test${i + 1}@example.com` }],
      data: {},
      status: NotificationStatus.PENDING,
      priority: Priority.NORMAL,
      retryCount: 0,
      createdAt: new Date(Date.now() + i * 1000),
      updatedAt: new Date(Date.now() + i * 1000),
    }));

    act(() => {
      notifications.forEach((n) => result.current.addNotification(n));
    });

    expect(result.current.notifications).toHaveLength(2);
    // Should keep the most recent notifications (highest timestamps)
    expect(result.current.notifications[0]?.id).toBe("5");
    expect(result.current.notifications[1]?.id).toBe("4");
  });
});

describe("useNotificationQueueStatus", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (global as any).mockWebSocketCallbacks = {};
  });

  it("should initialize with empty queue status", () => {
    const { result } = renderHook(() => useNotificationQueueStatus());

    expect(result.current.queueStatus).toEqual([]);
    expect(result.current.isConnected).toBe(true);
  });

  it("should update queue status", () => {
    const { result } = renderHook(() => useNotificationQueueStatus());

    const queueUpdate: QueueStatus = {
      channel: "email",
      pending: 10,
      processing: 2,
      failed: 1,
      processed: 100,
      averageProcessingTime: 1500,
      lastProcessed: new Date(),
    };

    act(() => {
      const callback = (global as any).mockWebSocketCallbacks["queue-status"];
      callback(queueUpdate);
    });

    expect(result.current.queueStatus).toHaveLength(1);
    expect(result.current.queueStatus[0]).toEqual(queueUpdate);
  });

  it("should calculate totals correctly", () => {
    const { result } = renderHook(() => useNotificationQueueStatus());

    const queueUpdates: QueueStatus[] = [
      {
        channel: "email",
        pending: 10,
        processing: 2,
        failed: 1,
        processed: 100,
        averageProcessingTime: 1500,
        lastProcessed: new Date(),
      },
      {
        channel: "sms",
        pending: 5,
        processing: 1,
        failed: 2,
        processed: 50,
        averageProcessingTime: 800,
        lastProcessed: new Date(),
      },
    ];

    act(() => {
      const callback = (global as any).mockWebSocketCallbacks["queue-status"];
      queueUpdates.forEach((update) => callback(update));
    });

    expect(result.current.getTotalPending()).toBe(15);
    expect(result.current.getTotalProcessing()).toBe(3);
    expect(result.current.getTotalFailed()).toBe(3);
    expect(result.current.getAverageProcessingTime()).toBe(1150);
  });

  it("should get queue by channel", () => {
    const { result } = renderHook(() => useNotificationQueueStatus());

    const queueUpdate: QueueStatus = {
      channel: "email",
      pending: 10,
      processing: 2,
      failed: 1,
      processed: 100,
      averageProcessingTime: 1500,
      lastProcessed: new Date(),
    };

    act(() => {
      const callback = (global as any).mockWebSocketCallbacks["queue-status"];
      callback(queueUpdate);
    });

    const emailQueue = result.current.getQueueByChannel("email");
    const smsQueue = result.current.getQueueByChannel("sms");

    expect(emailQueue).toEqual(queueUpdate);
    expect(smsQueue).toBeUndefined();
  });
});

describe("useSystemHealth", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (global as any).mockWebSocketCallbacks = {};
  });

  it("should initialize with null health status", () => {
    const { result } = renderHook(() => useSystemHealth());

    expect(result.current.systemHealth).toBeNull();
    expect(result.current.isConnected).toBe(true);
    expect(result.current.lastUpdate).toBeNull();
  });

  it("should update system health", () => {
    const { result } = renderHook(() => useSystemHealth());

    const healthUpdate: SystemHealth = {
      status: "healthy",
      services: {
        database: "up",
        redis: "up",
        providers: {
          sendgrid: "up",
          twilio: "down",
        },
      },
      metrics: {
        cpu: 45,
        memory: 60,
        activeConnections: 150,
      },
      timestamp: new Date(),
    };

    act(() => {
      const callback = (global as any).mockWebSocketCallbacks["system-health"];
      callback(healthUpdate);
    });

    expect(result.current.systemHealth).toEqual(healthUpdate);
    expect(result.current.lastUpdate).toBeInstanceOf(Date);
  });

  it("should provide health status helpers", () => {
    const { result } = renderHook(() => useSystemHealth());

    const healthyUpdate: SystemHealth = {
      status: "healthy",
      services: { database: "up", redis: "up", providers: {} },
      metrics: { cpu: 45, memory: 60, activeConnections: 150 },
      timestamp: new Date(),
    };

    act(() => {
      const callback = (global as any).mockWebSocketCallbacks["system-health"];
      callback(healthyUpdate);
    });

    expect(result.current.isHealthy()).toBe(true);
    expect(result.current.isDegraded()).toBe(false);
    expect(result.current.isDown()).toBe(false);

    const degradedUpdate: SystemHealth = {
      ...healthyUpdate,
      status: "degraded",
    };

    act(() => {
      const callback = (global as any).mockWebSocketCallbacks["system-health"];
      callback(degradedUpdate);
    });

    expect(result.current.isHealthy()).toBe(false);
    expect(result.current.isDegraded()).toBe(true);
    expect(result.current.isDown()).toBe(false);
  });

  it("should get service status", () => {
    const { result } = renderHook(() => useSystemHealth());

    const healthUpdate: SystemHealth = {
      status: "healthy",
      services: {
        database: "up",
        redis: "down",
        providers: {
          sendgrid: "up",
        },
      },
      metrics: { cpu: 45, memory: 60, activeConnections: 150 },
      timestamp: new Date(),
    };

    act(() => {
      const callback = (global as any).mockWebSocketCallbacks["system-health"];
      callback(healthUpdate);
    });

    expect(result.current.getServiceStatus("database")).toBe("up");
    expect(result.current.getServiceStatus("redis")).toBe("down");
    expect(result.current.getMetrics()).toEqual(healthUpdate.metrics);
  });
});
