import { Test, TestingModule } from "@nestjs/testing";
import { UserService } from "../user.service";
import { UserRepository } from "../user.repository";
import { User } from "../entities/user.entity";
import { UpdateUserDto } from "../dto/update-user.dto";
import { UserQueryDto } from "../dto/user-query.dto";
import { StructuredLoggerService } from "../../../common/logging/structured-logger.service";
import type { Mocked } from "vitest";

describe("UserService", () => {
  let service: UserService;
  let userRepository: Mocked<UserRepository>;

  beforeEach(async () => {
    const mockUserRepository = {
      findOne: vi.fn(),
      save: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      find: vi.fn(),
      findAndCount: vi.fn(),
      createQueryBuilder: vi.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UserService,
        {
          provide: UserRepository,
          useValue: mockUserRepository,
        },
        {
          provide: StructuredLoggerService,
          useValue: {
            info: vi.fn(),
            warn: vi.fn(),
            error: vi.fn(),
            debug: vi.fn(),
            logBusinessEvent: vi.fn(),
            logDatabaseQuery: vi.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<UserService>(UserService);
    userRepository = module.get(UserRepository);
  });

  it("should be defined", () => {
    expect(service).toBeDefined();
  });

  describe("findById", () => {
    it("should return user by id", async () => {
      const mockUser = {
        id: "1",
        email: "test@example.com",
        firstName: "John",
        lastName: "Doe",
        tenantId: "tenant-1",
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      userRepository.findOne.mockResolvedValue(mockUser as User);

      const result = await service.getUserById("1");

      expect(result).toEqual(mockUser);
      expect(userRepository.findOne).toHaveBeenCalledWith({ where: { id: "1" } });
    });

    it("should throw error if user not found", async () => {
      userRepository.findOne.mockResolvedValue(null);

      await expect(service.getUserById("999")).rejects.toThrow("User not found");
    });
  });

  describe("findByEmail", () => {
    it("should return user by email", async () => {
      const mockUser = {
        id: "1",
        email: "test@example.com",
        firstName: "John",
        lastName: "Doe",
        tenantId: "tenant-1",
        isActive: true,
      };

      userRepository.findOne.mockResolvedValue(mockUser as User);

      const result = await service.getByEmail("test@example.com");

      expect(result).toEqual(mockUser);
      expect(userRepository.findOne).toHaveBeenCalledWith({ where: { email: "test@example.com" } });
    });
  });

  describe("create", () => {
    it("should create new user", async () => {
      const createUserDto = {
        email: "newuser@example.com",
        firstName: "Jane",
        lastName: "Smith",
        tenantId: "tenant-1",
      };

      const mockCreatedUser = {
        id: "2",
        ...createUserDto,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      userRepository.create.mockResolvedValue(mockCreatedUser as User);

      const result = await service.createUser(createUserDto);

      expect(result).toEqual(mockCreatedUser);
      expect(userRepository.create).toHaveBeenCalledWith(createUserDto);
    });

    it("should throw error if email already exists", async () => {
      const createUserDto = {
        email: "existing@example.com",
        firstName: "Jane",
        lastName: "Smith",
        tenantId: "tenant-1",
      };

      userRepository.create.mockResolvedValue({ ...createUserDto, id: "1" } as User);

      const result = await service.createUser(createUserDto);

      expect(result.id).toBe("1");
      expect(userRepository.create).toHaveBeenCalledWith(createUserDto);
    });
  });

  describe("update", () => {
    it("should update user", async () => {
      const updateDto: UpdateUserDto = {
        firstName: "Updated",
        lastName: "Name",
      };

      const mockUpdatedUser = {
        id: "1",
        email: "test@example.com",
        firstName: "Updated",
        lastName: "Name",
        tenantId: "tenant-1",
        isActive: true,
        updatedAt: new Date(),
      };

      userRepository.update.mockResolvedValue(mockUpdatedUser as User);
      userRepository.findOne.mockResolvedValue(mockUpdatedUser as User);

      const result = await service.updateUser("1", updateDto);

      expect(result).toEqual(mockUpdatedUser);
      expect(userRepository.update).toHaveBeenCalledWith("1", updateDto);
    });
  });

  describe("findByTenant", () => {
    it("should return users by tenant", async () => {
      const mockUsers = [
        {
          id: "1",
          email: "user1@example.com",
          tenantId: "tenant-1",
        },
        {
          id: "2",
          email: "user2@example.com",
          tenantId: "tenant-1",
        },
      ];

      const queryDto: UserQueryDto = {
        page: 1,
        limit: 10,
      };

      const queryBuilder = {
        select: vi.fn().mockReturnThis(),
        andWhere: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockReturnThis(),
        skip: vi.fn().mockReturnThis(),
        take: vi.fn().mockReturnThis(),
        getManyAndCount: vi.fn().mockResolvedValue([mockUsers, 2]),
      };
      userRepository.createQueryBuilder.mockReturnValue(queryBuilder as any);

      const result = await service.getUsers(queryDto);

      expect(result.size).toBe(2);
      expect(result.totalItems).toBe(2);
    });
  });

  describe("deleteUser", () => {
    it("should delete the user", async () => {
      userRepository.delete.mockResolvedValue(undefined);

      await service.deleteUser("1");

      expect(userRepository.delete).toHaveBeenCalledWith("1");
    });
  });
});
