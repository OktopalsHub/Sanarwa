import axios, { AxiosError, AxiosInstance, AxiosRequestConfig, AxiosResponse } from "axios";
import { apiRuntimeConfig } from "./env";

const getApiBaseUrl = (): string => {
  return apiRuntimeConfig.baseUrl;
};

export interface ApiClientConfig {
  baseUrl?: string;
  tenantId?: string;
  timeout?: number;
  retryAttempts?: number;
  headers?: Record<string, string>;
}

export interface ApiError extends Error {
  status?: number;
  code?: string;
  details?: any;
  isAxiosError?: boolean;
}

export interface ApiResponse<T> {
  data: T;
  success: boolean;
  message?: string;
  errors?: Array<{
    field?: string;
    code: string;
    message: string;
  }>;
  pagination?: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

export interface TokenStorage {
  getAccessToken(): string | null;
  setAccessToken(token: string): void;
  getRefreshToken(): string | null;
  setRefreshToken(token: string): void;
  clearTokens(): void;
}

class LocalStorageTokenStorage implements TokenStorage {
  private readonly ACCESS_TOKEN_KEY = "sanarwa_access_token";
  private readonly REFRESH_TOKEN_KEY = "sanarwa_refresh_token";

  getAccessToken(): string | null {
    if (typeof window === "undefined") return null;
    return localStorage.getItem(this.ACCESS_TOKEN_KEY);
  }

  setAccessToken(token: string): void {
    if (typeof window === "undefined") return;
    localStorage.setItem(this.ACCESS_TOKEN_KEY, token);
  }

  getRefreshToken(): string | null {
    if (typeof window === "undefined") return null;
    return localStorage.getItem(this.REFRESH_TOKEN_KEY);
  }

  setRefreshToken(token: string): void {
    if (typeof window === "undefined") return;
    localStorage.setItem(this.REFRESH_TOKEN_KEY, token);
  }

  clearTokens(): void {
    if (typeof window === "undefined") return;
    localStorage.removeItem(this.ACCESS_TOKEN_KEY);
    localStorage.removeItem(this.REFRESH_TOKEN_KEY);
  }
}

export class ApiClient {
  private axiosInstance: AxiosInstance;
  private tenantId?: string;
  private tokenStorage: TokenStorage;
  private refreshPromise: Promise<string> | null = null;
  private retryAttempts: number;

  constructor(config: ApiClientConfig = {}) {
    this.tenantId = config.tenantId;
    this.retryAttempts = config.retryAttempts || 3;
    this.tokenStorage = new LocalStorageTokenStorage();

    this.axiosInstance = axios.create({
      baseURL: config.baseUrl || getApiBaseUrl(),
      timeout: config.timeout || 10000,
      headers: {
        "Content-Type": "application/json",
        ...config.headers,
      },
      withCredentials: true,
    });

    this.setupInterceptors();
  }

  private setupInterceptors(): void {
    this.axiosInstance.interceptors.request.use(
      (config) => {
        const token = this.tokenStorage.getAccessToken();
        if (token) {
          config.headers.Authorization = `Bearer ${token}`;
        }

        if (this.tenantId) {
          config.headers["X-Tenant-ID"] = this.tenantId;
        }

        if (config.url) {
          const fullUrl = config.baseURL + config.url;
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
            } catch {}
          }
        }

        return config;
      },
      (error) => {
        return Promise.reject(error);
      },
    );

