/**
 * @vitest-environment jsdom
 */

import { beforeEach, describe, expect, it } from 'vitest';
import {
  ConfigManager,
  createEnvironmentConfig,
  getEnvironment,
  getEnvironmentDefaults,
  validateConfig
} from '../environment';

// Mock environment variables
const mockEnv = (env: Record<string, string>) => {
  const originalEnv = process.env;
  process.env = { ...originalEnv, ...env };
  return () => {
    process.env = originalEnv;
  };
};

describe('Environment Configuration', () => {
  describe('getEnvironment', () => {
    it('should return development by default', () => {
      const restore = mockEnv({ NODE_ENV: '', NEXT_PUBLIC_ENVIRONMENT: '' });
      expect(getEnvironment()).toBe('development');
      restore();
    });

    it('should return production when NODE_ENV is production', () => {
      const restore = mockEnv({ NODE_ENV: 'production' });
      expect(getEnvironment()).toBe('production');
      restore();
    });

    it('should prioritize NEXT_PUBLIC_ENVIRONMENT over NODE_ENV', () => {
      const restore = mockEnv({
        NODE_ENV: 'production',
        NEXT_PUBLIC_ENVIRONMENT: 'staging'
      });
      expect(getEnvironment()).toBe('staging');
      restore();
    });

    it('should fallback to development for invalid custom environment', () => {
      const restore = mockEnv({
        NEXT_PUBLIC_ENVIRONMENT: 'invalid',
        NODE_ENV: 'development' // Ensure NODE_ENV is set to development
      });
      expect(getEnvironment()).toBe('development');
      restore();
    });
  });

  describe('createEnvironmentConfig', () => {
    it('should create valid configuration with defaults', () => {
      const restore = mockEnv({
        NODE_ENV: 'development',
        NEXT_PUBLIC_APP_NAME: 'Test App',
        NEXT_PUBLIC_API_URL: 'http://localhost:9000',
      });

      const config = createEnvironmentConfig();

      expect(config.app.name).toBe('Test App');
      expect(config.app.environment).toBe('development');
      expect(config.api.baseUrl).toBe('http://localhost:9000');
      expect(config.features.enableAnalytics).toBe(false); // Development default

      restore();
    });

    it('should use environment-specific defaults for production', () => {
      const restore = mockEnv({
        NODE_ENV: 'production',
        NEXT_PUBLIC_ENVIRONMENT: 'production',
      });

      const config = createEnvironmentConfig();

      expect(config.app.environment).toBe('production');
      expect(config.features.enableAnalytics).toBe(true); // Production default
      expect(config.features.enableErrorReporting).toBe(true);
      expect(config.logging.level).toBe('info');

      restore();
    });

    it('should parse boolean environment variables correctly', () => {
      const restore = mockEnv({
        NEXT_PUBLIC_ENABLE_ANALYTICS: 'true',
        NEXT_PUBLIC_ENABLE_ERROR_REPORTING: 'false',
        NEXT_PUBLIC_ENABLE_WEBRTC: 'TRUE',
        NEXT_PUBLIC_ENABLE_WORKFLOWS: 'False',
      });

      const config = createEnvironmentConfig();

      expect(config.features.enableAnalytics).toBe(true);
      expect(config.features.enableErrorReporting).toBe(false);
      expect(config.features.enableWebRTC).toBe(true);
      expect(config.features.enableWorkflows).toBe(false);

      restore();
    });

    it('should parse numeric environment variables correctly', () => {
      const restore = mockEnv({
        NEXT_PUBLIC_API_TIMEOUT: '15000',
        NEXT_PUBLIC_API_RETRY_ATTEMPTS: '5',
        NEXT_PUBLIC_WS_RECONNECT_ATTEMPTS: '3',
      });

      const config = createEnvironmentConfig();

      expect(config.api.timeout).toBe(15000);
      expect(config.api.retryAttempts).toBe(5);
      expect(config.websocket.reconnectAttempts).toBe(3);

      restore();
    });

    it('should parse array environment variables correctly', () => {
      const restore = mockEnv({
        NEXT_PUBLIC_ALLOWED_ORIGINS: 'http://localhost:3000,https://app.example.com,https://staging.example.com',
      });

      const config = createEnvironmentConfig();

      expect(config.security.allowedOrigins).toEqual([
        'http://localhost:3000',
        'https://app.example.com',
        'https://staging.example.com',
      ]);

      restore();
    });

    it('should handle missing environment variables gracefully', () => {
      const restore = mockEnv({
        // Clear all relevant env vars
        NEXT_PUBLIC_APP_NAME: '',
        NEXT_PUBLIC_API_URL: '',
        NEXT_PUBLIC_WS_URL: '',
        NODE_ENV: 'development', // Ensure we're in development mode
      });

      const config = createEnvironmentConfig();

      expect(config.app.name).toBe('Notifi'); // Default
      expect(config.api.baseUrl).toBe('http://localhost:9000'); // Default for development
      expect(config.websocket.url).toBe('ws://localhost:9000'); // Derived from API URL

      restore();
    });
  });

  describe('validateConfig', () => {
    it('should validate a correct configuration', () => {
      const config = createEnvironmentConfig();
      const errors = validateConfig(config);
      expect(errors).toHaveLength(0);
    });

    it('should detect invalid API URL', () => {
      const config = createEnvironmentConfig();
      config.api.baseUrl = 'invalid-url';

      const errors = validateConfig(config);
      expect(errors).toContain('API base URL is not a valid URL');
    });

    it('should detect missing required fields', () => {
      const config = createEnvironmentConfig();
      config.api.baseUrl = '';

      const errors = validateConfig(config);
      expect(errors.length).toBeGreaterThan(0);
    });

    it('should detect invalid timeout values', () => {
      const config = createEnvironmentConfig();
      config.api.timeout = -1;

      const errors = validateConfig(config);
      expect(errors).toContain('API timeout must be greater than 0');
    });

    it('should detect invalid retry attempts', () => {
      const config = createEnvironmentConfig();
      config.api.retryAttempts = -1;

      const errors = validateConfig(config);
      expect(errors).toContain('API retry attempts must be non-negative');
    });

    it('should detect missing Sentry DSN when Sentry is enabled', () => {
      const config = createEnvironmentConfig();
      config.monitoring.enableSentry = true;
      config.monitoring.sentryDsn = undefined;

      const errors = validateConfig(config);
      expect(errors).toContain('Sentry DSN is required when Sentry is enabled');
    });

    it('should detect missing PostHog key when PostHog is enabled', () => {
      const config = createEnvironmentConfig();
      config.monitoring.enablePosthog = true;
      config.monitoring.posthogKey = undefined;

      const errors = validateConfig(config);
      expect(errors).toContain('PostHog key is required when PostHog is enabled');
    });
  });

  describe('isFeatureEnabled', () => {
    it('should return correct feature flag values', () => {
      const restore = mockEnv({
        NEXT_PUBLIC_ENABLE_ANALYTICS: 'true',
        NEXT_PUBLIC_ENABLE_WEBRTC: 'false',
        NODE_ENV: 'development', // Ensure consistent environment
      });

      // Create a new config to pick up the environment variables
      const config = createEnvironmentConfig();
      expect(config.features.enableAnalytics).toBe(true);
      expect(config.features.enableWebRTC).toBe(false);

      restore();
    });
  });

  describe('ConfigManager', () => {
    let manager: ConfigManager;

    beforeEach(() => {
      manager = ConfigManager.getInstance();
      manager.reset();
    });

    it('should be a singleton', () => {
      const manager1 = ConfigManager.getInstance();
      const manager2 = ConfigManager.getInstance();
      expect(manager1).toBe(manager2);
    });

    it('should update feature flags', () => {
      manager.updateFeatureFlag('enableAnalytics', true);
      expect(manager.getFeatureFlag('enableAnalytics')).toBe(true);

      manager.updateFeatureFlag('enableAnalytics', false);
      expect(manager.getFeatureFlag('enableAnalytics')).toBe(false);
    });

    it('should update API configuration', () => {
      const updates = { timeout: 20000, retryAttempts: 5 };
      manager.updateApiConfig(updates);

      const apiConfig = manager.getApiConfig();
      expect(apiConfig.timeout).toBe(20000);
      expect(apiConfig.retryAttempts).toBe(5);
    });

    it('should reset configuration', () => {
      manager.updateFeatureFlag('enableAnalytics', true);
      manager.updateApiConfig({ timeout: 20000 });

      manager.reset();

      // Should return to default values from the global config
      const defaultConfig = createEnvironmentConfig();
      expect(manager.getFeatureFlag('enableAnalytics')).toBe(defaultConfig.features.enableAnalytics);
      expect(manager.getApiConfig().timeout).toBe(defaultConfig.api.timeout);
    });
  });

  describe('getEnvironmentDefaults', () => {
    it('should return development defaults', () => {
      const defaults = getEnvironmentDefaults('development');

      expect(defaults.api.timeout).toBe(30000);
      expect(defaults.api.retryAttempts).toBe(1);
      expect(defaults.api.enableRetry).toBe(false);
      expect(defaults.logging.level).toBe('debug');
      expect(defaults.logging.enableConsole).toBe(true);
      expect(defaults.monitoring.enableSentry).toBe(false);
    });

    it('should return production defaults', () => {
      const defaults = getEnvironmentDefaults('production');

      expect(defaults.api.timeout).toBe(10000);
      expect(defaults.api.retryAttempts).toBe(3);
      expect(defaults.api.enableRetry).toBe(true);
      expect(defaults.logging.level).toBe('info');
      expect(defaults.logging.enableConsole).toBe(false);
      expect(defaults.monitoring.enableSentry).toBe(true);
    });

    it('should return staging defaults', () => {
      const defaults = getEnvironmentDefaults('staging');

      expect(defaults.api.retryAttempts).toBe(3);
      expect(defaults.monitoring.enableSentry).toBe(true);
      expect(defaults.features.enableAPIPlayground).toBe(true); // Staging allows API playground
    });

    it('should return test defaults', () => {
      const defaults = getEnvironmentDefaults('test');

      expect(defaults.api.retryAttempts).toBe(3);
      expect(defaults.monitoring.enableSentry).toBe(false);
      expect(defaults.features.enableErrorReporting).toBe(false);
    });
  });

  describe('URL derivation', () => {
    it('should derive WebSocket URL from API URL', () => {
      const restore = mockEnv({
        NEXT_PUBLIC_API_URL: 'https://api.example.com',
        NEXT_PUBLIC_WS_URL: '',
      });

      const config = createEnvironmentConfig();
      expect(config.websocket.url).toBe('wss://api.example.com');

      restore();
    });

    it('should use explicit WebSocket URL when provided', () => {
      const restore = mockEnv({
        NEXT_PUBLIC_API_URL: 'https://api.example.com',
        NEXT_PUBLIC_WS_URL: 'wss://ws.example.com',
      });

      const config = createEnvironmentConfig();
      expect(config.websocket.url).toBe('wss://ws.example.com');

      restore();
    });

    it('should handle HTTP to WS protocol conversion', () => {
      const restore = mockEnv({
        NEXT_PUBLIC_API_URL: 'http://localhost:9000',
        NEXT_PUBLIC_WS_URL: '',
      });

      const config = createEnvironmentConfig();
      expect(config.websocket.url).toBe('ws://localhost:9000');

      restore();
    });
  });
});