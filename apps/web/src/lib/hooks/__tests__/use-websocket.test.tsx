import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useWebSocket, useWebSocketStatus, useWebSocketSubscription } from "../use-websocket";

// Mock the WebSocket manager
vi.mock("../../services/websocket-manager", () => {
  const mockManager = {
    connect: vi.fn().mockResolvedValue(undefined),
    disconnect: vi.fn(),
    subscribe: vi.fn().mockReturnValue("sub_123"),
    unsubscribe: vi.fn(),
    sendMessage: vi.fn(),
    isConnected: vi.fn().mockReturnValue(true),
    getConnectionState: vi.fn().mockReturnValue({
      status: "connected",
      reconnectAttempts: 0,
    }),
    on: vi.fn(),
    off: vi.fn(),
    destroy: vi.fn(),
  };

  return {
    getWebSocketManager: vi.fn().mockReturnValue(mockManager),
    initializeWebSocketManager: vi.fn().mockReturnValue(mockManager),
    destroyWebSocketManager: vi.fn(),
  };
});

// Mock environment config
vi.mock("../../api/client", () => ({
  getEnvironmentConfig: () => ({
    wsUrl: "ws://localhost:9000/ws",
    isDevelopment: true,
    isProduction: false,
    timeout: 10000,
    retryAttempts: 3,
  }),
}));

describe("useWebSocket", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should initialize WebSocket manager and connect automatically", () => {
    const { result } = renderHook(() => useWebSocket());

    expect(result.current.isConnected).toBe(true);
    expect(result.current.connectionState.status).toBe("connected");
  });

  it("should not auto-connect when disabled", () => {
    const { initializeWebSocketManager } = require("../../services/websocket-manager");
    const mockManager = initializeWebSocketManager();

    renderHook(() => useWebSocket({ autoConnect: false }));

    expect(mockManager.connect).not.toHaveBeenCalled();
  });

  it("should provide connect and disconnect functions", async () => {
    const { result } = renderHook(() => useWebSocket());
    const { initializeWebSocketManager } = require("../../services/websocket-manager");
    const mockManager = initializeWebSocketManager();

    await act(async () => {
      await result.current.connect();
    });

    expect(mockManager.connect).toHaveBeenCalled();

    act(() => {
      result.current.disconnect();
    });

    expect(mockManager.disconnect).toHaveBeenCalled();
  });

  it("should provide subscribe and unsubscribe functions", () => {
    const { result } = renderHook(() => useWebSocket());
    const { initializeWebSocketManager } = require("../../services/websocket-manager");
    const mockManager = initializeWebSocketManager();

    const callback = vi.fn();

    act(() => {
      const subscriptionId = result.current.subscribe("notifications", callback);
      expect(subscriptionId).toBe("sub_123");
    });

    expect(mockManager.subscribe).toHaveBeenCalledWith("notifications", callback);

    act(() => {
      result.current.unsubscribe("sub_123");
    });

    expect(mockManager.unsubscribe).toHaveBeenCalledWith("sub_123");
  });

  it("should provide sendMessage function", () => {
    const { result } = renderHook(() => useWebSocket());
    const { initializeWebSocketManager } = require("../../services/websocket-manager");
    const mockManager = initializeWebSocketManager();

    act(() => {
      result.current.sendMessage("test", { data: "test" }, "notifications");
    });

    expect(mockManager.sendMessage).toHaveBeenCalledWith({
      type: "test",
      channel: "notifications",
      data: { data: "test" },
      timestamp: expect.any(Number),
    });
  });
});

