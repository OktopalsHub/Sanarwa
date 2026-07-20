import { Injectable } from '@nestjs/common';
import { HealthIndicator, HealthIndicatorResult, HealthCheckError } from '@nestjs/terminus';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';

@Injectable()
export class LoggingHealthIndicator extends HealthIndicator {
  constructor(private readonly configService: ConfigService) {
    super();
  }

  async isHealthy(key: string): Promise<HealthIndicatorResult> {
    const checks = await Promise.allSettled([
      this.checkLoki(),
      this.checkPrometheus(),
      this.checkGrafana(),
      this.checkLogFileAccess(),
    ]);

    const results = {
      loki: this.getCheckResult(checks[0]),
      prometheus: this.getCheckResult(checks[1]),
      grafana: this.getCheckResult(checks[2]),
      logFile: this.getCheckResult(checks[3]),
    };

    const isHealthy = Object.values(results).every(result => result.status === 'up');

    const result = this.getStatus(key, isHealthy, results);

    if (!isHealthy) {
      throw new HealthCheckError('Logging system check failed', result);
    }

    return result;
  }

  private async checkLoki(): Promise<{ status: string; responseTime?: number; error?: string }> {
    const lokiUrl = this.configService.get('logging.loki.url');
    if (!lokiUrl) {
      return { status: 'down', error: 'Loki URL not configured' };
    }

    try {
      const startTime = Date.now();
      const response = await axios.get(`${lokiUrl}/ready`, {
        timeout: 5000,
      });
      const responseTime = Date.now() - startTime;

      return {
        status: response.status === 200 ? 'up' : 'down',
        responseTime,
      };
    } catch (error) {
      return {
        status: 'down',
        error: error.message,
      };
    }
  }

  private async checkPrometheus(): Promise<{ status: string; responseTime?: number; error?: string }> {
    const prometheusUrl = this.configService.get('logging.prometheus.url');
    if (!prometheusUrl) {
      return { status: 'down', error: 'Prometheus URL not configured' };
    }

    try {
      const startTime = Date.now();
      const response = await axios.get(`${prometheusUrl}/-/healthy`, {
        timeout: 5000,
      });
      const responseTime = Date.now() - startTime;

      return {
        status: response.status === 200 ? 'up' : 'down',
        responseTime,
      };
    } catch (error) {
      return {
        status: 'down',
        error: error.message,
      };
    }
  }

  private async checkGrafana(): Promise<{ status: string; responseTime?: number; error?: string }> {
    const grafanaUrl = this.configService.get('logging.grafana.url');
    if (!grafanaUrl) {
      return { status: 'down', error: 'Grafana URL not configured' };
    }

    try {
      const startTime = Date.now();
      const response = await axios.get(`${grafanaUrl}/api/health`, {
        timeout: 5000,
      });
      const responseTime = Date.now() - startTime;

      return {
        status: response.data.database === 'ok' ? 'up' : 'down',
        responseTime,
      };
    } catch (error) {
      return {
        status: 'down',
        error: error.message,
      };
    }
  }

  private async checkLogFileAccess(): Promise<{ status: string; error?: string }> {
    const logFileEnabled = this.configService.get('logging.file.enabled');
    if (!logFileEnabled) {
      return { status: 'up', error: 'File logging disabled' };
    }

    const logFilePath = this.configService.get('logging.file.path');
    if (!logFilePath) {
      return { status: 'down', error: 'Log file path not configured' };
    }

    try {
      const fs = await import('fs/promises');
      await fs.access(logFilePath.substring(0, logFilePath.lastIndexOf('/')));
      return { status: 'up' };
    } catch (error) {
      return {
        status: 'down',
        error: `Cannot access log directory: ${error.message}`,
      };
    }
  }

  private getCheckResult(result: PromiseSettledResult<any>): any {
    if (result.status === 'fulfilled') {
      return result.value;
    } else {
      return {
        status: 'down',
        error: result.reason?.message || 'Unknown error',
      };
    }
  }
}