    this.axiosInstance.interceptors.response.use(
      (response: AxiosResponse) => {
        if (response.config.url) {
          const fullUrl = response.config.baseURL + response.config.url;
        }

        return response;
      },
      async (error: AxiosError) => {
        const originalRequest = error.config as AxiosRequestConfig & { _retry?: boolean };

        if (error.response?.status === 429) {
          const retryAfter = error.response.headers["retry-after"];
          const delay = retryAfter ? parseInt(retryAfter, 10) * 1000 : 5000;

          console.warn(`Rate limited. Retrying after ${delay}ms`);

          if (!originalRequest._retry) {
            originalRequest._retry = true;
            await new Promise((resolve) => setTimeout(resolve, delay));
            return this.axiosInstance(originalRequest);
          }
        }

        if (error.response?.status === 401 && !originalRequest._retry) {
          originalRequest._retry = true;

          try {
            const newToken = await this.handleTokenRefresh();
            if (newToken && originalRequest.headers) {
              originalRequest.headers.Authorization = `Bearer ${newToken}`;
              return this.axiosInstance(originalRequest);
            }
          } catch (refreshError) {
            this.handleAuthenticationFailure();
            return Promise.reject(refreshError);
          }
        }

        if (error.response && originalRequest.url) {
          const fullUrl = originalRequest.baseURL + originalRequest.url;
        }

        return Promise.reject(this.transformError(error));
      },
    );
  }

  private async handleTokenRefresh(): Promise<string> {
    if (this.refreshPromise) {
      return this.refreshPromise;
    }

    this.refreshPromise = this.performTokenRefresh();

    try {
      const newToken = await this.refreshPromise;
      return newToken;
    } finally {
      this.refreshPromise = null;
    }
  }

  private async performTokenRefresh(): Promise<string> {
    const refreshToken = this.tokenStorage.getRefreshToken();

    if (!refreshToken) {
      throw new Error("No refresh token available");
    }

    try {
      const response = await axios.post(
        `${this.axiosInstance.defaults.baseURL}/auth/refresh-token`,
        { refreshToken },
        {
          headers: { "Content-Type": "application/json" },
          withCredentials: true,
        },
      );

      const { accessToken, refreshToken: newRefreshToken } = response.data;

      this.tokenStorage.setAccessToken(accessToken);
      if (newRefreshToken) {
        this.tokenStorage.setRefreshToken(newRefreshToken);
      }

      return accessToken;
    } catch (error) {
      this.tokenStorage.clearTokens();
      throw error;
    }
  }

  private handleAuthenticationFailure(): void {
    this.tokenStorage.clearTokens();

    if (typeof window !== "undefined") {
      window.location.href = "/login";
    }
  }

  private extractResponseMessage(responseData: unknown): string | undefined {
    if (!responseData || typeof responseData !== "object") return undefined;

    const data = responseData as Record<string, unknown>;
    const nested = data.error as Record<string, unknown> | undefined;
    const raw = nested?.message ?? data.message;

    if (Array.isArray(raw)) {
      const parts = raw.filter(
        (part): part is string => typeof part === "string" && part.trim().length > 0,
      );
      return parts.length > 0 ? parts.join(". ") : undefined;
    }

    if (typeof raw === "string" && raw.trim()) {
      if (raw === "Bad Request Exception" || raw === "Bad Request") {
        return "The request was invalid. Check your input and try again.";
      }
      return raw;
    }

    return undefined;
  }

  private transformError(error: AxiosError): ApiError {
    const apiError = new Error() as ApiError;
    apiError.isAxiosError = true;

    if (error.response) {
      const responseData = error.response.data as any;

      apiError.status = error.response.status;
      apiError.message =
        this.extractResponseMessage(responseData) ||
        error.message ||
        `HTTP error! status: ${error.response.status}`;
      apiError.code = responseData?.error?.code ?? responseData?.code;
      apiError.details = responseData?.error?.details ?? responseData?.details;

      switch (error.response.status) {
        case 401:
          apiError.message = "Invalid email or password";
          break;
        case 403:
          if (responseData?.code === "TENANT_ACCESS_DENIED") {
            apiError.message = "You do not have access to this tenant";
          }
          break;
        case 404:
          if (responseData?.code === "TENANT_NOT_FOUND") {
            apiError.message = "Tenant not found";
          }
          break;
        case 409:
          apiError.message =
            this.extractResponseMessage(responseData) ||
            "That workspace URL is already taken. Try another.";
          break;
        case 429:
          apiError.message = "Too many requests. Please try again later.";
          break;
      }
    } else if (error.request) {
      apiError.message = "Network error. Please check your connection.";
      apiError.code = "NETWORK_ERROR";
    } else {
      apiError.message = error.message || "An unexpected error occurred";
      apiError.code = "UNKNOWN_ERROR";
    }

    return apiError;
  }

  setAuthToken(token: string): void {
    this.tokenStorage.setAccessToken(token);
  }

  setRefreshToken(token: string): void {
    this.tokenStorage.setRefreshToken(token);
  }

  clearTokens(): void {
    this.tokenStorage.clearTokens();
  }

  setTenant(tenantId: string | null): void {
    this.tenantId = tenantId || undefined;
  }

  getTenant(): string | undefined {
    return this.tenantId;
  }

  resolvePath(endpoint: string, params?: { projectId?: string }): string {
    let path = endpoint;
    if (this.tenantId) {
      path = path.replace(/:tenantId/g, this.tenantId);
    }
    if (params?.projectId) {
      path = path.replace(/:projectId/g, params.projectId);
    }
    return path;
  }

  private prepareRequest(
    endpoint: string,
    tenantScoped: boolean,
    pathParams?: { projectId?: string },
  ): string {
    if (tenantScoped && !this.tenantId) {
      const error = new Error(
        "No tenant selected. Please select a tenant to continue.",
      ) as ApiError;
      error.code = "NO_TENANT_SELECTED";
      throw error;
    }
    return this.resolvePath(endpoint, pathParams);
  }

  private async requestWithRetry<T>(config: AxiosRequestConfig, retryCount = 0): Promise<T> {
    try {
      const response = await this.axiosInstance(config);
      return response.data;
    } catch (error) {
      const axiosError = error as AxiosError;

      const shouldRetry =
        retryCount < this.retryAttempts &&
        (!axiosError.response || axiosError.response.status >= 500) &&
        axiosError.code !== "ECONNABORTED";

      if (shouldRetry) {
        const delay = Math.pow(2, retryCount) * 1000;
        await new Promise((resolve) => setTimeout(resolve, delay));

        return this.requestWithRetry<T>(config, retryCount + 1);
      }

      throw error;
    }
  }

  async get<T>(
    endpoint: string,
    params?: Record<string, any>,
    options?: AxiosRequestConfig & { tenantScoped?: boolean; projectId?: string },
  ): Promise<T> {
    const { tenantScoped = true, projectId, ...axiosOptions } = options || {};
    const url = this.prepareRequest(endpoint, tenantScoped, projectId ? { projectId } : undefined);

    return this.requestWithRetry<T>({
      method: "GET",
      url,
      params,
      ...axiosOptions,
    });
  }

  async post<T>(
    endpoint: string,
    data?: any,
    options?: AxiosRequestConfig & { tenantScoped?: boolean; projectId?: string },
  ): Promise<T> {
    const { tenantScoped = true, projectId, ...axiosOptions } = options || {};
    const url = this.prepareRequest(endpoint, tenantScoped, projectId ? { projectId } : undefined);

    return this.requestWithRetry<T>({
      method: "POST",
      url,
      data,
      ...axiosOptions,
    });
  }

  async put<T>(
    endpoint: string,
    data?: any,
    options?: AxiosRequestConfig & { tenantScoped?: boolean; projectId?: string },
  ): Promise<T> {
    const { tenantScoped = true, projectId, ...axiosOptions } = options || {};
    const url = this.prepareRequest(endpoint, tenantScoped, projectId ? { projectId } : undefined);

    return this.requestWithRetry<T>({
      method: "PUT",
      url,
      data,
      ...axiosOptions,
    });
  }

  async patch<T>(
    endpoint: string,
    data?: any,
    options?: AxiosRequestConfig & { tenantScoped?: boolean; projectId?: string },
  ): Promise<T> {
    const { tenantScoped = true, projectId, ...axiosOptions } = options || {};
    const url = this.prepareRequest(endpoint, tenantScoped, projectId ? { projectId } : undefined);

    return this.requestWithRetry<T>({
      method: "PATCH",
      url,
      data,
      ...axiosOptions,
    });
  }

  async delete<T>(
    endpoint: string,
    options?: AxiosRequestConfig & { tenantScoped?: boolean; projectId?: string },
  ): Promise<T> {
    const { tenantScoped = true, projectId, ...axiosOptions } = options || {};
    const url = this.prepareRequest(endpoint, tenantScoped, projectId ? { projectId } : undefined);

    return this.requestWithRetry<T>({
      method: "DELETE",
      url,
      ...axiosOptions,
    });
  }

  connectWebSocket(endpoint: string): WebSocket | null {
    if (typeof window === "undefined") return null;

    const wsUrl = this.axiosInstance.defaults.baseURL?.replace(/^http/, "ws") + endpoint;
    const token = this.tokenStorage.getAccessToken();

    const ws = new WebSocket(`${wsUrl}?token=${token}`);

    ws.onopen = () => {
      console.log("WebSocket connected:", endpoint);
    };

    ws.onerror = (error) => {
      console.error("WebSocket error:", error);
    };

    ws.onclose = () => {
      console.log("WebSocket disconnected:", endpoint);
    };

    return ws;
  }
}

export const apiClient = new ApiClient();

export function useTenantApiClient(tenantId?: string): ApiClient {
  if (tenantId) {
    return new ApiClient({ tenantId });
  }
  return apiClient;
}

export const getEnvironmentConfig = () => {
  const isDevelopment = process.env.NODE_ENV === "development";
  const isProduction = process.env.NODE_ENV === "production";

  return {
    apiUrl: getApiBaseUrl(),
    wsUrl: process.env.NEXT_PUBLIC_WS_URL || getApiBaseUrl().replace(/^http/, "ws"),
    isDevelopment,
    isProduction,
    timeout: isDevelopment ? 30000 : 10000,
    retryAttempts: isDevelopment ? 1 : 3,
  };
};

export const createApiClient = (config?: Partial<ApiClientConfig>): ApiClient => {
  const envConfig = getEnvironmentConfig();

  return new ApiClient({
    baseUrl: envConfig.apiUrl,
    timeout: envConfig.timeout,
    retryAttempts: envConfig.retryAttempts,
    ...config,
  });
};
