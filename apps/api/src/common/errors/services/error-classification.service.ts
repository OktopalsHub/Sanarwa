import { HttpException, HttpStatus, Injectable } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import { QueryFailedError } from "typeorm";
import { BaseException } from "../exceptions/base.exception";
import {
  ClassifiedError,
  ErrorCategory,
  ErrorCode,
  ErrorContext,
  ErrorSeverity,
} from "../types/error.types";

@Injectable()
export class ErrorClassificationService {
  classifyError(error: any, context: Partial<ErrorContext> = {}): ClassifiedError {
    const fullContext: ErrorContext = {
      correlationId: context.correlationId || randomUUID(),
      tenantId: context.tenantId,
      userId: context.userId,
      requestId: context.requestId,
      method: context.method,
      url: context.url,
      userAgent: context.userAgent,
      ip: context.ip,
      timestamp: new Date(),
      metadata: context.metadata,
    };

    // If it's already a classified error (BaseException)
    if (error instanceof BaseException) {
      return {
        code: error.code,
        category: error.category,
        severity: error.severity,
        message: error.message,
        userMessage: error.userMessage,
        statusCode: error.getStatus(),
        context: { ...fullContext, ...error.context },
        originalError: error,
        retryable: error.retryable,
        recoverable: error.recoverable,
      };
    }

    // Classify known error types
    if (error instanceof HttpException) {
      return this.classifyHttpException(error, fullContext);
    }

    if (error instanceof QueryFailedError) {
      return this.classifyDatabaseError(error, fullContext);
    }

    if (this.isProviderError(error)) {
      return this.classifyProviderError(error, fullContext);
    }

    if (this.isValidationError(error)) {
      return this.classifyValidationError(error, fullContext);
    }

    if (this.isTimeoutError(error)) {
      return this.classifyTimeoutError(error, fullContext);
    }

    if (this.isNetworkError(error)) {
      return this.classifyNetworkError(error, fullContext);
    }

    // Default classification for unknown errors
    return this.classifyUnknownError(error, fullContext);
  }

  private classifyHttpException(error: HttpException, context: ErrorContext): ClassifiedError {
    const status = error.getStatus();
    const message = error.message;

    if (status >= 400 && status < 500) {
      return {
        code: this.getClientErrorCode(status),
        category: this.getClientErrorCategory(status),
        severity: ErrorSeverity.LOW,
        message,
        userMessage: this.getUserFriendlyMessage(status, message),
        statusCode: status,
        context,
        originalError: error,
        retryable: false,
        recoverable: false,
      };
    }

    if (status >= 500) {
      return {
        code: ErrorCode.INTERNAL_SERVER_ERROR,
        category: ErrorCategory.SYSTEM,
        severity: ErrorSeverity.CRITICAL,
        message,
        userMessage: "An internal server error occurred",
        statusCode: status,
        context,
        originalError: error,
        retryable: true,
        recoverable: true,
      };
    }

    return this.classifyUnknownError(error, context);
  }

  private classifyDatabaseError(error: QueryFailedError, context: ErrorContext): ClassifiedError {
    const message = error.message;

    // PostgreSQL specific error codes
    if ((error.driverError as any)?.code) {
      switch ((error.driverError as any).code) {
        case "23505": // unique_violation
          return {
            code: ErrorCode.DUPLICATE_RESOURCE,
            category: ErrorCategory.BUSINESS_LOGIC,
            severity: ErrorSeverity.LOW,
            message: "Duplicate resource",
            userMessage: "A resource with this information already exists",
            statusCode: HttpStatus.CONFLICT,
            context,
            originalError: error,
            retryable: false,
            recoverable: false,
          };
        case "23503": // foreign_key_violation
          return {
            code: ErrorCode.VALIDATION_ERROR,
            category: ErrorCategory.VALIDATION,
            severity: ErrorSeverity.LOW,
            message: "Foreign key constraint violation",
            userMessage: "Referenced resource does not exist",
            statusCode: HttpStatus.BAD_REQUEST,
            context,
            originalError: error,
            retryable: false,
            recoverable: false,
          };
        case "23502": // not_null_violation
          return {
            code: ErrorCode.MISSING_REQUIRED_FIELD,
            category: ErrorCategory.VALIDATION,
            severity: ErrorSeverity.LOW,
            message: "Required field missing",
            userMessage: "Required information is missing",
            statusCode: HttpStatus.BAD_REQUEST,
            context,
            originalError: error,
            retryable: false,
            recoverable: false,
          };
      }
    }

    return {
      code: ErrorCode.DATABASE_ERROR,
      category: ErrorCategory.SYSTEM,
      severity: ErrorSeverity.CRITICAL,
      message: `Database error: ${message}`,
      userMessage: "A database error occurred",
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      context,
      originalError: error,
      retryable: true,
      recoverable: true,
    };
  }

