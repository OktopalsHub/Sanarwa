import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import axios from 'axios';
import { AlertingService } from './alerting.service';
import { LoggingService } from './logging.service';
import { MetricsService } from './metrics.service';
import { ProviderHealthService } from './provider-health.service';
import type { Mocked } from 'vitest';

vi.mock('axios');
const mockedAxios = axios as Mocked<typeof axios>;

describe('ProviderHealthService', () => {
  let service: ProviderHealthService;
  let mockRedis: any;
  let mockAlertingService: any;
  let mockLoggingService: any;
  let mockMetricsService: any;

  beforeEach(async () => {
    mockRedis = {
      get: vi.fn(),
      setex: vi.fn(),
      keys: vi.fn(),
      mget: vi.fn(),
    };

    mockAlertingService = {
      sendAlert: vi.fn(),
    };

    mockLoggingService = {
      info: vi.fn(),
      error: vi.fn(),
    };

    mockMetricsService = {
      setProviderHealth: vi.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProviderHealthService,
        {
          provide: ConfigService,
          useValue: {
            get: vi.fn((key: string, defaultValue?: any) => {
              const config = {
                HEALTH_CHECK_INTERVAL: 60000,
                HEALTH_THRESHOLD: 0.95,
                ALERT_THRESHOLD: 0.8,
              };
              return config[key] || defaultValue;
            }),
          },
        },
        {
          provide: 'default_IORedisModuleConnectionToken',
          useValue: mockRedis,
        },
        {
          provide: AlertingService,
          useValue: mockAlertingService,
        },
        {
          provide: LoggingService,
          useValue: mockLoggingService,
        },
        {
          provide: MetricsService,
          useValue: mockMetricsService,
        },
      ],
    }).compile();

    service = module.get<ProviderHealthService>(ProviderHealthService);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('checkProviderHealth', () => {
    it('should check email provider health successfully', async () => {
      const provider = {
        providerId: 'aws-ses',
        channel: 'email',
        tenantId: 'test-tenant',
        timeout: 5000,
      };

      mockedAxios.head.mockResolvedValue({ status: 200 });
      mockRedis.get.mockResolvedValue(null);

      const result = await service.checkProviderHealth(provider);

      expect(result.isHealthy).toBe(true);
      expect(result.providerId).toBe('aws-ses');
      expect(result.channel).toBe('email');
      expect(mockMetricsService.setProviderHealth).toHaveBeenCalledWith(
        'aws-ses',
        'email',
        'test-tenant',
        true,
      );
    });

    it('should handle provider health check failure', async () => {
      const provider = {
        providerId: 'aws-ses',
        channel: 'email',
        tenantId: 'test-tenant',
        timeout: 5000,
      };

      mockedAxios.head.mockRejectedValue(new Error('Network error'));
      mockRedis.get.mockResolvedValue(null);

      const result = await service.checkProviderHealth(provider);

      expect(result.isHealthy).toBe(false);
      expect(result.lastError).toBeUndefined();
      expect(mockLoggingService.error).toHaveBeenCalled();
    });

    it('should send alert when success rate is below threshold', async () => {
      const provider = {
        providerId: 'aws-ses',
        channel: 'email',
        tenantId: 'test-tenant',
        timeout: 5000,
      };

      mockedAxios.head.mockRejectedValue(new Error('Network error'));
      mockRedis.get.mockResolvedValue(
        JSON.stringify({
          errorCount: 8,
          totalChecks: 10,
          successRate: 20,
        }),
      );

      await service.checkProviderHealth(provider);

      expect(mockAlertingService.sendAlert).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'provider_health',
          severity: 'high',
          title: 'Provider Health Alert: aws-ses',
        }),
      );
    });
  });

  describe('getProviderHealthStatus', () => {
    it('should return provider health status from Redis', async () => {
      const mockStatus = {
        providerId: 'aws-ses',
        channel: 'email',
        tenantId: 'test-tenant',
        isHealthy: true,
        successRate: 95,
      };

      mockRedis.get.mockResolvedValue(JSON.stringify(mockStatus));

      const result = await service.getProviderHealthStatus(
        'aws-ses',
        'test-tenant',
      );

      expect(result).toEqual(mockStatus);
      expect(mockRedis.get).toHaveBeenCalledWith(
        'provider:health:aws-ses:test-tenant',
      );
    });

    it('should return null when no health data exists', async () => {
      mockRedis.get.mockResolvedValue(null);

      const result = await service.getProviderHealthStatus(
        'aws-ses',
        'test-tenant',
      );

      expect(result).toBeNull();
    });
  });

  describe('getAllProviderHealthStatuses', () => {
    it('should return all provider health statuses', async () => {
      const mockStatuses = [
        { providerId: 'aws-ses', isHealthy: true },
        { providerId: 'aws-sns', isHealthy: false },
      ];

      mockRedis.keys.mockResolvedValue(['key1', 'key2']);
      mockRedis.mget.mockResolvedValue([
        JSON.stringify(mockStatuses[0]),
        JSON.stringify(mockStatuses[1]),
      ]);

      const result = await service.getAllProviderHealthStatuses();

      expect(result).toEqual(mockStatuses);
      expect(mockRedis.keys).toHaveBeenCalledWith('provider:health:*');
    });

    it('should filter by tenant when provided', async () => {
      mockRedis.keys.mockResolvedValue([]);

      await service.getAllProviderHealthStatuses('test-tenant');

      expect(mockRedis.keys).toHaveBeenCalledWith(
        'provider:health:*:test-tenant',
      );
    });
  });

  describe('triggerHealthCheck', () => {
    it('should trigger manual health check for specific provider', async () => {
      mockedAxios.head.mockResolvedValue({ status: 200 });
      mockRedis.get.mockResolvedValue(null);

      const result = await service.triggerHealthCheck('aws-ses', 'default');

      expect(result.providerId).toBe('aws-ses');
      expect(result.isHealthy).toBe(true);
    });

    it('should throw error for unknown provider', async () => {
      await expect(
        service.triggerHealthCheck('unknown-provider', 'default'),
      ).rejects.toThrow(
        'Provider unknown-provider not found for tenant default',
      );
    });
  });
});
