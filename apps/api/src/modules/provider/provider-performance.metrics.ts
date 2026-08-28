import { Channel } from "../../providers/types";
import {
  PerformanceAnalytics,
  ProviderMetrics,
  ProviderPerformanceRecord,
} from "./provider-performance.types";

export function calculatePercentile(sortedArray: number[], percentile: number): number {
  if (sortedArray.length === 0) return 0;

  const index = Math.ceil((percentile / 100) * sortedArray.length) - 1;
  return sortedArray[Math.max(0, Math.min(index, sortedArray.length - 1))];
}

export function calculateTrend(previousValue: number, currentValue: number): number {
  if (previousValue === 0) return currentValue > 0 ? 100 : 0;
  return ((currentValue - previousValue) / previousValue) * 100;
}

export function emptyPerformanceAnalytics(
  providerId: string,
  channel: Channel,
  startDate: Date,
  endDate: Date,
): PerformanceAnalytics {
  return {
    providerId,
    channel,
    timeRange: { start: startDate, end: endDate },
    metrics: {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      averageResponseTime: 0,
      p95ResponseTime: 0,
      p99ResponseTime: 0,
      successRate: 0,
      errorRate: 0,
      throughput: 0,
    },
    trends: {
      successRateTrend: 0,
      responseTimeTrend: 0,
      throughputTrend: 0,
    },
  };
}

export function calculateMetricsFromRecords(
  records: ProviderPerformanceRecord[],
  providerId: string,
  channel: Channel,
): ProviderMetrics {
  if (records.length === 0) {
    return {
      providerId,
      channel,
      successRate: 0,
      averageResponseTime: 0,
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      requestsPerMinute: 0,
      errorRate: 0,
    };
  }

  const successfulRequests = records.filter((r) => r.success);
  const failedRequests = records.filter((r) => !r.success);
  const totalRequests = records.length;

  const successRate = (successfulRequests.length / totalRequests) * 100;
  const errorRate = (failedRequests.length / totalRequests) * 100;

  const responseTimes = successfulRequests.map((r) => r.responseTime);
  const averageResponseTime =
    responseTimes.length > 0
      ? responseTimes.reduce((sum, time) => sum + time, 0) / responseTimes.length
      : 0;

  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
  const recentRecords = records.filter((r) => r.timestamp > oneHourAgo);
  const requestsPerMinute = recentRecords.length / 60;

  const lastSuccessfulRequest =
    successfulRequests.length > 0
      ? new Date(Math.max(...successfulRequests.map((r) => r.timestamp.getTime())))
      : undefined;

  const lastFailedRequest =
    failedRequests.length > 0
      ? new Date(Math.max(...failedRequests.map((r) => r.timestamp.getTime())))
      : undefined;

  return {
    providerId,
    channel,
    successRate,
    averageResponseTime,
    totalRequests,
    successfulRequests: successfulRequests.length,
    failedRequests: failedRequests.length,
    lastSuccessfulRequest,
    lastFailedRequest,
    requestsPerMinute,
    errorRate,
  };
}

export function buildPerformanceAnalytics(
  records: ProviderPerformanceRecord[],
  providerId: string,
  channel: Channel,
  startDate: Date,
  endDate: Date,
  previousMetrics?: PerformanceAnalytics["metrics"],
): PerformanceAnalytics {
  if (records.length === 0) {
    return emptyPerformanceAnalytics(providerId, channel, startDate, endDate);
  }

  const successfulRequests = records.filter((r) => r.success);
  const failedRequests = records.filter((r) => !r.success);
  const responseTimes = successfulRequests.map((r) => r.responseTime);

  const totalRequests = records.length;
  const successRate = (successfulRequests.length / totalRequests) * 100;
  const errorRate = (failedRequests.length / totalRequests) * 100;
  const averageResponseTime =
    responseTimes.length > 0
      ? responseTimes.reduce((sum, time) => sum + time, 0) / responseTimes.length
      : 0;

  const sortedResponseTimes = responseTimes.toSorted((a, b) => a - b);
  const p95ResponseTime = calculatePercentile(sortedResponseTimes, 95);
  const p99ResponseTime = calculatePercentile(sortedResponseTimes, 99);

  const timeRangeSeconds = (endDate.getTime() - startDate.getTime()) / 1000;
  const throughput = totalRequests / timeRangeSeconds;

  const metrics = {
    totalRequests,
    successfulRequests: successfulRequests.length,
    failedRequests: failedRequests.length,
    averageResponseTime,
    p95ResponseTime,
    p99ResponseTime,
    successRate,
    errorRate,
    throughput,
  };

  return {
    providerId,
    channel,
    timeRange: { start: startDate, end: endDate },
    metrics,
    trends: previousMetrics
      ? {
          successRateTrend: calculateTrend(previousMetrics.successRate, successRate),
          responseTimeTrend: calculateTrend(previousMetrics.averageResponseTime, averageResponseTime),
          throughputTrend: calculateTrend(previousMetrics.throughput, throughput),
        }
      : {
          successRateTrend: 0,
          responseTimeTrend: 0,
          throughputTrend: 0,
        },
  };
}

export function filterRecordsInRange(
  records: ProviderPerformanceRecord[],
  startDate: Date,
  endDate: Date,
): ProviderPerformanceRecord[] {
  return records.filter((record) => record.timestamp >= startDate && record.timestamp <= endDate);
}
