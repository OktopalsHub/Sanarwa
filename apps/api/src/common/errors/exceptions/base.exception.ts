import { HttpException, HttpStatus } from "@nestjs/common";
import { ErrorCategory, ErrorCode, ErrorContext, ErrorSeverity } from "../types/error.types";

export abstract class BaseException extends HttpException {
  public readonly code: ErrorCode;
  public readonly category: ErrorCategory;
  public readonly severity: ErrorSeverity;
  public readonly context: ErrorContext;
  public readonly userMessage: string;
  public readonly retryable: boolean;
  public readonly recoverable: boolean;

  constructor(
    code: ErrorCode,
    category: ErrorCategory,
    severity: ErrorSeverity,
    message: string,
    userMessage: string,
    statusCode: HttpStatus,
    context: ErrorContext,
    retryable: boolean = false,
    recoverable: boolean = false,
  ) {
    super(message, statusCode);
    this.code = code;
    this.category = category;
    this.severity = severity;
    this.context = context;
    this.userMessage = userMessage;
    this.retryable = retryable;
    this.recoverable = recoverable;
  }

  toJSON() {
    return {
      code: this.code,
      category: this.category,
      severity: this.severity,
      message: this.message,
      userMessage: this.userMessage,
      statusCode: this.getStatus(),
      context: this.context,
      retryable: this.retryable,
      recoverable: this.recoverable,
    };
  }
}

export class ValidationException extends BaseException {
  constructor(message: string, context: ErrorContext, userMessage?: string) {
    super(
      ErrorCode.VALIDATION_ERROR,
      ErrorCategory.VALIDATION,
      ErrorSeverity.LOW,
      message,
      userMessage || "Invalid request data provided",
      HttpStatus.BAD_REQUEST,
      context,
      false,
      false,
    );
  }
}

export class AuthenticationException extends BaseException {
  constructor(message: string, context: ErrorContext, userMessage?: string) {
    super(
      ErrorCode.UNAUTHORIZED,
      ErrorCategory.AUTHENTICATION,
      ErrorSeverity.MEDIUM,
      message,
      userMessage || "Authentication required",
      HttpStatus.UNAUTHORIZED,
      context,
      false,
      false,
    );
  }
}

export class AuthorizationException extends BaseException {
  constructor(message: string, context: ErrorContext, userMessage?: string) {
    super(
      ErrorCode.FORBIDDEN,
      ErrorCategory.AUTHORIZATION,
      ErrorSeverity.MEDIUM,
      message,
      userMessage || "Access denied",
      HttpStatus.FORBIDDEN,
      context,
      false,
      false,
    );
  }
}

export class ResourceNotFoundException extends BaseException {
  constructor(resource: string, context: ErrorContext, userMessage?: string) {
    super(
      ErrorCode.RESOURCE_NOT_FOUND,
      ErrorCategory.RESOURCE,
      ErrorSeverity.LOW,
      `${resource} not found`,
      userMessage || `The requested ${resource.toLowerCase()} was not found`,
      HttpStatus.NOT_FOUND,
      context,
      false,
      false,
    );
  }
}

export class BusinessLogicException extends BaseException {
  constructor(
    code: ErrorCode,
    message: string,
    context: ErrorContext,
    userMessage?: string,
    retryable: boolean = false,
  ) {
    super(
      code,
      ErrorCategory.BUSINESS_LOGIC,
      ErrorSeverity.MEDIUM,
      message,
      userMessage || "Business rule violation",
      HttpStatus.BAD_REQUEST,
      context,
      retryable,
      false,
    );
  }
}

export class ProviderException extends BaseException {
  constructor(
    code: ErrorCode,
    message: string,
    context: ErrorContext,
    userMessage?: string,
    retryable: boolean = true,
  ) {
    super(
      code,
      ErrorCategory.PROVIDER,
      ErrorSeverity.HIGH,
      message,
      userMessage || "External service temporarily unavailable",
      HttpStatus.SERVICE_UNAVAILABLE,
      context,
      retryable,
      true,
    );
  }
}

export class SystemException extends BaseException {
  constructor(
    code: ErrorCode,
    message: string,
    context: ErrorContext,
    userMessage?: string,
    retryable: boolean = false,
  ) {
    super(
      code,
      ErrorCategory.SYSTEM,
      ErrorSeverity.CRITICAL,
      message,
      userMessage || "Internal system error occurred",
      HttpStatus.INTERNAL_SERVER_ERROR,
      context,
      retryable,
      true,
    );
  }
}

export class CircuitBreakerException extends BaseException {
  constructor(service: string, context: ErrorContext) {
    super(
      ErrorCode.CIRCUIT_BREAKER_OPEN,
      ErrorCategory.CIRCUIT_BREAKER,
      ErrorSeverity.HIGH,
      `Circuit breaker is open for service: ${service}`,
      "Service is temporarily unavailable due to high failure rate",
      HttpStatus.SERVICE_UNAVAILABLE,
      context,
      true,
      true,
    );
  }
}
