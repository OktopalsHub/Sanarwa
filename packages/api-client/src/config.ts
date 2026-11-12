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

function readEnv(key: string): string | undefined {
  const meta = import.meta as unknown as { env?: Record<string, string | undefined> };
  if (typeof import.meta !== "undefined" && meta.env?.[key]) {
    return String(meta.env[key]);
  }
  if (typeof process !== "undefined" && process.env?.[key]) {
    return String(process.env[key]);
  }
  return undefined;
}

function readMode(): string {
  const meta = import.meta as unknown as { env?: Record<string, string | undefined> };
  if (typeof import.meta !== "undefined" && meta.env?.MODE) {
    return String(meta.env.MODE);
  }
  if (typeof process !== "undefined" && process.env?.NODE_ENV) {
    return String(process.env.NODE_ENV);
  }
  return "development";
}

const defaultEnvironmentConfig: EnvironmentConfig = {
  development: {
    baseUrl: "http://localhost:8000",
    wsUrl: "ws://localhost:8000",
    timeout: 30000,
    retryAttempts: 1,
    retryDelay: 1000,
    enableRetry: true,
    enableLogging: true,
  },
  staging: {
    baseUrl:
      readEnv("VITE_API_URL") ||
      readEnv("NEXT_PUBLIC_STAGING_API_URL") ||
      "https://staging-api.sanarwa.com",
    wsUrl:
      readEnv("VITE_WS_URL") ||
      readEnv("NEXT_PUBLIC_STAGING_WS_URL") ||
      "wss://staging-api.sanarwa.com",
    timeout: 15000,
    retryAttempts: 2,
    retryDelay: 2000,
    enableRetry: true,
    enableLogging: true,
  },
  production: {
    baseUrl: readEnv("VITE_API_URL") || readEnv("NEXT_PUBLIC_API_URL") || "https://api.sanarwa.com",
    wsUrl: readEnv("VITE_WS_URL") || readEnv("NEXT_PUBLIC_WS_URL") || "wss://api.sanarwa.com",
    timeout: 10000,
    retryAttempts: 3,
    retryDelay: 1000,
    enableRetry: true,
    enableLogging: false,
  },
};

const baseConfig: ApiConfig = {
  baseUrl: "http://localhost:8000",
  wsUrl: "ws://localhost:8000",
  timeout: 10000,
  retryAttempts: 3,
  retryDelay: 1000,
  enableRetry: true,
  enableLogging: true,
};

export const getCurrentEnvironment = (): keyof EnvironmentConfig => {
  if (typeof window === "undefined") {
    return (readMode() as keyof EnvironmentConfig) || "development";
  }

  const hostname = window.location.hostname;

  if (hostname === "localhost" || hostname === "127.0.0.1") {
    return "development";
  }

  if (hostname.includes("staging")) {
    return "staging";
  }

  return "production";
};

export const getApiConfig = (): ApiConfig => {
  const environment = getCurrentEnvironment();
  const envConfig = defaultEnvironmentConfig[environment];

  const config: ApiConfig = {
    ...baseConfig,
    ...envConfig,
  };

  const apiUrl = readEnv("VITE_API_URL") || readEnv("NEXT_PUBLIC_API_URL");
  if (apiUrl) {
    config.baseUrl = apiUrl;
  }

  const wsUrl = readEnv("VITE_WS_URL") || readEnv("NEXT_PUBLIC_WS_URL");
  if (wsUrl) {
    config.wsUrl = wsUrl;
  }

  const timeout = readEnv("VITE_API_TIMEOUT") || readEnv("NEXT_PUBLIC_API_TIMEOUT");
  if (timeout) {
    config.timeout = parseInt(timeout, 10);
  }

  const retryAttempts =
    readEnv("VITE_API_RETRY_ATTEMPTS") || readEnv("NEXT_PUBLIC_API_RETRY_ATTEMPTS");
  if (retryAttempts) {
    config.retryAttempts = parseInt(retryAttempts, 10);
  }

  return config;
};

export const getCorsConfig = () => {
  const environment = getCurrentEnvironment();

  const corsConfig = {
    development: {
      origin: ["http://localhost:3000", "http://127.0.0.1:3000"],
      credentials: true,
    },
    staging: {
      origin: [
        readEnv("VITE_STAGING_URL") ||
          readEnv("NEXT_PUBLIC_STAGING_URL") ||
          "https://staging.sanarwa.com",
      ],
      credentials: true,
    },
    production: {
      origin: [
        readEnv("VITE_APP_URL") || readEnv("NEXT_PUBLIC_APP_URL") || "https://app.sanarwa.com",
      ],
      credentials: true,
    },
  };

  return corsConfig[environment];
};

export const getFeatureFlags = () => {
  return {
    enableAnalytics:
      (readEnv("VITE_ENABLE_ANALYTICS") || readEnv("NEXT_PUBLIC_ENABLE_ANALYTICS")) === "true",
    enableErrorReporting:
      (readEnv("VITE_ENABLE_ERROR_REPORTING") || readEnv("NEXT_PUBLIC_ENABLE_ERROR_REPORTING")) ===
      "true",
    enablePerformanceMonitoring:
      (readEnv("VITE_ENABLE_PERFORMANCE_MONITORING") ||
        readEnv("NEXT_PUBLIC_ENABLE_PERFORMANCE_MONITORING")) === "true",
    enableWebRTC:
      (readEnv("VITE_ENABLE_WEBRTC") || readEnv("NEXT_PUBLIC_ENABLE_WEBRTC")) !== "false",
    enableRealTimeUpdates:
      (readEnv("VITE_ENABLE_REALTIME") || readEnv("NEXT_PUBLIC_ENABLE_REALTIME")) !== "false",
  };
};

export const getSecurityConfig = () => {
  const environment = getCurrentEnvironment();

  return {
    enforceHttps: environment === "production",
    enableCSP: environment === "production",
    tokenStorageKey: "sanarwa_auth_token",
    refreshTokenStorageKey: "sanarwa_refresh_token",
    sessionTimeout: 24 * 60 * 60 * 1000,
    refreshTokenThreshold: 5 * 60 * 1000,
  };
};

export const getLoggingConfig = () => {
  const environment = getCurrentEnvironment();

  return {
    level: environment === "production" ? "error" : "debug",
    enableConsoleLogging: environment !== "production",
    enableRemoteLogging: environment === "production",
    logApiRequests: environment === "development",
    logApiResponses: environment === "development",
  };
};

export const getPerformanceConfig = () => {
  return {
    enableCaching: true,
    cacheTimeout: 5 * 60 * 1000,
    enableCompression: true,
    enableBundleAnalysis: readEnv("ANALYZE") === "true",
    enableServiceWorker: readMode() === "production",
  };
};

export const validateConfig = (config: ApiConfig): boolean => {
  const errors: string[] = [];

  if (!config.baseUrl) {
    errors.push("Base URL is required");
  }

  if (!config.wsUrl) {
    errors.push("WebSocket URL is required");
  }

  if (config.timeout <= 0) {
    errors.push("Timeout must be greater than 0");
  }

  if (config.retryAttempts < 0) {
    errors.push("Retry attempts must be non-negative");
  }

  if (errors.length > 0) {
    console.error("Configuration validation failed:", errors);
    return false;
  }

  return true;
};

export const getCompleteConfig = () => {
  const apiConfig = getApiConfig();

  if (!validateConfig(apiConfig)) {
    throw new Error("Invalid API configuration");
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
