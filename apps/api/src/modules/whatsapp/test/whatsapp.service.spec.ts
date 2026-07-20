import { Test, TestingModule } from '@nestjs/testing';
import { WhatsappBusinessApiService } from '../services/whatsapp-business-api.service';
import { WhatsappEmbeddedSignupService } from '../services/whatsapp-embedded-signup.service';
import { WhatsappMultiTenantTemplateService } from '../services/whatsapp-multi-tenant-template.service';
import { Repository } from 'typeorm';
import { getRepositoryToken } from '@nestjs/typeorm';
import { WabaConfig } from '../entities/waba-config.entity';
import { TenantWabaConfig } from '../entities/tenant-waba-config.entity';
import { TenantWabaAssignment } from '../entities/tenant-waba-assignment.entity';
import type { Mock, Mocked } from 'vitest';

describe('WhatsappBusinessApiService', () => {
  let service: WhatsappBusinessApiService;
  let wabaConfigRepository: Mocked<Repository<WabaConfig>>;
  let tenantWabaConfigRepository: Mocked<Repository<TenantWabaConfig>>;

  beforeEach(async () => {
    const mockRepository = {
      find: vi.fn(),
      findOne: vi.fn(),
      save: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WhatsappBusinessApiService,
        {
          provide: getRepositoryToken(WabaConfig),
          useValue: mockRepository,
        },
        {
          provide: getRepositoryToken(TenantWabaConfig),
          useValue: mockRepository,
        },
      ],
    }).compile();

    service = module.get<WhatsappBusinessApiService>(WhatsappBusinessApiService);
    wabaConfigRepository = module.get(getRepositoryToken(WabaConfig));
    tenantWabaConfigRepository = module.get(getRepositoryToken(TenantWabaConfig));
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('sendMessage', () => {
    it('should send WhatsApp message', async () => {
      const messageData = {
        to: '+1234567890',
        message: 'Hello World',
        tenantId: 'tenant-1',
      };

      const mockConfig = {
        id: '1',
        wabaId: 'waba-123',
        accessToken: 'token-123',
        phoneNumberId: 'phone-123',
      };

      tenantWabaConfigRepository.findOne.mockResolvedValue(mockConfig as TenantWabaConfig);

      // Mock HTTP request
      vi.spyOn(service as any, 'makeWhatsAppRequest').mockResolvedValue({
        messages: [{ id: 'msg-123' }],
      });

      const result = await service.sendMessage(messageData);

      expect(result).toBeDefined();
      expect(result.messageId).toBe('msg-123');
    });

    it('should throw error if no WABA config found', async () => {
      const messageData = {
        to: '+1234567890',
        message: 'Hello World',
        tenantId: 'tenant-1',
      };

      tenantWabaConfigRepository.findOne.mockResolvedValue(null);

      await expect(service.sendMessage(messageData)).rejects.toThrow('No WhatsApp Business API configuration found');
    });
  });

  describe('sendTemplate', () => {
    it('should send template message', async () => {
      const templateData = {
        to: '+1234567890',
        templateName: 'welcome_message',
        templateLanguage: 'en',
        parameters: ['John'],
        tenantId: 'tenant-1',
      };

      const mockConfig = {
        id: '1',
        wabaId: 'waba-123',
        accessToken: 'token-123',
        phoneNumberId: 'phone-123',
      };

      tenantWabaConfigRepository.findOne.mockResolvedValue(mockConfig as TenantWabaConfig);

      vi.spyOn(service as any, 'makeWhatsAppRequest').mockResolvedValue({
        messages: [{ id: 'msg-template-123' }],
      });

      const result = await service.sendTemplate(templateData);

      expect(result).toBeDefined();
      expect(result.messageId).toBe('msg-template-123');
    });
  });

  describe('getMessageStatus', () => {
    it('should get message delivery status', async () => {
      const messageId = 'msg-123';
      const tenantId = 'tenant-1';

      const mockConfig = {
        id: '1',
        wabaId: 'waba-123',
        accessToken: 'token-123',
      };

      tenantWabaConfigRepository.findOne.mockResolvedValue(mockConfig as TenantWabaConfig);

      vi.spyOn(service as any, 'makeWhatsAppRequest').mockResolvedValue({
        id: messageId,
        status: 'delivered',
        timestamp: '1234567890',
      });

      const result = await service.getMessageStatus(messageId, tenantId);

      expect(result.status).toBe('delivered');
      expect(result.messageId).toBe(messageId);
    });
  });
});

describe('WhatsappEmbeddedSignupService', () => {
  let service: WhatsappEmbeddedSignupService;
  let wabaConfigRepository: Mocked<Repository<WabaConfig>>;

  beforeEach(async () => {
    const mockRepository = {
      find: vi.fn(),
      findOne: vi.fn(),
      save: vi.fn(),
      create: vi.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WhatsappEmbeddedSignupService,
        {
          provide: getRepositoryToken(WabaConfig),
          useValue: mockRepository,
        },
      ],
    }).compile();

    service = module.get<WhatsappEmbeddedSignupService>(WhatsappEmbeddedSignupService);
    wabaConfigRepository = module.get(getRepositoryToken(WabaConfig));
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('handleEmbeddedSignup', () => {
    it('should process embedded signup callback', async () => {
      const signupData = {
        wabaId: 'waba-123',
        accessToken: 'token-123',
        phoneNumbers: [
          {
            id: 'phone-123',
            number: '+1234567890',
            verified: true,
          },
        ],
      };

      const mockConfig = {
        id: '1',
        wabaId: signupData.wabaId,
        accessToken: signupData.accessToken,
        isActive: true,
      };

      wabaConfigRepository.create.mockReturnValue(mockConfig as WabaConfig);
      wabaConfigRepository.save.mockResolvedValue(mockConfig as WabaConfig);

      const result = await service.handleEmbeddedSignup(signupData);

      expect(result).toBeDefined();
      expect(result.wabaId).toBe(signupData.wabaId);
      expect(wabaConfigRepository.save).toHaveBeenCalled();
    });
  });
});

describe('WhatsappMultiTenantTemplateService', () => {
  let service: WhatsappMultiTenantTemplateService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [WhatsappMultiTenantTemplateService],
    }).compile();

    service = module.get<WhatsappMultiTenantTemplateService>(WhatsappMultiTenantTemplateService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('createTemplate', () => {
    it('should create WhatsApp template', async () => {
      const templateData = {
        name: 'welcome_message',
        category: 'MARKETING',
        language: 'en',
        components: [
          {
            type: 'BODY',
            text: 'Welcome {{1}}! Thank you for joining us.',
          },
        ],
        tenantId: 'tenant-1',
      };

      // Mock API call
      vi.spyOn(service as any, 'makeTemplateRequest').mockResolvedValue({
        id: 'template-123',
        status: 'PENDING',
        name: templateData.name,
      });

      const result = await service.createTemplate(templateData);

      expect(result).toBeDefined();
      expect(result.templateId).toBe('template-123');
      expect(result.status).toBe('PENDING');
    });
  });

  describe('getTemplateStatus', () => {
    it('should get template approval status', async () => {
      const templateId = 'template-123';
      const tenantId = 'tenant-1';

      vi.spyOn(service as any, 'makeTemplateRequest').mockResolvedValue({
        id: templateId,
        status: 'APPROVED',
        name: 'welcome_message',
      });

      const result = await service.getTemplateStatus(templateId, tenantId);

      expect(result.status).toBe('APPROVED');
      expect(result.templateId).toBe(templateId);
    });
  });
});