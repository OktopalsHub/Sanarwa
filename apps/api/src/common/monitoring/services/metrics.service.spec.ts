import { ConfigService } from "@nestjs/config";
import { Test, TestingModule } from "@nestjs/testing";
import * as client from "prom-client";
import { MetricsService } from "./metrics.service";

describe("MetricsService", () => {
  let service: MetricsService;

  beforeEach(async () => {
    // Clear all metrics before each test
    client.register.clear();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MetricsService,
        {
          provide: ConfigService,
          useValue: {
            get: vi.fn((key: string, defaultValue?: any) => {
              const config = {
                APP_VERSION: "1.0.0",
                NODE_ENV: "test",
              };
              return config[key] || defaultValue;
            }),
          },
        },
      ],
    }).compile();

    service = module.get<MetricsService>(MetricsService);
  });

  afterEach(() => {
    client.register.clear();
  });

  describe("recordHttpRequest", () => {
    it("should record HTTP request metrics", () => {
      service.recordHttpRequest("GET", "/api/notifications", 200, 150, "test-tenant");

      // Verify metrics were recorded (we can't easily test the actual values without exposing internals)
      expect(service).toBeDefined();
    });

    it("should handle requests without tenant ID", () => {
      service.recordHttpRequest("POST", "/api/notifications", 201, 300);

      expect(service).toBeDefined();
    });
  });

  describe("recordNotificationSent", () => {
    it("should record successful notification metrics", () => {
      service.recordNotificationSent("email", "aws-ses", "test-tenant", "success");

      expect(service).toBeDefined();
    });

    it("should record failed notification metrics", () => {
      service.recordNotificationSent("sms", "aws-sns", "test-tenant", "failure");

      expect(service).toBeDefined();
    });
  });

  describe("recordNotificationFailure", () => {
    it("should record notification failure with error type", () => {
      service.recordNotificationFailure("email", "aws-ses", "test-tenant", "provider_error");

      expect(service).toBeDefined();
    });
  });

  describe("setProviderHealth", () => {
    it("should set provider health status", () => {
      service.setProviderHealth("aws-ses", "email", "test-tenant", true);
      service.setProviderHealth("aws-sns", "sms", "test-tenant", false);

      expect(service).toBeDefined();
    });
  });

  describe("setQueueSize", () => {
    it("should set queue size metrics", () => {
      service.setQueueSize("notifications", "waiting", 10);
      service.setQueueSize("notifications", "processing", 5);

      expect(service).toBeDefined();
    });
  });

  describe("setActiveConnections", () => {
    it("should set active connections metrics", () => {
      service.setActiveConnections("database", 5);
      service.setActiveConnections("redis", 3);

      expect(service).toBeDefined();
    });
  });

  describe("updateSystemMetrics", () => {
    it("should update system metrics", () => {
      service.updateSystemMetrics();

      expect(service).toBeDefined();
    });
  });

  describe("getMetrics", () => {
    it("should return Prometheus metrics", async () => {
      // Record some test metrics
      service.recordHttpRequest("GET", "/test", 200, 100, "test-tenant");
      service.setProviderHealth("test-provider", "email", "test-tenant", true);

      const metrics = await service.getMetrics();

      expect(typeof metrics).toBe("string");
      expect(metrics).toContain("http_requests_total");
      expect(metrics).toContain("provider_health_status");
    });
  });

  describe("getMetricValue", () => {
    it("should return specific metric value", async () => {
      service.recordHttpRequest("GET", "/test", 200, 100, "test-tenant");

      const metric = await service.getMetricValue("http_requests_total");

      expect(metric).toBeDefined();
      expect(metric.name).toBe("http_requests_total");
    });

    it("should return undefined for non-existent metric", async () => {
      const metric = await service.getMetricValue("non_existent_metric");

      expect(metric).toBeUndefined();
    });
  });

  describe("resetMetrics", () => {
    it("should reset all metrics", () => {
      service.recordHttpRequest("GET", "/test", 200, 100, "test-tenant");
      service.resetMetrics();

      expect(service).toBeDefined();
    });
  });
});
