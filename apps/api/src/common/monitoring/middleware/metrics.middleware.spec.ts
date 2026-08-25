import { Test, TestingModule } from "@nestjs/testing";
import { NextFunction, Request, Response } from "express";
import { MetricsService } from "../services/metrics.service";
import { MetricsMiddleware } from "./metrics.middleware";
import type { Mock } from "vitest";

describe("MetricsMiddleware", () => {
  let middleware: MetricsMiddleware;
  let mockMetricsService: any;
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let mockNext: NextFunction;

  beforeEach(async () => {
    mockMetricsService = {
      recordHttpRequest: vi.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MetricsMiddleware,
        {
          provide: MetricsService,
          useValue: mockMetricsService,
        },
      ],
    }).compile();

    middleware = module.get<MetricsMiddleware>(MetricsMiddleware);

    mockRequest = {
      method: "GET",
      path: "/api/notifications",
      route: { path: "/api/notifications" },
      headers: {},
      user: undefined,
    };

    mockResponse = {
      statusCode: 200,
      on: vi.fn(),
    };

    mockNext = vi.fn();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("use", () => {
    it("should record HTTP request metrics on response finish", () => {
      const startTime = Date.now();

      // Mock Date.now to control timing
      const mockDateNow = vi.spyOn(Date, "now");
      mockDateNow.mockReturnValueOnce(startTime).mockReturnValueOnce(startTime + 150);

      middleware.use(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockResponse.on).toHaveBeenCalledWith("finish", expect.any(Function));

      // Simulate response finish
      const finishCallback = (mockResponse.on as Mock).mock.calls[0][1];
      finishCallback();

      expect(mockMetricsService.recordHttpRequest).toHaveBeenCalledWith(
        "GET",
        "/api/notifications",
        200,
        150,
        "unknown",
      );

      mockDateNow.mockRestore();
    });

    it("should extract tenant ID from headers", () => {
      mockRequest.headers = { "x-tenant-id": "test-tenant" };
      const startTime = Date.now();

      const mockDateNow = vi.spyOn(Date, "now");
      mockDateNow.mockReturnValueOnce(startTime).mockReturnValueOnce(startTime + 100);

      middleware.use(mockRequest as Request, mockResponse as Response, mockNext);

      // Simulate response finish
      const finishCallback = (mockResponse.on as Mock).mock.calls[0][1];
      finishCallback();

      expect(mockMetricsService.recordHttpRequest).toHaveBeenCalledWith(
        "GET",
        "/api/notifications",
        200,
        100,
        "test-tenant",
      );

      mockDateNow.mockRestore();
    });

    it("should extract tenant ID from user object", () => {
      mockRequest.user = { tenantId: "user-tenant" };
      const startTime = Date.now();

      const mockDateNow = vi.spyOn(Date, "now");
      mockDateNow.mockReturnValueOnce(startTime).mockReturnValueOnce(startTime + 200);

      middleware.use(mockRequest as Request, mockResponse as Response, mockNext);

      // Simulate response finish
      const finishCallback = (mockResponse.on as Mock).mock.calls[0][1];
      finishCallback();

      expect(mockMetricsService.recordHttpRequest).toHaveBeenCalledWith(
        "GET",
        "/api/notifications",
        200,
        200,
        "user-tenant",
      );

      mockDateNow.mockRestore();
    });

    it("should use path when route is not available", () => {
      mockRequest.route = undefined;
      const startTime = Date.now();

      const mockDateNow = vi.spyOn(Date, "now");
      mockDateNow.mockReturnValueOnce(startTime).mockReturnValueOnce(startTime + 75);

      middleware.use(mockRequest as Request, mockResponse as Response, mockNext);

      // Simulate response finish
      const finishCallback = (mockResponse.on as Mock).mock.calls[0][1];
      finishCallback();

      expect(mockMetricsService.recordHttpRequest).toHaveBeenCalledWith(
        "GET",
        "/api/notifications",
        200,
        75,
        "unknown",
      );

      mockDateNow.mockRestore();
    });

    it("should handle different HTTP methods and status codes", () => {
      mockRequest.method = "POST";
      mockResponse.statusCode = 201;
      const startTime = Date.now();

      const mockDateNow = vi.spyOn(Date, "now");
      mockDateNow.mockReturnValueOnce(startTime).mockReturnValueOnce(startTime + 300);

      middleware.use(mockRequest as Request, mockResponse as Response, mockNext);

      // Simulate response finish
      const finishCallback = (mockResponse.on as Mock).mock.calls[0][1];
      finishCallback();

      expect(mockMetricsService.recordHttpRequest).toHaveBeenCalledWith(
        "POST",
        "/api/notifications",
        201,
        300,
        "unknown",
      );

      mockDateNow.mockRestore();
    });
  });
});
