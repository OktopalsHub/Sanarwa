import { Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { EventEmitter2, OnEvent } from '@nestjs/event-emitter';
import {
  getPaginationSummary,
  IPaginatedData,
} from 'src/common/dto/pagination.dto';

import { TenantMemberRole } from '../../common/enums';
import {
  TenantCreatedEvent,
  TenantMemberCreatedEvent,
} from '../../common/events/tenant.event';
import { BaseRepository } from '../../database/repositories/base.repository';
import { Tenant } from '../tenant/entities/tenant.entity';
import {
  CreateTenantMemberDto,
  TenantMemberQueryDto,
  TenantMemberResponseDto,
  UpdateTenantMemberDto,
  UserTenantsQueryDto,
} from './dto';
import { TenantMember } from './entities/tenant-member.entity';
import { TENANT_MEMBER_REPO } from './tenant-member.tokens';

@Injectable()
export class TenantMemberService {
  private readonly logger = new Logger(TenantMemberService.name);

  constructor(
    @Inject(TENANT_MEMBER_REPO)
    private readonly tenantMemberRepository: BaseRepository<TenantMember>,
    private readonly eventEmitter: EventEmitter2,
  ) { }

  async createTenantMember(
    tenantId: string,
    createDto: CreateTenantMemberDto,
  ): Promise<TenantMember> {
    const savedMember = await this.tenantMemberRepository.create({
      ...createDto,
      tenant: { id: tenantId } as Tenant,
    });

    if (createDto.role !== TenantMemberRole.OWNER) {
      this.eventEmitter.emit(
        'tenant.member.created',
        new TenantMemberCreatedEvent(tenantId, savedMember.id, createDto.role),
      );
    }

    return savedMember;
  }

  async getTenantMembers(
    tenantId: string,
    query: TenantMemberQueryDto,
  ): Promise<IPaginatedData<TenantMemberResponseDto>> {
    const {
      page = 1,
      limit = 10,
      search,
      role,
      sortBy = 'createdAt',
      sortOrder = 'DESC',
    } = query;

    const queryBuilder = this.tenantMemberRepository
      .createQueryBuilder('member')
      .leftJoin('member.user', 'user')
      .select([
        'member.id',
        'member.role',
        'member.status',
        'member.createdAt',
        'member.updatedAt',
        'user.id',
        'user.email',
     'user.name',
      ])
      .where('member.tenant.id = :tenantId', { tenantId });

    // Apply filters
    if (role) {
      queryBuilder.andWhere('member.role = :role', { role });
    }

    if (search) {
      queryBuilder.andWhere(
        '(user.firstName ILIKE :search OR user.lastName ILIKE :search OR user.email ILIKE :search)',
        { search: `%${search}%` },
      );
    }

    // Apply sorting
    queryBuilder.orderBy(`member.${sortBy}`, sortOrder);

    // Apply pagination
    queryBuilder.skip((page - 1) * limit).take(limit);

    const [members, total] = await queryBuilder.getManyAndCount();

    // Transform to response DTOs
    const transformedMembers = members.map((member) =>
      this.transformMemberResponse(member),
    );

    return getPaginationSummary(
      transformedMembers,
      total,
      { page, limit },
      'Tenant Members',
    );
  }

  async getTenantMemberById(
    tenantId: string,
    id: string,
  ): Promise<TenantMemberResponseDto> {
    const queryBuilder = this.tenantMemberRepository
      .createQueryBuilder('member')
      .leftJoin('member.user', 'user')
      .leftJoin('member.tenant', 'tenant')
      .select([
        'member.id',
        'member.role',
        'member.status',
        'member.createdAt',
        'member.updatedAt',
        'user.id',
        'user.email',
     'user.name',
        'tenant.id',
        'tenant.name',
        'tenant.subdomain',
      ])
      .where('member.id = :id', { id })
      .andWhere('member.tenant.id = :tenantId', { tenantId });

    const member = await queryBuilder.getOne();

    if (!member) {
      throw new NotFoundException(`Tenant member with ID ${id} not found`);
    }

    return this.transformMemberResponse(member, true);
  }

  async updateTenantMember(
    tenantId: string,
    id: string,
    updateDto: UpdateTenantMemberDto,
  ): Promise<TenantMember> {
    const member = await this.tenantMemberRepository.findOne({
      where: { id, tenant: { id: tenantId } },
    });

    if (!member) {
      throw new NotFoundException(`Tenant member with ID ${id} not found`);
    }

    Object.assign(member, updateDto);

    const updatedMember = await this.tenantMemberRepository.update(member.id, updateDto);
    return updatedMember || member;
  }

  async removeTenantMember(tenantId: string, id: string): Promise<void> {
    const member = await this.tenantMemberRepository.findOne({
      where: { id, tenant: { id: tenantId } },
    });

    if (!member) {
      throw new NotFoundException(`Tenant member with ID ${id} not found`);
    }

    await this.tenantMemberRepository.delete(member.id);
  }

  async getMemberByUserId(
    tenantId: string,
    userId: string,
  ): Promise<TenantMember | null> {
    return this.tenantMemberRepository.findOne({
      where: { tenant: { id: tenantId }, user: { id: userId } },
      relations: ['user', 'tenant'],
    });
  }

  async findByUserEmail(
    tenantId: string,
    email: string,
  ): Promise<TenantMember | null> {
    return this.tenantMemberRepository.findOne({
      where: { tenant: { id: tenantId }, user: { email } },
      relations: ['user', 'tenant'],
    });
  }

  async getUserTenants(userId: string): Promise<TenantMemberResponseDto[]> {
    const queryBuilder = this.tenantMemberRepository
      .createQueryBuilder('member')
      .leftJoin('member.user', 'user')
      .leftJoin('member.tenant', 'tenant')
      .select([
        'member.id',
        'member.role',
        'member.status',
        'member.createdAt',
        'member.updatedAt',
        'user.id',
        'user.email',
     'user.name',
        'tenant.id',
        'tenant.name',
        'tenant.subdomain',
        'tenant.status',
        'tenant.createdAt',
      ])
      .where('member.user.id = :userId', { userId })
      .orderBy('member.createdAt', 'DESC');

    const members = await queryBuilder.getMany();

    return members.map((member) => this.transformUserTenantResponse(member));
  }

  async getUserTenantsPaginated(
    userId: string,
    query: UserTenantsQueryDto,
  ): Promise<IPaginatedData<TenantMemberResponseDto>> {
    const {
      page = 1,
      limit = 10,
      search,
      role,
      sortBy = 'createdAt',
      sortOrder = 'DESC',
    } = query;

    const queryBuilder = this.tenantMemberRepository
      .createQueryBuilder('member')
      .leftJoin('member.user', 'user')
      .leftJoin('member.tenant', 'tenant')
      .select([
        'member.id',
        'member.role',
        'member.status',
        'member.createdAt',
        'user.id',
        'user.email',
        'tenant.id',
        'tenant.name',
      ])
      .where('member.user.id = :userId', { userId });

    // Apply filters
    if (role) {
      queryBuilder.andWhere('member.role = :role', { role });
    }

    if (search) {
      queryBuilder.andWhere(
        '(tenant.name ILIKE :search OR tenant.subdomain ILIKE :search)',
        { search: `%${search}%` },
      );
    }

    // Apply sorting
    let orderByField = 'member.createdAt';
    if (sortBy === 'tenantName') {
      orderByField = 'tenant.name';
    } else if (sortBy === 'role') {
      orderByField = 'member.role';
    }

    queryBuilder.orderBy(orderByField, sortOrder);

    // Apply pagination
    queryBuilder.skip((page - 1) * limit).take(limit);

    const [members, total] = await queryBuilder.getManyAndCount();

    // Transform to response DTOs
    const transformedMembers = members.map((member) =>
      this.transformUserTenantResponse(member),
    );

    return getPaginationSummary(
      transformedMembers,
      total,
      { page, limit },
      'User Tenants',
    );
  }

  private transformUserTenantResponse(member: any): TenantMemberResponseDto {
    return {
      id: member.id,
      role: member.role,
      status: member.status,
      user: {
        id: member.user.id,
        email: member.user.email,
        name: member?.user?.name,
        image: member?.user?.image,
      },
      tenant: {
        id: member.tenant.id,
        name: member.tenant.name,
      }
    };
  }

  /**
   * Event listener for tenant creation
   * Automatically creates the tenant owner membership
   */
  @OnEvent('tenant.created')
  async handleTenantCreated(event: TenantCreatedEvent): Promise<void> {
    try {
      await this.createTenantMember(event.tenant.id, {
        role: TenantMemberRole.OWNER,
        user: event.creator,
      });
    } catch (error) {
      // Log error but don't throw to prevent tenant creation rollback
      this.logger.error('Failed to create tenant owner membership:', error.message, {
        error: error.stack,
        tenantId: event.tenant.id,
        userId: event.creator.id
      });
    }
  }

  private transformMemberResponse(
    member: any,
    includeDetails = false,
  ): TenantMemberResponseDto {
    const response: TenantMemberResponseDto = {
      id: member.id,
      role: member.role,
      status: member.status,
      user: {
        id: member.user.id,
        email: member.user.email,
        name: member.user.name,
        image: member.user.image,
      }
    };

    if (includeDetails && member.tenant) {
      response.tenant = {
        id: member.tenant.id,
        name: member.tenant.name,
        subdomain: member.tenant.subdomain,
      };
    }

    return response;
  }
}
