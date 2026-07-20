import { useCallback, useEffect, useRef, useState } from 'react';
import { getEnvironmentConfig } from '../api/client';
import { getWebSocketManager, initializeWebSocketManager } from '../services/websocket-manager';
import type {
  ChannelMessageMap,
  WebSocketChannels,
  WebSocketConfig,
  WebSocketConnectionState
} from '../types/websocket';

interface UseWebSocketOptions {
  autoConnect?: boolean;
  config?: Partial<WebSocketConfig>;
}

interface UseWebSocketReturn {
  connectionState: WebSocketConnectionState;
  isConnected: boolean;
  connect: () => Promise<void>;
  disconnect: () => void;
  subscribe: <T extends WebSocketChannels>(
    channel: T,
    callback: (data: ChannelMessageMap[T]) => void
  ) => string;
  unsubscribe: (subscriptionId: string) => void;
  sendMessage: (type: string, data: any, channel?: string) => void;
}

/**
 * Hook for managing WebSocket connections and subscriptions
 */
export function useWebSocket(options: UseWebSocketOptions = {}): UseWebSocketReturn {
  const { autoConnect = true, config = {} } = options;
  const managerRef = useRef<ReturnType<typeof getWebSocketManager> | null>(null);
  const [connectionState, setConnectionState] = useState<WebSocketConnectionState>({
    status: 'disconnected',
    reconnectAttempts: 0
  });

  // Initialize WebSocket manager
  useEffect(() => {
    const envConfig = getEnvironmentConfig();
    const wsConfig: WebSocketConfig = {
      url: envConfig.wsUrl,
      reconnectInterval: 5000,
      maxReconnectAttempts: 10,
      heartbeatInterval: 30000,
      timeout: 10000,
      ...config
    };

    try {
      managerRef.current = initializeWebSocketManager(wsConfig);
    } catch (error) {
      // Manager might already exist, get the existing one
      managerRef.current = getWebSocketManager();
    }

    const manager = managerRef.current;

    // Set up event listeners
    const handleConnectionStateChange = () => {
      setConnectionState(manager.getConnectionState());
    };

    manager.on('connection:open', handleConnectionStateChange);
    manager.on('connection:close', handleConnectionStateChange);
    manager.on('connection:error', handleConnectionStateChange);
    manager.on('connection:reconnecting', handleConnectionStateChange);
    manager.on('connection:reconnected', handleConnectionStateChange);
    manager.on('connection:failed', handleConnectionStateChange);

    // Initial state
    setConnectionState(manager.getConnectionState());

    // Auto-connect if enabled
    if (autoConnect && !manager.isConnected()) {
      manager.connect().catch(console.error);
    }

    return () => {
      manager.off('connection:open', handleConnectionStateChange);
      manager.off('connection:close', handleConnectionStateChange);
      manager.off('connection:error', handleConnectionStateChange);
      manager.off('connection:reconnecting', handleConnectionStateChange);
      manager.off('connection:reconnected', handleConnectionStateChange);
      manager.off('connection:failed', handleConnectionStateChange);
    };
  }, [autoConnect, config]);

  const connect = useCallback(async () => {
    if (managerRef.current) {
      await managerRef.current.connect();
    }
  }, []);

  const disconnect = useCallback(() => {
    if (managerRef.current) {
      managerRef.current.disconnect();
    }
  }, []);

  const subscribe = useCallback(<T extends WebSocketChannels>(
    channel: T,
    callback: (data: ChannelMessageMap[T]) => void
  ): string => {
    if (!managerRef.current) {
      throw new Error('WebSocket manager not initialized');
    }
    return managerRef.current.subscribe(channel, callback);
  }, []);

  const unsubscribe = useCallback((subscriptionId: string) => {
    if (managerRef.current) {
      managerRef.current.unsubscribe(subscriptionId);
    }
  }, []);

  const sendMessage = useCallback((type: string, data: any, channel?: string) => {
    if (managerRef.current) {
      managerRef.current.sendMessage({
        type,
        channel,
        data,
        timestamp: Date.now()
      });
    }
  }, []);

  return {
    connectionState,
    isConnected: connectionState.status === 'connected',
    connect,
    disconnect,
    subscribe,
    unsubscribe,
    sendMessage
  };
}

/**
 * Hook for subscribing to a specific WebSocket channel
 */
export function useWebSocketSubscription<T extends WebSocketChannels>(
  channel: T,
  callback: (data: ChannelMessageMap[T]) => void,
  options: UseWebSocketOptions & { enabled?: boolean } = {}
) {
  const { enabled = true, ...wsOptions } = options;
  const { subscribe, unsubscribe, connectionState, isConnected } = useWebSocket(wsOptions);
  const subscriptionIdRef = useRef<string | null>(null);
  const callbackRef = useRef(callback);

  // Update callback ref when callback changes
  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  useEffect(() => {
    if (!enabled || !isConnected) {
      return;
    }

    // Subscribe to the channel
    subscriptionIdRef.current = subscribe(channel, (data) => {
      callbackRef.current(data);
    });

    return () => {
      if (subscriptionIdRef.current) {
        unsubscribe(subscriptionIdRef.current);
        subscriptionIdRef.current = null;
      }
    };
  }, [channel, enabled, isConnected, subscribe, unsubscribe]);

  return {
    connectionState,
    isConnected,
    isSubscribed: subscriptionIdRef.current !== null
  };
}

/**
 * Hook for managing WebSocket connection status with UI feedback
 */
export function useWebSocketStatus() {
  const { connectionState, isConnected, connect, disconnect } = useWebSocket();
  const [showReconnectButton, setShowReconnectButton] = useState(false);

  useEffect(() => {
    // Show reconnect button if connection failed or after multiple reconnect attempts
    const shouldShowReconnect =
      connectionState.status === 'error' ||
      (connectionState.status === 'disconnected' && connectionState.reconnectAttempts > 0);

    setShowReconnectButton(shouldShowReconnect);
  }, [connectionState]);

  const getStatusMessage = useCallback(() => {
    switch (connectionState.status) {
      case 'connecting':
        return 'Connecting to real-time updates...';
      case 'connected':
        return 'Connected to real-time updates';
      case 'disconnected':
        return connectionState.reconnectAttempts > 0
          ? 'Disconnected from real-time updates'
          : 'Real-time updates not connected';
      case 'reconnecting':
        return `Reconnecting... (attempt ${connectionState.reconnectAttempts})`;
      case 'error':
        return connectionState.error || 'Connection error';
      default:
        return 'Unknown connection status';
    }
  }, [connectionState]);

  const getStatusColor = useCallback(() => {
    switch (connectionState.status) {
      case 'connected':
        return 'success';
      case 'connecting':
      case 'reconnecting':
        return 'warning';
      case 'disconnected':
      case 'error':
        return 'error';
      default:
        return 'default';
    }
  }, [connectionState.status]);

  return {
    connectionState,
    isConnected,
    showReconnectButton,
    statusMessage: getStatusMessage(),
    statusColor: getStatusColor(),
    connect,
    disconnect
  };
}