import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { WebSocketConfig } from '../../types/websocket';
import { WebSocketManager } from '../websocket-manager';

// Mock WebSocket
class MockWebSocket {
  static CONNECTING = 0;
  static OPEN = 1;
  static CLOSING = 2;
  static CLOSED = 3;

  readyState = MockWebSocket.CONNECTING;
  url: string;
  protocol: string;
  onopen: ((event: Event) => void) | null = null;
  onclose: ((event: CloseEvent) => void) | null = null;
  onerror: ((event: Event) => void) | null = null;
  onmessage: ((event: MessageEvent) => void) | null = null;

  private listeners: { [key: string]: ((event: any) => void)[] } = {};

  constructor(url: string, protocols?: string | string[]) {
    this.url = url;
    this.protocol = Array.isArray(protocols) ? protocols[0] || '' : protocols || '';

    // Simulate connection opening
    setTimeout(() => {
      this.readyState = MockWebSocket.OPEN;
      this.dispatchEvent(new Event('open'));
    }, 10);
  }

  addEventListener(type: string, listener: (event: any) => void) {
    if (!this.listeners[type]) {
      this.listeners[type] = [];
    }
    this.listeners[type].push(listener);
  }

  removeEventListener(type: string, listener: (event: any) => void) {
    if (this.listeners[type]) {
      const index = this.listeners[type].indexOf(listener);
      if (index > -1) {
        this.listeners[type].splice(index, 1);
      }
    }
  }

  dispatchEvent(event: Event) {
    const listeners = this.listeners[event.type] || [];
    listeners.forEach(listener => listener(event));

    // Also call direct event handlers
    switch (event.type) {
      case 'open':
        this.onopen?.(event);
        break;
      case 'close':
        this.onclose?.(event as CloseEvent);
        break;
      case 'error':
        this.onerror?.(event);
        break;
      case 'message':
        this.onmessage?.(event as MessageEvent);
        break;
    }
  }

  send(data: string) {
    if (this.readyState !== MockWebSocket.OPEN) {
      throw new Error('WebSocket is not open');
    }
    // Simulate message sending
  }

  close(code?: number, reason?: string) {
    this.readyState = MockWebSocket.CLOSED;
    const closeEvent = new CloseEvent('close', { code: code || 1000, reason: reason || '' });
    setTimeout(() => this.dispatchEvent(closeEvent), 10);
  }
}

// Mock global WebSocket
(global as any).WebSocket = MockWebSocket;

