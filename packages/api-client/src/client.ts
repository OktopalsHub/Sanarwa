import axios, { AxiosError, AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios';
import { apiRuntimeConfig } from './env';

// Environment-based backend URL management
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

// Default token storage implementation using localStorage
class LocalStorageTokenStorage implements TokenStorage {
  private readonly ACCESS_TOKEN_KEY = 'sanarwa_access_token';
  private readonly REFRESH_TOKEN_KEY = 'sanarwa_refresh_token';

  getAccessToken(): string | null {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem(this.ACCESS_TOKEN_KEY);
  }

  setAccessToken(token: string): void {
    if (typeof window === 'undefined') return;
    localStorage.setItem(this.ACCESS_TOKEN_KEY, token);
  }

  getRefreshToken(): string | null {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem(this.REFRESH_TOKEN_KEY);
  }

  setRefreshToken(token: string): void {
    if (typeof window === 'undefined') return;
    localStorage.setItem(this.REFRESH_TOKEN_KEY, token);
  }

  clearTokens(): void {
    if (typeof window === 'undefined') return;
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

    // Create axios instance with configuration
    this.axiosInstance = axios.create({
      baseURL: config.baseUrl || getApiBaseUrl(),
      timeout: config.timeout || 10000,
      headers: {
        'Content-Type': 'application/json',
        ...config.headers,
      },
      withCredentials: true, // Include cookies for authentication
    });

    this.setupInterceptors();
  }

  private setupInterceptors(): void {
    // Request interceptor for authentication, tenant headers, and security
    this.axiosInstance.interceptors.request.use(
      (config) => {
        // Add authentication token
        const token = this.tokenStorage.getAccessToken();
        if (token) {
          config.headers.Authorization = `Bearer ${token}`;
        }

        // Add tenant header if tenant is set
        if (this.tenantId) {
          config.headers['X-Tenant-ID'] = this.tenantId;
        }

        // Apply security middleware
        if (config.url) {
          const fullUrl = config.baseURL + config.url;
          const requestInit: RequestInit = {
            method: config.method?.toUpperCase(),
            headers: config.headers as Record<string, string>,
            body: config.data ? JSON.stringify(config.data) : undefined,
          };

          // TODO: Implement security middleware
          const processedRequest = requestInit;

          // Update config with processed headers
          if (processedRequest.headers) {
            const headers = new Headers(processedRequest.headers);
            headers.forEach((value, key) => {
              config.headers[key] = value;
            });
          }

          // Update body if it was sanitized
          if (processedRequest.body && typeof processedRequest.body === 'string') {
            try {
              config.data = JSON.parse(processedRequest.body);
            } catch {
              // Keep original data if parsing fails
            }
          }
        }

        return config;
      },
      (error) => {
        return Promise.reject(error);
      }
    );

    // Response interceptor for error handling, token refresh, and security processing
    this.axiosInstance.interceptors.response.use(
      (response: AxiosResponse) => {
        // Process response through security middleware
        if (response.config.url) {
          const fullUrl = response.config.baseURL + response.config.url;
          // TODO: Implement security middleware response processing
        }

        return response;
      },
      async (error: AxiosError) => {
        const originalRequest = error.config as AxiosRequestConfig & { _retry?: boolean };

        // Handle rate limiting
        if (error.response?.status === 429) {
          const retryAfter = error.response.headers['retry-after'];
          const delay = retryAfter ? parseInt(retryAfter, 10) * 1000 : 5000;

          console.warn(`Rate limited. Retrying after ${delay}ms`);

          // Wait and retry if not already retried
          if (!originalRequest._retry) {
            originalRequest._retry = true;
            await new Promise(resolve => setTimeout(resolve, delay));
            return this.axiosInstance(originalRequest);
          }
        }

        // Handle 401 errors with automatic token refresh
        if (error.response?.status === 401 && !originalRequest._retry) {
          originalRequest._retry = true;

          try {
            const newToken = await this.handleTokenRefresh();
            if (newToken && originalRequest.headers) {
              originalRequest.headers.Authorization = `Bearer ${newToken}`;
              return this.axiosInstance(originalRequest);
            }
          } catch (refreshError) {
            // Refresh failed, redirect to login
            this.handleAuthenticationFailure();
            return Promise.reject(refreshError);
          }
        }

        // Process error response through security middleware
        if (error.response && originalRequest.url) {
          const fullUrl = originalRequest.baseURL + originalRequest.url;
          // TODO: Implement security middleware error response processing
        }

        // Handle other errors
        return Promise.reject(this.transformError(error));
      }
    );
  }

  private async handleTokenRefresh(): Promise<string> {
    // Prevent multiple simultaneous refresh attempts
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
      throw new Error('No refresh token available');
    }

    try {
      const response = await axios.post(
        `${this.axiosInstance.defaults.baseURL}/auth/refresh`,
        { refreshToken },
        {
          headers: { 'Content-Type': 'application/json' },
          withCredentials: true,
        }
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

    // Only redirect on client-side
    if (typeof window !== 'undefined') {
      window.location.href = '/login';
    }
  }

  private transformError(error: AxiosError): ApiError {
    const apiError = new Error() as ApiError;
    apiError.isAxiosError = true;

    if (error.response) {
      // Server responded with error status
      const responseData = error.response.data as any;

      apiError.status = error.response.status;
      apiError.message = responseData?.message || error.message || `HTTP error! status: ${error.response.status}`;
      apiError.code = responseData?.code;
      apiError.details = responseData?.details;

      // Handle specific error types
      switch (error.response.status) {
        case 403:
          if (responseData?.code === 'TENANT_ACCESS_DENIED') {
            apiError.message = 'You do not have access to this tenant';
          }
          break;
        case 404:
          if (responseData?.code === 'TENANT_NOT_FOUND') {
            apiError.message = 'Tenant not found';
          }
          break;
        case 429:
          apiError.message = 'Too many requests. Please try again later.';
          break;
      }
    } else if (error.request) {
      // Network error
      apiError.message = 'Network error. Please check your connection.';
      apiError.code = 'NETWORK_ERROR';
    } else {
      // Other error
      apiError.message = error.message || 'An unexpected error occurred';
      apiError.code = 'UNKNOWN_ERROR';
    }

    return apiError;
  }

  // Token management methods
  setAuthToken(token: string): void {
    this.tokenStorage.setAccessToken(token);
  }

  setRefreshToken(token: string): void {
    this.tokenStorage.setRefreshToken(token);
  }

  clearTokens(): void {
    this.tokenStorage.clearTokens();
  }

  // Tenant management
  setTenant(tenantId: string | null): void {
    this.tenantId = tenantId || undefined;
  }

  getTenant(): string | undefined {
    return this.tenantId;
  }

  /** Replace :tenantId and :projectId placeholders in API paths */
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
      const error = new Error('No tenant selected. Please select a tenant to continue.') as ApiError;
      error.code = 'NO_TENANT_SELECTED';
      throw error;
    }
    return this.resolvePath(endpoint, pathParams);
  }

  // HTTP methods with retry logic
  private async requestWithRetry<T>(
    config: AxiosRequestConfig,
    retryCount = 0
  ): Promise<T> {
    try {
      const response = await this.axiosInstance(config);
      return response.data;
    } catch (error) {
      const axiosError = error as AxiosError;

      // Retry on network errors or 5xx server errors
      const shouldRetry =
        retryCount < this.retryAttempts &&
        (!axiosError.response || axiosError.response.status >= 500) &&
        axiosError.code !== 'ECONNABORTED'; // Don't retry timeouts

      if (shouldRetry) {
        // Exponential backoff
        const delay = Math.pow(2, retryCount) * 1000;
        await new Promise(resolve => setTimeout(resolve, delay));

        return this.requestWithRetry<T>(config, retryCount + 1);
      }

      throw error;
    }
  }

  // Convenience methods
  async get<T>(
    endpoint: string,
    params?: Record<string, any>,
    options?: AxiosRequestConfig & { tenantScoped?: boolean; projectId?: string }
  ): Promise<T> {
    const { tenantScoped = true, projectId, ...axiosOptions } = options || {};
    const url = this.prepareRequest(endpoint, tenantScoped, projectId ? { projectId } : undefined);

    return this.requestWithRetry<T>({
      method: 'GET',
      url,
      params,
      ...axiosOptions,
    });
  }

  async post<T>(
    endpoint: string,
    data?: any,
    options?: AxiosRequestConfig & { tenantScoped?: boolean; projectId?: string }
  ): Promise<T> {
    const { tenantScoped = true, projectId, ...axiosOptions } = options || {};
    const url = this.prepareRequest(endpoint, tenantScoped, projectId ? { projectId } : undefined);

    return this.requestWithRetry<T>({
      method: 'POST',
      url,
      data,
      ...axiosOptions,
    });
  }

  async put<T>(
    endpoint: string,
    data?: any,
    options?: AxiosRequestConfig & { tenantScoped?: boolean; projectId?: string }
  ): Promise<T> {
    const { tenantScoped = true, projectId, ...axiosOptions } = options || {};
    const url = this.prepareRequest(endpoint, tenantScoped, projectId ? { projectId } : undefined);

    return this.requestWithRetry<T>({
      method: 'PUT',
      url,
      data,
      ...axiosOptions,
    });
  }

  async patch<T>(
    endpoint: string,
    data?: any,
    options?: AxiosRequestConfig & { tenantScoped?: boolean; projectId?: string }
  ): Promise<T> {
    const { tenantScoped = true, projectId, ...axiosOptions } = options || {};
    const url = this.prepareRequest(endpoint, tenantScoped, projectId ? { projectId } : undefined);

    return this.requestWithRetry<T>({
      method: 'PATCH',
      url,
      data,
      ...axiosOptions,
    });
  }

  async delete<T>(
    endpoint: string,
    options?: AxiosRequestConfig & { tenantScoped?: boolean; projectId?: string }
  ): Promise<T> {
    const { tenantScoped = true, projectId, ...axiosOptions } = options || {};
    const url = this.prepareRequest(endpoint, tenantScoped, projectId ? { projectId } : undefined);

    return this.requestWithRetry<T>({
      method: 'DELETE',
      url,
      ...axiosOptions,
    });
  }

  // WebSocket connection method (for future real-time features)
  connectWebSocket(endpoint: string): WebSocket | null {
    if (typeof window === 'undefined') return null;

    const wsUrl = this.axiosInstance.defaults.baseURL?.replace(/^http/, 'ws') + endpoint;
    const token = this.tokenStorage.getAccessToken();

    const ws = new WebSocket(`${wsUrl}?token=${token}`);

    ws.onopen = () => {
      console.log('WebSocket connected:', endpoint);
    };

    ws.onerror = (error) => {
      console.error('WebSocket error:', error);
    };

    ws.onclose = () => {
      console.log('WebSocket disconnected:', endpoint);
    };

    return ws;
  }
}

// Global API client instance
export const apiClient = new ApiClient();

// Hook to get tenant-scoped API client
export function useTenantApiClient(tenantId?: string): ApiClient {
  if (tenantId) {
    return new ApiClient({ tenantId });
  }
  return apiClient;
}

// Environment configuration utilities
export const getEnvironmentConfig = () => {
  const isDevelopment = process.env.NODE_ENV === 'development';
  const isProduction = process.env.NODE_ENV === 'production';

  return {
    apiUrl: getApiBaseUrl(),
    wsUrl: process.env.NEXT_PUBLIC_WS_URL || getApiBaseUrl().replace(/^http/, 'ws'),
    isDevelopment,
    isProduction,
    timeout: isDevelopment ? 30000 : 10000, // Longer timeout in development
    retryAttempts: isDevelopment ? 1 : 3, // Fewer retries in development
  };
};

// Create configured API client for different environments
export const createApiClient = (config?: Partial<ApiClientConfig>): ApiClient => {
  const envConfig = getEnvironmentConfig();

  return new ApiClient({
    baseUrl: envConfig.apiUrl,
    timeout: envConfig.timeout,
    retryAttempts: envConfig.retryAttempts,
    ...config,
  });
};