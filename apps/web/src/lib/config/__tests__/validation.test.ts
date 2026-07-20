/**
 * @vitest-environment jsdom
 */

import { describe, expect, it } from 'vitest';
import { createEnvironmentConfig } from '../environment';
import {
  autoFixConfig,
  getConfigSuggestions,
  validateConfigSection,
  validateEnvironmentConfig
} from '../validation';

describe('Configuration Validation', () => {
  describe('validateEnvironmentConfig', () => {
    it('should validate a correct configuration', () => {
      const config = createEnvironmentConfig();
      const result = validateEnvironmentConfig(config);

      expect(result.isValid).toBe(true);
      expect(Array.isArray(result.errors)).toBe(true);
      expect(Array.isArray(result.warnings)).toBe(true);
    });

    it('should detect invalid API URL', () => {
      const config = createEnvironmentConfig();
      config.api.baseUrl = 'invalid-url';

      const result = validateEnvironmentConfig(config);

      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.field === 'api.baseUrl')).toBe(true);
      expect(result.errors.some(e => e.code === 'INVALID_URL')).toBe(true);
    });

    it('should detect missing required fields', () => {
      const config = createEnvironmentConfig();
      config.app.name = '';
      config.app.version = '';

      const result = validateEnvironmentConfig(config);

      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.field === 'app.name')).toBe(true);
      expect(result.errors.some(e => e.field === 'app.version')).toBe(true);
      expect(result.errors.some(e => e.code === 'REQUIRED_FIELD')).toBe(true);
    });

    it('should detect invalid timeout values', () => {
      const config = createEnvironmentConfig();
      config.api.timeout = -1;

      const result = validateEnvironmentConfig(config);

      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.field === 'api.timeout')).toBe(true);
      expect(result.errors.some(e => e.code === 'INVALID_VALUE')).toBe(true);
    });

    it('should detect suspicious timeout values', () => {
      const config = createEnvironmentConfig();
      config.api.timeout = 400000; // > 5 minutes

      const result = validateEnvironmentConfig(config);

      expect(result.errors.some(e => e.field === 'api.timeout' && e.severity === 'warning')).toBe(true);
      expect(result.errors.some(e => e.code === 'SUSPICIOUS_VALUE')).toBe(true);
    });

    it('should detect invalid retry configuration', () => {
      const config = createEnvironmentConfig();
      config.api.retryAttempts = -1;
      config.api.retryDelay = -1;
      config.api.maxRetryDelay = 500; // Will be less than retryDelay when retryDelay is set to -1, but validation checks retryDelay > 0 first

      const result = validateEnvironmentConfig(config);

      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.field === 'api.retryAttempts')).toBe(true);
      expect(result.errors.some(e => e.field === 'api.retryDelay')).toBe(true);
      // maxRetryDelay validation only triggers when retryDelay > 0, so let's test it separately
    });

    it('should detect invalid maxRetryDelay configuration', () => {
      const config = createEnvironmentConfig();
      config.api.retryDelay = 2000;
      config.api.maxRetryDelay = 1000; // Less than retryDelay

      const result = validateEnvironmentConfig(config);

      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.field === 'api.maxRetryDelay')).toBe(true);
    });

    it('should detect excessive retry attempts', () => {
      const config = createEnvironmentConfig();
      config.api.retryAttempts = 15; // > 10

      const result = validateEnvironmentConfig(config);

      expect(result.errors.some(e =>
        e.field === 'api.retryAttempts' &&
        e.severity === 'warning' &&
        e.code === 'SUSPICIOUS_VALUE'
      )).toBe(true);
    });

    it('should detect invalid WebSocket URL', () => {
      const config = createEnvironmentConfig();
      config.websocket.url = 'http://example.com'; // Should be ws:// or wss://

      const result = validateEnvironmentConfig(config);

      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.field === 'websocket.url')).toBe(true);
      expect(result.errors.some(e => e.code === 'INVALID_PROTOCOL')).toBe(true);
    });

    it('should detect missing WebSocket URL', () => {
      const config = createEnvironmentConfig();
      config.websocket.url = '';

      const result = validateEnvironmentConfig(config);

      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.field === 'websocket.url')).toBe(true);
      expect(result.errors.some(e => e.code === 'REQUIRED_FIELD')).toBe(true);
    });

    it('should detect invalid WebSocket configuration values', () => {
      const config = createEnvironmentConfig();
      config.websocket.reconnectAttempts = -1;
      config.websocket.reconnectDelay = -1;
      config.websocket.heartbeatInterval = -1;

      const result = validateEnvironmentConfig(config);

      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.field === 'websocket.reconnectAttempts')).toBe(true);
      expect(result.errors.some(e => e.field === 'websocket.reconnectDelay')).toBe(true);
      expect(result.errors.some(e => e.field === 'websocket.heartbeatInterval')).toBe(true);
    });

    it('should detect empty allowed origins', () => {
      const config = createEnvironmentConfig();
      config.security.allowedOrigins = [];

      const result = validateEnvironmentConfig(config);

      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.field === 'security.allowedOrigins')).toBe(true);
      expect(result.errors.some(e => e.code === 'REQUIRED_FIELD')).toBe(true);
    });

    it('should detect invalid origin URLs', () => {
      const config = createEnvironmentConfig();
      config.security.allowedOrigins = ['invalid-url', 'https://valid.com'];

      const result = validateEnvironmentConfig(config);

      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.field === 'security.allowedOrigins[0]')).toBe(true);
      expect(result.errors.some(e => e.code === 'INVALID_URL')).toBe(true);
    });

    it('should detect invalid rate limit configuration', () => {
      const config = createEnvironmentConfig();
      config.security.rateLimitWindow = -1;
      config.security.rateLimitMax = -1;

      const result = validateEnvironmentConfig(config);

      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.field === 'security.rateLimitWindow')).toBe(true);
      expect(result.errors.some(e => e.field === 'security.rateLimitMax')).toBe(true);
    });

    it('should detect missing Sentry DSN when enabled', () => {
      const config = createEnvironmentConfig();
      config.monitoring.enableSentry = true;
      config.monitoring.sentryDsn = undefined;

      const result = validateEnvironmentConfig(config);

      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.field === 'monitoring.sentryDsn')).toBe(true);
      expect(result.errors.some(e => e.code === 'REQUIRED_FIELD')).toBe(true);
    });

    it('should detect invalid Sentry DSN', () => {
      const config = createEnvironmentConfig();
      config.monitoring.sentryDsn = 'invalid-url';

      const result = validateEnvironmentConfig(config);

      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.field === 'monitoring.sentryDsn')).toBe(true);
      expect(result.errors.some(e => e.code === 'INVALID_URL')).toBe(true);
    });

    it('should detect missing PostHog key when enabled', () => {
      const config = createEnvironmentConfig();
      config.monitoring.enablePosthog = true;
      config.monitoring.posthogKey = undefined;

      const result = validateEnvironmentConfig(config);

      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.field === 'monitoring.posthogKey')).toBe(true);
      expect(result.errors.some(e => e.code === 'REQUIRED_FIELD')).toBe(true);
    });

    it('should detect invalid PostHog host', () => {
      const config = createEnvironmentConfig();
      config.monitoring.posthogHost = 'invalid-url';

      const result = validateEnvironmentConfig(config);

      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.field === 'monitoring.posthogHost')).toBe(true);
      expect(result.errors.some(e => e.code === 'INVALID_URL')).toBe(true);
    });

    it('should detect missing Analytics ID when enabled', () => {
      const config = createEnvironmentConfig();
      config.monitoring.enableGoogleAnalytics = true;
      config.monitoring.analyticsId = undefined;

      const result = validateEnvironmentConfig(config);

      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.field === 'monitoring.analyticsId')).toBe(true);
      expect(result.errors.some(e => e.code === 'REQUIRED_FIELD')).toBe(true);
    });

    it('should detect invalid cache configuration', () => {
      const config = createEnvironmentConfig();
      config.cache.defaultStaleTime = -1;
      config.cache.defaultCacheTime = -1;
      config.cache.persistenceKey = '';

      const result = validateEnvironmentConfig(config);

      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.field === 'cache.defaultStaleTime')).toBe(true);
      expect(result.errors.some(e => e.field === 'cache.defaultCacheTime')).toBe(true);
      expect(result.errors.some(e => e.field === 'cache.persistenceKey')).toBe(true);
    });

    it('should warn about cache time relationships', () => {
      const config = createEnvironmentConfig();
      config.cache.defaultCacheTime = 1000;
      config.cache.defaultStaleTime = 2000; // Greater than cache time

      const result = validateEnvironmentConfig(config);

      expect(result.errors.some(e =>
        e.field === 'cache.defaultCacheTime' &&
        e.severity === 'warning'
      )).toBe(true);
    });

    it('should detect invalid CDN and assets URLs', () => {
      const config = createEnvironmentConfig();
      config.app.cdnUrl = 'invalid-url';
      config.app.assetsUrl = 'invalid-url';

      const result = validateEnvironmentConfig(config);

      expect(result.errors.some(e => e.field === 'app.cdnUrl' && e.severity === 'warning')).toBe(true);
      expect(result.errors.some(e => e.field === 'app.assetsUrl' && e.severity === 'warning')).toBe(true);
    });
  });

  describe('validateConfigSection', () => {
    it('should validate app section', () => {
      const config = createEnvironmentConfig();
      config.app.name = '';

      const errors = validateConfigSection('app', config.app, config);

      expect(errors.length).toBeGreaterThan(0);
      expect(errors.some(e => e.field === 'app.name')).toBe(true);
    });

    it('should validate API section', () => {
      const config = createEnvironmentConfig();
      config.api.timeout = -1;

      const errors = validateConfigSection('api', config.api, config);

      expect(errors.length).toBeGreaterThan(0);
      expect(errors.some(e => e.field === 'api.timeout')).toBe(true);
    });

    it('should validate WebSocket section', () => {
      const config = createEnvironmentConfig();
      config.websocket.url = '';

      const errors = validateConfigSection('websocket', config.websocket, config);

      expect(errors.length).toBeGreaterThan(0);
      expect(errors.some(e => e.field === 'websocket.url')).toBe(true);
    });

    it('should validate security section', () => {
      const config = createEnvironmentConfig();
      config.security.allowedOrigins = [];

      const errors = validateConfigSection('security', config.security, config);

      expect(errors.length).toBeGreaterThan(0);
      expect(errors.some(e => e.field === 'security.allowedOrigins')).toBe(true);
    });

    it('should validate monitoring section', () => {
      const config = createEnvironmentConfig();
      config.monitoring.enableSentry = true;
      config.monitoring.sentryDsn = undefined;

      const errors = validateConfigSection('monitoring', config.monitoring, config);

      expect(errors.length).toBeGreaterThan(0);
      expect(errors.some(e => e.field === 'monitoring.sentryDsn')).toBe(true);
    });

    it('should validate cache section', () => {
      const config = createEnvironmentConfig();
      config.cache.defaultStaleTime = -1;

      const errors = validateConfigSection('cache', config.cache, config);

      expect(errors.length).toBeGreaterThan(0);
      expect(errors.some(e => e.field === 'cache.defaultStaleTime')).toBe(true);
    });

    it('should return empty array for unknown section', () => {
      const config = createEnvironmentConfig();
      const errors = validateConfigSection('unknown' as any, {} as any, config);

      expect(errors).toEqual([]);
    });
  });

  describe('Environment-specific warnings', () => {
    it('should generate production warnings', () => {
      const config = createEnvironmentConfig();
      config.app.environment = 'production';
      config.monitoring.enableSentry = false;
      config.features.enableErrorReporting = false;
      config.logging.level = 'debug';
      config.features.enableAPIPlayground = true;

      const result = validateEnvironmentConfig(config);

      expect(result.warnings.some(w => w.field === 'monitoring.enableSentry')).toBe(true);
      expect(result.warnings.some(w => w.field === 'features.enableErrorReporting')).toBe(true);
      expect(result.warnings.some(w => w.field === 'logging.level')).toBe(true);
      expect(result.warnings.some(w => w.field === 'features.enableAPIPlayground')).toBe(true);
    });

    it('should generate development warnings', () => {
      const config = createEnvironmentConfig();
      config.app.environment = 'development';
      config.api.baseUrl = 'https://localhost:9000';

      const result = validateEnvironmentConfig(config);

      expect(result.warnings.some(w => w.field === 'api.baseUrl')).toBe(true);
    });

    it('should generate security warnings', () => {
      const config = createEnvironmentConfig();
      config.security.allowedOrigins = ['*'];

      const result = validateEnvironmentConfig(config);

      expect(result.warnings.some(w => w.field === 'security.allowedOrigins')).toBe(true);
    });
  });

  describe('getConfigSuggestions', () => {
    it('should provide production suggestions', () => {
      const suggestions = getConfigSuggestions('production');

      expect(suggestions.logging.level).toBe('error');
      expect(suggestions.logging.enableConsole).toBe(false);
      expect(suggestions.monitoring.enableSentry).toBe(true);
      expect(suggestions.monitoring.enablePosthog).toBe(true);
      expect(suggestions.features.enableErrorReporting).toBe(true);
      expect(suggestions.features.enableAPIPlayground).toBe(false);
      expect(suggestions.api.retryAttempts).toBe(3);
    });

    it('should provide development suggestions', () => {
      const suggestions = getConfigSuggestions('development');

      expect(suggestions.logging.level).toBe('debug');
      expect(suggestions.logging.enableConsole).toBe(true);
      expect(suggestions.monitoring.enableSentry).toBe(false);
      expect(suggestions.monitoring.enablePosthog).toBe(false);
      expect(suggestions.features.enableErrorReporting).toBe(false);
      expect(suggestions.features.enableAPIPlayground).toBe(true);
      expect(suggestions.api.retryAttempts).toBe(1);
    });

    it('should provide staging suggestions', () => {
      const suggestions = getConfigSuggestions('staging');

      expect(suggestions.logging.level).toBe('warn');
      expect(suggestions.monitoring.enableSentry).toBe(true);
      expect(suggestions.monitoring.enablePosthog).toBe(false);
      expect(suggestions.features.enableAPIPlayground).toBe(true);
      expect(suggestions.api.retryAttempts).toBe(2);
    });

    it('should provide test suggestions', () => {
      const suggestions = getConfigSuggestions('test');

      expect(suggestions.logging.level).toBe('error');
      expect(suggestions.monitoring.enableSentry).toBe(false);
      expect(suggestions.monitoring.enablePosthog).toBe(false);
      expect(suggestions.features.enableErrorReporting).toBe(false);
      expect(suggestions.features.enableAPIPlayground).toBe(false);
      expect(suggestions.api.retryAttempts).toBe(0);
    });
  });

  describe('autoFixConfig', () => {
    it('should fix trailing slashes in URLs', () => {
      const config = createEnvironmentConfig();
      config.api.baseUrl = 'http://localhost:9000/';
      config.app.appUrl = 'http://localhost:3000/';

      const fixed = autoFixConfig(config);

      expect(fixed.api.baseUrl).toBe('http://localhost:9000');
      expect(fixed.app.appUrl).toBe('http://localhost:3000');
    });

    it('should fix WebSocket protocol', () => {
      const config = createEnvironmentConfig();
      config.websocket.url = 'http://localhost:9000';

      const fixed = autoFixConfig(config);

      expect(fixed.websocket.url).toBe('ws://localhost:9000');
    });

    it('should fix HTTPS WebSocket protocol', () => {
      const config = createEnvironmentConfig();
      config.websocket.url = 'https://api.example.com';

      const fixed = autoFixConfig(config);

      expect(fixed.websocket.url).toBe('wss://api.example.com');
    });

    it('should fix cache time relationships', () => {
      const config = createEnvironmentConfig();
      config.cache.defaultStaleTime = 10000;
      config.cache.defaultCacheTime = 5000; // Less than stale time

      const fixed = autoFixConfig(config);

      expect(fixed.cache.defaultCacheTime).toBe(20000); // 2x stale time
    });

    it('should apply environment-specific fixes', () => {
      const config = createEnvironmentConfig();
      config.app.environment = 'production';

      const fixed = autoFixConfig(config);

      // Should apply production suggestions
      expect(fixed.logging?.level).toBe('error');
      expect(fixed.monitoring?.enableSentry).toBe(true);
      expect(fixed.features?.enableErrorReporting).toBe(true);
    });

    it('should preserve valid configuration', () => {
      const config = createEnvironmentConfig();
      const originalBaseUrl = config.api.baseUrl;
      const originalTimeout = config.api.timeout;

      const fixed = autoFixConfig(config);

      expect(fixed.api.baseUrl).toBe(originalBaseUrl);
      expect(fixed.api.timeout).toBe(originalTimeout);
    });
  });

  describe('Error and warning structure', () => {
    it('should have proper error structure', () => {
      const config = createEnvironmentConfig();
      config.api.baseUrl = 'invalid-url';

      const result = validateEnvironmentConfig(config);
      const error = result.errors.find(e => e.field === 'api.baseUrl');

      expect(error).toBeDefined();
      if (error) {
        expect(typeof error.field).toBe('string');
        expect(typeof error.message).toBe('string');
        expect(typeof error.code).toBe('string');
        expect(['error', 'warning']).toContain(error.severity);
      }
    });

    it('should have proper warning structure', () => {
      const config = createEnvironmentConfig();
      config.security.allowedOrigins = ['*'];

      const result = validateEnvironmentConfig(config);
      const warning = result.warnings[0];

      if (warning) {
        expect(typeof warning.field).toBe('string');
        expect(typeof warning.message).toBe('string');
        expect(warning.suggestion).toBeDefined();
        expect(typeof warning.suggestion).toBe('string');
      }
    });
  });
});