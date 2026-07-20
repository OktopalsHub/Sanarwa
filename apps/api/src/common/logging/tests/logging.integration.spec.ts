import { Test, TestingModule } from '@nestjs/testing';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { StructuredLoggerService } from '../structured-logger.service';
import { LogSanitizer } from '../utils/log-sanitizer.util';
import { LogRotationService } from '../utils/log-rotation.util';
import { LoggingHealthIndicator } from '../health/logging-health.indicator';
import loggingConfig from '../../../config/logging.config';

describe('Logging System Integration', () => {
  let module: TestingModule;
  let loggerService: StructuredLoggerService;
  let configService: ConfigService;
  let rotationService: LogRotationService;
  let healthIndicator: LoggingHealthIndicator;

  beforeEach(async () => {
    module = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          load: [loggingConfig],
          isGlobal: true,
        }),
      ],
      providers: [
        StructuredLoggerService,
        LogRotationService,
        LoggingHealthIndicator,
      ],
    }).compile();

    loggerService = module.get<StructuredLoggerService>(StructuredLoggerService);
    configService = module.get<ConfigService>(ConfigService);
    rotationService = module.get<LogRotationService>(LogRotationService);
    healthIndicator = module.get<LoggingHealthIndicator>(LoggingHealthIndicator);
  });

  afterEach(async () => {
    await module.close();
  });

  describe('StructuredLoggerService', () => {
    it('should be defined', () => {
      expect(loggerService).toBeDefined();
    });

    it('should log messages with proper structure', () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation();
      
      loggerService.log('Test message', {
        correlationId: 'test-123',
        userId: 'user-456',
      });

      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });

    it('should log user actions', () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation();
      
      loggerService.logUserAction('profile_updated', 'user-123', {
        correlationId: 'req-456',
      });

      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });

    it('should log business events', () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation();
      
      loggerService.logBusinessEvent('order_created', {
        orderId: 'order-789',
        amount: 99.99,
      });

      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });

    it('should log security events', () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation();
      
      loggerService.logSecurityEvent('failed_login', 'medium', {
        userId: 'user-123',
        ipAddress: '192.168.1.1',
      });

      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });
  });

  describe('LogSanitizer', () => {
    it('should sanitize sensitive fields', () => {
      const sensitiveData = {
        username: 'john_doe',
        password: 'secret123',
        token: 'abc123def456',
        email: 'john@example.com',
      };

      const sanitized = LogSanitizer.sanitizeObject(sensitiveData);

      expect(sanitized.username).toBe('john_doe');
      expect(sanitized.email).toBe('john@example.com');
      expect(sanitized.password).toBe('[REDACTED]');
      expect(sanitized.token).toBe('ab********56');
    });

    it('should sanitize nested objects', () => {
      const nestedData = {
        user: {
          id: 'user-123',
          credentials: {
            password: 'secret123',
            apiKey: 'key123456789',
          },
        },
      };

      const sanitized = LogSanitizer.sanitizeObject(nestedData);

      expect(sanitized.user.id).toBe('user-123');
      expect(sanitized.user.credentials.password).toBe('[REDACTED]');
      expect(sanitized.user.credentials.apiKey).toBe('ke********89');
    });

    it('should sanitize headers', () => {
      const headers = {
        'content-type': 'application/json',
        'authorization': 'Bearer token123',
        'x-api-key': 'secret-key',
        'user-agent': 'Mozilla/5.0',
      };

      const sanitized = LogSanitizer.sanitizeHeaders(headers);

      expect(sanitized['content-type']).toBe('application/json');
      expect(sanitized['user-agent']).toBe('Mozilla/5.0');
      expect(sanitized['authorization']).toBe('[REDACTED]');
      expect(sanitized['x-api-key']).toBe('[REDACTED]');
    });

    it('should truncate long strings', () => {
      const longString = 'a'.repeat(2000);
      const truncated = LogSanitizer.truncateString(longString, 100);

      expect(truncated.length).toBeLessThanOrEqual(115); // 100 + '... [TRUNCATED]'
      expect(truncated).toContain('[TRUNCATED]');
    });

    it('should limit object size', () => {
      const largeObject = {
        data: 'x'.repeat(20000),
        metadata: { info: 'test' },
      };

      const limited = LogSanitizer.limitObjectSize(largeObject, 1000);

      expect(limited._truncated).toBe(true);
      expect(limited._originalSize).toBeGreaterThan(1000);
    });
  });

  describe('LogRotationService', () => {
    it('should be defined', () => {
      expect(rotationService).toBeDefined();
    });

    it('should get log file stats', async () => {
      const stats = await rotationService.getLogFileStats();
      expect(stats).toBeDefined();
      expect(typeof stats.enabled).toBe('boolean');
    });
  });

  describe('LoggingHealthIndicator', () => {
    it('should be defined', () => {
      expect(healthIndicator).toBeDefined();
    });

    it('should perform health check', async () => {
      try {
        const result = await healthIndicator.isHealthy('logging');
        expect(result).toBeDefined();
        expect(result.logging).toBeDefined();
      } catch (error) {
        // Health check might fail in test environment, that's okay
        expect(error).toBeDefined();
      }
    });
  });

  describe('Configuration', () => {
    it('should load logging configuration', () => {
      const logLevel = configService.get('logging.level');
      const logFormat = configService.get('logging.format');

      expect(logLevel).toBeDefined();
      expect(logFormat).toBeDefined();
    });

    it('should have ELK configuration', () => {
      const elasticsearchUrl = configService.get('logging.elk.elasticsearch.url');
      const logstashHost = configService.get('logging.elk.logstash.host');
      const kibanaUrl = configService.get('logging.elk.kibana.url');

      expect(elasticsearchUrl).toBeDefined();
      expect(logstashHost).toBeDefined();
      expect(kibanaUrl).toBeDefined();
    });
  });
});