import { HttpException, HttpStatus } from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";
import { lastValueFrom, of, throwError } from "rxjs";
import { LoggingService } from "../services/logging.service";
import { ErrorAlertingInterceptor } from "./error-alerting.interceptor";

describe("ErrorAlertingInterceptor", () => {
  let interceptor: ErrorAlertingInterceptor;
  let mockLoggingService: any;
  let mockExecutionContext: any;
  let mockCallHandler: any;

  beforeEach(async () => {
    mockLoggingService = {
      error: vi.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ErrorAlertingInterceptor,
        {
          provide: LoggingService,
          useValue: mockLoggingService,
        },
      ],
    }).compile();

    interceptor = module.get<ErrorAlertingInterceptor>(ErrorAlertingInterceptor);

    mockExecutionContext = {
      getType: () => "http",
      switchToHttp: vi.fn().mockReturnValue({
        getRequest: vi.fn().mockReturnValue({
          method: "GET",
          url: "/api/test",
          headers: { "user-agent": "test-agent", "x-tenant-id": "test-tenant" },
          ip: "127.0.0.1",
          user: { tenantId: "test-tenant" },
        }),
        getResponse: vi.fn().mockReturnValue({}),
      }),
    };

    mockCallHandler = {
      handle: vi.fn(),
    };
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("intercept", () => {
    it("should pass through successful requests without intervention", async () => {
      const testData = { success: true };
      mockCallHandler.handle.mockReturnValue(of(testData));

      const data = await lastValueFrom(
        interceptor.intercept(mockExecutionContext, mockCallHandler),
      );

      expect(data).toEqual(testData);
      expect(mockLoggingService.error).not.toHaveBeenCalled();
    });

    it("should log 5xx errors", async () => {
      const error = new HttpException("Internal Server Error", HttpStatus.INTERNAL_SERVER_ERROR);
      mockCallHandler.handle.mockReturnValue(throwError(() => error));

      await expect(
        lastValueFrom(interceptor.intercept(mockExecutionContext, mockCallHandler)),
      ).rejects.toBe(error);

      expect(mockLoggingService.error).toHaveBeenCalledWith(
        "Request error",
        error,
        expect.objectContaining({
          method: "GET",
          url: "/api/test",
          statusCode: 500,
        }),
      );
    });

    it("should log 4xx errors", async () => {
      const error = new HttpException("Bad Request", HttpStatus.BAD_REQUEST);
      mockCallHandler.handle.mockReturnValue(throwError(() => error));

      await expect(
        lastValueFrom(interceptor.intercept(mockExecutionContext, mockCallHandler)),
      ).rejects.toBe(error);

      expect(mockLoggingService.error).toHaveBeenCalledWith(
        "Request error",
        error,
        expect.objectContaining({
          method: "GET",
          url: "/api/test",
          statusCode: 400,
        }),
      );
    });

    it("should log unknown errors as 5xx", async () => {
      const error = new Error("Unknown error");
      mockCallHandler.handle.mockReturnValue(throwError(() => error));

      await expect(
        lastValueFrom(interceptor.intercept(mockExecutionContext, mockCallHandler)),
      ).rejects.toBe(error);

      expect(mockLoggingService.error).toHaveBeenCalledWith(
        "Request error",
        error,
        expect.objectContaining({
          statusCode: 500,
        }),
      );
    });

    it("should extract tenant ID from headers when user is not available", async () => {
      const error = new HttpException("Internal Server Error", HttpStatus.INTERNAL_SERVER_ERROR);

      mockExecutionContext.switchToHttp().getRequest.mockReturnValue({
        method: "GET",
        url: "/api/test",
        headers: { "user-agent": "test-agent", "x-tenant-id": "header-tenant" },
        ip: "127.0.0.1",
        user: undefined,
      });

      mockCallHandler.handle.mockReturnValue(throwError(() => error));

      await expect(
        lastValueFrom(interceptor.intercept(mockExecutionContext, mockCallHandler)),
      ).rejects.toBe(error);

      expect(mockLoggingService.error).toHaveBeenCalledWith(
        "Request error",
        error,
        expect.objectContaining({
          tenantId: "header-tenant",
        }),
      );
    });
  });
});
