/**
 * Environment Configuration System
 *
 * Provides centralized configuration management for different environments
 * with type safety, validation, and feature flag support.
 */

export type Environment = "development" | "staging" | "production" | "test";

export interface ApiConfig {
  baseUrl: string;
  timeout: number;
  retryAttempts: number;
  retryDelay: number;
  maxRetryDelay: number;
  enableRetry: boolean;
}

export interface WebSocketConfig {
  url: string;
  reconnectAttempts: number;
  reconnectDelay: number;
  heartbeatInterval: number;
  enableHeartbeat: boolean;
}

export interface SecurityConfig {
  enableCORS: boolean;
  allowedOrigins: string[];
  enableCSRF: boolean;
  enableRateLimit: boolean;
  rateLimitWindow: number;
  rateLimitMax: number;
}

export interface FeatureFlags {
  enableAnalytics: boolean;
  enableErrorReporting: boolean;
  enablePerformanceMonitoring: boolean;
  enableWebRTC: boolean;
  enableRealTimeNotifications: boolean;
  enableAdvancedTemplating: boolean;
  enableMultiTenant: boolean;
  enableBrandingCustomization: boolean;
  enableWorkflows: boolean;
  enableAPIPlayground: boolean;
}

export interface LoggingConfig {
  level: "debug" | "info" | "warn" | "error";
  enableConsole: boolean;
  enableRemote: boolean;
  remoteEndpoint?: string;
  enablePerformanceLogs: boolean;
}

export interface MonitoringConfig {
  sentryDsn?: string;
  sentryEnvironment: string;
  enableSentry: boolean;
  posthogKey?: string;
  posthogHost?: string;
  enablePosthog: boolean;
  analyticsId?: string;
  enableGoogleAnalytics: boolean;
}

export interface CacheConfig {
  enableQueryCache: boolean;
  defaultStaleTime: number;
  defaultCacheTime: number;
  enablePersistence: boolean;
  persistenceKey: string;
}

export interface AppConfig {
  name: string;
  version: string;
  environment: Environment;
  buildTime: string;
  buildId?: string;
  appUrl: string;
  cdnUrl?: string;
  assetsUrl?: string;
}

export interface EnvironmentConfig {
  app: AppConfig;
  api: ApiConfig;
  websocket: WebSocketConfig;
  security: SecurityConfig;
  features: FeatureFlags;
  logging: LoggingConfig;
  monitoring: MonitoringConfig;
  cache: CacheConfig;
}

/**
 * Get the current environment
 */
export function getEnvironment(): Environment {
  const nodeEnv = process.env.NODE_ENV;
  const customEnv = process.env.NEXT_PUBLIC_ENVIRONMENT;

  if (customEnv && ["development", "staging", "production", "test"].includes(customEnv)) {
    return customEnv as Environment;
  }

  switch (nodeEnv) {
    case "production":
      return "production";
    case "test":
      return "test";
    case "development":
    default:
      return "development";
  }
}

/**
 * Get boolean value from environment variable
 */
function getBooleanEnv(key: string, defaultValue: boolean = false): boolean {
  const value = process.env[key];
  if (value === undefined) return defaultValue;
  return value.toLowerCase() === "true";
}

/**
 * Get number value from environment variable
 */
function getNumberEnv(key: string, defaultValue: number): number {
  const value = process.env[key];
  if (value === undefined) return defaultValue;
  const parsed = parseInt(value, 10);
  return isNaN(parsed) ? defaultValue : parsed;
}

/**
 * Get string value from environment variable
 */
function getStringEnv(key: string, defaultValue: string = ""): string {
  return process.env[key] || defaultValue;
}

/**
 * Get array value from environment variable (comma-separated)
 */
