import axios, { AxiosError, AxiosInstance, AxiosRequestConfig, AxiosResponse } from "axios";
import { transformApiError } from "./client.error";
import { ApiError, TokenStorage } from "./client.types";

export type ApiClientInterceptorDeps = {
  tokenStorage: TokenStorage;
  getTenantId: () => string | undefined;
  handleTokenRefresh: () => Promise<string>;
  handleAuthenticationFailure: () => void;
  request: <T>(config: AxiosRequestConfig) => Promise<T>;
};

export function attachApiClientInterceptors(
  axiosInstance: AxiosInstance,
  deps: ApiClientInterceptorDeps,
): void {
  axiosInstance.interceptors.request.use(
    (config) => {
      const token = deps.tokenStorage.getAccessToken();
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }

      const tenantId = deps.getTenantId();
      if (tenantId) {
        config.headers["X-Tenant-ID"] = tenantId;
      }

      if (config.url) {
        const requestInit: RequestInit = {
          method: config.method?.toUpperCase(),
          headers: config.headers as Record<string, string>,
          body: config.data ? JSON.stringify(config.data) : undefined,
        };

        const processedRequest = requestInit;

        if (processedRequest.headers) {
          const headers = new Headers(processedRequest.headers);
          headers.forEach((value, key) => {
            config.headers[key] = value;
          });
        }

        if (processedRequest.body && typeof processedRequest.body === "string") {
          try {
            config.data = JSON.parse(processedRequest.body);
          } catch {
            // Keep original data if parsing fails
          }
        }
      }

      return config;
    },
    (error) => Promise.reject(error),
  );

  axiosInstance.interceptors.response.use(
    (response: AxiosResponse) => response,
    async (error: AxiosError) => {
      const originalRequest = error.config as AxiosRequestConfig & { _retry?: boolean };

      if (error.response?.status === 429) {
        const retryAfter = error.response.headers["retry-after"];
        const delay = retryAfter ? parseInt(retryAfter, 10) * 1000 : 5000;

        console.warn(`Rate limited. Retrying after ${delay}ms`);

        if (!originalRequest._retry) {
          originalRequest._retry = true;
          await new Promise((resolve) => setTimeout(resolve, delay));
          return axiosInstance(originalRequest);
        }
      }

      if (error.response?.status === 401 && !originalRequest._retry) {
        originalRequest._retry = true;

        try {
          const newToken = await deps.handleTokenRefresh();
          if (newToken && originalRequest.headers) {
            originalRequest.headers.Authorization = `Bearer ${newToken}`;
            return axiosInstance(originalRequest);
          }
        } catch (refreshError) {
          deps.handleAuthenticationFailure();
          return Promise.reject(refreshError);
        }
      }

      return Promise.reject(transformApiError(error));
    },
  );
}

export function createNoTenantError(): ApiError {
  const error = new Error(
    "No tenant selected. Please select a tenant to continue.",
  ) as ApiError;
  error.code = "NO_TENANT_SELECTED";
  return error;
}
