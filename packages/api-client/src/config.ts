/**
 * API Configuration Management
 * Handles environment-based backend URL management and API settings
 */

export interface ApiConfig {
  baseUrl: string;
  wsUrl: string;
  timeout: number;
  retryAttempts: number;
  retryDelay: number;
  enableRetry: boolean;
  enableLogging: boolean;
}

export interface EnvironmentConfig {
  development: Partial<ApiConfig>;
  staging: Partial<ApiConfig>;
  production: Partial<ApiConfig>;
}

// Default configuration for different environments
const defaultEnvironmentConfig: EnvironmentConfig = {
  development: {
    baseUrl: 'http://localhost:9000',
    wsUrl: 'ws://localhost:9000',
    timeout: 30000, // Longer timeout for development
    retryAttempts: 1, // Fewer retries in development for faster feedback
    retryDelay: 1000,
    enableRetry: true,
    enableLogging: true,
  },
  staging: {
    baseUrl: process.env.NEXT_PUBLIC_STAGING_API_URL || 'https://staging-api.notifi.com',
    wsUrl: process.env.NEXT_PUBLIC_STAGING_WS_URL || 'wss://staging-api.notifi.com',
    timeout: 15000,
    retryAttempts: 2,
    retryDelay: 2000,
    enableRetry: true,
    enableLogging: true,
  },
  production: {
    baseUrl: process.env.NEXT_PUBLIC_API_URL || 'https://api.notifi.com',
    wsUrl: process.env.NEXT_PUBLIC_WS_URL || 'wss://api.notifi.com',
    timeout: 10000,
    retryAttempts: 3,
    retryDelay: 1000,
    enableRetry: true,
    enableLogging: false, // Disable verbose logging in production
  },
};

// Base configuration that applies to all environments
const baseConfig: ApiConfig = {
  baseUrl: 'http://localhost:9000',
  wsUrl: 'ws://localhost:9000',
  timeout: 10000,
  retryAttempts: 3,
  retryDelay: 1000,
  enableRetry: true,
  enableLogging: true,
};

/**
 * Get the current environment
 */
export const getCurrentEnvironment = (): keyof EnvironmentConfig => {
  if (typeof window === 'undefined') {
    // Server-side: use NODE_ENV
    return (process.env.NODE_ENV as keyof EnvironmentConfig) || 'development';
  }

  // Client-side: determine from URL or environment variable
  const hostname = window.location.hostname;

  if (hostname === 'localhost' || hostname === '127.0.0.1') {
    return 'development';
  }

  if (hostname.includes('staging')) {
    return 'staging';
  }

  return 'production';
};

/**
 * Get API configuration for the current environment
 */
export const getApiConfig = (): ApiConfig => {
  const environment = getCurrentEnvironment();
  const envConfig = defaultEnvironmentConfig[environment];

  // Merge base config with environment-specific config
  const config: ApiConfig = {
    ...baseConfig,
    ...envConfig,
  };

  // Override with explicit environment variables if provided
  if (process.env.NEXT_PUBLIC_API_URL) {
    config.baseUrl = process.env.NEXT_PUBLIC_API_URL;
  }

  if (process.env.NEXT_PUBLIC_WS_URL) {
    config.wsUrl = process.env.NEXT_PUBLIC_WS_URL;
  }

  if (process.env.NEXT_PUBLIC_API_TIMEOUT) {
    config.timeout = parseInt(process.env.NEXT_PUBLIC_API_TIMEOUT, 10);
  }

  if (process.env.NEXT_PUBLIC_API_RETRY_ATTEMPTS) {
    config.retryAttempts = parseInt(process.env.NEXT_PUBLIC_API_RETRY_ATTEMPTS, 10);
  }

  return config;
};

/**
 * CORS configuration for different environments
 */
export const getCorsConfig = () => {
  const environment = getCurrentEnvironment();

  const corsConfig = {
    development: {
      origin: ['http://localhost:3000', 'http://127.0.0.1:3000'],
      credentials: true,
    },
    staging: {
      origin: [process.env.NEXT_PUBLIC_STAGING_URL || 'https://staging.notifi.com'],
      credentials: true,
    },
    production: {
      origin: [process.env.NEXT_PUBLIC_APP_URL || 'https://app.notifi.com'],
      credentials: true,
    },
  };

  return corsConfig[environment];
};

/**
 * Feature flags configuration
 */
export const getFeatureFlags = () => {
  return {
    enableAnalytics: process.env.NEXT_PUBLIC_ENABLE_ANALYTICS === 'true',
    enableErrorReporting: process.env.NEXT_PUBLIC_ENABLE_ERROR_REPORTING === 'true',
    enablePerformanceMonitoring: process.env.NEXT_PUBLIC_ENABLE_PERFORMANCE_MONITORING === 'true',
    enableWebRTC: process.env.NEXT_PUBLIC_ENABLE_WEBRTC !== 'false', // Default to true
    enableRealTimeUpdates: process.env.NEXT_PUBLIC_ENABLE_REALTIME !== 'false', // Default to true
  };
};

/**
 * Security configuration
 */
export const getSecurityConfig = () => {
  const environment = getCurrentEnvironment();

  return {
    enforceHttps: environment === 'production',
    enableCSP: environment === 'production',
    tokenStorageKey: 'notifi_auth_token',
    refreshTokenStorageKey: 'notifi_refresh_token',
    sessionTimeout: 24 * 60 * 60 * 1000, // 24 hours
    refreshTokenThreshold: 5 * 60 * 1000, // Refresh when 5 minutes left
  };
};

/**
 * Logging configuration
 */
export const getLoggingConfig = () => {
  const environment = getCurrentEnvironment();

  return {
    level: environment === 'production' ? 'error' : 'debug',
    enableConsoleLogging: environment !== 'production',
    enableRemoteLogging: environment === 'production',
    logApiRequests: environment === 'development',
    logApiResponses: environment === 'development',
  };
};

/**
 * Performance configuration
 */
export const getPerformanceConfig = () => {
  return {
    enableCaching: true,
    cacheTimeout: 5 * 60 * 1000, // 5 minutes
    enableCompression: true,
    enableBundleAnalysis: process.env.ANALYZE === 'true',
    enableServiceWorker: process.env.NODE_ENV === 'production',
  };
};

/**
 * Validate configuration
 */
export const validateConfig = (config: ApiConfig): boolean => {
  const errors: string[] = [];

  if (!config.baseUrl) {
    errors.push('Base URL is required');
  }

  if (!config.wsUrl) {
    errors.push('WebSocket URL is required');
  }

  if (config.timeout <= 0) {
    errors.push('Timeout must be greater than 0');
  }

  if (config.retryAttempts < 0) {
    errors.push('Retry attempts must be non-negative');
  }

  if (errors.length > 0) {
    console.error('Configuration validation failed:', errors);
    return false;
  }

  return true;
};

/**
 * Get complete configuration object
 */
export const getCompleteConfig = () => {
  const apiConfig = getApiConfig();

  if (!validateConfig(apiConfig)) {
    throw new Error('Invalid API configuration');
  }

  return {
    api: apiConfig,
    cors: getCorsConfig(),
    features: getFeatureFlags(),
    security: getSecurityConfig(),
    logging: getLoggingConfig(),
    performance: getPerformanceConfig(),
    environment: getCurrentEnvironment(),
  };
};