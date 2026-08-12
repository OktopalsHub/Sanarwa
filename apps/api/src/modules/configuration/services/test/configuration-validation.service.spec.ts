import { Test, TestingModule } from '@nestjs/testing';
import { ConfigurationValidationService } from '../configuration-validation.service';

describe('ConfigurationValidationService', () => {
  let service: ConfigurationValidationService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [ConfigurationValidationService],
    }).compile();

    service = module.get<ConfigurationValidationService>(
      ConfigurationValidationService,
    );
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('validateValue', () => {
    it('should return valid for string schema', async () => {
      const result = await service.validateValue('test-string', 'string');
      expect(result.isValid).toBe(true);
    });

    it('should return valid for number schema with valid number', async () => {
      const result = await service.validateValue('123', 'number');
      expect(result.isValid).toBe(true);
    });

    it('should return invalid for number schema with invalid value', async () => {
      const result = await service.validateValue('not-a-number', 'number');
      expect(result.isValid).toBe(false);
      expect(result.errors).toBeDefined();
    });

    it('should return valid for boolean schema with valid boolean', async () => {
      const result = await service.validateValue('true', 'boolean');
      expect(result.isValid).toBe(true);
    });

    it('should return invalid for boolean schema with invalid value', async () => {
      const result = await service.validateValue('not-a-boolean', 'boolean');
      expect(result.isValid).toBe(false);
    });

    it('should return valid for email schema with valid email', async () => {
      const result = await service.validateValue('test@example.com', 'email');
      expect(result.isValid).toBe(true);
    });

    it('should return invalid for email schema with invalid email', async () => {
      const result = await service.validateValue('invalid-email', 'email');
      expect(result.isValid).toBe(false);
    });

    it('should return valid for url schema with valid URL', async () => {
      const result = await service.validateValue('https://example.com', 'url');
      expect(result.isValid).toBe(true);
    });

    it('should return invalid for url schema with invalid URL', async () => {
      const result = await service.validateValue('not-a-url', 'url');
      expect(result.isValid).toBe(false);
    });

    it('should return valid for port schema with valid port', async () => {
      const result = await service.validateValue('8080', 'port');
      expect(result.isValid).toBe(true);
    });

    it('should return invalid for port schema with out-of-range port', async () => {
      const result = await service.validateValue('70000', 'port');
      expect(result.isValid).toBe(false);
    });

    it('should validate database_config schema', async () => {
      const validConfig = JSON.stringify({
        host: 'localhost',
        port: 5432,
        username: 'user',
        database: 'testdb',
      });

      const result = await service.validateValue(
        validConfig,
        'database_config',
      );
      expect(result.isValid).toBe(true);
    });

    it('should reject invalid database_config schema', async () => {
      const invalidConfig = JSON.stringify({
        host: 'localhost',
        // missing required fields
      });

      const result = await service.validateValue(
        invalidConfig,
        'database_config',
      );
      expect(result.isValid).toBe(false);
      expect(result.errors).toBeDefined();
    });

    it('should validate redis_config schema', async () => {
      const validConfig = JSON.stringify({
        host: 'localhost',
        port: 6379,
        password: 'secret',
        db: 0,
      });

      const result = await service.validateValue(validConfig, 'redis_config');
      expect(result.isValid).toBe(true);
    });

    it('should validate jwt_config schema', async () => {
      const validConfig = JSON.stringify({
        secret: 'this-is-a-very-long-secret-key-for-jwt',
        expiresIn: '1h',
        issuer: 'test-app',
      });

      const result = await service.validateValue(validConfig, 'jwt_config');
      expect(result.isValid).toBe(true);
    });

    it('should reject jwt_config with short secret', async () => {
      const invalidConfig = JSON.stringify({
        secret: 'short',
      });

      const result = await service.validateValue(invalidConfig, 'jwt_config');
      expect(result.isValid).toBe(false);
    });

    it('should validate rate_limit_config schema', async () => {
      const validConfig = JSON.stringify({
        windowMs: 60000,
        max: 100,
        message: 'Too many requests',
      });

      const result = await service.validateValue(
        validConfig,
        'rate_limit_config',
      );
      expect(result.isValid).toBe(true);
    });

    it('should return valid when no schema is provided', async () => {
      const result = await service.validateValue('any-value');
      expect(result.isValid).toBe(true);
    });

    it('should return valid when schema is not found', async () => {
      const result = await service.validateValue(
        'any-value',
        'non-existent-schema',
      );
      expect(result.isValid).toBe(true);
    });
  });

  describe('validateConfigurations', () => {
    it('should validate multiple configurations', async () => {
      const configurations = [
        { key: 'config1', value: 'test-string', validationSchema: 'string' },
        { key: 'config2', value: '123', validationSchema: 'number' },
        {
          key: 'config3',
          value: 'test@example.com',
          validationSchema: 'email',
        },
      ];

      const results = await service.validateConfigurations(configurations);

      expect(results.config1.isValid).toBe(true);
      expect(results.config2.isValid).toBe(true);
      expect(results.config3.isValid).toBe(true);
    });

    it('should handle mixed validation results', async () => {
      const configurations = [
        { key: 'valid', value: 'test-string', validationSchema: 'string' },
        { key: 'invalid', value: 'not-a-number', validationSchema: 'number' },
      ];

      const results = await service.validateConfigurations(configurations);

      expect(results.valid.isValid).toBe(true);
      expect(results.invalid.isValid).toBe(false);
    });
  });

  describe('registerSchema', () => {
    it('should register custom schema successfully', () => {
      const customSchema = {
        type: 'object',
        properties: {
          customField: { type: 'string' },
        },
        required: ['customField'],
      };

      expect(() => {
        service.registerSchema('custom_schema', customSchema);
      }).not.toThrow();
    });

    it('should throw error for invalid schema', () => {
      const invalidSchema = {
        type: 'invalid-type',
      } as any;

      expect(() => {
        service.registerSchema('invalid_schema', invalidSchema);
      }).toThrow();
    });
  });

  describe('getAvailableSchemas', () => {
    it('should return list of available schemas', () => {
      const schemas = service.getAvailableSchemas();

      expect(schemas).toContain('string');
      expect(schemas).toContain('number');
      expect(schemas).toContain('boolean');
      expect(schemas).toContain('email');
      expect(schemas).toContain('url');
      expect(schemas).toContain('port');
      expect(schemas).toContain('database_config');
      expect(schemas).toContain('redis_config');
      expect(schemas).toContain('jwt_config');
      expect(schemas).toContain('rate_limit_config');
    });
  });

  describe('validateEnvironmentConfig', () => {
    it('should validate development environment requirements', async () => {
      const configs = {
        DATABASE_HOST: 'localhost',
        DATABASE_PORT: '5432',
        DATABASE_USERNAME: 'user',
        DATABASE_NAME: 'testdb',
        JWT_AUTH_SECRET: 'test-secret',
        JWT_REFRESH_SECRET: 'test-refresh-secret',
      };

      const result = await service.validateEnvironmentConfig(
        'development',
        configs,
      );
      expect(result.isValid).toBe(true);
    });

    it('should validate production environment requirements', async () => {
      const configs = {
        DATABASE_HOST: 'localhost',
        DATABASE_PORT: '5432',
        DATABASE_USERNAME: 'user',
        DATABASE_NAME: 'testdb',
        JWT_AUTH_SECRET: 'test-secret',
        JWT_REFRESH_SECRET: 'test-refresh-secret',
        REDIS_HOST: 'localhost',
        REDIS_PORT: '6379',
        ENCRYPTION_KEY_V1: 'encryption-key',
        SESSION_SECRET: 'session-secret',
      };

      const result = await service.validateEnvironmentConfig(
        'production',
        configs,
      );
      expect(result.isValid).toBe(true);
    });

    it('should return invalid for missing required configs', async () => {
      const configs = {
        DATABASE_HOST: 'localhost',
        // missing other required configs
      };

      const result = await service.validateEnvironmentConfig(
        'production',
        configs,
      );
      expect(result.isValid).toBe(false);
      expect(result.errors).toBeDefined();
      expect(result.errors![0]).toContain('Missing required configurations');
    });

    it('should validate staging environment requirements', async () => {
      const configs = {
        DATABASE_HOST: 'localhost',
        DATABASE_PORT: '5432',
        DATABASE_USERNAME: 'user',
        DATABASE_NAME: 'testdb',
        JWT_AUTH_SECRET: 'test-secret',
        JWT_REFRESH_SECRET: 'test-refresh-secret',
        REDIS_HOST: 'localhost',
        REDIS_PORT: '6379',
      };

      const result = await service.validateEnvironmentConfig(
        'staging',
        configs,
      );
      expect(result.isValid).toBe(true);
    });
  });
});
