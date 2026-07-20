import { Test, TestingModule } from '@nestjs/testing';
import { Channel, ProviderConfig, ProviderHealth } from '../types';
import { MetaWhatsAppProvider } from './meta-whatsapp-provider';
import {
import type { Mock } from 'vitest';
  WhatsAppPayload,
  WhatsAppTemplate,
} from './whatsapp-provider.interface';

// Mock fetch globally
global.fetch = vi.fn();

describe('MetaWhatsAppProvider', () => {
  let provider: MetaWhatsAppProvider;
  let validConfig: ProviderConfig;
  let mockFetch: Mock;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [MetaWhatsAppProvider],
    }).compile();

    provider = module.get<MetaWhatsAppProvider>(MetaWhatsAppProvider);
    mockFetch = fetch as Mock;

    validConfig = {
      id: 'whatsapp-provider',
      name: 'Meta WhatsApp Provider',
      channel: Channel.WHATSAPP,
      priority: 1,
      isActive: true,
      credentials: {
        accessToken: 'test-access-token',
        phoneNumberId: 'test-phone-number-id',
        businessAccountId: 'test-business-account-id',
        apiVersion: 'v18.0',
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
      expect(provider.id).toBe('meta-whatsapp');
      expect(provider.name).toBe('Meta WhatsApp Business');
      expect(provider.channel).toBe(Channel.WHATSAPP);
    });

    it('should fail initialization with missing accessToken', async () => {
      const invalidConfig = {
        ...validConfig,
        credentials: { ...validConfig.credentials, accessToken: '' },
      };

      await expect(provider.initialize(invalidConfig)).rejects.toThrow(
        'Invalid configuration for provider Meta WhatsApp Business',
      );
    });

    it('should fail initialization with missing phoneNumberId', async () => {
      const invalidConfig = {
        ...validConfig,
        credentials: { ...validConfig.credentials, phoneNumberId: '' },
      };

      await expect(provider.initialize(invalidConfig)).rejects.toThrow(
        'Invalid configuration for provider Meta WhatsApp Business',
      );
    });

    it('should fail initialization with missing businessAccountId', async () => {
      const invalidConfig = {
        ...validConfig,
        credentials: { ...validConfig.credentials, businessAccountId: '' },
      };

      await expect(provider.initialize(invalidConfig)).rejects.toThrow(
        'Invalid configuration for provider Meta WhatsApp Business',
      );
    });
  });

  describe('WhatsApp number validation', () => {
    beforeEach(async () => {
      await provider.initialize(validConfig);
    });

    it('should validate correct WhatsApp numbers', () => {
      const validNumbers = [
        '1234567890',
        '+1234567890',
        '919876543210',
        '+919876543210',
        '2348012345678',
      ];

      validNumbers.forEach((number) => {
        expect(provider.validateWhatsAppNumber(number)).toBe(true);
      });
    });

    it('should reject invalid WhatsApp numbers', () => {
      const invalidNumbers = [
        '',
        '123',
        '12345678901234567', // Too long
        'abc1234567890',
        '+abc1234567890',
        '123-456-7890',
      ];

      invalidNumbers.forEach((number) => {
        expect(provider.validateWhatsAppNumber(number)).toBe(false);
      });
    });
  });

  describe('sending messages', () => {
    beforeEach(async () => {
      await provider.initialize(validConfig);
    });

    it('should send text message successfully', async () => {
      const mockResponse = {
        messaging_product: 'whatsapp',
        contacts: [{ input: '1234567890', wa_id: '1234567890' }],
        messages: [{ id: 'whatsapp-message-123' }],
      };

      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      } as Response);

      const payload: WhatsAppPayload = {
        recipient: '+1234567890',
        message: {
          type: 'text',
          text: 'Hello, this is a test message!',
        },
        data: {},
      };

      const response = await provider.send(payload);

      expect(response.status).toBe('sent');
      expect(response.providerMessageId).toBe('whatsapp-message-123');
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/messages'),
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            Authorization: 'Bearer test-access-token',
            'Content-Type': 'application/json',
          }),
        }),
      );
    });

    it('should send image message successfully', async () => {
      const mockResponse = {
        messaging_product: 'whatsapp',
        contacts: [{ input: '1234567890', wa_id: '1234567890' }],
        messages: [{ id: 'whatsapp-image-123' }],
      };

      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      } as Response);

      const payload: WhatsAppPayload = {
        recipient: '+1234567890',
        message: {
          type: 'media',
          mediaType: 'image',
          mediaUrl: 'https://example.com/image.jpg',
          caption: 'Test image',
        },
        data: {},
      };

      const response = await provider.send(payload);

      expect(response.status).toBe('sent');
      expect(response.providerMessageId).toBe('whatsapp-image-123');
    });

    it('should send template message successfully', async () => {
      const mockResponse = {
        messaging_product: 'whatsapp',
        contacts: [{ input: '1234567890', wa_id: '1234567890' }],
        messages: [{ id: 'whatsapp-template-123' }],
      };

      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      } as Response);

      const payload: WhatsAppPayload = {
        recipient: '+1234567890',
        message: {
          type: 'template',
        },
        templateName: 'hello_world',
        templateLanguage: 'en',
        templateParameters: ['John'],
        data: {},
      };

      const response = await provider.send(payload);

      expect(response.status).toBe('sent');
      expect(response.providerMessageId).toBe('whatsapp-template-123');
    });

    it('should handle invalid WhatsApp number', async () => {
      const payload: WhatsAppPayload = {
        recipient: 'invalid-number',
        message: {
          type: 'text',
          text: 'Test message',
        },
        data: {},
      };

      const response = await provider.send(payload);

      expect(response.status).toBe('failed');
      expect(response.error).toContain('Invalid WhatsApp number format');
    });

    it('should handle API errors', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 400,
        statusText: 'Bad Request',
        json: () =>
          Promise.resolve({
            error: {
              message: 'Invalid phone number',
              type: 'param',
              code: 100,
            },
          }),
      } as Response);

      const payload: WhatsAppPayload = {
        recipient: '+1234567890',
        message: {
          type: 'text',
          text: 'Test message',
        },
        data: {},
      };

      const response = await provider.send(payload);

      expect(response.status).toBe('failed');
      expect(response.error).toContain('Invalid phone number');
    });

    it('should fail when provider not initialized', async () => {
      await provider.destroy();

      const payload: WhatsAppPayload = {
        recipient: '+1234567890',
        message: {
          type: 'text',
          text: 'Test message',
        },
        data: {},
      };

      const response = await provider.send(payload);

      expect(response.status).toBe('failed');
      expect(response.error).toBe('Provider not initialized');
    });
  });

  describe('template functionality', () => {
    beforeEach(async () => {
      await provider.initialize(validConfig);
    });

    it('should send template message with sendTemplate method', async () => {
      const mockResponse = {
        messaging_product: 'whatsapp',
        contacts: [{ input: '1234567890', wa_id: '1234567890' }],
        messages: [{ id: 'whatsapp-template-456' }],
      };

      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      } as Response);

      const template: WhatsAppTemplate = {
        name: 'welcome_message',
        language: 'en',
        components: [
          {
            type: 'body',
            parameters: [{ type: 'text', text: 'name' }],
          },
        ],
      };

      const response = await provider.sendTemplate('+1234567890', template, {
        name: 'John Doe',
      });

      expect(response.status).toBe('sent');
      expect(response.providerMessageId).toBe('whatsapp-template-456');
    });

    it('should validate template correctly', () => {
      const validTemplate: WhatsAppTemplate = {
        name: 'test_template',
        language: 'en_US',
        components: [{ type: 'header' }, { type: 'body' }, { type: 'footer' }],
      };

      expect(provider.validateTemplate(validTemplate)).toBe(true);
    });

    it('should reject invalid templates', () => {
      const invalidTemplates = [
        { name: '', language: 'en', components: [] },
        { name: 'test', language: '', components: [] },
        { name: 'test', language: 'invalid-lang', components: [] },
        { name: 'test', language: 'en', components: [{ type: 'invalid' }] },
      ];

      invalidTemplates.forEach((template) => {
        expect(provider.validateTemplate(template as WhatsAppTemplate)).toBe(
          false,
        );
      });
    });

    it('should get templates from API', async () => {
      const mockTemplates = {
        data: [
          {
            name: 'hello_world',
            language: 'en',
            components: [{ type: 'body' }],
          },
          {
            name: 'welcome_message',
            language: 'en_US',
            components: [{ type: 'header' }, { type: 'body' }],
          },
        ],
      };

      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockTemplates),
      } as Response);

      const templates = await provider.getTemplates();

      expect(templates).toHaveLength(2);
      expect(templates[0].name).toBe('hello_world');
      expect(templates[1].name).toBe('welcome_message');
    });
  });

  describe('health checks', () => {
    beforeEach(async () => {
      await provider.initialize(validConfig);
    });

    it('should return healthy status when API is accessible', async () => {
      const mockPhoneInfo = {
        display_phone_number: '+1 555-123-4567',
        verified_name: 'Test Business',
        id: 'test-phone-number-id',
      };

      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockPhoneInfo),
      } as Response);

      const healthStatus = await provider.checkHealth();

      expect(healthStatus.status).toBe(ProviderHealth.HEALTHY);
      expect(healthStatus.metadata?.service).toBe('Meta WhatsApp Business');
      expect(healthStatus.metadata?.phoneNumber).toBe('+1 555-123-4567');
      expect(healthStatus.metadata?.verifiedName).toBe('Test Business');
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
        'WhatsApp health check failed',
      );
    });
  });

  describe('WhatsApp-specific methods', () => {
    beforeEach(async () => {
      await provider.initialize(validConfig);
    });

    it('should get message status', async () => {
      const mockStatus = {
        id: 'whatsapp-message-123',
        status: 'delivered',
        timestamp: '1234567890',
      };

      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockStatus),
      } as Response);

      const status = await provider.getMessageStatus('whatsapp-message-123');

      expect(status).toEqual(mockStatus);
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/whatsapp-message-123'),
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: 'Bearer test-access-token',
          }),
        }),
      );
    });

    it('should upload media', async () => {
      const mockUploadResponse = {
        id: 'media-id-123',
      };

      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockUploadResponse),
      } as Response);

      const mediaId = await provider.uploadMedia(
        'https://example.com/image.jpg',
        'image',
      );

      expect(mediaId).toBe('media-id-123');
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/media'),
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            Authorization: 'Bearer test-access-token',
          }),
        }),
      );
    });

    it('should handle API errors in specific methods', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
      } as Response);

      await expect(provider.getMessageStatus('test-id')).rejects.toThrow();
      await expect(provider.uploadMedia('test-url', 'image')).rejects.toThrow();
      await expect(provider.getTemplates()).rejects.toThrow();
    });
  });

  describe('configuration validation', () => {
    it('should validate correct configuration', async () => {
      const isValid = await provider.validateConfig(validConfig);
      expect(isValid).toBe(true);
    });

    it('should reject configuration without required fields', async () => {
      const requiredFields = [
        'accessToken',
        'phoneNumberId',
        'businessAccountId',
      ];

      for (const field of requiredFields) {
        const invalidConfig = {
          ...validConfig,
          credentials: { ...validConfig.credentials, [field]: '' },
        };

        const isValid = await provider.validateConfig(invalidConfig);
        expect(isValid).toBe(false);
      }
    });
  });
});
