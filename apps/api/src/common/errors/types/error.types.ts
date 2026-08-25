export enum ErrorCode {
  // Validation Errors (4xx)
  VALIDATION_ERROR = "VALIDATION_ERROR",
  INVALID_REQUEST = "INVALID_REQUEST",
  MISSING_REQUIRED_FIELD = "MISSING_REQUIRED_FIELD",
  INVALID_FORMAT = "INVALID_FORMAT",

  // Authentication/Authorization Errors (4xx)
  UNAUTHORIZED = "UNAUTHORIZED",
  FORBIDDEN = "FORBIDDEN",
  INVALID_TOKEN = "INVALID_TOKEN",
  TOKEN_EXPIRED = "TOKEN_EXPIRED",

  // Resource Errors (4xx)
  NOT_FOUND = "NOT_FOUND",
  RESOURCE_NOT_FOUND = "RESOURCE_NOT_FOUND",
  TENANT_NOT_FOUND = "TENANT_NOT_FOUND",
  TEMPLATE_NOT_FOUND = "TEMPLATE_NOT_FOUND",

  // Business Logic Errors (4xx)
  QUOTA_EXCEEDED = "QUOTA_EXCEEDED",
  RATE_LIMIT_EXCEEDED = "RATE_LIMIT_EXCEEDED",
  DUPLICATE_RESOURCE = "DUPLICATE_RESOURCE",
  INVALID_OPERATION = "INVALID_OPERATION",

  // Provider Errors (5xx)
  PROVIDER_ERROR = "PROVIDER_ERROR",
  PROVIDER_UNAVAILABLE = "PROVIDER_UNAVAILABLE",
  PROVIDER_TIMEOUT = "PROVIDER_TIMEOUT",
  PROVIDER_AUTHENTICATION_FAILED = "PROVIDER_AUTHENTICATION_FAILED",
  PROVIDER_RATE_LIMITED = "PROVIDER_RATE_LIMITED",
  ALL_PROVIDERS_FAILED = "ALL_PROVIDERS_FAILED",

  // System Errors (5xx)
  INTERNAL_SERVER_ERROR = "INTERNAL_SERVER_ERROR",
  DATABASE_ERROR = "DATABASE_ERROR",
  QUEUE_ERROR = "QUEUE_ERROR",
  CACHE_ERROR = "CACHE_ERROR",
  CONFIGURATION_ERROR = "CONFIGURATION_ERROR",

  // Circuit Breaker Errors (5xx)
  CIRCUIT_BREAKER_OPEN = "CIRCUIT_BREAKER_OPEN",
  SERVICE_DEGRADED = "SERVICE_DEGRADED",
}

export enum ErrorSeverity {
  LOW = "low",
  MEDIUM = "medium",
  HIGH = "high",
  CRITICAL = "critical",
}

export enum ErrorCategory {
  VALIDATION = "validation",
  AUTHENTICATION = "authentication",
  AUTHORIZATION = "authorization",
  RESOURCE = "resource",
  BUSINESS_LOGIC = "business_logic",
  PROVIDER = "provider",
  SYSTEM = "system",
  CIRCUIT_BREAKER = "circuit_breaker",
}

export interface ErrorContext {
  correlationId: string;
  tenantId?: string;
  userId?: string;
  requestId?: string;
  method?: string;
  url?: string;
  userAgent?: string;
  ip?: string;
  timestamp: Date;
  metadata?: Record<string, any>;
}

export interface ClassifiedError {
  code: ErrorCode;
  category: ErrorCategory;
  severity: ErrorSeverity;
  message: string;
  userMessage: string;
  statusCode: number;
  context: ErrorContext;
  originalError?: Error;
  retryable: boolean;
  recoverable: boolean;
}

export interface CircuitBreakerState {
  state: "CLOSED" | "OPEN" | "HALF_OPEN";
  failureCount: number;
  lastFailureTime?: Date;
  nextAttemptTime?: Date;
  successCount?: number;
}

export interface RecoveryStrategy {
  type: "retry" | "fallback" | "circuit_breaker" | "graceful_degradation";
  maxAttempts?: number;
  backoffMultiplier?: number;
  initialDelay?: number;
  maxDelay?: number;
  fallbackValue?: any;
  condition?: (error: ClassifiedError) => boolean;
}
