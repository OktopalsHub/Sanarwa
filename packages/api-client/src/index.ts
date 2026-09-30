/**
 * API Client Library
 * Core infrastructure for communicating with the NestJS backend
 */

// Core API client
export {
  ApiClient,
  apiClient,
  createApiClient,
  getEnvironmentConfig,
  useTenantApiClient,
  type ApiClientConfig,
  type ApiError,
  type ApiResponse,
  type TokenStorage,
} from "./client";

// Authentication API
export { authApi } from "./auth";

// Error handling
export {
  ApiErrorHandler,
  setApiErrorToast,
  useApiErrorHandler,
  type ErrorHandlerConfig,
} from "./error-handler";

// Configuration management
export {
  getApiConfig,
  getCompleteConfig,
  getCorsConfig,
  getCurrentEnvironment,
  getFeatureFlags,
  getLoggingConfig,
  getPerformanceConfig,
  getSecurityConfig,
  validateConfig,
  type ApiConfig,
  type EnvironmentConfig,
} from "./config";

// Project and API Key management
export { apiKeyApi } from "./api-key";
export { projectApi } from "./project";
export { providerApi } from "./provider";
export { notificationApi } from "./notification";
export { analyticsApi } from "./analytics";
export { billingApi } from "./billing";
export * from "./messaging";
export * from "./webhook";
export * from "./demo";

// WebRTC API
export { webrtcApi, WebRTCApiClient, webrtcSignaling, WebRTCSignalingManager } from "./webrtc";

// Re-export existing API clients for backward compatibility
export * from "./campaigns";
export * from "./tenant";
