import { SetMetadata } from "@nestjs/common";

export const LOG_PERFORMANCE_KEY = "log_performance";

export interface LogPerformanceOptions {
  operation: string;
  threshold?: number; // Log as warning if execution time exceeds this (ms)
  includeArgs?: boolean;
  includeResult?: boolean;
  category?: string;
}

export const LogPerformance = (options: LogPerformanceOptions) =>
  SetMetadata(LOG_PERFORMANCE_KEY, options);
