import { Test, TestingModule } from "@nestjs/testing";
import { NotificationChannel } from "../../../common/enums/notification-channel.enum";
import { ProviderPerformanceTracker } from "../provider-performance-tracker";
import type { Mock } from "vitest";
import { getRedisConnectionToken } from "@nestjs-modules/ioredis";
import Redis from "ioredis-mock";

describe("ProviderPerformanceTracker", () => {
  let tracker: ProviderPerformanceTracker;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProviderPerformanceTracker,
        {
          provide: getRedisConnectionToken(),
          useValue: new Redis(),
        },
      ],
    }).compile();

    tracker = module.get<ProviderPerformanceTracker>(ProviderPerformanceTracker);
  });

  afterEach(async () => {
    await (tracker as any).redis.flushall();
  });

  async function backdateRecords(
    tracker: ProviderPerformanceTracker,
    keySuffix: string,
    predicate: (record: any, index: number) => boolean,
  ) {
    const redis = (tracker as any).redis;
    const key = `perf:records:${keySuffix}`;
    const raw = await redis.lrange(key, 0, -1);
    const records = raw.map((item: string) => JSON.parse(item));
    for (let i = 0; i < records.length; i++) {
      if (predicate(records[i], i)) {
        records[i].timestamp = new Date(Date.now() - 31 * 24 * 60 * 60 * 1000).toISOString();
      }
    }
    await redis.del(key);
    for (const record of records.reverse()) {
      await redis.lpush(key, JSON.stringify(record));
    }
  }

  describe("recordSuccess", () => {
    it("should record successful operation", async () => {
      await tracker.recordSuccess("aws_ses", NotificationChannel.EMAIL, 150, {
        test: "metadata",
      });

      const metrics = await tracker.getMetrics("aws_ses", NotificationChannel.EMAIL);

      expect(metrics.providerId).toBe("aws_ses");
      expect(metrics.channel).toBe(NotificationChannel.EMAIL);
      expect(metrics.totalRequests).toBe(1);
      expect(metrics.successfulRequests).toBe(1);
      expect(metrics.failedRequests).toBe(0);
      expect(metrics.successRate).toBe(100);
      expect(metrics.averageResponseTime).toBe(150);
      expect(metrics.errorRate).toBe(0);
    });

    it("should accumulate multiple successful operations", async () => {
      await tracker.recordSuccess("aws_ses", NotificationChannel.EMAIL, 100);
      await tracker.recordSuccess("aws_ses", NotificationChannel.EMAIL, 200);
      await tracker.recordSuccess("aws_ses", NotificationChannel.EMAIL, 150);

      const metrics = await tracker.getMetrics("aws_ses", NotificationChannel.EMAIL);

      expect(metrics.totalRequests).toBe(3);
      expect(metrics.successfulRequests).toBe(3);
      expect(metrics.successRate).toBe(100);
      expect(metrics.averageResponseTime).toBe(150);
    });
  });

  describe("recordFailure", () => {
    it("should record failed operation", async () => {
      await tracker.recordFailure("aws_ses", NotificationChannel.EMAIL, "Connection timeout");

      const metrics = await tracker.getMetrics("aws_ses", NotificationChannel.EMAIL);

      expect(metrics.totalRequests).toBe(1);
      expect(metrics.successfulRequests).toBe(0);
      expect(metrics.failedRequests).toBe(1);
      expect(metrics.successRate).toBe(0);
      expect(metrics.errorRate).toBe(100);
      expect(metrics.averageResponseTime).toBe(0);
    });

    it("should calculate correct success rate with mixed results", async () => {
      await tracker.recordSuccess("aws_ses", NotificationChannel.EMAIL, 100);
      await tracker.recordSuccess("aws_ses", NotificationChannel.EMAIL, 150);
      await tracker.recordFailure("aws_ses", NotificationChannel.EMAIL, "Error 1");
      await tracker.recordFailure("aws_ses", NotificationChannel.EMAIL, "Error 2");
      await tracker.recordSuccess("aws_ses", NotificationChannel.EMAIL, 200);

      const metrics = await tracker.getMetrics("aws_ses", NotificationChannel.EMAIL);

      expect(metrics.totalRequests).toBe(5);
      expect(metrics.successfulRequests).toBe(3);
      expect(metrics.failedRequests).toBe(2);
      expect(metrics.successRate).toBe(60);
      expect(metrics.errorRate).toBe(40);
      expect(metrics.averageResponseTime).toBe(150);
    });
  });

  describe("getMetrics", () => {
    it("should return empty metrics for unknown provider", async () => {
      const metrics = await tracker.getMetrics("unknown", NotificationChannel.EMAIL);

      expect(metrics.providerId).toBe("unknown");
      expect(metrics.channel).toBe(NotificationChannel.EMAIL);
      expect(metrics.totalRequests).toBe(0);
      expect(metrics.successfulRequests).toBe(0);
      expect(metrics.failedRequests).toBe(0);
      expect(metrics.successRate).toBe(0);
      expect(metrics.averageResponseTime).toBe(0);
    });

    it("should cache metrics for performance", async () => {
      await tracker.recordSuccess("aws_ses", NotificationChannel.EMAIL, 100);

      const metrics1 = await tracker.getMetrics("aws_ses", NotificationChannel.EMAIL);

      const metrics2 = await tracker.getMetrics("aws_ses", NotificationChannel.EMAIL);

      expect(metrics1).toEqual(metrics2);
    });

    it("should invalidate cache after new records", async () => {
      await tracker.recordSuccess("aws_ses", NotificationChannel.EMAIL, 100);
      const metrics1 = await tracker.getMetrics("aws_ses", NotificationChannel.EMAIL);

      await tracker.recordSuccess("aws_ses", NotificationChannel.EMAIL, 200);
      const metrics2 = await tracker.getMetrics("aws_ses", NotificationChannel.EMAIL);

      expect(metrics1.totalRequests).toBe(1);
      expect(metrics2.totalRequests).toBe(2);
      expect(metrics2.averageResponseTime).toBe(150);
    });
  });

  describe("getAnalytics", () => {
    beforeEach(async () => {
      const now = new Date();
      const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
      const twoHoursAgo = new Date(now.getTime() - 2 * 60 * 60 * 1000);

      vi.spyOn(Date, "now")
        .mockReturnValueOnce(twoHoursAgo.getTime())
        .mockReturnValueOnce(twoHoursAgo.getTime())
        .mockReturnValueOnce(oneHourAgo.getTime())
        .mockReturnValueOnce(oneHourAgo.getTime())
        .mockReturnValueOnce(now.getTime());

      await tracker.recordSuccess("aws_ses", NotificationChannel.EMAIL, 100);
      await tracker.recordFailure("aws_ses", NotificationChannel.EMAIL, "Error");
      await tracker.recordSuccess("aws_ses", NotificationChannel.EMAIL, 200);
      await tracker.recordSuccess("aws_ses", NotificationChannel.EMAIL, 150);
      await tracker.recordFailure("aws_ses", NotificationChannel.EMAIL, "Another error");
    });

    afterEach(() => {
      vi.restoreAllMocks();
    });

    it("should return analytics for time range", async () => {
      const startDate = new Date(Date.now() - 3 * 60 * 60 * 1000);
      const endDate = new Date();

      const analytics = await tracker.getAnalytics(
        "aws_ses",
        NotificationChannel.EMAIL,
        startDate,
        endDate,
      );

      expect(analytics.providerId).toBe("aws_ses");
      expect(analytics.channel).toBe(NotificationChannel.EMAIL);
      expect(analytics.metrics.totalRequests).toBe(5);
      expect(analytics.metrics.successfulRequests).toBe(3);
      expect(analytics.metrics.failedRequests).toBe(2);
      expect(analytics.metrics.successRate).toBe(60);
      expect(analytics.metrics.errorRate).toBe(40);
      expect(analytics.metrics.averageResponseTime).toBe(150);
    });

    it("should calculate percentiles correctly", async () => {
      for (let i = 1; i <= 100; i++) {
        await tracker.recordSuccess("test_provider", NotificationChannel.EMAIL, i * 10);
      }

      const startDate = new Date(Date.now() - 60 * 60 * 1000);
      const endDate = new Date();

      const analytics = await tracker.getAnalytics(
        "test_provider",
        NotificationChannel.EMAIL,
        startDate,
        endDate,
      );

      expect(analytics.metrics.p95ResponseTime).toBe(950);
      expect(analytics.metrics.p99ResponseTime).toBe(990);
    });

    it("should return empty analytics for no data", async () => {
      const startDate = new Date(Date.now() - 60 * 60 * 1000);
      const endDate = new Date();

      const analytics = await tracker.getAnalytics(
        "unknown",
        NotificationChannel.EMAIL,
        startDate,
        endDate,
      );

      expect(analytics.metrics.totalRequests).toBe(0);
      expect(analytics.metrics.successRate).toBe(0);
      expect(analytics.metrics.throughput).toBe(0);
    });
  });

  describe("getTopPerformers", () => {
    beforeEach(async () => {
      await tracker.recordSuccess("aws_ses", NotificationChannel.EMAIL, 100);
      await tracker.recordSuccess("aws_ses", NotificationChannel.EMAIL, 150);
      await tracker.recordFailure("aws_ses", NotificationChannel.EMAIL, "Error");

      await tracker.recordSuccess("sendgrid", NotificationChannel.EMAIL, 80);
      await tracker.recordSuccess("sendgrid", NotificationChannel.EMAIL, 120);
      await tracker.recordSuccess("sendgrid", NotificationChannel.EMAIL, 100);

      await tracker.recordSuccess("mailgun", NotificationChannel.EMAIL, 200);
      await tracker.recordFailure("mailgun", NotificationChannel.EMAIL, "Error");
      await tracker.recordFailure("mailgun", NotificationChannel.EMAIL, "Error");
    });

    it("should return top performers sorted by success rate and response time", async () => {
      const topPerformers = await tracker.getTopPerformers(NotificationChannel.EMAIL, 3);

      expect(topPerformers).toHaveLength(3);

      expect(topPerformers[0].providerId).toBe("sendgrid");
      expect(topPerformers[0].successRate).toBe(100);
      expect(topPerformers[0].averageResponseTime).toBe(100);

      expect(topPerformers[1].providerId).toBe("aws_ses");
      expect(topPerformers[1].successRate).toBeCloseTo(66.67, 1);

      expect(topPerformers[2].providerId).toBe("mailgun");
      expect(topPerformers[2].successRate).toBeCloseTo(33.33, 1);
    });

    it("should limit results to specified count", async () => {
      const topPerformers = await tracker.getTopPerformers(NotificationChannel.EMAIL, 2);

      expect(topPerformers).toHaveLength(2);
    });
  });

  describe("cleanupOldData", () => {
    it("should remove old performance data", async () => {
      await tracker.recordSuccess("aws_ses", NotificationChannel.EMAIL, 100);
      await tracker.recordFailure("aws_ses", NotificationChannel.EMAIL, "Error");

      let metrics = await tracker.getMetrics("aws_ses", NotificationChannel.EMAIL);
      expect(metrics.totalRequests).toBe(2);

      await backdateRecords(tracker, "aws_ses:email", () => true);

      await tracker.cleanupOldData(30);

      metrics = await tracker.getMetrics("aws_ses", NotificationChannel.EMAIL);
      expect(metrics.totalRequests).toBe(0);
    });

    it("should preserve recent data during cleanup", async () => {
      await tracker.recordSuccess("aws_ses", NotificationChannel.EMAIL, 100);
      await tracker.recordSuccess("aws_ses", NotificationChannel.EMAIL, 150);

      await backdateRecords(tracker, "aws_ses:email", (_record, index) => index === 1);

      await tracker.cleanupOldData(30);

      const metrics = await tracker.getMetrics("aws_ses", NotificationChannel.EMAIL);
      expect(metrics.totalRequests).toBe(1);
      expect(metrics.averageResponseTime).toBe(150);
    });
  });

  describe("getProviderComparison", () => {
    beforeEach(async () => {
      await tracker.recordSuccess("aws_ses", NotificationChannel.EMAIL, 100);
      await tracker.recordSuccess("aws_ses", NotificationChannel.EMAIL, 200);

      await tracker.recordSuccess("sendgrid", NotificationChannel.EMAIL, 80);
      await tracker.recordFailure("sendgrid", NotificationChannel.EMAIL, "Error");
    });

    it("should return comparison data sorted by success rate", async () => {
      const startDate = new Date(Date.now() - 60 * 60 * 1000);
      const endDate = new Date();

      const comparison = await tracker.getProviderComparison(
        NotificationChannel.EMAIL,
        startDate,
        endDate,
      );

      expect(comparison).toHaveLength(2);

      expect(comparison[0].providerId).toBe("aws_ses");
      expect(comparison[0].metrics.successRate).toBe(100);

      expect(comparison[1].providerId).toBe("sendgrid");
      expect(comparison[1].metrics.successRate).toBe(50);
    });
  });

  describe("edge cases", () => {
    it("should handle maximum records per provider limit", async () => {
      const maxRecords = 50;
      (tracker as any).MAX_RECORDS_PER_PROVIDER = maxRecords;

      for (let i = 0; i < maxRecords + 10; i++) {
        await tracker.recordSuccess("aws_ses", NotificationChannel.EMAIL, 100);
      }

      const records = await (tracker as any).redis.lrange("perf:records:aws_ses:email", 0, -1);

      expect(records.length).toBe(maxRecords);
    });

    it("should handle concurrent operations safely", async () => {
      const promises = [];

      for (let i = 0; i < 100; i++) {
        promises.push(tracker.recordSuccess("aws_ses", NotificationChannel.EMAIL, 100 + i));
        promises.push(tracker.recordFailure("aws_ses", NotificationChannel.EMAIL, `Error ${i}`));
      }

      await Promise.all(promises);

      const metrics = await tracker.getMetrics("aws_ses", NotificationChannel.EMAIL);
      expect(metrics.totalRequests).toBe(200);
      expect(metrics.successfulRequests).toBe(100);
      expect(metrics.failedRequests).toBe(100);
      expect(metrics.successRate).toBe(50);
    });
  });
});
