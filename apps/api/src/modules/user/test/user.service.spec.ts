import { Test, TestingModule } from '@nestjs/testing';
import { UserService } from '../user.service';
import { UserRepository } from '../user.repository';
import { User } from '../entities/user.entity';
import { UpdateUserDto } from '../dto/update-user.dto';
import { UserQueryDto } from '../dto/user-query.dto';
import type { Mocked } from 'vitest';

describe('UserService', () => {
  let service: UserService;
  let userRepository: Mocked<UserRepository>;

  beforeEach(async () => {
    const mockUserRepository = {
      findById: vi.fn(),
      findByEmail: vi.fn(),
      findAll: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      findByTenant: vi.fn(),
      search: vi.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UserService,
        {
          provide: UserRepository,
          useValue: mockUserRepository,
        },
      ],
    }).compile();

    service = module.get<UserService>(UserService);
    userRepository = module.get(UserRepository);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('findById', () => {
    it('should return user by id', async () => {
      const mockUser = {
        id: '1',
        email: 'test@example.com',
        firstName: 'John',
        lastName: 'Doe',
        tenantId: 'tenant-1',
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      userRepository.findById.mockResolvedValue(mockUser as User);

      const result = await service.findById('1');

      expect(result).toEqual(mockUser);
      expect(userRepository.findById).toHaveBeenCalledWith('1');
    });

    it('should throw error if user not found', async () => {
      userRepository.findById.mockResolvedValue(null);

      await expect(service.findById('999')).rejects.toThrow('User not found');
    });
  });

  describe('findByEmail', () => {
    it('should return user by email', async () => {
      const mockUser = {
        id: '1',
        email: 'test@example.com',
        firstName: 'John',
        lastName: 'Doe',
        tenantId: 'tenant-1',
        isActive: true,
      };

      userRepository.findByEmail.mockResolvedValue(mockUser as User);

      const result = await service.findByEmail('test@example.com');

      expect(result).toEqual(mockUser);
      expect(userRepository.findByEmail).toHaveBeenCalledWith('test@example.com');
    });
  });

  describe('create', () => {
    it('should create new user', async () => {
      const createUserDto = {
        email: 'newuser@example.com',
        firstName: 'Jane',
        lastName: 'Smith',
        tenantId: 'tenant-1',
      };

      const mockCreatedUser = {
        id: '2',
        ...createUserDto,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      userRepository.create.mockResolvedValue(mockCreatedUser as User);

      const result = await service.create(createUserDto);

      expect(result).toEqual(mockCreatedUser);
      expect(userRepository.create).toHaveBeenCalledWith(createUserDto);
    });

    it('should throw error if email already exists', async () => {
      const createUserDto = {
        email: 'existing@example.com',
        firstName: 'Jane',
        lastName: 'Smith',
        tenantId: 'tenant-1',
      };

      userRepository.findByEmail.mockResolvedValue({} as User);

      await expect(service.create(createUserDto)).rejects.toThrow('User with this email already exists');
    });
  });

  describe('update', () => {
    it('should update user', async () => {
      const updateDto: UpdateUserDto = {
        firstName: 'Updated',
        lastName: 'Name',
      };

      const mockUpdatedUser = {
        id: '1',
        email: 'test@example.com',
        firstName: 'Updated',
        lastName: 'Name',
        tenantId: 'tenant-1',
        isActive: true,
        updatedAt: new Date(),
      };

      userRepository.update.mockResolvedValue(mockUpdatedUser as User);

      const result = await service.update('1', updateDto);

      expect(result).toEqual(mockUpdatedUser);
      expect(userRepository.update).toHaveBeenCalledWith('1', updateDto);
    });
  });

  describe('findByTenant', () => {
    it('should return users by tenant', async () => {
      const mockUsers = [
        {
          id: '1',
          email: 'user1@example.com',
          tenantId: 'tenant-1',
        },
        {
          id: '2',
          email: 'user2@example.com',
          tenantId: 'tenant-1',
        },
      ];

      const queryDto: UserQueryDto = {
        page: 1,
        limit: 10,
      };

      userRepository.findByTenant.mockResolvedValue({
        users: mockUsers as User[],
        total: 2,
        page: 1,
        limit: 10,
      });

      const result = await service.findByTenant('tenant-1', queryDto);

      expect(result.users).toHaveLength(2);
      expect(result.total).toBe(2);
      expect(userRepository.findByTenant).toHaveBeenCalledWith('tenant-1', queryDto);
    });
  });

  describe('deactivate', () => {
    it('should deactivate user', async () => {
      const mockUser = {
        id: '1',
        isActive: false,
      };

      userRepository.update.mockResolvedValue(mockUser as User);

      const result = await service.deactivate('1');

      expect(result.isActive).toBe(false);
      expect(userRepository.update).toHaveBeenCalledWith('1', { isActive: false });
    });
  });
});