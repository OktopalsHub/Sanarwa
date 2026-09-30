import { Test, TestingModule } from "@nestjs/testing";
import { Channel } from "../../providers/types";
import { ProviderPerformanceTracker } from "./provider-performance-tracker";
import type { Mock } from "vitest";

describe("ProviderPerformanceTracker", () => {
  let tracker: ProviderPerformanceTracker;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [ProviderPerformanceTracker],
    }).compile();

    tracker = module.get<ProviderPerformanceTracker>(ProviderPerformanceTracker);
  });

  afterEach(() => {
    // Clear all data after each test
    (tracker as any).performanceData.clear();
    (tracker as any).metricsCache.clear();
  });

  describe("recordSuccess", () => {
    it("should record successful operation", async () => {
      await tracker.recordSuccess("aws_ses", Channel.EMAIL, 150, {
        test: "metadata",
      });

      const metrics = await tracker.getMetrics("aws_ses", Channel.EMAIL);

      expect(metrics.providerId).toBe("aws_ses");
      expect(metrics.channel).toBe(Channel.EMAIL);
      expect(metrics.totalRequests).toBe(1);
      expect(metrics.successfulRequests).toBe(1);
      expect(metrics.failedRequests).toBe(0);
      expect(metrics.successRate).toBe(100);
      expect(metrics.averageResponseTime).toBe(150);
      expect(metrics.errorRate).toBe(0);
    });

    it("should accumulate multiple successful operations", async () => {
      await tracker.recordSuccess("aws_ses", Channel.EMAIL, 100);
      await tracker.recordSuccess("aws_ses", Channel.EMAIL, 200);
      await tracker.recordSuccess("aws_ses", Channel.EMAIL, 150);

      const metrics = await tracker.getMetrics("aws_ses", Channel.EMAIL);

      expect(metrics.totalRequests).toBe(3);
      expect(metrics.successfulRequests).toBe(3);
      expect(metrics.successRate).toBe(100);
      expect(metrics.averageResponseTime).toBe(150); // (100 + 200 + 150) / 3
    });
  });

  describe("recordFailure", () => {
    it("should record failed operation", async () => {
      await tracker.recordFailure("aws_ses", Channel.EMAIL, "Connection timeout");

      const metrics = await tracker.getMetrics("aws_ses", Channel.EMAIL);

      expect(metrics.totalRequests).toBe(1);
      expect(metrics.successfulRequests).toBe(0);
      expect(metrics.failedRequests).toBe(1);
      expect(metrics.successRate).toBe(0);
      expect(metrics.errorRate).toBe(100);
      expect(metrics.averageResponseTime).toBe(0);
    });

    it("should calculate correct success rate with mixed results", async () => {
      await tracker.recordSuccess("aws_ses", Channel.EMAIL, 100);
      await tracker.recordSuccess("aws_ses", Channel.EMAIL, 150);
      await tracker.recordFailure("aws_ses", Channel.EMAIL, "Error 1");
      await tracker.recordFailure("aws_ses", Channel.EMAIL, "Error 2");
      await tracker.recordSuccess("aws_ses", Channel.EMAIL, 200);

      const metrics = await tracker.getMetrics("aws_ses", Channel.EMAIL);

      expect(metrics.totalRequests).toBe(5);
      expect(metrics.successfulRequests).toBe(3);
      expect(metrics.failedRequests).toBe(2);
      expect(metrics.successRate).toBe(60); // 3/5 * 100
      expect(metrics.errorRate).toBe(40); // 2/5 * 100
      expect(metrics.averageResponseTime).toBe(150); // (100 + 150 + 200) / 3
    });
  });

  describe("getMetrics", () => {
    it("should return empty metrics for unknown provider", async () => {
      const metrics = await tracker.getMetrics("unknown", Channel.EMAIL);

      expect(metrics.providerId).toBe("unknown");
      expect(metrics.channel).toBe(Channel.EMAIL);
      expect(metrics.totalRequests).toBe(0);
      expect(metrics.successfulRequests).toBe(0);
      expect(metrics.failedRequests).toBe(0);
      expect(metrics.successRate).toBe(0);
      expect(metrics.averageResponseTime).toBe(0);
    });

    it("should cache metrics for performance", async () => {
      await tracker.recordSuccess("aws_ses", Channel.EMAIL, 100);

      // First call should calculate metrics
      const metrics1 = await tracker.getMetrics("aws_ses", Channel.EMAIL);

      // Second call should use cached metrics
      const metrics2 = await tracker.getMetrics("aws_ses", Channel.EMAIL);

      expect(metrics1).toEqual(metrics2);
    });

    it("should invalidate cache after new records", async () => {
      await tracker.recordSuccess("aws_ses", Channel.EMAIL, 100);
      const metrics1 = await tracker.getMetrics("aws_ses", Channel.EMAIL);

      await tracker.recordSuccess("aws_ses", Channel.EMAIL, 200);
      const metrics2 = await tracker.getMetrics("aws_ses", Channel.EMAIL);

      expect(metrics1.totalRequests).toBe(1);
      expect(metrics2.totalRequests).toBe(2);
      expect(metrics2.averageResponseTime).toBe(150);
    });
  });

  describe("getAnalytics", () => {
    beforeEach(async () => {
      // Set up test data
      const now = new Date();
      const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
      const twoHoursAgo = new Date(now.getTime() - 2 * 60 * 60 * 1000);

      // Mock timestamps for consistent testing
      vi.spyOn(Date, "now")
        .mockReturnValueOnce(twoHoursAgo.getTime())
        .mockReturnValueOnce(twoHoursAgo.getTime())
        .mockReturnValueOnce(oneHourAgo.getTime())
        .mockReturnValueOnce(oneHourAgo.getTime())
        .mockReturnValueOnce(now.getTime());

      await tracker.recordSuccess("aws_ses", Channel.EMAIL, 100);
      await tracker.recordFailure("aws_ses", Channel.EMAIL, "Error");
      await tracker.recordSuccess("aws_ses", Channel.EMAIL, 200);
      await tracker.recordSuccess("aws_ses", Channel.EMAIL, 150);
      await tracker.recordFailure("aws_ses", Channel.EMAIL, "Another error");
    });

    afterEach(() => {
      vi.restoreAllMocks();
    });

    it("should return analytics for time range", async () => {
      const startDate = new Date(Date.now() - 3 * 60 * 60 * 1000);
      const endDate = new Date();

      const analytics = await tracker.getAnalytics("aws_ses", Channel.EMAIL, startDate, endDate);

      expect(analytics.providerId).toBe("aws_ses");
      expect(analytics.channel).toBe(Channel.EMAIL);
      expect(analytics.metrics.totalRequests).toBe(5);
      expect(analytics.metrics.successfulRequests).toBe(3);
      expect(analytics.metrics.failedRequests).toBe(2);
      expect(analytics.metrics.successRate).toBe(60);
      expect(analytics.metrics.errorRate).toBe(40);
      expect(analytics.metrics.averageResponseTime).toBe(150);
    });

    it("should calculate percentiles correctly", async () => {
      // Add more data points for percentile calculation
      for (let i = 1; i <= 100; i++) {
        await tracker.recordSuccess("test_provider", Channel.EMAIL, i * 10);
      }

      const startDate = new Date(Date.now() - 60 * 60 * 1000);
      const endDate = new Date();

      const analytics = await tracker.getAnalytics(
        "test_provider",
        Channel.EMAIL,
        startDate,
        endDate,
      );

      expect(analytics.metrics.p95ResponseTime).toBe(950); // 95th percentile
      expect(analytics.metrics.p99ResponseTime).toBe(990); // 99th percentile
    });

    it("should return empty analytics for no data", async () => {
      const startDate = new Date(Date.now() - 60 * 60 * 1000);
      const endDate = new Date();

      const analytics = await tracker.getAnalytics("unknown", Channel.EMAIL, startDate, endDate);

      expect(analytics.metrics.totalRequests).toBe(0);
      expect(analytics.metrics.successRate).toBe(0);
      expect(analytics.metrics.throughput).toBe(0);
    });
  });

  describe("getTopPerformers", () => {
    beforeEach(async () => {
      // Set up test data for multiple providers
      await tracker.recordSuccess("aws_ses", Channel.EMAIL, 100);
      await tracker.recordSuccess("aws_ses", Channel.EMAIL, 150);
      await tracker.recordFailure("aws_ses", Channel.EMAIL, "Error");

      await tracker.recordSuccess("sendgrid", Channel.EMAIL, 80);
      await tracker.recordSuccess("sendgrid", Channel.EMAIL, 120);
      await tracker.recordSuccess("sendgrid", Channel.EMAIL, 100);

      await tracker.recordSuccess("mailgun", Channel.EMAIL, 200);
      await tracker.recordFailure("mailgun", Channel.EMAIL, "Error");
      await tracker.recordFailure("mailgun", Channel.EMAIL, "Error");
    });

    it("should return top performers sorted by success rate and response time", async () => {
      const topPerformers = await tracker.getTopPerformers(Channel.EMAIL, 3);

      expect(topPerformers).toHaveLength(3);

      // SendGrid should be first (100% success rate, 100ms avg response time)
      expect(topPerformers[0].providerId).toBe("sendgrid");
      expect(topPerformers[0].successRate).toBe(100);
      expect(topPerformers[0].averageResponseTime).toBe(100);

      // AWS SES should be second (66.67% success rate)
      expect(topPerformers[1].providerId).toBe("aws_ses");
      expect(topPerformers[1].successRate).toBeCloseTo(66.67, 1);

      // Mailgun should be last (33.33% success rate)
      expect(topPerformers[2].providerId).toBe("mailgun");
      expect(topPerformers[2].successRate).toBeCloseTo(33.33, 1);
    });

    it("should limit results to specified count", async () => {
      const topPerformers = await tracker.getTopPerformers(Channel.EMAIL, 2);

      expect(topPerformers).toHaveLength(2);
    });
  });

  describe("cleanupOldData", () => {
    it("should remove old performance data", async () => {
      // Record some data
      await tracker.recordSuccess("aws_ses", Channel.EMAIL, 100);
      await tracker.recordFailure("aws_ses", Channel.EMAIL, "Error");

      // Verify data exists
      let metrics = await tracker.getMetrics("aws_ses", Channel.EMAIL);
      expect(metrics.totalRequests).toBe(2);

      // Mock old timestamps
      const performanceData = (tracker as any).performanceData;
      const records = performanceData.get("aws_ses:email");
      records.forEach((record: any) => {
        record.timestamp = new Date(Date.now() - 31 * 24 * 60 * 60 * 1000); // 31 days ago
      });

      // Cleanup old data (older than 30 days)
      await tracker.cleanupOldData(30);

      // Verify data was removed
      metrics = await tracker.getMetrics("aws_ses", Channel.EMAIL);
      expect(metrics.totalRequests).toBe(0);
    });

    it("should preserve recent data during cleanup", async () => {
      await tracker.recordSuccess("aws_ses", Channel.EMAIL, 100);
      await tracker.recordSuccess("aws_ses", Channel.EMAIL, 150);

      // Mock one record as old, one as recent
      const performanceData = (tracker as any).performanceData;
      const records = performanceData.get("aws_ses:email");
      records[0].timestamp = new Date(Date.now() - 31 * 24 * 60 * 60 * 1000); // 31 days ago
      records[1].timestamp = new Date(); // Recent

      await tracker.cleanupOldData(30);

      const metrics = await tracker.getMetrics("aws_ses", Channel.EMAIL);
      expect(metrics.totalRequests).toBe(1);
      expect(metrics.averageResponseTime).toBe(150);
    });
  });

  describe("getProviderComparison", () => {
    beforeEach(async () => {
      // Set up comparison data
      await tracker.recordSuccess("aws_ses", Channel.EMAIL, 100);
      await tracker.recordSuccess("aws_ses", Channel.EMAIL, 200);

      await tracker.recordSuccess("sendgrid", Channel.EMAIL, 80);
      await tracker.recordFailure("sendgrid", Channel.EMAIL, "Error");
    });

    it("should return comparison data sorted by success rate", async () => {
      const startDate = new Date(Date.now() - 60 * 60 * 1000);
      const endDate = new Date();

      const comparison = await tracker.getProviderComparison(Channel.EMAIL, startDate, endDate);

      expect(comparison).toHaveLength(2);

      // AWS SES should be first (100% success rate)
      expect(comparison[0].providerId).toBe("aws_ses");
      expect(comparison[0].metrics.successRate).toBe(100);

      // SendGrid should be second (50% success rate)
      expect(comparison[1].providerId).toBe("sendgrid");
      expect(comparison[1].metrics.successRate).toBe(50);
    });
  });

  describe("edge cases", () => {
    it("should handle maximum records per provider limit", async () => {
      const maxRecords = (tracker as any).MAX_RECORDS_PER_PROVIDER;

      // Add more records than the limit
      for (let i = 0; i < maxRecords + 100; i++) {
        await tracker.recordSuccess("aws_ses", Channel.EMAIL, 100);
      }

      const performanceData = (tracker as any).performanceData;
      const records = performanceData.get("aws_ses:email");

      expect(records.length).toBe(maxRecords);
    });

    it("should handle concurrent operations safely", async () => {
      const promises = [];

      // Simulate concurrent operations
      for (let i = 0; i < 100; i++) {
        promises.push(tracker.recordSuccess("aws_ses", Channel.EMAIL, 100 + i));
        promises.push(tracker.recordFailure("aws_ses", Channel.EMAIL, `Error ${i}`));
      }

      await Promise.all(promises);

      const metrics = await tracker.getMetrics("aws_ses", Channel.EMAIL);
      expect(metrics.totalRequests).toBe(200);
      expect(metrics.successfulRequests).toBe(100);
      expect(metrics.failedRequests).toBe(100);
      expect(metrics.successRate).toBe(50);
    });
  });
});
