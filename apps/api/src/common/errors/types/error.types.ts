export enum ErrorCode {
  VALIDATION_ERROR = "VALIDATION_ERROR",
  INVALID_REQUEST = "INVALID_REQUEST",
  MISSING_REQUIRED_FIELD = "MISSING_REQUIRED_FIELD",

  UNAUTHORIZED = "UNAUTHORIZED",
  FORBIDDEN = "FORBIDDEN",

  NOT_FOUND = "NOT_FOUND",
  RESOURCE_NOT_FOUND = "RESOURCE_NOT_FOUND",

  QUOTA_EXCEEDED = "QUOTA_EXCEEDED",
  RATE_LIMIT_EXCEEDED = "RATE_LIMIT_EXCEEDED",
  DUPLICATE_RESOURCE = "DUPLICATE_RESOURCE",
  INVALID_OPERATION = "INVALID_OPERATION",

  PROVIDER_ERROR = "PROVIDER_ERROR",
  PROVIDER_UNAVAILABLE = "PROVIDER_UNAVAILABLE",
  PROVIDER_TIMEOUT = "PROVIDER_TIMEOUT",
  PROVIDER_AUTHENTICATION_FAILED = "PROVIDER_AUTHENTICATION_FAILED",
  PROVIDER_RATE_LIMITED = "PROVIDER_RATE_LIMITED",

  INTERNAL_SERVER_ERROR = "INTERNAL_SERVER_ERROR",
  DATABASE_ERROR = "DATABASE_ERROR",
  QUEUE_ERROR = "QUEUE_ERROR",

  CIRCUIT_BREAKER_OPEN = "CIRCUIT_BREAKER_OPEN",
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