function getArrayEnv(key: string, defaultValue: string[] = []): string[] {
  const value = process.env[key];
  if (!value) return defaultValue;
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

/**
 * Get API base URL based on environment
 */
function getApiBaseUrl(): string {
  const environment = getEnvironment();

  // Check for explicit API URL first
  const explicitUrl = getStringEnv("VITE_API_URL") || getStringEnv("NEXT_PUBLIC_API_URL");
  if (explicitUrl) return explicitUrl;

  // Environment-specific defaults
  switch (environment) {
    case "production":
      return "https://api.sanarwa.com/api/v1";
    case "staging":
      return "https://staging-api.sanarwa.com/api/v1";
    case "test":
      return "http://localhost:9001/api/v1"; // Different port for tests
    case "development":
    default:
      return "http://localhost:9000/api/v1"; // NestJS backend default port
  }
}

/**
 * Get WebSocket URL based on environment
 */
function getWebSocketUrl(): string {
  const environment = getEnvironment();

  // Check for explicit WebSocket URL first
  const explicitUrl = getStringEnv("NEXT_PUBLIC_WS_URL");
  if (explicitUrl) return explicitUrl;

  // Derive from API URL
  const apiUrl = getApiBaseUrl();
  return apiUrl.replace(/^http/, "ws");
}

/**
 * Get app URL based on environment
 */
function getAppUrl(): string {
  const environment = getEnvironment();

  // Check for explicit app URL first
  const explicitUrl = getStringEnv("NEXT_PUBLIC_APP_URL");
  if (explicitUrl) return explicitUrl;

  // Environment-specific defaults
  switch (environment) {
    case "production":
      return "https://app.sanarwa.com";
    case "staging":
      return "https://staging.sanarwa.com";
    case "test":
      return "http://localhost:3001";
    case "development":
    default:
      return "http://localhost:3000";
  }
}

/**
 * Create environment-specific configuration
 */
export function createEnvironmentConfig(): EnvironmentConfig {
  const environment = getEnvironment();
  const isDevelopment = environment === "development";
  const isProduction = environment === "production";
  const isTest = environment === "test";

  return {
    app: {
      name: getStringEnv("VITE_APP_NAME", getStringEnv("NEXT_PUBLIC_APP_NAME", "Sanarwa")),
      version: getStringEnv("npm_package_version", "0.1.0"),
      environment,
      buildTime: getStringEnv("BUILD_TIME", new Date().toISOString()),
      buildId: getStringEnv("BUILD_ID"),
      appUrl: getAppUrl(),
      cdnUrl: getStringEnv("NEXT_PUBLIC_CDN_URL"),
      assetsUrl: getStringEnv("NEXT_PUBLIC_ASSETS_URL"),
    },

    api: {
      baseUrl: getApiBaseUrl(),
      timeout: getNumberEnv("NEXT_PUBLIC_API_TIMEOUT", isDevelopment ? 30000 : 10000),
      retryAttempts: getNumberEnv("NEXT_PUBLIC_API_RETRY_ATTEMPTS", isDevelopment ? 1 : 3),
      retryDelay: getNumberEnv("NEXT_PUBLIC_API_RETRY_DELAY", 1000),
      maxRetryDelay: getNumberEnv("NEXT_PUBLIC_API_MAX_RETRY_DELAY", 10000),
      enableRetry: getBooleanEnv("NEXT_PUBLIC_API_ENABLE_RETRY", !isDevelopment),
    },

    websocket: {
      url: getWebSocketUrl(),
      reconnectAttempts: getNumberEnv("NEXT_PUBLIC_WS_RECONNECT_ATTEMPTS", 5),
      reconnectDelay: getNumberEnv("NEXT_PUBLIC_WS_RECONNECT_DELAY", 1000),
      heartbeatInterval: getNumberEnv("NEXT_PUBLIC_WS_HEARTBEAT_INTERVAL", 30000),
      enableHeartbeat: getBooleanEnv("NEXT_PUBLIC_WS_ENABLE_HEARTBEAT", true),
    },

    security: {
      enableCORS: getBooleanEnv("NEXT_PUBLIC_ENABLE_CORS", true),
      allowedOrigins: getArrayEnv("NEXT_PUBLIC_ALLOWED_ORIGINS", [getAppUrl()]),
      enableCSRF: getBooleanEnv("NEXT_PUBLIC_ENABLE_CSRF", isProduction),
      enableRateLimit: getBooleanEnv("NEXT_PUBLIC_ENABLE_RATE_LIMIT", isProduction),
      rateLimitWindow: getNumberEnv("NEXT_PUBLIC_RATE_LIMIT_WINDOW", 60000), // 1 minute
      rateLimitMax: getNumberEnv("NEXT_PUBLIC_RATE_LIMIT_MAX", 100),
    },

    features: {
      enableAnalytics: getBooleanEnv("NEXT_PUBLIC_ENABLE_ANALYTICS", isProduction),
      enableErrorReporting: getBooleanEnv("NEXT_PUBLIC_ENABLE_ERROR_REPORTING", !isDevelopment),
      enablePerformanceMonitoring: getBooleanEnv("NEXT_PUBLIC_ENABLE_PERFORMANCE_MONITORING", true),
      enableWebRTC: getBooleanEnv("NEXT_PUBLIC_ENABLE_WEBRTC", true),
      enableRealTimeNotifications: getBooleanEnv("NEXT_PUBLIC_ENABLE_REALTIME_NOTIFICATIONS", true),
      enableAdvancedTemplating: getBooleanEnv("NEXT_PUBLIC_ENABLE_ADVANCED_TEMPLATING", true),
      enableMultiTenant: getBooleanEnv("NEXT_PUBLIC_ENABLE_MULTI_TENANT", true),
      enableBrandingCustomization: getBooleanEnv("NEXT_PUBLIC_ENABLE_BRANDING_CUSTOMIZATION", true),
      enableWorkflows: getBooleanEnv("NEXT_PUBLIC_ENABLE_WORKFLOWS", true),
      enableAPIPlayground: getBooleanEnv("NEXT_PUBLIC_ENABLE_API_PLAYGROUND", !isProduction),
    },

    logging: {
      level: getStringEnv("NEXT_PUBLIC_LOG_LEVEL", isDevelopment ? "debug" : "info") as any,
      enableConsole: getBooleanEnv("NEXT_PUBLIC_ENABLE_CONSOLE_LOGS", !isProduction),
      enableRemote: getBooleanEnv("NEXT_PUBLIC_ENABLE_REMOTE_LOGS", isProduction),
      remoteEndpoint: getStringEnv("NEXT_PUBLIC_REMOTE_LOG_ENDPOINT"),
      enablePerformanceLogs: getBooleanEnv("NEXT_PUBLIC_ENABLE_PERFORMANCE_LOGS", isDevelopment),
    },

    monitoring: {
      sentryDsn: getStringEnv("NEXT_PUBLIC_SENTRY_DSN"),
      sentryEnvironment: environment,
      enableSentry: getBooleanEnv("NEXT_PUBLIC_ENABLE_SENTRY", !isDevelopment && !isTest),
      posthogKey: getStringEnv("NEXT_PUBLIC_POSTHOG_KEY"),
      posthogHost: getStringEnv("NEXT_PUBLIC_POSTHOG_HOST", "https://app.posthog.com"),
      enablePosthog: getBooleanEnv("NEXT_PUBLIC_ENABLE_POSTHOG", isProduction),
      analyticsId: getStringEnv("NEXT_PUBLIC_ANALYTICS_ID"),
      enableGoogleAnalytics: getBooleanEnv("NEXT_PUBLIC_ENABLE_GOOGLE_ANALYTICS", isProduction),
    },

    cache: {
      enableQueryCache: getBooleanEnv("NEXT_PUBLIC_ENABLE_QUERY_CACHE", true),
      defaultStaleTime: getNumberEnv("NEXT_PUBLIC_DEFAULT_STALE_TIME", 5 * 60 * 1000), // 5 minutes
      defaultCacheTime: getNumberEnv("NEXT_PUBLIC_DEFAULT_CACHE_TIME", 10 * 60 * 1000), // 10 minutes
      enablePersistence: getBooleanEnv("NEXT_PUBLIC_ENABLE_CACHE_PERSISTENCE", true),
      persistenceKey: getStringEnv(
        "VITE_CACHE_PERSISTENCE_KEY",
        getStringEnv("NEXT_PUBLIC_CACHE_PERSISTENCE_KEY", "sanarwa-cache"),
      ),
    },
  };
}

/**
 * Global configuration instance
 */
export const config = createEnvironmentConfig();

/**
 * Configuration validation
 */
export function validateConfig(config: EnvironmentConfig): string[] {
  const errors: string[] = [];

  // Validate required URLs
  if (!config.api.baseUrl) {
    errors.push("API base URL is required");
  }

  if (!config.app.appUrl) {
    errors.push("App URL is required");
  }

  // Validate URL formats
  try {
    new URL(config.api.baseUrl);
  } catch {
    errors.push("API base URL is not a valid URL");
  }

  try {
    new URL(config.app.appUrl);
  } catch {
    errors.push("App URL is not a valid URL");
  }

  // Validate numeric values
  if (config.api.timeout <= 0) {
    errors.push("API timeout must be greater than 0");
  }

  if (config.api.retryAttempts < 0) {
    errors.push("API retry attempts must be non-negative");
  }

  // Validate monitoring configuration
  if (config.monitoring.enableSentry && !config.monitoring.sentryDsn) {
    errors.push("Sentry DSN is required when Sentry is enabled");
  }

  if (config.monitoring.enablePosthog && !config.monitoring.posthogKey) {
    errors.push("PostHog key is required when PostHog is enabled");
  }

  return errors;
}

/**
 * Get configuration for specific feature
 */
export function getFeatureConfig<K extends keyof EnvironmentConfig>(
  feature: K,
): EnvironmentConfig[K] {
  return config[feature];
}

/**
 * Check if feature is enabled
 */
export function isFeatureEnabled(feature: keyof FeatureFlags): boolean {
  return config.features[feature];
}

/**
 * Get environment-specific defaults
 */
export function getEnvironmentDefaults(env: Environment) {
  const isDevelopment = env === "development";
  const isProduction = env === "production";
  const isTest = env === "test";

  return {
    api: {
      timeout: isDevelopment ? 30000 : 10000,
      retryAttempts: isDevelopment ? 1 : 3,
      enableRetry: !isDevelopment,
    },
    logging: {
      level: isDevelopment ? "debug" : "info",
      enableConsole: !isProduction,
      enableRemote: isProduction,
    },
    monitoring: {
      enableSentry: !isDevelopment && !isTest,
      enablePosthog: isProduction,
      enableGoogleAnalytics: isProduction,
    },
    features: {
      enableAnalytics: isProduction,
      enableErrorReporting: !isDevelopment && !isTest,
      enableAPIPlayground: isDevelopment || env === "staging",
    },
  };
}

/**
 * Runtime configuration updates (for dynamic feature flags)
 */
export class ConfigManager {
  private static instance: ConfigManager;
  private runtimeConfig: Partial<EnvironmentConfig> = {};

  static getInstance(): ConfigManager {
    if (!ConfigManager.instance) {
      ConfigManager.instance = new ConfigManager();
    }
    return ConfigManager.instance;
  }

  updateFeatureFlag(flag: keyof FeatureFlags, enabled: boolean): void {
    if (!this.runtimeConfig.features) {
      this.runtimeConfig.features = { ...config.features };
    }
    this.runtimeConfig.features[flag] = enabled;
  }

  getFeatureFlag(flag: keyof FeatureFlags): boolean {
    return this.runtimeConfig.features?.[flag] ?? config.features[flag];
  }

  updateApiConfig(updates: Partial<ApiConfig>): void {
    this.runtimeConfig.api = {
      ...config.api,
      ...this.runtimeConfig.api,
      ...updates,
    };
  }

  getApiConfig(): ApiConfig {
    return {
      ...config.api,
      ...this.runtimeConfig.api,
    };
  }

  reset(): void {
    this.runtimeConfig = {};
  }
}

export const configManager = ConfigManager.getInstance();
