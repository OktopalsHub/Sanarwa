import { HttpStatus } from '@nestjs/common';
import {
  ErrorCategory,
  ErrorCode,
  ErrorContext,
  ErrorSeverity,
} from '../types/error.types';
import {
  AuthenticationException,
  AuthorizationException,
  BaseException,
  BusinessLogicException,
  CircuitBreakerException,
  ProviderException,
  ResourceNotFoundException,
  SystemException,
  ValidationException,
} from './base.exception';

describe('BaseException', () => {
  const mockContext: ErrorContext = {
    correlationId: 'test-correlation-id',
    tenantId: 'test-tenant',
    userId: 'test-user',
    timestamp: new Date(),
  };

  describe('BaseException', () => {
    class TestException extends BaseException {
      constructor() {
        super(
          ErrorCode.VALIDATION_ERROR,
          ErrorCategory.VALIDATION,
          ErrorSeverity.LOW,
          'Test message',
          'User friendly message',
          HttpStatus.BAD_REQUEST,
          mockContext,
          false,
          false,
        );
      }
    }

    it('should create exception with all properties', () => {
      const exception = new TestException();

      expect(exception.code).toBe(ErrorCode.VALIDATION_ERROR);
      expect(exception.category).toBe(ErrorCategory.VALIDATION);
      expect(exception.severity).toBe(ErrorSeverity.LOW);
      expect(exception.message).toBe('Test message');
      expect(exception.userMessage).toBe('User friendly message');
      expect(exception.getStatus()).toBe(HttpStatus.BAD_REQUEST);
      expect(exception.context).toBe(mockContext);
      expect(exception.retryable).toBe(false);
      expect(exception.recoverable).toBe(false);
    });

    it('should serialize to JSON correctly', () => {
      const exception = new TestException();
      const json = exception.toJSON();

      expect(json).toEqual({
        code: ErrorCode.VALIDATION_ERROR,
        category: ErrorCategory.VALIDATION,
        severity: ErrorSeverity.LOW,
        message: 'Test message',
        userMessage: 'User friendly message',
        statusCode: HttpStatus.BAD_REQUEST,
        context: mockContext,
        retryable: false,
        recoverable: false,
      });
    });
  });

  describe('ValidationException', () => {
    it('should create validation exception with correct properties', () => {
      const exception = new ValidationException('Invalid data', mockContext);

      expect(exception.code).toBe(ErrorCode.VALIDATION_ERROR);
      expect(exception.category).toBe(ErrorCategory.VALIDATION);
      expect(exception.severity).toBe(ErrorSeverity.LOW);
      expect(exception.message).toBe('Invalid data');
      expect(exception.userMessage).toBe('Invalid request data provided');
      expect(exception.getStatus()).toBe(HttpStatus.BAD_REQUEST);
      expect(exception.retryable).toBe(false);
      expect(exception.recoverable).toBe(false);
    });

    it('should use custom user message when provided', () => {
      const exception = new ValidationException(
        'Invalid data',
        mockContext,
        'Custom user message',
      );

      expect(exception.userMessage).toBe('Custom user message');
    });
  });

  describe('AuthenticationException', () => {
    it('should create authentication exception with correct properties', () => {
      const exception = new AuthenticationException(
        'Invalid token',
        mockContext,
      );

      expect(exception.code).toBe(ErrorCode.UNAUTHORIZED);
      expect(exception.category).toBe(ErrorCategory.AUTHENTICATION);
      expect(exception.severity).toBe(ErrorSeverity.MEDIUM);
      expect(exception.message).toBe('Invalid token');
      expect(exception.userMessage).toBe('Authentication required');
      expect(exception.getStatus()).toBe(HttpStatus.UNAUTHORIZED);
      expect(exception.retryable).toBe(false);
      expect(exception.recoverable).toBe(false);
    });
  });

  describe('AuthorizationException', () => {
    it('should create authorization exception with correct properties', () => {
      const exception = new AuthorizationException(
        'Insufficient permissions',
        mockContext,
      );

      expect(exception.code).toBe(ErrorCode.FORBIDDEN);
      expect(exception.category).toBe(ErrorCategory.AUTHORIZATION);
      expect(exception.severity).toBe(ErrorSeverity.MEDIUM);
      expect(exception.message).toBe('Insufficient permissions');
      expect(exception.userMessage).toBe('Access denied');
      expect(exception.getStatus()).toBe(HttpStatus.FORBIDDEN);
      expect(exception.retryable).toBe(false);
      expect(exception.recoverable).toBe(false);
    });
  });

  describe('ResourceNotFoundException', () => {
    it('should create resource not found exception with correct properties', () => {
      const exception = new ResourceNotFoundException('User', mockContext);

      expect(exception.code).toBe(ErrorCode.RESOURCE_NOT_FOUND);
      expect(exception.category).toBe(ErrorCategory.RESOURCE);
      expect(exception.severity).toBe(ErrorSeverity.LOW);
      expect(exception.message).toBe('User not found');
      expect(exception.userMessage).toBe('The requested user was not found');
      expect(exception.getStatus()).toBe(HttpStatus.NOT_FOUND);
      expect(exception.retryable).toBe(false);
      expect(exception.recoverable).toBe(false);
    });

    it('should use custom user message when provided', () => {
      const exception = new ResourceNotFoundException(
        'Template',
        mockContext,
        'Template does not exist',
      );

      expect(exception.userMessage).toBe('Template does not exist');
    });
  });

  describe('BusinessLogicException', () => {
    it('should create business logic exception with correct properties', () => {
      const exception = new BusinessLogicException(
        ErrorCode.QUOTA_EXCEEDED,
        'Monthly quota exceeded',
        mockContext,
      );

      expect(exception.code).toBe(ErrorCode.QUOTA_EXCEEDED);
      expect(exception.category).toBe(ErrorCategory.BUSINESS_LOGIC);
      expect(exception.severity).toBe(ErrorSeverity.MEDIUM);
      expect(exception.message).toBe('Monthly quota exceeded');
      expect(exception.userMessage).toBe('Business rule violation');
      expect(exception.getStatus()).toBe(HttpStatus.BAD_REQUEST);
      expect(exception.retryable).toBe(false);
      expect(exception.recoverable).toBe(false);
    });

    it('should support retryable business logic exceptions', () => {
      const exception = new BusinessLogicException(
        ErrorCode.RATE_LIMIT_EXCEEDED,
        'Rate limit exceeded',
        mockContext,
        'Too many requests',
        true,
      );

      expect(exception.retryable).toBe(true);
      expect(exception.userMessage).toBe('Too many requests');
    });
  });

  describe('ProviderException', () => {
    it('should create provider exception with correct properties', () => {
      const exception = new ProviderException(
        ErrorCode.PROVIDER_ERROR,
        'AWS SES failed',
        mockContext,
      );

      expect(exception.code).toBe(ErrorCode.PROVIDER_ERROR);
      expect(exception.category).toBe(ErrorCategory.PROVIDER);
      expect(exception.severity).toBe(ErrorSeverity.HIGH);
      expect(exception.message).toBe('AWS SES failed');
      expect(exception.userMessage).toBe(
        'External service temporarily unavailable',
      );
      expect(exception.getStatus()).toBe(HttpStatus.SERVICE_UNAVAILABLE);
      expect(exception.retryable).toBe(true);
      expect(exception.recoverable).toBe(true);
    });

    it('should support non-retryable provider exceptions', () => {
      const exception = new ProviderException(
        ErrorCode.PROVIDER_AUTHENTICATION_FAILED,
        'Invalid API key',
        mockContext,
        'Authentication failed',
        false,
      );

      expect(exception.retryable).toBe(false);
      expect(exception.userMessage).toBe('Authentication failed');
    });
  });

  describe('SystemException', () => {
    it('should create system exception with correct properties', () => {
      const exception = new SystemException(
        ErrorCode.DATABASE_ERROR,
        'Connection timeout',
        mockContext,
      );

      expect(exception.code).toBe(ErrorCode.DATABASE_ERROR);
      expect(exception.category).toBe(ErrorCategory.SYSTEM);
      expect(exception.severity).toBe(ErrorSeverity.CRITICAL);
      expect(exception.message).toBe('Connection timeout');
      expect(exception.userMessage).toBe('Internal system error occurred');
      expect(exception.getStatus()).toBe(HttpStatus.INTERNAL_SERVER_ERROR);
      expect(exception.retryable).toBe(false);
      expect(exception.recoverable).toBe(true);
    });

    it('should support retryable system exceptions', () => {
      const exception = new SystemException(
        ErrorCode.QUEUE_ERROR,
        'Queue is full',
        mockContext,
        'System temporarily overloaded',
        true,
      );

      expect(exception.retryable).toBe(true);
      expect(exception.userMessage).toBe('System temporarily overloaded');
    });
  });

  describe('CircuitBreakerException', () => {
    it('should create circuit breaker exception with correct properties', () => {
      const exception = new CircuitBreakerException(
        'email-service',
        mockContext,
      );

      expect(exception.code).toBe(ErrorCode.CIRCUIT_BREAKER_OPEN);
      expect(exception.category).toBe(ErrorCategory.CIRCUIT_BREAKER);
      expect(exception.severity).toBe(ErrorSeverity.HIGH);
      expect(exception.message).toBe(
        'Circuit breaker is open for service: email-service',
      );
      expect(exception.userMessage).toBe(
        'Service is temporarily unavailable due to high failure rate',
      );
      expect(exception.getStatus()).toBe(HttpStatus.SERVICE_UNAVAILABLE);
      expect(exception.retryable).toBe(true);
      expect(exception.recoverable).toBe(true);
    });
  });
});
