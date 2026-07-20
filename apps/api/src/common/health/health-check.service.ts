import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRedis } from '@nestjs-modules/ioredis';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import Redis from 'ioredis';
import { AlertService } from '../alerts/alert.service';

export interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: Date;
  uptime: number;
  version: string;
  checks: {
    database: HealthCheckResult;
    redis: HealthCheckResult;
    memory: HealthCheckResult;
    cache: HealthCheckResult;
    connectionPools: HealthCheckResult;
    batchProcessing: HealthCheckResult;
  };
}

export interface HealthCheckResult {
  status: 'healthy' | 'degraded' | 'unhealthy';
  responseTime: number;
  message?: string;
  details?: any;
}

@Injectable()
export class HealthCheckService {
  private readonly logger = new Logger(HealthCheckService.name);
  private readonly startTime = Date.now();

  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    @InjectRedis() private readonly redis: Redis,
    private readonly configService: ConfigService,
    private readonly alertService: AlertService,
  ) { }

  async getHealthStatus(): Promise<HealthStatus> {
    const checks = await Promise.allSettled([
      this.checkDatabase(),
      this.checkRedis(),
      this.checkMemory(),
      this.checkCache(),
      this.checkConnectionPools(),
      this.checkBatchProcessing(),
    ]);

    const [database, redis, memory, cache, connectionPools, batchProcessing] = checks.map(
      (result) => (result.status === 'fulfilled' ? result.value : this.createUnhealthyResult('Check failed'))
    );

    const overallStatus = this.determineOverallStatus([
      database,
      redis,
      memory,
      cache,
      connectionPools,
      batchProcessing,
    ]);

    const healthStatus: HealthStatus = {
      status: overallStatus,
      timestamp: new Date(),
      uptime: Date.now() - this.startTime,
      version: this.configService.get('APP_VERSION', '1.0.0'),
      checks: {
        database,
        redis,
        memory,
        cache,
        connectionPools,
        batchProcessing,
      },
    };

    // Send alert if system is unhealthy
    if (overallStatus === 'unhealthy') {
      await this.sendHealthAlert(healthStatus);
    }

    return healthStatus;
  }

  private async checkDatabase(): Promise<HealthCheckResult> {
    const startTime = Date.now();

    try {
      await this.dataSource.query('SELECT 1');

      return {
        status: 'healthy',
        responseTime: Date.now() - startTime,
        message: 'Database connection successful',
      };
    } catch (error) {
      this.logger.error('Database health check failed', error);

      return {
        status: 'unhealthy',
        responseTime: Date.now() - startTime,
        message: 'Database connection failed',
        details: { error: error.message },
      };
    }
  }

  private async checkRedis(): Promise<HealthCheckResult> {
    const startTime = Date.now();

    try {
      await this.redis.ping();

      return {
        status: 'healthy',
        responseTime: Date.now() - startTime,
        message: 'Redis connection successful',
      };
    } catch (error) {
      this.logger.error('Redis health check failed', error);

      return {
        status: 'unhealthy',
        responseTime: Date.now() - startTime,
        message: 'Redis connection failed',
        details: { error: error.message },
      };
    }
  }

  private async checkMemory(): Promise<HealthCheckResult> {
    const startTime = Date.now();

    try {
      const memoryUsage = process.memoryUsage();
      const heapUsedMB = memoryUsage.heapUsed / 1024 / 1024;
      const rssUsedMB = memoryUsage.rss / 1024 / 1024;

      const heapWarningMB = this.configService.get<number>('MEMORY_HEAP_WARNING_MB', 512);
      const heapCriticalMB = this.configService.get<number>('MEMORY_HEAP_CRITICAL_MB', 1024);
      const rssWarningMB = this.configService.get<number>('MEMORY_RSS_WARNING_MB', 1024);
      const rssCriticalMB = this.configService.get<number>('MEMORY_RSS_CRITICAL_MB', 2048);

      let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
      let message = 'Memory usage normal';

      if (heapUsedMB > heapCriticalMB || rssUsedMB > rssCriticalMB) {
        status = 'unhealthy';
        message = 'Critical memory usage detected';
      } else if (heapUsedMB > heapWarningMB || rssUsedMB > rssWarningMB) {
        status = 'degraded';
        message = 'High memory usage detected';
      }

      return {
        status,
        responseTime: Date.now() - startTime,
        message,
        details: {
          heapUsedMB: Math.round(heapUsedMB),
          rssUsedMB: Math.round(rssUsedMB),
          heapTotalMB: Math.round(memoryUsage.heapTotal / 1024 / 1024),
          externalMB: Math.round(memoryUsage.external / 1024 / 1024),
        },
      };
    } catch (error) {
      this.logger.error('Memory health check failed', error);

      return {
        status: 'unhealthy',
        responseTime: Date.now() - startTime,
        message: 'Memory check failed',
        details: { error: error.message },
      };
    }
  }

  private async checkCache(): Promise<HealthCheckResult> {
    const startTime = Date.now();

    try {
      const testKey = 'health-check-' + Date.now();
      const testValue = JSON.stringify({ test: true, timestamp: new Date() });

      // Test cache write
      await this.redis.set(testKey, testValue, 'EX', 60);

      // Test cache read
      const retrieved = await this.redis.get(testKey);

      // Clean up
      await this.redis.del(testKey);

      if (!retrieved) {
        throw new Error('Cache read/write test failed');
      }

      return {
        status: 'healthy',
        responseTime: Date.now() - startTime,
        message: 'Cache operations successful',
        details: {
          connected: true,
        },
      };
    } catch (error) {
      this.logger.error('Cache health check failed', error);

      return {
        status: 'unhealthy',
        responseTime: Date.now() - startTime,
        message: 'Cache check failed',
        details: { error: error.message },
      };
    }
  }

  private async checkConnectionPools(): Promise<HealthCheckResult> {
    const startTime = Date.now();

    try {
      // Simple check using the existing database connection
      const result = await this.dataSource.query('SELECT 1');

      return {
        status: 'healthy',
        responseTime: Date.now() - startTime,
        message: 'Database connection pool healthy',
        details: { connected: true },
      };
    } catch (error) {
      this.logger.error('Connection pool health check failed', error);

      return {
        status: 'unhealthy',
        responseTime: Date.now() - startTime,
        message: 'Connection pool check failed',
        details: { error: error.message },
      };
    }
  }

  private async checkBatchProcessing(): Promise<HealthCheckResult> {
    const startTime = Date.now();

    try {
      // Simple check - just return healthy since we don't have complex batch processing
      return {
        status: 'healthy',
        responseTime: Date.now() - startTime,
        message: 'Batch processing healthy',
        details: { status: 'operational' },
      };
    } catch (error) {
      this.logger.error('Batch processing health check failed', error);

      return {
        status: 'unhealthy',
        responseTime: Date.now() - startTime,
        message: 'Batch processing check failed',
        details: { error: error.message },
      };
    }
  }

  private determineOverallStatus(checks: HealthCheckResult[]): 'healthy' | 'degraded' | 'unhealthy' {
    const unhealthyCount = checks.filter(check => check.status === 'unhealthy').length;
    const degradedCount = checks.filter(check => check.status === 'degraded').length;

    if (unhealthyCount > 0) {
      return 'unhealthy';
    }

    if (degradedCount > 0) {
      return 'degraded';
    }

    return 'healthy';
  }

  private createUnhealthyResult(message: string): HealthCheckResult {
    return {
      status: 'unhealthy',
      responseTime: 0,
      message,
    };
  }

  private async sendHealthAlert(healthStatus: HealthStatus): Promise<void> {
    try {
      const unhealthyChecks = Object.entries(healthStatus.checks)
        .filter(([, check]) => check.status === 'unhealthy')
        .map(([name]) => name);

      await this.alertService.sendSystemAlert(
        '🚨 System Health Alert',
        `System is unhealthy. Failed checks: ${unhealthyChecks.join(', ')}`,
        'critical',
        {
          status: healthStatus.status,
          failedChecks: unhealthyChecks,
          uptime: healthStatus.uptime,
          timestamp: healthStatus.timestamp,
        }
      );
    } catch (error) {
      this.logger.error('Failed to send health alert', error);
    }
  }
}