  private classifyProviderError(error: any, context: ErrorContext): ClassifiedError {
    const message = error.message || "Provider error";

    if (this.isProviderTimeoutError(error)) {
      return {
        code: ErrorCode.PROVIDER_TIMEOUT,
        category: ErrorCategory.PROVIDER,
        severity: ErrorSeverity.HIGH,
        message: `Provider timeout: ${message}`,
        userMessage: "External service is taking too long to respond",
        statusCode: HttpStatus.GATEWAY_TIMEOUT,
        context,
        originalError: error,
        retryable: true,
        recoverable: true,
      };
    }

    if (this.isProviderAuthError(error)) {
      return {
        code: ErrorCode.PROVIDER_AUTHENTICATION_FAILED,
        category: ErrorCategory.PROVIDER,
        severity: ErrorSeverity.HIGH,
        message: `Provider authentication failed: ${message}`,
        userMessage: "External service authentication failed",
        statusCode: HttpStatus.BAD_GATEWAY,
        context,
        originalError: error,
        retryable: false,
        recoverable: true,
      };
    }

    if (this.isProviderRateLimitError(error)) {
      return {
        code: ErrorCode.PROVIDER_RATE_LIMITED,
        category: ErrorCategory.PROVIDER,
        severity: ErrorSeverity.MEDIUM,
        message: `Provider rate limited: ${message}`,
        userMessage: "External service rate limit exceeded",
        statusCode: HttpStatus.TOO_MANY_REQUESTS,
        context,
        originalError: error,
        retryable: true,
        recoverable: true,
      };
    }

    return {
      code: ErrorCode.PROVIDER_ERROR,
      category: ErrorCategory.PROVIDER,
      severity: ErrorSeverity.HIGH,
      message: `Provider error: ${message}`,
      userMessage: "External service is temporarily unavailable",
      statusCode: HttpStatus.BAD_GATEWAY,
      context,
      originalError: error,
      retryable: true,
      recoverable: true,
    };
  }

  private classifyValidationError(error: any, context: ErrorContext): ClassifiedError {
    return {
      code: ErrorCode.VALIDATION_ERROR,
      category: ErrorCategory.VALIDATION,
      severity: ErrorSeverity.LOW,
      message: error.message || "Validation failed",
      userMessage: "Invalid data provided",
      statusCode: HttpStatus.BAD_REQUEST,
      context,
      originalError: error,
      retryable: false,
      recoverable: false,
    };
  }

  private classifyTimeoutError(error: any, context: ErrorContext): ClassifiedError {
    return {
      code: ErrorCode.PROVIDER_TIMEOUT,
      category: ErrorCategory.SYSTEM,
      severity: ErrorSeverity.HIGH,
      message: `Timeout error: ${error.message}`,
      userMessage: "Request timed out",
      statusCode: HttpStatus.REQUEST_TIMEOUT,
      context,
      originalError: error,
      retryable: true,
      recoverable: true,
    };
  }

  private classifyNetworkError(error: any, context: ErrorContext): ClassifiedError {
    return {
      code: ErrorCode.PROVIDER_UNAVAILABLE,
      category: ErrorCategory.PROVIDER,
      severity: ErrorSeverity.HIGH,
      message: `Network error: ${error.message}`,
      userMessage: "Network connectivity issue",
      statusCode: HttpStatus.BAD_GATEWAY,
      context,
      originalError: error,
      retryable: true,
      recoverable: true,
    };
  }

