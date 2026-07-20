import { Test, TestingModule } from '@nestjs/testing';
import { Channel, ProviderConfig, ProviderHealth } from '../types';
import { AsiaSMSProvider } from './asia-sms-provider';
import { SMSPayload } from './sms-provider.interface';
import type { Mock } from 'vitest';

// Mock fetch globally
global.fetch = vi.fn();

describe('AsiaSMSProvider', () => {
  let provider: AsiaSMSProvider;
  let validConfig: ProviderConfig;
  let mockFetch: Mock;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [AsiaSMSProvider],
    }).compile();

    provider = module.get<AsiaSMSProvider>(AsiaSMSProvider);
    mockFetch = fetch as Mock;

    validConfig = {
      id: 'asia-sms-provider',
      name: 'Asia SMS Provider',
      channel: Channel.SMS,
      priority: 1,
      isActive: true,
      credentials: {
        apiKey: 'test-account-sid',
        apiSecret: 'test-auth-token',
        senderId: 'AsiaSMS',
      },
    };
  });

  afterEach(async () => {
    if (provider.isInitialized) {
      await provider.destroy();
    }
    vi.clearAllMocks();
  });

  describe('initialization', () => {
    it('should initialize successfully with valid config', async () => {
      await provider.initialize(validConfig);

      expect(provider.isInitialized).toBe(true);
      expect(provider.id).toBe('asia-sms');
      expect(provider.name).toBe('Asia SMS Provider');
      expect(provider.channel).toBe(Channel.SMS);
    });

    it('should fail initialization with missing apiKey', async () => {
      const invalidConfig = {
        ...validConfig,
        credentials: { ...validConfig.credentials, apiKey: '' },
      };

      await expect(provider.initialize(invalidConfig)).rejects.toThrow(
        'Invalid configuration for provider Asia SMS Provider',
      );
    });

    it('should fail initialization with missing apiSecret', async () => {
      const invalidConfig = {
        ...validConfig,
        credentials: { ...validConfig.credentials, apiSecret: '' },
      };

      await expect(provider.initialize(invalidConfig)).rejects.toThrow(
        'Invalid configuration for provider Asia SMS Provider',
      );
    });
  });

  describe('country support', () => {
    beforeEach(async () => {
      await provider.initialize(validConfig);
    });

    it('should support Asian countries', () => {
      const asianCountries = [
        'CN',
        'JP',
        'KR',
        'IN',
        'ID',
        'TH',
        'VN',
        'PH',
        'MY',
        'SG',
      ];

      asianCountries.forEach((country) => {
        expect(provider.isCountrySupported(country)).toBe(true);
      });
    });

    it('should support Middle Eastern countries', () => {
      const middleEasternCountries = ['SA', 'AE', 'QA', 'BH', 'KW', 'OM'];

      middleEasternCountries.forEach((country) => {
        expect(provider.isCountrySupported(country)).toBe(true);
      });
    });

    it('should not support non-Asian countries', () => {
      const nonAsianCountries = ['US', 'GB', 'NG', 'BR', 'AU'];

      nonAsianCountries.forEach((country) => {
        expect(provider.isCountrySupported(country)).toBe(false);
      });
    });

    it('should return list of supported countries', () => {
      const supportedCountries = provider.getSupportedCountries();

      expect(supportedCountries).toContain('CN');
      expect(supportedCountries).toContain('IN');
      expect(supportedCountries).toContain('JP');
      expect(supportedCountries.length).toBeGreaterThan(40);
    });
  });

  describe('phone number formatting', () => {
    beforeEach(async () => {
      await provider.initialize(validConfig);
    });

    it('should format Indian numbers correctly', () => {
      const testCases = [
        { input: '09876543210', country: 'IN', expected: '+919876543210' },
        { input: '9876543210', country: 'IN', expected: '+919876543210' },
        { input: '+919876543210', country: 'IN', expected: '+919876543210' },
      ];

      testCases.forEach(({ input, country, expected }) => {
        const result = provider.formatPhoneNumber(input, country);
        expect(result).toBe(expected);
      });
    });

    it('should format Chinese numbers correctly', () => {
      const result = provider.formatPhoneNumber('13812345678', 'CN');
      expect(result).toBe('+8613812345678');
    });

    it('should format Japanese numbers correctly', () => {
      const result = provider.formatPhoneNumber('09012345678', 'JP');
      expect(result).toBe('+819012345678');
    });

    it('should default to India when no country code provided', () => {
      const result = provider.formatPhoneNumber('09876543210');
      expect(result).toBe('+919876543210');
    });

    it('should handle already formatted international numbers', () => {
      const result = provider.formatPhoneNumber('+919876543210');
      expect(result).toBe('+919876543210');
    });
  });

  describe('sending SMS', () => {
    beforeEach(async () => {
      await provider.initialize(validConfig);
    });

    it('should send SMS successfully', async () => {
      const mockResponse = {
        sid: 'asia-sms-123456',
        status: 'queued',
      };

      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      } as Response);

      const payload: SMSPayload = {
        recipient: '+919876543210',
        message: 'Test SMS message',
        countryCode: 'IN',
        data: {},
      };

      const response = await provider.send(payload);

      expect(response.status).toBe('sent');
      expect(response.providerMessageId).toBe('asia-sms-123456');
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/Messages.json'),
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            Authorization: expect.stringContaining('Basic'),
            'Content-Type': 'application/x-www-form-urlencoded',
          }),
        }),
      );
    });

    it('should handle unsupported country', async () => {
      const payload: SMSPayload = {
        recipient: '+1234567890',
        message: 'Test SMS message',
        countryCode: 'US',
        data: {},
      };

      const response = await provider.send(payload);

      expect(response.status).toBe('failed');
      expect(response.error).toContain('Country not supported');
    });

    it('should handle API errors', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
        json: () => Promise.resolve({ message: 'Invalid credentials' }),
      } as Response);

      const payload: SMSPayload = {
        recipient: '+919876543210',
        message: 'Test SMS message',
        countryCode: 'IN',
        data: {},
      };

      const response = await provider.send(payload);

      expect(response.status).toBe('failed');
      expect(response.error).toContain('Asia SMS Error');
    });

    it('should handle failed status from API', async () => {
      const mockResponse = {
        sid: 'asia-sms-123456',
        status: 'failed',
        error_message: 'Invalid phone number',
      };

      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      } as Response);

      const payload: SMSPayload = {
        recipient: '+919876543210',
        message: 'Test SMS message',
        countryCode: 'IN',
        data: {},
      };

      const response = await provider.send(payload);

      expect(response.status).toBe('failed');
      expect(response.error).toContain('Invalid phone number');
    });

    it('should fail when provider not initialized', async () => {
      await provider.destroy();

      const payload: SMSPayload = {
        recipient: '+919876543210',
        message: 'Test SMS message',
        data: {},
      };

      const response = await provider.send(payload);

      expect(response.status).toBe('failed');
      expect(response.error).toBe('Provider not initialized');
    });
  });

  describe('health checks', () => {
    beforeEach(async () => {
      await provider.initialize(validConfig);
    });

    it('should return healthy status when API is accessible', async () => {
      const mockAccountResponse = {
        status: 'active',
        friendly_name: 'Test Account',
      };

      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockAccountResponse),
      } as Response);

      const healthStatus = await provider.checkHealth();

      expect(healthStatus.status).toBe(ProviderHealth.HEALTHY);
      expect(healthStatus.metadata?.service).toBe('Asia SMS Provider');
      expect(healthStatus.metadata?.accountStatus).toBe('active');
    });

    it('should return unhealthy status when API is not accessible', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
      } as Response);

      const healthStatus = await provider.checkHealth();

      expect(healthStatus.status).toBe(ProviderHealth.UNHEALTHY);
      expect(healthStatus.metadata?.error).toContain(
        'Asia SMS health check failed',
      );
    });
  });

  describe('Asia SMS-specific methods', () => {
    beforeEach(async () => {
      await provider.initialize(validConfig);
    });

    it('should get account information', async () => {
      const mockAccount = {
        status: 'active',
        friendly_name: 'Test Account',
        type: 'Full',
      };

      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockAccount),
      } as Response);

      const account = await provider.getAccountInfo();

      expect(account).toEqual(mockAccount);
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('.json'),
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: expect.stringContaining('Basic'),
          }),
        }),
      );
    });

    it('should get message status', async () => {
      const mockMessageStatus = {
        sid: 'test-message-sid',
        status: 'delivered',
        date_sent: '2023-01-01T00:00:00Z',
      };

      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockMessageStatus),
      } as Response);

      const status = await provider.getMessageStatus('test-message-sid');

      expect(status).toEqual(mockMessageStatus);
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/Messages/test-message-sid.json'),
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: expect.stringContaining('Basic'),
          }),
        }),
      );
    });

    it('should handle API errors in account methods', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
      } as Response);

      await expect(provider.getAccountInfo()).rejects.toThrow();
      await expect(provider.getMessageStatus('test-sid')).rejects.toThrow();
    });
  });

  describe('configuration validation', () => {
    it('should validate correct configuration', async () => {
      const isValid = await provider.validateConfig(validConfig);
      expect(isValid).toBe(true);
    });

    it('should reject configuration without apiKey', async () => {
      const invalidConfig = {
        ...validConfig,
        credentials: { apiSecret: 'test-secret' },
      };

      const isValid = await provider.validateConfig(invalidConfig);
      expect(isValid).toBe(false);
    });

    it('should reject configuration without apiSecret', async () => {
      const invalidConfig = {
        ...validConfig,
        credentials: { apiKey: 'test-key' },
      };

      const isValid = await provider.validateConfig(invalidConfig);
      expect(isValid).toBe(false);
    });
  });
});
