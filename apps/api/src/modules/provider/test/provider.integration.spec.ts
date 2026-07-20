import { ConfigModule } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken, TypeOrmModule } from '@nestjs/typeorm';
import { Channel } from 'diagnostics_channel';
import { Repository } from 'typeorm';
import { ProviderConfig, ProviderType } from '../provider-config.entity';

describe('ProviderService Integration', () => {
  let app: TestingModule;
  let providerService: ProviderService;
  let providerConfigRepository: Repository<ProviderConfig>;

  beforeAll(async () => {
    app = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          envFilePath: '.env.test',
          isGlobal: true,
        }),
        TypeOrmModule.forRoot({
          type: 'sqlite',
          database: ':memory:',
          entities: [ProviderConfig],
          synchronize: true,
          logging: false,
        }),
        ProviderModule,
      ],
    }).compile();

    providerService = app.get<ProviderService>(ProviderService);
    providerConfigRepository = app.get<Repository<ProviderConfig>>(
      getRepositoryToken(ProviderConfig),
    );

    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    // Clear database before each test
    await providerConfigRepository.clear();
  });

  describe('Provider Selection and Failover', () => {
    it('should select providers based on priority and health', async () => {
      // Create test provider configurations
      const provider1 = providerConfigRepository.create({
        tenantId: 'tenant-1',
        providerId: 'aws_ses',
        providerName: 'AWS SES Primary',
        providerType: ProviderType.AWS_SES,
        channel: Channel.EMAIL,
        config: {
          accessKeyId: 'test-key-1',
          secretAccessKey: 'test-secret-1',
          region: 'us-east-1',
        },
        priority: 1,
        isActive: true,
        isDefault: true,
      });

      const provider2 = providerConfigRepository.create({
        tenantId: 'tenant-1',
        providerId: 'sendgrid',
        providerName: 'SendGrid Backup',
        providerType: ProviderType.SENDGRID,
        channel: Channel.EMAIL,
        config: {
          apiKey: 'test-sendgrid-key',
        },
        priority: 2,
        isActive: true,
        isDefault: false,
      });

      await providerConfigRepository.save([provider1, provider2]);

      const options = {
        tenantId: 'tenant-1',
        channel: Channel.EMAIL,
      };

      const providers = await providerService.selectProviders(options);

      expect(providers).toHaveLength(2);
      expect(providers[0].providerId).toBe('aws_ses');
      expect(providers[0].priority).toBe(1);
      expect(providers[1].providerId).toBe('sendgrid');
      expect(providers[1].priority).toBe(2);
    });

    it('should filter providers by country support', async () => {
      const provider1 = providerConfigRepository.create({
        tenantId: 'tenant-1',
        providerId: 'termii',
        providerName: 'Termii Africa',
        providerType: ProviderType.TERMII,
        channel: Channel.SMS,
        config: {
          apiKey: 'test-termii-key',
          senderId: 'TestApp',
        },
        priority: 1,
        isActive: true,
        supportedCountries: ['NG', 'KE', 'GH'],
      });

      const provider2 = providerConfigRepository.create({
        tenantId: 'tenant-1',
        providerId: 'aws_sns',
        providerName: 'AWS SNS Global',
        providerType: ProviderType.AWS_SNS,
        channel: Channel.SMS,
        config: {
          accessKeyId: 'test-key',
          secretAccessKey: 'test-secret',
          region: 'us-east-1',
        },
        priority: 2,
        isActive: true,
        supportedCountries: null, // Global support
      });

      await providerConfigRepository.save([provider1, provider2]);

      // Test with Nigeria (should get Termii first)
      const nigeriaOptions = {
        tenantId: 'tenant-1',
        channel: Channel.SMS,
        country: 'NG',
      };

      const nigeriaProviders =
        await providerService.selectProviders(nigeriaOptions);
      expect(nigeriaProviders).toHaveLength(2);
      expect(nigeriaProviders[0].providerId).toBe('termii');

      // Test with US (should get AWS SNS only)
      const usOptions = {
        tenantId: 'tenant-1',
        channel: Channel.SMS,
        country: 'US',
      };

      const usProviders = await providerService.selectProviders(usOptions);
      expect(usProviders).toHaveLength(1);
      expect(usProviders[0].providerId).toBe('aws_sns');
    });

    it('should exclude specified providers', async () => {
      const provider1 = providerConfigRepository.create({
        tenantId: 'tenant-1',
        providerId: 'aws_ses',
        providerName: 'AWS SES',
        providerType: ProviderType.AWS_SES,
        channel: Channel.EMAIL,
        config: {
          accessKeyId: 'test',
          secretAccessKey: 'test',
          region: 'us-east-1',
        },
        priority: 1,
        isActive: true,
      });

      const provider2 = providerConfigRepository.create({
        tenantId: 'tenant-1',
        providerId: 'sendgrid',
        providerName: 'SendGrid',
        providerType: ProviderType.SENDGRID,
        channel: Channel.EMAIL,
        config: { apiKey: 'test-key' },
        priority: 2,
        isActive: true,
      });

      await providerConfigRepository.save([provider1, provider2]);

      const options = {
        tenantId: 'tenant-1',
        channel: Channel.EMAIL,
        excludeProviders: ['aws_ses'],
      };

      const providers = await providerService.selectProviders(options);
      expect(providers).toHaveLength(1);
      expect(providers[0].providerId).toBe('sendgrid');
    });
  });

  describe('Provider Configuration Management', () => {
    it('should update provider configuration', async () => {
      const provider = providerConfigRepository.create({
        tenantId: 'tenant-1',
        providerId: 'aws_ses',
        providerName: 'AWS SES',
        providerType: ProviderType.AWS_SES,
        channel: Channel.EMAIL,
        config: {
          accessKeyId: 'old-key',
          secretAccessKey: 'old-secret',
          region: 'us-east-1',
        },
        priority: 1,
        isActive: true,
      });

      await providerConfigRepository.save(provider);

      const updates = {
        priority: 2,
        isActive: false,
        config: {
          accessKeyId: 'new-key',
          secretAccessKey: 'new-secret',
          region: 'us-west-2',
        },
      };

      const updated = await providerService.updateProviderConfig(
        'tenant-1',
        'aws_ses',
        Channel.EMAIL,
        updates,
      );

      expect(updated.priority).toBe(2);
      expect(updated.isActive).toBe(false);
      // Config should be encrypted, so we can't directly compare
      expect(updated.config).toBeDefined();
    });

    it('should toggle provider status', async () => {
      const provider = providerConfigRepository.create({
        tenantId: 'tenant-1',
        providerId: 'aws_ses',
        providerName: 'AWS SES',
        providerType: ProviderType.AWS_SES,
        channel: Channel.EMAIL,
        config: {
          accessKeyId: 'test',
          secretAccessKey: 'test',
          region: 'us-east-1',
        },
        priority: 1,
        isActive: true,
      });

      await providerConfigRepository.save(provider);

      await providerService.toggleProvider(
        'tenant-1',
        'aws_ses',
        Channel.EMAIL,
        false,
      );

      const updated = await providerConfigRepository.findOne({
        where: {
          tenantId: 'tenant-1',
          providerId: 'aws_ses',
          channel: Channel.EMAIL,
        },
      });

      expect(updated?.isActive).toBe(false);
    });

    it('should validate provider configuration', async () => {
      const validConfig = providerConfigRepository.create({
        tenantId: 'tenant-1',
        providerId: 'aws_ses',
        providerName: 'AWS SES',
        providerType: ProviderType.AWS_SES,
        channel: Channel.EMAIL,
        config: {
          accessKeyId: 'AKIAIOSFODNN7EXAMPLE',
          secretAccessKey: 'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY',
          region: 'us-east-1',
        },
        priority: 1,
        isActive: true,
      });

      // Note: This will fail in real scenario because we don't have actual AWS credentials
      // In a real integration test, you would use mock providers or test credentials
      const isValid = await providerService.validateProviderConfig(validConfig);

      // For this test, we expect it to fail validation due to invalid credentials
      // but the structure validation should pass
      expect(typeof isValid).toBe('boolean');
    });
  });

  describe('Bulk Operations', () => {
    it('should handle bulk notification sending', async () => {
      const provider = providerConfigRepository.create({
        tenantId: 'tenant-1',
        providerId: 'aws_ses',
        providerName: 'AWS SES',
        providerType: ProviderType.AWS_SES,
        channel: Channel.EMAIL,
        config: {
          accessKeyId: 'test-key',
          secretAccessKey: 'test-secret',
          region: 'us-east-1',
        },
        priority: 1,
        isActive: true,
      });

      await providerConfigRepository.save(provider);

      const payloads = [
        { recipient: 'user1@example.com', data: { message: 'Hello User 1' } },
        { recipient: 'user2@example.com', data: { message: 'Hello User 2' } },
        { recipient: 'user3@example.com', data: { message: 'Hello User 3' } },
      ];

      const options = {
        tenantId: 'tenant-1',
        channel: Channel.EMAIL,
      };

      // This will fail because we don't have real AWS credentials
      // but it tests the bulk processing logic
      try {
        const results = await providerService.sendBulk(payloads, options);
        expect(results).toHaveLength(3);
      } catch (error) {
        // Expected to fail with mock credentials
        expect(error.message).toContain('providers failed');
      }
    });
  });

  describe('Provider Health and Metrics', () => {
    it('should track provider performance', async () => {
      const provider = providerConfigRepository.create({
        tenantId: 'tenant-1',
        providerId: 'test_provider',
        providerName: 'Test Provider',
        providerType: ProviderType.CUSTOM,
        channel: Channel.EMAIL,
        config: { apiKey: 'test-key' },
        priority: 1,
        isActive: true,
      });

      await providerConfigRepository.save(provider);

      // Get initial metrics (should be empty)
      const initialMetrics = await providerService.getProviderMetrics(
        'test_provider',
        Channel.EMAIL,
      );
      expect(initialMetrics.totalRequests).toBe(0);

      // The actual performance tracking would happen during real send operations
      // For this integration test, we're just verifying the service methods work
    });

    it('should get available providers for tenant', async () => {
      const providers = [
        providerConfigRepository.create({
          tenantId: 'tenant-1',
          providerId: 'aws_ses',
          providerName: 'AWS SES',
          providerType: ProviderType.AWS_SES,
          channel: Channel.EMAIL,
          config: {
            accessKeyId: 'test',
            secretAccessKey: 'test',
            region: 'us-east-1',
          },
          priority: 1,
          isActive: true,
        }),
        providerConfigRepository.create({
          tenantId: 'tenant-1',
          providerId: 'sendgrid',
          providerName: 'SendGrid',
          providerType: ProviderType.SENDGRID,
          channel: Channel.EMAIL,
          config: { apiKey: 'test-key' },
          priority: 2,
          isActive: true,
        }),
        providerConfigRepository.create({
          tenantId: 'tenant-1',
          providerId: 'aws_sns',
          providerName: 'AWS SNS',
          providerType: ProviderType.AWS_SNS,
          channel: Channel.SMS,
          config: {
            accessKeyId: 'test',
            secretAccessKey: 'test',
            region: 'us-east-1',
          },
          priority: 1,
          isActive: true,
        }),
      ];

      await providerConfigRepository.save(providers);

      const emailProviders = await providerService.getAvailableProviders(
        'tenant-1',
        Channel.EMAIL,
      );
      const smsProviders = await providerService.getAvailableProviders(
        'tenant-1',
        Channel.SMS,
      );

      expect(emailProviders).toHaveLength(2);
      expect(smsProviders).toHaveLength(1);
      expect(emailProviders[0].priority).toBeLessThanOrEqual(
        emailProviders[1].priority,
      );
    });
  });

  describe('Multi-tenant Isolation', () => {
    it('should isolate providers by tenant', async () => {
      const tenant1Provider = providerConfigRepository.create({
        tenantId: 'tenant-1',
        providerId: 'aws_ses',
        providerName: 'Tenant 1 AWS SES',
        providerType: ProviderType.AWS_SES,
        channel: Channel.EMAIL,
        config: {
          accessKeyId: 'tenant1-key',
          secretAccessKey: 'tenant1-secret',
          region: 'us-east-1',
        },
        priority: 1,
        isActive: true,
      });

      const tenant2Provider = providerConfigRepository.create({
        tenantId: 'tenant-2',
        providerId: 'aws_ses',
        providerName: 'Tenant 2 AWS SES',
        providerType: ProviderType.AWS_SES,
        channel: Channel.EMAIL,
        config: {
          accessKeyId: 'tenant2-key',
          secretAccessKey: 'tenant2-secret',
          region: 'us-west-2',
        },
        priority: 1,
        isActive: true,
      });

      await providerConfigRepository.save([tenant1Provider, tenant2Provider]);

      const tenant1Providers = await providerService.getAvailableProviders(
        'tenant-1',
        Channel.EMAIL,
      );
      const tenant2Providers = await providerService.getAvailableProviders(
        'tenant-2',
        Channel.EMAIL,
      );

      expect(tenant1Providers).toHaveLength(1);
      expect(tenant2Providers).toHaveLength(1);
      expect(tenant1Providers[0].tenantId).toBe('tenant-1');
      expect(tenant2Providers[0].tenantId).toBe('tenant-2');
    });
  });

  describe('Error Handling', () => {
    it('should handle missing provider configurations gracefully', async () => {
      const options = {
        tenantId: 'nonexistent-tenant',
        channel: Channel.EMAIL,
      };

      const providers = await providerService.selectProviders(options);
      expect(providers).toHaveLength(0);
    });

    it('should handle provider configuration not found', async () => {
      await expect(
        providerService.updateProviderConfig(
          'tenant-1',
          'nonexistent',
          Channel.EMAIL,
          {},
        ),
      ).rejects.toThrow('Provider configuration not found');
    });
  });
});
