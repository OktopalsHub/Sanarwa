import axios, { AxiosError, AxiosInstance, AxiosRequestConfig } from "axios";
import { apiRuntimeConfig } from "./env";
import { attachApiClientInterceptors, createNoTenantError } from "./client.interceptors";
import { LocalStorageTokenStorage } from "./client.token-storage";
import { ApiClientConfig, ApiError, TokenStorage } from "./client.types";

export type { ApiClientConfig, ApiError, ApiResponse, TokenStorage } from "./client.types";

const getApiBaseUrl = (): string => apiRuntimeConfig.baseUrl;

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

    attachApiClientInterceptors(this.axiosInstance, {
      tokenStorage: this.tokenStorage,
      getTenantId: () => this.tenantId,
      handleTokenRefresh: () => this.handleTokenRefresh(),
      handleAuthenticationFailure: () => this.handleAuthenticationFailure(),
      request: (requestConfig) => this.requestWithRetry(requestConfig),
    });
  }

  private async handleTokenRefresh(): Promise<string> {
    if (this.refreshPromise) {
      return this.refreshPromise;
    }

    this.refreshPromise = this.performTokenRefresh();

    try {
      return await this.refreshPromise;
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
        `${this.axiosInstance.defaults.baseURL}/auth/refresh`,
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
      throw createNoTenantError();
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