  private classifyUnknownError(error: any, context: ErrorContext): ClassifiedError {
    return {
      code: ErrorCode.INTERNAL_SERVER_ERROR,
      category: ErrorCategory.SYSTEM,
      severity: ErrorSeverity.CRITICAL,
      message: error.message || "Unknown error occurred",
      userMessage: "An unexpected error occurred",
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      context,
      originalError: error,
      retryable: true,
      recoverable: true,
    };
  }

  private getClientErrorCode(status: number): ErrorCode {
    switch (status) {
      case HttpStatus.BAD_REQUEST:
        return ErrorCode.INVALID_REQUEST;
      case HttpStatus.UNAUTHORIZED:
        return ErrorCode.UNAUTHORIZED;
      case HttpStatus.FORBIDDEN:
        return ErrorCode.FORBIDDEN;
      case HttpStatus.NOT_FOUND:
        return ErrorCode.NOT_FOUND;
      case HttpStatus.TOO_MANY_REQUESTS:
        return ErrorCode.RATE_LIMIT_EXCEEDED;
      default:
        return ErrorCode.VALIDATION_ERROR;
    }
  }

  private getClientErrorCategory(status: number): ErrorCategory {
    switch (status) {
      case HttpStatus.UNAUTHORIZED:
        return ErrorCategory.AUTHENTICATION;
      case HttpStatus.FORBIDDEN:
        return ErrorCategory.AUTHORIZATION;
      case HttpStatus.NOT_FOUND:
        return ErrorCategory.RESOURCE;
      case HttpStatus.TOO_MANY_REQUESTS:
        return ErrorCategory.BUSINESS_LOGIC;
      default:
        return ErrorCategory.VALIDATION;
    }
  }

  private getUserFriendlyMessage(status: number, originalMessage: string): string {
    switch (status) {
      case HttpStatus.BAD_REQUEST:
        return "Invalid request data";
      case HttpStatus.UNAUTHORIZED:
        return "Authentication required";
      case HttpStatus.FORBIDDEN:
        return "Access denied";
      case HttpStatus.NOT_FOUND:
        return "Resource not found";
      case HttpStatus.TOO_MANY_REQUESTS:
        return "Too many requests, please try again later";
      default:
        return originalMessage;
    }
  }

  private isProviderError(error: any): boolean {
    return (
      error.name?.includes("Provider") ||
      error.message?.includes("provider") ||
      error.code?.startsWith("PROVIDER_") ||
      this.isAxiosError(error) ||
      this.isFetchError(error)
    );
  }

  private isProviderTimeoutError(error: any): boolean {
    return (
      error.code === "ECONNABORTED" ||
      error.code === "ETIMEDOUT" ||
      error.message?.includes("timeout") ||
      error.message?.includes("TIMEOUT")
    );
  }

  private isProviderAuthError(error: any): boolean {
    return (
      error.response?.status === 401 ||
      error.response?.status === 403 ||
      error.message?.includes("authentication") ||
      error.message?.includes("unauthorized")
    );
  }

  private isProviderRateLimitError(error: any): boolean {
    return (
      error.response?.status === 429 ||
      error.message?.includes("rate limit") ||
      error.message?.includes("too many requests")
    );
  }

  private isValidationError(error: any): boolean {
    return (
      error.name === "ValidationError" ||
      error.name === "ValidatorError" ||
      error.message?.includes("validation")
    );
  }

  private isTimeoutError(error: any): boolean {
    return (
      error.code === "ETIMEDOUT" || error.code === "ECONNABORTED" || error.name === "TimeoutError"
    );
  }

  private isNetworkError(error: any): boolean {
    return (
      error.code === "ECONNREFUSED" ||
      error.code === "ENOTFOUND" ||
      error.code === "ECONNRESET" ||
      error.name === "NetworkError"
    );
  }

  private isAxiosError(error: any): boolean {
    return error.isAxiosError === true;
  }

  private isFetchError(error: any): boolean {
    return error.name === "FetchError" || error.type === "system";
  }
}
