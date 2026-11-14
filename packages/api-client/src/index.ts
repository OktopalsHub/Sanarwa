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

export { authApi } from "./auth";

export {
  ApiErrorHandler,
  setApiErrorToast,
  useApiErrorHandler,
  type ErrorHandlerConfig,
} from "./error-handler";

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

export { apiKeyApi } from "./api-key";
export { projectApi } from "./project";
export { providerApi } from "./provider";
export type { Project } from "./types/project";
export type {
  CreateProviderConfigRequest,
  ProviderChannel,
  ProviderConfigRecord,
  ProviderSchema,
  ProviderTemplate,
  UpdateProviderConfigRequest,
} from "./types/provider";
export { notificationApi } from "./notification";
export { templateApi, TemplateApiClient } from "./template";
export { analyticsApi } from "./analytics";
export { billingApi } from "./billing";
export * from "./messaging";
export * from "./webhook";
export * from "./demo";

export { webrtcApi, WebRTCApiClient, webrtcSignaling, WebRTCSignalingManager } from "./webrtc";

export * from "./campaigns";
export * from "./tenant";