describe("useWebSocketSubscription", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should subscribe to channel when enabled and connected", () => {
    const { initializeWebSocketManager } = require("../../services/websocket-manager");
    const mockManager = initializeWebSocketManager();

    const callback = vi.fn();

    renderHook(() => useWebSocketSubscription("notifications", callback, { enabled: true }));

    expect(mockManager.subscribe).toHaveBeenCalledWith("notifications", expect.any(Function));
  });

  it("should not subscribe when disabled", () => {
    const { initializeWebSocketManager } = require("../../services/websocket-manager");
    const mockManager = initializeWebSocketManager();

    const callback = vi.fn();

    renderHook(() => useWebSocketSubscription("notifications", callback, { enabled: false }));

    expect(mockManager.subscribe).not.toHaveBeenCalled();
  });

  it("should unsubscribe on unmount", () => {
    const { initializeWebSocketManager } = require("../../services/websocket-manager");
    const mockManager = initializeWebSocketManager();

    const callback = vi.fn();

    const { unmount } = renderHook(() => useWebSocketSubscription("notifications", callback));

    expect(mockManager.subscribe).toHaveBeenCalled();

    unmount();

    expect(mockManager.unsubscribe).toHaveBeenCalledWith("sub_123");
  });

  it("should update callback when it changes", () => {
    const { initializeWebSocketManager } = require("../../services/websocket-manager");
    const mockManager = initializeWebSocketManager();

    let callback = vi.fn();

    const { rerender } = renderHook(({ cb }) => useWebSocketSubscription("notifications", cb), {
      initialProps: { cb: callback },
    });

    // Get the callback that was passed to subscribe
    const subscribedCallback = mockManager.subscribe.mock.calls[0][1];

    // Call the subscribed callback
    act(() => {
      subscribedCallback({ test: "data" });
    });

    expect(callback).toHaveBeenCalledWith({ test: "data" });

    // Change the callback
    const newCallback = vi.fn();
    callback = newCallback;

    rerender({ cb: newCallback });

    // Call the subscribed callback again
    act(() => {
      subscribedCallback({ test: "new data" });
    });

    expect(newCallback).toHaveBeenCalledWith({ test: "new data" });
  });
});

describe("useWebSocketStatus", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return connection status information", () => {
    const { result } = renderHook(() => useWebSocketStatus());

    expect(result.current.isConnected).toBe(true);
    expect(result.current.statusMessage).toBe("Connected to real-time updates");
    expect(result.current.statusColor).toBe("success");
    expect(result.current.showReconnectButton).toBe(false);
  });

  it("should show reconnect button for error state", () => {
    const { initializeWebSocketManager } = require("../../services/websocket-manager");
    const mockManager = initializeWebSocketManager();

    // Mock error state
    mockManager.getConnectionState.mockReturnValue({
      status: "error",
      reconnectAttempts: 0,
      error: "Connection failed",
    });
    mockManager.isConnected.mockReturnValue(false);

    const { result } = renderHook(() => useWebSocketStatus());

    expect(result.current.isConnected).toBe(false);
    expect(result.current.statusMessage).toBe("Connection failed");
    expect(result.current.statusColor).toBe("error");
    expect(result.current.showReconnectButton).toBe(true);
  });

  it("should show reconnect button after failed reconnection attempts", () => {
    const { initializeWebSocketManager } = require("../../services/websocket-manager");
    const mockManager = initializeWebSocketManager();

    // Mock disconnected state with reconnect attempts
    mockManager.getConnectionState.mockReturnValue({
      status: "disconnected",
      reconnectAttempts: 3,
    });
    mockManager.isConnected.mockReturnValue(false);

    const { result } = renderHook(() => useWebSocketStatus());

    expect(result.current.statusMessage).toBe("Disconnected from real-time updates");
    expect(result.current.statusColor).toBe("error");
    expect(result.current.showReconnectButton).toBe(true);
  });

  it("should provide connect and disconnect functions", async () => {
    const { result } = renderHook(() => useWebSocketStatus());
    const { initializeWebSocketManager } = require("../../services/websocket-manager");
    const mockManager = initializeWebSocketManager();

    await act(async () => {
      await result.current.connect();
    });

    expect(mockManager.connect).toHaveBeenCalled();

    act(() => {
      result.current.disconnect();
    });

    expect(mockManager.disconnect).toHaveBeenCalled();
  });

  it("should return correct status messages for different states", () => {
    const { initializeWebSocketManager } = require("../../services/websocket-manager");
    const mockManager = initializeWebSocketManager();

    const testCases = [
      {
        state: { status: "connecting", reconnectAttempts: 0 },
        expectedMessage: "Connecting to real-time updates...",
        expectedColor: "warning",
      },
      {
        state: { status: "reconnecting", reconnectAttempts: 2 },
        expectedMessage: "Reconnecting... (attempt 2)",
        expectedColor: "warning",
      },
      {
        state: { status: "disconnected", reconnectAttempts: 0 },
        expectedMessage: "Real-time updates not connected",
        expectedColor: "error",
      },
    ];

    testCases.forEach(({ state, expectedMessage, expectedColor }) => {
      mockManager.getConnectionState.mockReturnValue(state);
      mockManager.isConnected.mockReturnValue(state.status === "connected");

      const { result } = renderHook(() => useWebSocketStatus());

      expect(result.current.statusMessage).toBe(expectedMessage);
      expect(result.current.statusColor).toBe(expectedColor);
    });
  });
});
