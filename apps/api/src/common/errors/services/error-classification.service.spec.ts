import { HttpException, HttpStatus } from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";
import { QueryFailedError } from "typeorm";
import { ValidationException } from "../exceptions/base.exception";
import { ErrorCategory, ErrorCode, ErrorContext, ErrorSeverity } from "../types/error.types";
import { ErrorClassificationService } from "./error-classification.service";

describe("ErrorClassificationService", () => {
  let service: ErrorClassificationService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [ErrorClassificationService],
    }).compile();

    service = module.get<ErrorClassificationService>(ErrorClassificationService);
  });

  describe("classifyError", () => {
    const mockContext: Partial<ErrorContext> = {
      tenantId: "test-tenant",
      userId: "test-user",
      method: "POST",
      url: "/api/test",
    };

    it("should classify BaseException correctly", () => {
      const error = new ValidationException("Test validation error", mockContext as ErrorContext);
      const classified = service.classifyError(error, mockContext);

      expect(classified.code).toBe(ErrorCode.VALIDATION_ERROR);
      expect(classified.category).toBe(ErrorCategory.VALIDATION);
      expect(classified.severity).toBe(ErrorSeverity.LOW);
      expect(classified.statusCode).toBe(HttpStatus.BAD_REQUEST);
      expect(classified.retryable).toBe(false);
    });

    it("should classify HttpException correctly", () => {
      const error = new HttpException("Not found", HttpStatus.NOT_FOUND);
      const classified = service.classifyError(error, mockContext);

      expect(classified.code).toBe(ErrorCode.NOT_FOUND);
      expect(classified.category).toBe(ErrorCategory.RESOURCE);
      expect(classified.severity).toBe(ErrorSeverity.LOW);
      expect(classified.statusCode).toBe(HttpStatus.NOT_FOUND);
    });

    it("should classify database unique violation error", () => {
      const dbError = new QueryFailedError("SELECT * FROM users", [], new Error());
      (dbError as any).driverError = { code: "23505" };

      const classified = service.classifyError(dbError, mockContext);

      expect(classified.code).toBe(ErrorCode.DUPLICATE_RESOURCE);
      expect(classified.category).toBe(ErrorCategory.BUSINESS_LOGIC);
      expect(classified.statusCode).toBe(HttpStatus.CONFLICT);
    });

    it("should classify provider timeout error", () => {
      const error = new Error("Request timeout");
      error.name = "TimeoutError";
      (error as any).code = "ETIMEDOUT";

      const classified = service.classifyError(error, mockContext);

      expect(classified.code).toBe(ErrorCode.PROVIDER_TIMEOUT);
      expect(classified.category).toBe(ErrorCategory.SYSTEM);
      expect(classified.retryable).toBe(true);
    });

    it("should classify provider authentication error", () => {
      const error = new Error("Authentication failed");
      (error as any).response = { status: 401 };
      (error as any).isAxiosError = true;

      const classified = service.classifyError(error, mockContext);

      expect(classified.code).toBe(ErrorCode.PROVIDER_AUTHENTICATION_FAILED);
      expect(classified.category).toBe(ErrorCategory.PROVIDER);
      expect(classified.retryable).toBe(false);
      expect(classified.recoverable).toBe(true);
    });

    it("should classify provider rate limit error", () => {
      const error = new Error("Too many requests");
      (error as any).response = { status: 429 };
      (error as any).isAxiosError = true;

      const classified = service.classifyError(error, mockContext);

      expect(classified.code).toBe(ErrorCode.PROVIDER_RATE_LIMITED);
      expect(classified.category).toBe(ErrorCategory.PROVIDER);
      expect(classified.statusCode).toBe(HttpStatus.TOO_MANY_REQUESTS);
      expect(classified.retryable).toBe(true);
    });

    it("should classify unknown error as internal server error", () => {
      const error = new Error("Unknown error");
      const classified = service.classifyError(error, mockContext);

      expect(classified.code).toBe(ErrorCode.INTERNAL_SERVER_ERROR);
      expect(classified.category).toBe(ErrorCategory.SYSTEM);
      expect(classified.severity).toBe(ErrorSeverity.CRITICAL);
      expect(classified.statusCode).toBe(HttpStatus.INTERNAL_SERVER_ERROR);
      expect(classified.retryable).toBe(true);
    });

    it("should generate correlation ID if not provided", () => {
      const error = new Error("Test error");
      const classified = service.classifyError(error, {});

      expect(classified.context.correlationId).toBeDefined();
      expect(classified.context.correlationId).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
      );
    });

    it("should preserve existing context data", () => {
      const error = new Error("Test error");
      const classified = service.classifyError(error, mockContext);

      expect(classified.context.tenantId).toBe(mockContext.tenantId);
      expect(classified.context.userId).toBe(mockContext.userId);
      expect(classified.context.method).toBe(mockContext.method);
      expect(classified.context.url).toBe(mockContext.url);
    });
  });
});
