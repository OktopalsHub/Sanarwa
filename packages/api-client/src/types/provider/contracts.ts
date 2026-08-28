import { ProviderHealthStatus, ProviderStatus, ProviderType } from "./enums";
import { Provider, ProviderConfig } from "./configs";
import { ProviderFailoverConfig, ProviderHealthCheck, ProviderMetrics } from "./monitoring";

// Request/Response DTOs
export interface CreateProviderRequest {
  name: string;
  description?: string;
  type: ProviderType;
  subtype: string;
  config: ProviderConfig;
  priority?: number;
  isDefault?: boolean;
  metadata?: Record<string, any>;
}

export interface UpdateProviderRequest {
  name?: string;
  description?: string;
  status?: ProviderStatus;
  config?: Partial<ProviderConfig>;
  priority?: number;
  isDefault?: boolean;
  metadata?: Record<string, any>;
}

export interface TestProviderRequest {
  providerId: string;
  testData: ProviderTestData;
}

export interface ProviderTestData {
  // Email test data
  email?: {
    to: string;
    subject: string;
    body: string;
  };

  // SMS test data
  sms?: {
    to: string;
    message: string;
  };

  // Push test data
  push?: {
    deviceToken: string;
    title: string;
    body: string;
  };

  // WhatsApp test data
  whatsapp?: {
    to: string;
    message: string;
  };

  // Webhook test data
  webhook?: {
    payload: Record<string, any>;
  };
}

export interface ProviderTestResult {
  success: boolean;
  responseTime: number;
  statusCode?: number;
  response?: any;
  errorMessage?: string;
  message?: string;
  metadata?: Record<string, any>;
  testedAt: Date;
}

export interface ProviderQueryParams {
  type?: ProviderType;
  status?: ProviderStatus;
  healthStatus?: ProviderHealthStatus;
  isDefault?: boolean;
  search?: string;
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: "ASC" | "DESC";
}

// State management
export interface ProviderState {
  providers: Provider[];
  failoverConfigs: ProviderFailoverConfig[];
  healthChecks: ProviderHealthCheck[];
  metrics: ProviderMetrics[];
  isLoading: boolean;
  error: string | null;
}

// API response wrappers
export interface ProviderApiResponse<T = any> {
  data: T;
  success: boolean;
  message?: string;
  errors?: ValidationError[];
}

export interface ValidationError {
  field: string;
  message: string;
  code: string;
}

// Events
export interface ProviderCreatedEvent {
  providerId: string;
  tenantId: string;
  type: ProviderType;
  name: string;
  timestamp: Date;
}

export interface ProviderStatusChangedEvent {
  providerId: string;
  tenantId: string;
  oldStatus: ProviderStatus;
  newStatus: ProviderStatus;
  timestamp: Date;
}

export interface ProviderHealthChangedEvent {
  providerId: string;
  tenantId: string;
  oldHealth: ProviderHealthStatus;
  newHealth: ProviderHealthStatus;
  errorMessage?: string;
  timestamp: Date;
}

export interface ProviderFailoverEvent {
  tenantId: string;
  channel: ProviderType;
  failedProviderId: string;
  fallbackProviderId: string;
  reason: string;
  timestamp: Date;
}
