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
