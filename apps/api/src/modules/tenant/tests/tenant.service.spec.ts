import { ConflictException, NotFoundException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Test, TestingModule } from '@nestjs/testing';
import { TenantStatus } from '../../../common/enums';
import { TenantCreatedEvent } from '../../../common/events/tenant.event';
import { UserService } from '../../user/user.service';
import { CreateTenantDto } from '../dto/create-tenant.dto';
import { UpdateTenantDto } from '../dto/update-tenant.dto';
import { Tenant } from '../entities/tenant.entity';
import { TenantRepository } from '../tenant.repository';
import { TenantService } from '../tenant.service';

describe('TenantService', () => {
  let service: TenantService;
  let tenantRepository: TenantRepository;
  let userService: UserService;
  let eventEmitter: EventEmitter2;

  const mockUser = {
    id: 'user-123',
    email: 'test@example.com',
    firstName: 'Test',
    lastName: 'User',
  };

  const mockTenant: Tenant = {
    id: '123e4567-e89b-12d3-a456-426614174000',
    name: 'Test Tenant',
    description: 'Test Description',
    subdomain: 'test-tenant',
    status: TenantStatus.ACTIVE,
    quotas: {
      notifications: { daily: 1000, monthly: 30000 },
      channels: {
        email: { daily: 500, monthly: 15000 },
        sms: { daily: 200, monthly: 6000 },
      },
    },
    settings: {
      timezone: 'UTC',
      defaultFromEmail: 'noreply@test.com',
    },
    usage: {
      currentMonth: {
        notifications: 100,
        email: 50,
        sms: 25,
      },
      lastUpdated: new Date(),
    },
    lastActiveAt: new Date(),
    createdAt: new Date(),
    updatedAt: new Date(),

    // Relationship properties
    members: [],
    apiKeys: [],
  };

  const mockQueryBuilder = {
    andWhere: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockReturnThis(),
    skip: vi.fn().mockReturnThis(),
    take: vi.fn().mockReturnThis(),
    getManyAndCount: vi.fn(),
    getOne: vi.fn(),
  };

  const mockTenantRepository = {
    create: vi.fn(),
    findOne: vi.fn(),
    findById: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    createQueryBuilder: vi.fn().mockReturnValue(mockQueryBuilder),
  };

  const mockUserService = {
    getUserById: vi.fn(),
  };

  const mockEventEmitter = {
    emit: vi.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TenantService,
        {
          provide: TenantRepository,
          useValue: mockTenantRepository,
        },
        {
          provide: UserService,
          useValue: mockUserService,
        },
        {
          provide: EventEmitter2,
          useValue: mockEventEmitter,
        },
      ],
    }).compile();

    service = module.get<TenantService>(TenantService);
    tenantRepository = module.get<TenantRepository>(TenantRepository);
    userService = module.get<UserService>(UserService);
    eventEmitter = module.get<EventEmitter2>(EventEmitter2);

    // Reset all mocks
    vi.clearAllMocks();
  });

  describe('createTenant', () => {
    const createTenantDto: CreateTenantDto = {
      name: 'New Tenant',
      description: 'New tenant description',
      subdomain: 'new-tenant',
      quotas: {
        notifications: { daily: 1000 },
        channels: {},
      },
    };

    it('should create a new tenant successfully and emit event', async () => {
      mockUserService.getUserById.mockResolvedValue(mockUser);
      mockTenantRepository.findOne.mockResolvedValue(null);
      const createdTenant = {
        ...mockTenant,
        ...createTenantDto,
      };
      mockTenantRepository.create.mockResolvedValue(createdTenant);

      const result = await service.createTenant(mockUser.id, createTenantDto);

      expect(mockUserService.getUserById).toHaveBeenCalledWith(mockUser.id);
      expect(mockTenantRepository.findOne).toHaveBeenCalledWith({
        where: [
          { name: createTenantDto.name.toLowerCase() },
          { subdomain: createTenantDto.subdomain },
        ],
      });
      expect(mockTenantRepository.create).toHaveBeenCalledWith({
        ...createTenantDto,
        status: TenantStatus.ACTIVE,
      });
      expect(mockEventEmitter.emit).toHaveBeenCalledWith(
        'tenant.created',
        expect.any(TenantCreatedEvent),
      );
      expect(result).toBeDefined();
      expect(result.name).toBe(createTenantDto.name);
    });

    it('should throw ConflictException if tenant with same name exists', async () => {
      mockUserService.getUserById.mockResolvedValue(mockUser);
      mockTenantRepository.findOne.mockResolvedValue(mockTenant);

      await expect(
        service.createTenant(mockUser.id, createTenantDto),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('getAllTenants', () => {
    it('should return paginated tenants', async () => {
      mockQueryBuilder.getManyAndCount.mockResolvedValue([[mockTenant], 1]);

      const result = await service.getAllTenants({});

      expect(result.tenants).toHaveLength(1);
      expect(result.total).toBe(1);
    });

    it('should apply filters correctly', async () => {
      mockQueryBuilder.getManyAndCount.mockResolvedValue([[], 0]);

      await service.getAllTenants({
        status: TenantStatus.ACTIVE,
        search: 'test',
        page: 2,
        limit: 5,
      });

      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
        'tenant.status = :status',
        {
          status: TenantStatus.ACTIVE,
        },
      );
      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
        '(tenant.name ILIKE :search OR tenant.description ILIKE :search OR tenant.subdomain ILIKE :search)',
        { search: '%test%' },
      );
      expect(mockQueryBuilder.skip).toHaveBeenCalledWith(5);
      expect(mockQueryBuilder.take).toHaveBeenCalledWith(5);
    });
  });

  describe('getTenantById', () => {
    it('should return a tenant by id', async () => {
      mockTenantRepository.findById.mockResolvedValue(mockTenant);

      const result = await service.getTenantById(mockTenant.id);

      expect(result).toBeDefined();
      expect(result.id).toBe(mockTenant.id);
    });

    it('should throw NotFoundException if tenant not found', async () => {
      mockTenantRepository.findById.mockResolvedValue(null);

      await expect(service.getTenantById('non-existent-id')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('updateTenant', () => {
    const updateDto: UpdateTenantDto = {
      name: 'Updated Tenant',
    };

    it('should update tenant successfully', async () => {
      mockTenantRepository.findById.mockResolvedValue(mockTenant);
      mockTenantRepository.update.mockResolvedValue({ affected: 1 });
      mockTenantRepository.findById
        .mockResolvedValueOnce(mockTenant)
        .mockResolvedValueOnce({
          ...mockTenant,
          ...updateDto,
        });

      const result = await service.updateTenant(mockTenant.id, updateDto);

      expect(mockTenantRepository.update).toHaveBeenCalledWith(
        mockTenant.id,
        updateDto,
      );
      expect(result.name).toBe(updateDto.name);
    });

    it('should check for conflicts when updating name or subdomain', async () => {
      mockQueryBuilder.getOne.mockResolvedValue(null);
      mockTenantRepository.findById.mockResolvedValue(mockTenant);
      mockTenantRepository.update.mockResolvedValue({ affected: 1 });

      await service.updateTenant(mockTenant.id, { name: 'New Name' });

      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
        'tenant.name = :name',
        {
          name: 'New Name',
        },
      );
    });
  });

  describe('suspend and activate', () => {
    it('should suspend tenant', async () => {
      mockTenantRepository.update.mockResolvedValue({ affected: 1 });
      mockTenantRepository.findById.mockResolvedValue({
        ...mockTenant,
        status: TenantStatus.SUSPENDED,
      });

      const result = await service.suspendTenant(mockTenant.id);

      expect(mockTenantRepository.update).toHaveBeenCalledWith(mockTenant.id, {
        status: TenantStatus.SUSPENDED,
      });
      expect(result.status).toBe(TenantStatus.SUSPENDED);
    });

    it('should activate tenant', async () => {
      mockTenantRepository.update.mockResolvedValue({ affected: 1 });
      mockTenantRepository.findById.mockResolvedValue({
        ...mockTenant,
        status: TenantStatus.ACTIVE,
      });

      const result = await service.activateTenant(mockTenant.id);

      expect(mockTenantRepository.update).toHaveBeenCalledWith(mockTenant.id, {
        status: TenantStatus.ACTIVE,
      });
      expect(result.status).toBe(TenantStatus.ACTIVE);
    });
  });

  describe('updateUsage', () => {
    it('should update tenant usage statistics', async () => {
      mockTenantRepository.findOne.mockResolvedValue(mockTenant);
      mockTenantRepository.update.mockResolvedValue({ affected: 1 });

      await service.updateUsage(mockTenant.id, 'email', 5);

      expect(mockTenantRepository.update).toHaveBeenCalledWith(mockTenant.id, {
        usage: {
          currentMonth: {
            notifications: 105, // 100 + 5
            email: 55, // 50 + 5
            sms: 25,
          },
          lastUpdated: expect.any(Date),
        },
      });
    });

    it('should handle tenant not found gracefully', async () => {
      mockTenantRepository.findOne.mockResolvedValue(null);

      await expect(
        service.updateUsage('non-existent', 'email'),
      ).resolves.not.toThrow();
    });
  });

  describe('checkQuotas', () => {
    it('should return true when within quotas', async () => {
      mockTenantRepository.findOne.mockResolvedValue(mockTenant);

      const result = await service.checkQuotas(mockTenant.id, 'email');

      expect(result).toBe(true);
    });

    it('should return false when daily quota exceeded', async () => {
      const tenantWithHighUsage = {
        ...mockTenant,
        usage: {
          currentMonth: {
            notifications: 1500,
            email: 600,
          },
        },
      };
      mockTenantRepository.findOne.mockResolvedValue(tenantWithHighUsage);

      const result = await service.checkQuotas(mockTenant.id, 'email');

      expect(result).toBe(false);
    });

    it('should return true when no quotas defined', async () => {
      const tenantWithoutQuotas = { ...mockTenant, quotas: null };
      mockTenantRepository.findOne.mockResolvedValue(tenantWithoutQuotas);

      const result = await service.checkQuotas(mockTenant.id);

      expect(result).toBe(true);
    });
  });
});
