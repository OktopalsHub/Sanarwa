import { ConfigService } from "@nestjs/config";
import { Test, TestingModule } from "@nestjs/testing";
import { LoggingService } from "./logging.service";

describe("LoggingService", () => {
  let service: LoggingService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LoggingService,
        {
          provide: ConfigService,
          useValue: {
            get: vi.fn((key: string, defaultValue?: any) => {
              const config = {
                LOG_LEVEL: "info",
                LOG_DIR: "logs",
                NODE_ENV: "test",
              };
              return config[key] || defaultValue;
            }),
          },
        },
      ],
    }).compile();

    service = module.get<LoggingService>(LoggingService);
  });

  describe("info", () => {
    it("should log info messages", () => {
      // Just verify the service method exists and can be called
      expect(() => {
        service.info("Test info message", { tenantId: "test-tenant" });
      }).not.toThrow();
    });
  });

  describe("warn", () => {
    it("should log warning messages", () => {
      expect(() => {
        service.warn("Test warning message", { tenantId: "test-tenant" });
      }).not.toThrow();
    });
  });

  describe("error", () => {
    it("should log error messages with error object", () => {
      const error = new Error("Test error");

      expect(() => {
        service.error("Test error message", error, { tenantId: "test-tenant" });
      }).not.toThrow();
    });

    it("should log error messages without error object", () => {
      expect(() => {
        service.error("Test error message", undefined, {
          tenantId: "test-tenant",
        });
      }).not.toThrow();
    });
  });

  describe("debug", () => {
    it("should log debug messages", () => {
      expect(() => {
        service.debug("Test debug message", { tenantId: "test-tenant" });
      }).not.toThrow();
    });
  });

  describe("audit", () => {
    it("should log audit events", () => {
      expect(() => {
        service.audit("User login", {
          tenantId: "test-tenant",
          userId: "test-user",
          action: "login",
        });
      }).not.toThrow();
    });
  });

  describe("logNotificationSent", () => {
    it("should log notification sent events", () => {
      expect(() => {
        service.logNotificationSent("notification-123", "email", {
          tenantId: "test-tenant",
        });
      }).not.toThrow();
    });
  });

  describe("logProviderFailure", () => {
    it("should log provider failure events", () => {
      const error = new Error("Provider failed");

      expect(() => {
        service.logProviderFailure("aws-ses", error, {
          tenantId: "test-tenant",
        });
      }).not.toThrow();
    });
  });

  describe("logSecurityEvent", () => {
    it("should log security events", () => {
      expect(() => {
        service.logSecurityEvent("Suspicious login attempt", "high", {
          tenantId: "test-tenant",
          ip: "192.168.1.1",
        });
      }).not.toThrow();
    });
  });

  describe("logPerformanceMetric", () => {
    it("should log performance metrics", () => {
      expect(() => {
        service.logPerformanceMetric("response_time", 150, "ms", {
          tenantId: "test-tenant",
          endpoint: "/api/notifications",
        });
      }).not.toThrow();
    });
  });
});
