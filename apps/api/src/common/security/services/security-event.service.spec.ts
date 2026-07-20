import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  SecurityEventEntity,
  SecurityEventSeverity,
  SecurityEventType,
} from '../entities/security-event.entity';
import { SecurityEventService } from './security-event.service';

describe('SecurityEventService', () => {
  let service: SecurityEventService;
  let repository: Repository<SecurityEventEntity>;

  const mockRepository = {
    create: vi.fn(),
    save: vi.fn(),
    findOne: vi.fn(),
    find: vi.fn(),
    createQueryBuilder: vi.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SecurityEventService,
        {
          provide: getRepositoryToken(SecurityEventEntity),
          useValue: mockRepository,
        },
      ],
    }).compile();

    service = module.get<SecurityEventService>(SecurityEventService);
    repository = module.get<Repository<SecurityEventEntity>>(
      getRepositoryToken(SecurityEventEntity),
    );
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('logEvent', () => {
    it('should create and save a security event', async () => {
      const eventData = {
        tenantId: 'tenant-1',
        userId: 'user-1',
        eventType: SecurityEventType.LOGIN_SUCCESS,
        description: 'User logged in successfully',
        ipAddress: '192.168.1.1',
      };

      const mockEvent = {
        id: 'event-1',
        ...eventData,
        severity: SecurityEventSeverity.LOW,
      };
      mockRepository.create.mockReturnValue(mockEvent);
      mockRepository.save.mockResolvedValue(mockEvent);

      const result = await service.logEvent(eventData);

      expect(mockRepository.create).toHaveBeenCalledWith({
        ...eventData,
        severity: SecurityEventSeverity.LOW,
      });
      expect(mockRepository.save).toHaveBeenCalledWith(mockEvent);
      expect(result).toEqual(mockEvent);
    });

    it('should determine severity automatically', async () => {
      const eventData = {
        tenantId: 'tenant-1',
        eventType: SecurityEventType.UNAUTHORIZED_ACCESS,
        description: 'Unauthorized access attempt',
      };

      const mockEvent = {
        id: 'event-1',
        ...eventData,
        severity: SecurityEventSeverity.HIGH,
      };
      mockRepository.create.mockReturnValue(mockEvent);
      mockRepository.save.mockResolvedValue(mockEvent);

      await service.logEvent(eventData);

      expect(mockRepository.create).toHaveBeenCalledWith({
        ...eventData,
        severity: SecurityEventSeverity.HIGH,
      });
    });
  });

  describe('logLoginSuccess', () => {
    it('should log successful login event', async () => {
      const mockEvent = { id: 'event-1' };
      mockRepository.create.mockReturnValue(mockEvent);
      mockRepository.save.mockResolvedValue(mockEvent);

      await service.logLoginSuccess(
        'user-1',
        'tenant-1',
        '192.168.1.1',
        'Mozilla/5.0',
        'session-1',
      );

      expect(mockRepository.create).toHaveBeenCalledWith({
        userId: 'user-1',
        tenantId: 'tenant-1',
        eventType: SecurityEventType.LOGIN_SUCCESS,
        severity: SecurityEventSeverity.LOW,
        description: 'User logged in successfully',
        ipAddress: '192.168.1.1',
        userAgent: 'Mozilla/5.0',
        sessionId: 'session-1',
      });
    });
  });

  describe('logLoginFailure', () => {
    it('should log failed login event', async () => {
      const mockEvent = { id: 'event-1' };
      mockRepository.create.mockReturnValue(mockEvent);
      mockRepository.save.mockResolvedValue(mockEvent);

      await service.logLoginFailure(
        'user@example.com',
        'tenant-1',
        'Invalid password',
        '192.168.1.1',
      );

      expect(mockRepository.create).toHaveBeenCalledWith({
        tenantId: 'tenant-1',
        eventType: SecurityEventType.LOGIN_FAILURE,
        severity: SecurityEventSeverity.MEDIUM,
        description: 'Login failed for user@example.com: Invalid password',
        ipAddress: '192.168.1.1',
        userAgent: undefined,
        metadata: { email: 'user@example.com', reason: 'Invalid password' },
      });
    });
  });

  describe('logUnauthorizedAccess', () => {
    it('should log unauthorized access event', async () => {
      const mockEvent = { id: 'event-1' };
      mockRepository.create.mockReturnValue(mockEvent);
      mockRepository.save.mockResolvedValue(mockEvent);

      await service.logUnauthorizedAccess(
        'notification',
        'notif-1',
        'user-1',
        'tenant-1',
        '192.168.1.1',
      );

      expect(mockRepository.create).toHaveBeenCalledWith({
        userId: 'user-1',
        tenantId: 'tenant-1',
        eventType: SecurityEventType.UNAUTHORIZED_ACCESS,
        severity: SecurityEventSeverity.HIGH,
        description: 'Unauthorized access attempt to notification:notif-1',
        ipAddress: '192.168.1.1',
        userAgent: undefined,
        resourceType: 'notification',
        resourceId: 'notif-1',
        requestDetails: undefined,
      });
    });
  });

  describe('getSecurityEvents', () => {
    it('should return paginated security events', async () => {
      const mockQueryBuilder = {
        andWhere: vi.fn().mockReturnThis(),
        getCount: vi.fn().mockResolvedValue(10),
        orderBy: vi.fn().mockReturnThis(),
        skip: vi.fn().mockReturnThis(),
        take: vi.fn().mockReturnThis(),
        getMany: vi.fn().mockResolvedValue([{ id: 'event-1' }]),
      };

      mockRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder);

      const query = {
        tenantId: 'tenant-1',
        eventType: SecurityEventType.LOGIN_SUCCESS,
        limit: 10,
        offset: 0,
      };

      const result = await service.getSecurityEvents(query);

      expect(result).toEqual({
        events: [{ id: 'event-1' }],
        total: 10,
        page: 1,
        limit: 10,
      });

      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
        'event.tenantId = :tenantId',
        { tenantId: 'tenant-1' },
      );
      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
        'event.eventType = :eventType',
        { eventType: SecurityEventType.LOGIN_SUCCESS },
      );
    });
  });

  describe('resolveEvent', () => {
    it('should resolve a security event', async () => {
      const mockEvent = {
        id: 'event-1',
        resolved: false,
      };

      mockRepository.findOne.mockResolvedValue(mockEvent);
      mockRepository.save.mockResolvedValue({
        ...mockEvent,
        resolved: true,
        resolvedBy: 'admin-1',
        resolution: 'False positive',
      });

      const result = await service.resolveEvent(
        'event-1',
        'admin-1',
        'False positive',
      );

      expect(mockRepository.findOne).toHaveBeenCalledWith({
        where: { id: 'event-1' },
      });

      expect(result.resolved).toBe(true);
      expect(result.resolvedBy).toBe('admin-1');
      expect(result.resolution).toBe('False positive');
    });

    it('should throw error if event not found', async () => {
      mockRepository.findOne.mockResolvedValue(null);

      await expect(
        service.resolveEvent('invalid-id', 'admin-1', 'Resolution'),
      ).rejects.toThrow('Security event with ID invalid-id not found');
    });
  });

  describe('getUnresolvedHighSeverityEvents', () => {
    it('should return unresolved high severity events', async () => {
      const mockQueryBuilder = {
        where: vi.fn().mockReturnThis(),
        andWhere: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockReturnThis(),
        getMany: vi.fn().mockResolvedValue([{ id: 'event-1' }]),
      };

      mockRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder);

      const result = await service.getUnresolvedHighSeverityEvents('tenant-1');

      expect(result).toEqual([{ id: 'event-1' }]);
      expect(mockQueryBuilder.where).toHaveBeenCalledWith(
        'event.resolved = :resolved',
        { resolved: false },
      );
      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
        'event.severity IN (:...severities)',
        {
          severities: [
            SecurityEventSeverity.HIGH,
            SecurityEventSeverity.CRITICAL,
          ],
        },
      );
    });
  });

  describe('cleanupOldEvents', () => {
    it('should clean up old resolved events', async () => {
      const mockQueryBuilder = {
        delete: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        andWhere: vi.fn().mockReturnThis(),
        execute: vi.fn().mockResolvedValue({ affected: 5 }),
      };

      mockRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder);

      const result = await service.cleanupOldEvents(30);

      expect(result).toBe(5);
      expect(mockQueryBuilder.delete).toHaveBeenCalled();
      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
        'resolved = :resolved',
        { resolved: true },
      );
    });
  });
});