describe('WebSocketManager', () => {
  let manager: WebSocketManager;
  const config: WebSocketConfig = {
    url: 'ws://localhost:9000/ws',
    reconnectInterval: 100,
    maxReconnectAttempts: 3,
    heartbeatInterval: 1000,
    timeout: 1000
  };

  beforeEach(() => {
    manager = new WebSocketManager(config);
  });

  afterEach(() => {
    manager.destroy();
  });

  describe('Connection Management', () => {
    it('should connect successfully', async () => {
      const connectPromise = manager.connect();

      await expect(connectPromise).resolves.toBeUndefined();
      expect(manager.isConnected()).toBe(true);
      expect(manager.getConnectionState().status).toBe('connected');
    });

    it('should handle connection errors', async () => {
      // Mock WebSocket constructor to throw error
      const originalWebSocket = (global as any).WebSocket;
      (global as any).WebSocket = class {
        constructor() {
          throw new Error('Connection failed');
        }
      };

      await expect(manager.connect()).rejects.toThrow('Connection failed');
      expect(manager.getConnectionState().status).toBe('error');

      // Restore original WebSocket
      (global as any).WebSocket = originalWebSocket;
    });

    it('should disconnect properly', async () => {
      await manager.connect();
      expect(manager.isConnected()).toBe(true);

      manager.disconnect();
      expect(manager.getConnectionState().status).toBe('disconnected');
    });

    it('should emit connection events', async () => {
      const openSpy = vi.fn();
      const closeSpy = vi.fn();

      manager.on('connection:open', openSpy);
      manager.on('connection:close', closeSpy);

      await manager.connect();
      expect(openSpy).toHaveBeenCalled();

      manager.disconnect();
      // Wait for close event
      await new Promise(resolve => setTimeout(resolve, 50));
      expect(closeSpy).toHaveBeenCalled();
    });
  });

  describe('Subscription Management', () => {
    beforeEach(async () => {
      await manager.connect();
    });

    it('should subscribe to channels', () => {
      const callback = vi.fn();
      const subscriptionId = manager.subscribe('notifications', callback);

      expect(subscriptionId).toBeDefined();
      expect(manager.getSubscriptions()).toHaveLength(1);
      expect(manager.getSubscriptions()[0]?.channel).toBe('notifications');
    });

    it('should unsubscribe from channels', () => {
      const callback = vi.fn();
      const subscriptionId = manager.subscribe('notifications', callback);

      manager.unsubscribe(subscriptionId);
      expect(manager.getSubscriptions()).toHaveLength(0);
    });

    it('should route messages to subscribers', () => {
      const callback1 = vi.fn();
      const callback2 = vi.fn();

      manager.subscribe('notifications', callback1);
      manager.subscribe('queue-status', callback2);

      // Simulate incoming message
      const mockMessage = {
        type: 'update',
        channel: 'notifications',
        data: { id: '123', status: 'delivered' },
        timestamp: Date.now()
      };

      // Simulate message reception
      const messageEvent = new MessageEvent('message', {
        data: JSON.stringify(mockMessage)
      });

      // Access the private WebSocket instance to trigger message
      const ws = (manager as any).ws as MockWebSocket;
      ws.dispatchEvent(messageEvent);

      expect(callback1).toHaveBeenCalledWith(mockMessage.data);
      expect(callback2).not.toHaveBeenCalled();
    });

    it('should emit subscription events', () => {
      const addedSpy = vi.fn();
      const removedSpy = vi.fn();

      manager.on('subscription:added', addedSpy);
      manager.on('subscription:removed', removedSpy);

      const callback = vi.fn();
      const subscriptionId = manager.subscribe('notifications', callback);

      expect(addedSpy).toHaveBeenCalled();

      manager.unsubscribe(subscriptionId);
      expect(removedSpy).toHaveBeenCalledWith(subscriptionId);
    });
  });

  describe('Message Handling', () => {
    beforeEach(async () => {
      await manager.connect();
    });

    it('should send messages when connected', () => {
      const ws = (manager as any).ws as MockWebSocket;
      const sendSpy = vi.spyOn(ws, 'send');

      const message = {
        type: 'test',
        data: { test: true },
        timestamp: Date.now()
      };

      manager.sendMessage(message);
      expect(sendSpy).toHaveBeenCalledWith(JSON.stringify(message));
    });

    it('should queue messages when disconnected', () => {
      manager.disconnect();

      const message = {
        type: 'test',
        data: { test: true },
        timestamp: Date.now()
      };

      // Should not throw error
      expect(() => manager.sendMessage(message)).not.toThrow();

      // Message should be queued
      const messageQueue = (manager as any).messageQueue;
      expect(messageQueue).toContain(message);
    });

    it('should handle ping/pong messages', () => {
      const ws = (manager as any).ws as MockWebSocket;
      const sendSpy = vi.spyOn(ws, 'send');

      // Simulate ping message
      const pingMessage = {
        type: 'ping',
        data: { timestamp: Date.now() },
        timestamp: Date.now()
      };

      const messageEvent = new MessageEvent('message', {
        data: JSON.stringify(pingMessage)
      });

      ws.dispatchEvent(messageEvent);

      // Should respond with pong
      expect(sendSpy).toHaveBeenCalledWith(
        expect.stringContaining('"type":"pong"')
      );
    });
  });

  describe('Reconnection Logic', () => {
    it('should attempt reconnection on unexpected disconnect', async () => {
      const reconnectingSpy = vi.fn();
      manager.on('connection:reconnecting', reconnectingSpy);

      await manager.connect();

      // Simulate unexpected disconnect
      const ws = (manager as any).ws as MockWebSocket;
      ws.close(1006, 'Abnormal closure'); // Abnormal closure code

      // Wait for reconnection attempt
      await new Promise(resolve => setTimeout(resolve, 150));

      expect(reconnectingSpy).toHaveBeenCalled();
      expect(manager.getConnectionState().reconnectAttempts).toBeGreaterThan(0);
    });

    it('should not reconnect on manual disconnect', async () => {
      const reconnectingSpy = vi.fn();
      manager.on('connection:reconnecting', reconnectingSpy);

      await manager.connect();
      manager.disconnect(); // Manual disconnect

      // Wait to ensure no reconnection attempt
      await new Promise(resolve => setTimeout(resolve, 150));

      expect(reconnectingSpy).not.toHaveBeenCalled();
    });

    it('should stop reconnecting after max attempts', async () => {
      const failedSpy = vi.fn();
      manager.on('connection:failed', failedSpy);

      // Mock WebSocket to always fail
      const originalWebSocket = (global as any).WebSocket;
      (global as any).WebSocket = class {
        constructor() {
          setTimeout(() => {
            const errorEvent = new Event('error');
            this.dispatchEvent(errorEvent);
          }, 10);
        }
        addEventListener() { }
        dispatchEvent(event: Event) {
          if (event.type === 'error' && this.onerror) {
            this.onerror(event);
          }
        }
        close() { }
        readyState = MockWebSocket.CLOSED;
        onerror: ((event: Event) => void) | null = null;
      };

      try {
        await manager.connect();
      } catch (error) {
        // Expected to fail
      }

      // Wait for all reconnection attempts
      await new Promise(resolve => setTimeout(resolve, 500));

      expect(manager.getConnectionState().reconnectAttempts).toBe(config.maxReconnectAttempts);
      expect(failedSpy).toHaveBeenCalled();

      // Restore original WebSocket
      (global as any).WebSocket = originalWebSocket;
    });
  });

  describe('Cleanup', () => {
    it('should clean up resources on destroy', async () => {
      await manager.connect();

      const callback = vi.fn();
      manager.subscribe('notifications', callback);

      expect(manager.getSubscriptions()).toHaveLength(1);
      expect(manager.isConnected()).toBe(true);

      manager.destroy();

      expect(manager.getSubscriptions()).toHaveLength(0);
      expect(manager.getConnectionState().status).toBe('disconnected');
    });
  });
});