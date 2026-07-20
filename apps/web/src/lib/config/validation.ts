/**
 * Configuration Validation Utilities
 * 
 * Provides comprehensive validation for environment configuration
 * with detailed error reporting and suggestions.
 */

import { Environment, EnvironmentConfig } from './environment';

export interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
}

export interface ValidationError {
  field: string;
  message: string;
  code: string;
  severity: 'error' | 'warning';
}

export interface ValidationWarning {
  field: string;
  message: string;
  suggestion?: string;
}

/**
 * Validate URL format
 */
function isValidUrl(url: string): boolean {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

/**
 * Validate email format
 */
function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Validate port number
 */
function isValidPort(port: number): boolean {
  return Number.isInteger(port) && port >= 1 && port <= 65535;
}

/**
 * Extract port from URL
 */
function getPortFromUrl(url: string): number | null {
  try {
    const urlObj = new URL(url);
    if (urlObj.port) {
      return parseInt(urlObj.port, 10);
    }
    // Default ports
    if (urlObj.protocol === 'https:') return 443;
    if (urlObj.protocol === 'http:') return 80;
    if (urlObj.protocol === 'ws:') return 80;
    if (urlObj.protocol === 'wss:') return 443;
    return null;
  } catch {
    return null;
  }
}

/**
 * Validate app configuration
 */
function validateAppConfig(config: EnvironmentConfig['app']): ValidationError[] {
  const errors: ValidationError[] = [];

  if (!config.name || config.name.trim().length === 0) {
    errors.push({
      field: 'app.name',
      message: 'App name is required',
      code: 'REQUIRED_FIELD',
      severity: 'error',
    });
  }

  if (!config.version || config.version.trim().length === 0) {
    errors.push({
      field: 'app.version',
      message: 'App version is required',
      code: 'REQUIRED_FIELD',
      severity: 'error',
    });
  }

  if (!config.appUrl || !isValidUrl(config.appUrl)) {
    errors.push({
      field: 'app.appUrl',
      message: 'Valid app URL is required',
      code: 'INVALID_URL',
      severity: 'error',
    });
  }

  if (config.cdnUrl && !isValidUrl(config.cdnUrl)) {
    errors.push({
      field: 'app.cdnUrl',
      message: 'CDN URL must be a valid URL',
      code: 'INVALID_URL',
      severity: 'warning',
    });
  }

  if (config.assetsUrl && !isValidUrl(config.assetsUrl)) {
    errors.push({
      field: 'app.assetsUrl',
      message: 'Assets URL must be a valid URL',
      code: 'INVALID_URL',
      severity: 'warning',
    });
  }

  return errors;
}

/**
 * Validate API configuration
 */
function validateApiConfig(config: EnvironmentConfig['api']): ValidationError[] {
  const errors: ValidationError[] = [];

  if (!config.baseUrl || !isValidUrl(config.baseUrl)) {
    errors.push({
      field: 'api.baseUrl',
      message: 'Valid API base URL is required',
      code: 'INVALID_URL',
      severity: 'error',
    });
  }

  if (config.timeout <= 0) {
    errors.push({
      field: 'api.timeout',
      message: 'API timeout must be greater than 0',
      code: 'INVALID_VALUE',
      severity: 'error',
    });
  }

  if (config.timeout > 300000) { // 5 minutes
    errors.push({
      field: 'api.timeout',
      message: 'API timeout is unusually high (>5 minutes)',
      code: 'SUSPICIOUS_VALUE',
      severity: 'warning',
    });
  }

  if (config.retryAttempts < 0) {
    errors.push({
      field: 'api.retryAttempts',
      message: 'Retry attempts must be non-negative',
      code: 'INVALID_VALUE',
      severity: 'error',
    });
  }

  if (config.retryAttempts > 10) {
    errors.push({
      field: 'api.retryAttempts',
      message: 'Too many retry attempts (>10) may cause performance issues',
      code: 'SUSPICIOUS_VALUE',
      severity: 'warning',
    });
  }

  if (config.retryDelay <= 0) {
    errors.push({
      field: 'api.retryDelay',
      message: 'Retry delay must be greater than 0',
      code: 'INVALID_VALUE',
      severity: 'error',
    });
  }

  if (config.maxRetryDelay <= config.retryDelay) {
    errors.push({
      field: 'api.maxRetryDelay',
      message: 'Max retry delay must be greater than retry delay',
      code: 'INVALID_VALUE',
      severity: 'error',
    });
  }

  return errors;
}

/**
 * Validate WebSocket configuration
 */
function validateWebSocketConfig(config: EnvironmentConfig['websocket']): ValidationError[] {
  const errors: ValidationError[] = [];

  if (!config.url) {
    errors.push({
      field: 'websocket.url',
      message: 'WebSocket URL is required',
      code: 'REQUIRED_FIELD',
      severity: 'error',
    });
  } else {
    try {
      const url = new URL(config.url);
      if (!['ws:', 'wss:'].includes(url.protocol)) {
        errors.push({
          field: 'websocket.url',
          message: 'WebSocket URL must use ws:// or wss:// protocol',
          code: 'INVALID_PROTOCOL',
          severity: 'error',
        });
      }
    } catch {
      errors.push({
        field: 'websocket.url',
        message: 'WebSocket URL is not a valid URL',
        code: 'INVALID_URL',
        severity: 'error',
      });
    }
  }

  if (config.reconnectAttempts < 0) {
    errors.push({
      field: 'websocket.reconnectAttempts',
      message: 'Reconnect attempts must be non-negative',
      code: 'INVALID_VALUE',
      severity: 'error',
    });
  }

  if (config.reconnectDelay <= 0) {
    errors.push({
      field: 'websocket.reconnectDelay',
      message: 'Reconnect delay must be greater than 0',
      code: 'INVALID_VALUE',
      severity: 'error',
    });
  }

  if (config.heartbeatInterval <= 0) {
    errors.push({
      field: 'websocket.heartbeatInterval',
      message: 'Heartbeat interval must be greater than 0',
      code: 'INVALID_VALUE',
      severity: 'error',
    });
  }

  return errors;
}

/**
 * Validate security configuration
 */
function validateSecurityConfig(config: EnvironmentConfig['security']): ValidationError[] {
  const errors: ValidationError[] = [];

  if (config.allowedOrigins.length === 0) {
    errors.push({
      field: 'security.allowedOrigins',
      message: 'At least one allowed origin must be specified',
      code: 'REQUIRED_FIELD',
      severity: 'error',
    });
  }

  config.allowedOrigins.forEach((origin, index) => {
    if (origin !== '*' && !isValidUrl(origin)) {
      errors.push({
        field: `security.allowedOrigins[${index}]`,
        message: `Invalid origin URL: ${origin}`,
        code: 'INVALID_URL',
        severity: 'error',
      });
    }
  });

  if (config.rateLimitWindow <= 0) {
    errors.push({
      field: 'security.rateLimitWindow',
      message: 'Rate limit window must be greater than 0',
      code: 'INVALID_VALUE',
      severity: 'error',
    });
  }

  if (config.rateLimitMax <= 0) {
    errors.push({
      field: 'security.rateLimitMax',
      message: 'Rate limit max must be greater than 0',
      code: 'INVALID_VALUE',
      severity: 'error',
    });
  }

  return errors;
}

/**
 * Validate monitoring configuration
 */
function validateMonitoringConfig(config: EnvironmentConfig['monitoring']): ValidationError[] {
  const errors: ValidationError[] = [];

  if (config.enableSentry && !config.sentryDsn) {
    errors.push({
      field: 'monitoring.sentryDsn',
      message: 'Sentry DSN is required when Sentry is enabled',
      code: 'REQUIRED_FIELD',
      severity: 'error',
    });
  }

  if (config.sentryDsn && !isValidUrl(config.sentryDsn)) {
    errors.push({
      field: 'monitoring.sentryDsn',
      message: 'Sentry DSN must be a valid URL',
      code: 'INVALID_URL',
      severity: 'error',
    });
  }

  if (config.enablePosthog && !config.posthogKey) {
    errors.push({
      field: 'monitoring.posthogKey',
      message: 'PostHog key is required when PostHog is enabled',
      code: 'REQUIRED_FIELD',
      severity: 'error',
    });
  }

  if (config.posthogHost && !isValidUrl(config.posthogHost)) {
    errors.push({
      field: 'monitoring.posthogHost',
      message: 'PostHog host must be a valid URL',
      code: 'INVALID_URL',
      severity: 'error',
    });
  }

  if (config.enableGoogleAnalytics && !config.analyticsId) {
    errors.push({
      field: 'monitoring.analyticsId',
      message: 'Analytics ID is required when Google Analytics is enabled',
      code: 'REQUIRED_FIELD',
      severity: 'error',
    });
  }

  return errors;
}

/**
 * Validate cache configuration
 */
function validateCacheConfig(config: EnvironmentConfig['cache']): ValidationError[] {
  const errors: ValidationError[] = [];

  if (config.defaultStaleTime < 0) {
    errors.push({
      field: 'cache.defaultStaleTime',
      message: 'Default stale time must be non-negative',
      code: 'INVALID_VALUE',
      severity: 'error',
    });
  }

  if (config.defaultCacheTime < 0) {
    errors.push({
      field: 'cache.defaultCacheTime',
      message: 'Default cache time must be non-negative',
      code: 'INVALID_VALUE',
      severity: 'error',
    });
  }

  if (config.defaultCacheTime < config.defaultStaleTime) {
    errors.push({
      field: 'cache.defaultCacheTime',
      message: 'Cache time should be greater than or equal to stale time',
      code: 'INVALID_VALUE',
      severity: 'warning',
    });
  }

  if (!config.persistenceKey || config.persistenceKey.trim().length === 0) {
    errors.push({
      field: 'cache.persistenceKey',
      message: 'Cache persistence key is required',
      code: 'REQUIRED_FIELD',
      severity: 'error',
    });
  }

  return errors;
}

/**
 * Generate environment-specific warnings
 */
function generateEnvironmentWarnings(config: EnvironmentConfig): ValidationWarning[] {
  const warnings: ValidationWarning[] = [];
  const { environment } = config.app;

  // Production-specific warnings
  if (environment === 'production') {
    if (!config.monitoring.enableSentry) {
      warnings.push({
        field: 'monitoring.enableSentry',
        message: 'Sentry should be enabled in production for error tracking',
        suggestion: 'Enable Sentry monitoring for production environments',
      });
    }

    if (!config.features.enableErrorReporting) {
      warnings.push({
        field: 'features.enableErrorReporting',
        message: 'Error reporting should be enabled in production',
        suggestion: 'Enable error reporting for production monitoring',
      });
    }

    if (config.logging.level === 'debug') {
      warnings.push({
        field: 'logging.level',
        message: 'Debug logging in production may impact performance',
        suggestion: 'Use "error" or "warn" log level in production',
      });
    }

    if (config.features.enableAPIPlayground) {
      warnings.push({
        field: 'features.enableAPIPlayground',
        message: 'API playground should be disabled in production',
        suggestion: 'Disable API playground in production for security',
      });
    }
  }

  // Development-specific warnings
  if (environment === 'development') {
    if (config.api.baseUrl.includes('localhost') && config.api.baseUrl.includes('https')) {
      warnings.push({
        field: 'api.baseUrl',
        message: 'HTTPS on localhost may cause certificate issues in development',
        suggestion: 'Use HTTP for localhost in development',
      });
    }
  }

  // Security warnings
  if (config.security.allowedOrigins.includes('*')) {
    warnings.push({
      field: 'security.allowedOrigins',
      message: 'Wildcard CORS origin (*) is not recommended for production',
      suggestion: 'Specify explicit allowed origins for better security',
    });
  }

  return warnings;
}

/**
 * Main validation function
 */
export function validateEnvironmentConfig(config: EnvironmentConfig): ValidationResult {
  const errors: ValidationError[] = [];

  // Validate each configuration section
  errors.push(...validateAppConfig(config.app));
  errors.push(...validateApiConfig(config.api));
  errors.push(...validateWebSocketConfig(config.websocket));
  errors.push(...validateSecurityConfig(config.security));
  errors.push(...validateMonitoringConfig(config.monitoring));
  errors.push(...validateCacheConfig(config.cache));

  // Generate environment-specific warnings
  const warnings = generateEnvironmentWarnings(config);

  return {
    isValid: errors.filter(e => e.severity === 'error').length === 0,
    errors,
    warnings,
  };
}

/**
 * Validate specific configuration section
 */
export function validateConfigSection<K extends keyof EnvironmentConfig>(
  section: K,
  config: EnvironmentConfig[K],
  fullConfig: EnvironmentConfig
): ValidationError[] {
  switch (section) {
    case 'app':
      return validateAppConfig(config as EnvironmentConfig['app']);
    case 'api':
      return validateApiConfig(config as EnvironmentConfig['api']);
    case 'websocket':
      return validateWebSocketConfig(config as EnvironmentConfig['websocket']);
    case 'security':
      return validateSecurityConfig(config as EnvironmentConfig['security']);
    case 'monitoring':
      return validateMonitoringConfig(config as EnvironmentConfig['monitoring']);
    case 'cache':
      return validateCacheConfig(config as EnvironmentConfig['cache']);
    default:
      return [];
  }
}

/**
 * Get configuration suggestions based on environment
 */
export function getConfigSuggestions(environment: Environment): Record<string, any> {
  const suggestions: Record<string, any> = {};

  switch (environment) {
    case 'production':
      suggestions.logging = { level: 'error', enableConsole: false };
      suggestions.monitoring = { enableSentry: true, enablePosthog: true };
      suggestions.features = { enableErrorReporting: true, enableAPIPlayground: false };
      suggestions.api = { retryAttempts: 3, enableRetry: true };
      break;

    case 'staging':
      suggestions.logging = { level: 'warn', enableConsole: false };
      suggestions.monitoring = { enableSentry: true, enablePosthog: false };
      suggestions.features = { enableErrorReporting: true, enableAPIPlayground: true };
      suggestions.api = { retryAttempts: 2, enableRetry: true };
      break;

    case 'development':
      suggestions.logging = { level: 'debug', enableConsole: true };
      suggestions.monitoring = { enableSentry: false, enablePosthog: false };
      suggestions.features = { enableErrorReporting: false, enableAPIPlayground: true };
      suggestions.api = { retryAttempts: 1, enableRetry: false };
      break;

    case 'test':
      suggestions.logging = { level: 'error', enableConsole: false };
      suggestions.monitoring = { enableSentry: false, enablePosthog: false };
      suggestions.features = { enableErrorReporting: false, enableAPIPlayground: false };
      suggestions.api = { retryAttempts: 0, enableRetry: false };
      break;
  }

  return suggestions;
}

/**
 * Auto-fix common configuration issues
 */
export function autoFixConfig(config: EnvironmentConfig): EnvironmentConfig {
  const fixed = { ...config };

  // Fix common URL issues
  if (fixed.api.baseUrl.endsWith('/')) {
    fixed.api.baseUrl = fixed.api.baseUrl.slice(0, -1);
  }

  if (fixed.app.appUrl.endsWith('/')) {
    fixed.app.appUrl = fixed.app.appUrl.slice(0, -1);
  }

  // Fix WebSocket URL protocol
  if (fixed.websocket.url.startsWith('http://')) {
    fixed.websocket.url = fixed.websocket.url.replace('http://', 'ws://');
  } else if (fixed.websocket.url.startsWith('https://')) {
    fixed.websocket.url = fixed.websocket.url.replace('https://', 'wss://');
  }

  // Fix cache time relationships
  if (fixed.cache.defaultCacheTime < fixed.cache.defaultStaleTime) {
    fixed.cache.defaultCacheTime = fixed.cache.defaultStaleTime * 2;
  }

  // Apply environment-specific fixes
  const suggestions = getConfigSuggestions(fixed.app.environment);
  Object.keys(suggestions).forEach(section => {
    if (fixed[section as keyof EnvironmentConfig]) {
      Object.assign(fixed[section as keyof EnvironmentConfig], suggestions[section]);
    }
  });

  return fixed;
}