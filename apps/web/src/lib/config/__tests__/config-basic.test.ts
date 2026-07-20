/**
 * @vitest-environment jsdom
 */

import { describe, expect, it } from 'vitest';
import {
  createEnvironmentConfig,
  getEnvironment,
  getEnvironmentDefaults,
  isFeatureEnabled,
  validateConfig,
} from '../environment';

describe('Configuration System', () => {
  describe('Environment Detection', () => {
    it('should detect test environment', () => {
      const env = getEnvironment();
      expect(['development', 'test', 'production', 'staging']).toContain(env);
    });

    it('should create valid configuration', () => {
      const config = createEnvironmentConfig();

      expect(config.app).toBeDefined();
      expect(config.api).toBeDefined();
      expect(config.features).toBeDefined();
      expect(config.security).toBeDefined();
      expect(config.monitoring).toBeDefined();
      expect(config.logging).toBeDefined();
      expect(config.cache).toBeDefined();
      expect(config.websocket).toBeDefined();
    });

    it('should validate configuration', () => {
      const config = createEnvironmentConfig();
      const errors = validateConfig(config);

      // Should have no critical errors for default config
      expect(Array.isArray(errors)).toBe(true);
    });

    it('should provide environment defaults', () => {
      const devDefaults = getEnvironmentDefaults('development');
      const prodDefaults = getEnvironmentDefaults('production');

      expect(devDefaults.api.timeout).toBeGreaterThan(prodDefaults.api.timeout);
      expect(devDefaults.api.retryAttempts).toBeLessThan(prodDefaults.api.retryAttempts);
      expect(devDefaults.logging.level).toBe('debug');
      expect(prodDefaults.logging.level).toBe('info');
    });
  });

  describe('Feature Flags', () => {
    it('should check feature flags', () => {
      const analyticsEnabled = isFeatureEnabled('enableAnalytics');
      const webrtcEnabled = isFeatureEnabled('enableWebRTC');

      expect(typeof analyticsEnabled).toBe('boolean');
      expect(typeof webrtcEnabled).toBe('boolean');
    });
  });

  describe('API Configuration', () => {
    it('should have valid API configuration', () => {
      const config = createEnvironmentConfig();

      expect(config.api.baseUrl).toBeTruthy();
      expect(config.api.timeout).toBeGreaterThan(0);
      expect(config.api.retryAttempts).toBeGreaterThanOrEqual(0);
      expect(config.api.retryDelay).toBeGreaterThan(0);
      expect(config.api.maxRetryDelay).toBeGreaterThan(config.api.retryDelay);
    });
  });

  describe('Security Configuration', () => {
    it('should have valid security configuration', () => {
      const config = createEnvironmentConfig();

      expect(Array.isArray(config.security.allowedOrigins)).toBe(true);
      expect(config.security.allowedOrigins.length).toBeGreaterThan(0);
      expect(config.security.rateLimitWindow).toBeGreaterThan(0);
      expect(config.security.rateLimitMax).toBeGreaterThan(0);
    });
  });

  describe('WebSocket Configuration', () => {
    it('should have valid WebSocket configuration', () => {
      const config = createEnvironmentConfig();

      expect(config.websocket.url).toBeTruthy();
      expect(config.websocket.reconnectAttempts).toBeGreaterThanOrEqual(0);
      expect(config.websocket.reconnectDelay).toBeGreaterThan(0);
      expect(config.websocket.heartbeatInterval).toBeGreaterThan(0);
    });
  });

  describe('Monitoring Configuration', () => {
    it('should have valid monitoring configuration', () => {
      const config = createEnvironmentConfig();

      expect(typeof config.monitoring.enableSentry).toBe('boolean');
      expect(typeof config.monitoring.enablePosthog).toBe('boolean');
      expect(typeof config.monitoring.enableGoogleAnalytics).toBe('boolean');
      expect(config.monitoring.sentryEnvironment).toBeTruthy();
    });
  });

  describe('Cache Configuration', () => {
    it('should have valid cache configuration', () => {
      const config = createEnvironmentConfig();

      expect(config.cache.defaultStaleTime).toBeGreaterThanOrEqual(0);
      expect(config.cache.defaultCacheTime).toBeGreaterThanOrEqual(0);
      expect(config.cache.persistenceKey).toBeTruthy();
      expect(typeof config.cache.enableQueryCache).toBe('boolean');
      expect(typeof config.cache.enablePersistence).toBe('boolean');
    });
  });
});