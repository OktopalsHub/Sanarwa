import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TenantFactory } from '../../test/factories/tenant.factory';
import { UserFactory } from '../../test/factories/user.factory';
import { Role } from '../role/role.entity';
import { User } from '../user/user.entity';
import { MemberStatus, TenantMember } from './tenant-member.entity';
import { TenantMemberService } from './tenant-member.service';
import { TENANT_MEMBER_REPO } from '../tenant-member.tokens';

describe('TenantMemberService', () => {
  let service: TenantMemberService;
  let tenantMemberRepository: Repository<TenantMember>;
  let userRepository: Repository<User>;
  let roleRepository: Repository<Role>;

  const mockTenantMemberRepository = {
    create: vi.fn(),
    save: vi.fn(),
    find: vi.fn(),
    findOne: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    createQueryBuilder: vi.fn(() => ({
      leftJoinAndSelect: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      andWhere: vi.fn().mockReturnThis(),
      getMany: vi.fn(),
      getOne: vi.fn(),
    })),
  };

  const mockUserRepository = {
    findOne: vi.fn(),
  };

  const mockRoleRepository = {
    findOne: vi.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TenantMemberService,
        {
          provide: TENANT_MEMBER_REPO,
          useValue: mockTenantMemberRepository,
        },
        {
          provide: getRepositoryToken(User),
          useValue: mockUserRepository,
        },
        {
          provide: getRepositoryToken(Role),
          useValue: mockRoleRepository,
        },
      ],
    }).compile();

    service = module.get<TenantMemberService>(TenantMemberService);
    tenantMemberRepository = module.get(TENANT_MEMBER_REPO);
    userRepository = module.get<Repository<User>>(getRepositoryToken(User));
    roleRepository = module.get<Repository<Role>>(getRepositoryToken(Role));
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('addMember', () => {
    it('should add a new member successfully', async () => {
      const tenant = TenantFactory.create();
      const user = UserFactory.create();
      const memberData = {
        userId: user.id,
        roleId: 'role-1',
        invitedBy: 'admin-user-id',
      };

      const mockRole = {
        id: 'role-1',
        name: 'Member',
        tenantId: tenant.id,
      };

      const mockMember = {
        id: 'member-1',
        tenantId: tenant.id,
        userId: user.id,
        roleId: 'role-1',
        status: MemberStatus.ACTIVE,
        invitedBy: memberData.invitedBy,
        invitedAt: new Date(),
        joinedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockUserRepository.findOne.mockResolvedValue(user);
      mockRoleRepository.findOne.mockResolvedValue(mockRole);
      mockTenantMemberRepository.findOne.mockResolvedValue(null); // No existing membership
      mockTenantMemberRepository.create.mockReturnValue(mockMember);
      mockTenantMemberRepository.save.mockResolvedValue(mockMember);

      const result = await service.addMember(tenant.id, memberData);

      expect(mockUserRepository.findOne).toHaveBeenCalledWith({
        where: { id: user.id },
      });
      expect(mockRoleRepository.findOne).toHaveBeenCalledWith({
        where: { id: 'role-1', tenantId: tenant.id },
      });
      expect(mockTenantMemberRepository.findOne).toHaveBeenCalledWith({
        where: { tenantId: tenant.id, userId: user.id },
      });
      expect(result).toEqual(mockMember);
    });

    it('should throw error when user not found', async () => {
      const tenant = TenantFactory.create();
      const memberData = {
        userId: 'non-existent-user',
        roleId: 'role-1',
        invitedBy: 'admin-user-id',
      };

      mockUserRepository.findOne.mockResolvedValue(null);

      await expect(service.addMember(tenant.id, memberData)).rejects.toThrow(
        'User not found',
      );
    });

    it('should throw error when role not found', async () => {
      const tenant = TenantFactory.create();
      const user = UserFactory.create();
      const memberData = {
        userId: user.id,
        roleId: 'non-existent-role',
        invitedBy: 'admin-user-id',
      };

      mockUserRepository.findOne.mockResolvedValue(user);
      mockRoleRepository.findOne.mockResolvedValue(null);

      await expect(service.addMember(tenant.id, memberData)).rejects.toThrow(
        'Role not found',
      );
    });

    it('should throw error when user is already a member', async () => {
      const tenant = TenantFactory.create();
      const user = UserFactory.create();
      const memberData = {
        userId: user.id,
        roleId: 'role-1',
        invitedBy: 'admin-user-id',
      };

      const mockRole = { id: 'role-1', name: 'Member', tenantId: tenant.id };
      const existingMember = {
        id: 'member-1',
        tenantId: tenant.id,
        userId: user.id,
      };

      mockUserRepository.findOne.mockResolvedValue(user);
      mockRoleRepository.findOne.mockResolvedValue(mockRole);
      mockTenantMemberRepository.findOne.mockResolvedValue(existingMember);

      await expect(service.addMember(tenant.id, memberData)).rejects.toThrow(
        'User is already a member of this tenant',
      );
    });
  });

  describe('getMembers', () => {
    it('should return all members for a tenant', async () => {
      const tenant = TenantFactory.create();
      const mockMembers = [
        { id: 'member-1', tenantId: tenant.id, status: MemberStatus.ACTIVE },
        { id: 'member-2', tenantId: tenant.id, status: MemberStatus.ACTIVE },
      ];

      const mockQueryBuilder = {
        leftJoinAndSelect: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        getMany: vi.fn().mockResolvedValue(mockMembers),
      };

      mockTenantMemberRepository.createQueryBuilder.mockReturnValue(
        mockQueryBuilder,
      );

      const result = await service.getMembers(tenant.id);

      expect(
        mockTenantMemberRepository.createQueryBuilder,
      ).toHaveBeenCalledWith('member');
      expect(mockQueryBuilder.leftJoinAndSelect).toHaveBeenCalledWith(
        'member.user',
        'user',
      );
      expect(mockQueryBuilder.leftJoinAndSelect).toHaveBeenCalledWith(
        'member.role',
        'role',
      );
      expect(mockQueryBuilder.where).toHaveBeenCalledWith(
        'member.tenantId = :tenantId',
        { tenantId: tenant.id },
      );
      expect(result).toEqual(mockMembers);
    });

    it('should filter members by status when provided', async () => {
      const tenant = TenantFactory.create();
      const status = MemberStatus.PENDING;
      const mockMembers = [
        { id: 'member-1', tenantId: tenant.id, status: MemberStatus.PENDING },
      ];

      const mockQueryBuilder = {
        leftJoinAndSelect: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        andWhere: vi.fn().mockReturnThis(),
        getMany: vi.fn().mockResolvedValue(mockMembers),
      };

      mockTenantMemberRepository.createQueryBuilder.mockReturnValue(
        mockQueryBuilder,
      );

      const result = await service.getMembers(tenant.id, status);

      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
        'member.status = :status',
        { status },
      );
      expect(result).toEqual(mockMembers);
    });
  });

  describe('updateMemberRole', () => {
    it('should update member role successfully', async () => {
      const tenant = TenantFactory.create();
      const memberId = 'member-1';
      const newRoleId = 'role-2';

      const existingMember = {
        id: memberId,
        tenantId: tenant.id,
        roleId: 'role-1',
        status: MemberStatus.ACTIVE,
      };

      const newRole = {
        id: newRoleId,
        name: 'Admin',
        tenantId: tenant.id,
      };

      const updatedMember = { ...existingMember, roleId: newRoleId };

      mockTenantMemberRepository.findOne.mockResolvedValue(existingMember);
      mockRoleRepository.findOne.mockResolvedValue(newRole);
      mockTenantMemberRepository.save.mockResolvedValue(updatedMember);

      const result = await service.updateMemberRole(
        tenant.id,
        memberId,
        newRoleId,
      );

      expect(mockTenantMemberRepository.findOne).toHaveBeenCalledWith({
        where: { id: memberId, tenantId: tenant.id },
      });
      expect(mockRoleRepository.findOne).toHaveBeenCalledWith({
        where: { id: newRoleId, tenantId: tenant.id },
      });
      expect(result).toEqual(updatedMember);
    });

    it('should throw error when member not found', async () => {
      const tenant = TenantFactory.create();
      const memberId = 'non-existent';
      const newRoleId = 'role-2';

      mockTenantMemberRepository.findOne.mockResolvedValue(null);

      await expect(
        service.updateMemberRole(tenant.id, memberId, newRoleId),
      ).rejects.toThrow('Member not found');
    });

    it('should throw error when new role not found', async () => {
      const tenant = TenantFactory.create();
      const memberId = 'member-1';
      const newRoleId = 'non-existent-role';

      const existingMember = {
        id: memberId,
        tenantId: tenant.id,
        roleId: 'role-1',
      };

      mockTenantMemberRepository.findOne.mockResolvedValue(existingMember);
      mockRoleRepository.findOne.mockResolvedValue(null);

      await expect(
        service.updateMemberRole(tenant.id, memberId, newRoleId),
      ).rejects.toThrow('Role not found');
    });
  });

  describe('removeMember', () => {
    it('should remove member successfully', async () => {
      const tenant = TenantFactory.create();
      const memberId = 'member-1';

      const existingMember = {
        id: memberId,
        tenantId: tenant.id,
        status: MemberStatus.ACTIVE,
      };

      mockTenantMemberRepository.findOne.mockResolvedValue(existingMember);
      mockTenantMemberRepository.delete.mockResolvedValue({ affected: 1 });

      await service.removeMember(tenant.id, memberId);

      expect(mockTenantMemberRepository.findOne).toHaveBeenCalledWith({
        where: { id: memberId, tenantId: tenant.id },
      });
      expect(mockTenantMemberRepository.delete).toHaveBeenCalledWith(memberId);
    });

    it('should throw error when member not found', async () => {
      const tenant = TenantFactory.create();
      const memberId = 'non-existent';

      mockTenantMemberRepository.findOne.mockResolvedValue(null);

      await expect(service.removeMember(tenant.id, memberId)).rejects.toThrow(
        'Member not found',
      );
    });
  });

  describe('getMemberByUser', () => {
    it('should return member for user in tenant', async () => {
      const tenant = TenantFactory.create();
      const user = UserFactory.create();

      const mockMember = {
        id: 'member-1',
        tenantId: tenant.id,
        userId: user.id,
        status: MemberStatus.ACTIVE,
      };

      const mockQueryBuilder = {
        leftJoinAndSelect: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        andWhere: vi.fn().mockReturnThis(),
        getOne: vi.fn().mockResolvedValue(mockMember),
      };

      mockTenantMemberRepository.createQueryBuilder.mockReturnValue(
        mockQueryBuilder,
      );

      const result = await service.getMemberByUser(tenant.id, user.id);

      expect(mockQueryBuilder.where).toHaveBeenCalledWith(
        'member.tenantId = :tenantId',
        { tenantId: tenant.id },
      );
      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
        'member.userId = :userId',
        { userId: user.id },
      );
      expect(result).toEqual(mockMember);
    });

    it('should return null when member not found', async () => {
      const tenant = TenantFactory.create();
      const user = UserFactory.create();

      const mockQueryBuilder = {
        leftJoinAndSelect: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        andWhere: vi.fn().mockReturnThis(),
        getOne: vi.fn().mockResolvedValue(null),
      };

      mockTenantMemberRepository.createQueryBuilder.mockReturnValue(
        mockQueryBuilder,
      );

      const result = await service.getMemberByUser(tenant.id, user.id);

      expect(result).toBeNull();
    });
  });
});
