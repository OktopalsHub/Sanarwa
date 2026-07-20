import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import * as crypto from 'crypto';
import {
  IPaginatedData,
  getPaginationSummary,
} from '../../common/dto/pagination.dto';
import { TenantStatus } from '../../common/enums';
import { TenantCreatedEvent } from '../../common/events/tenant.event';
import { UserService } from '../user/user.service';
import { CreateTenantDto } from './dto/create-tenant.dto';
import { TenantQueryDto } from './dto/tenant-query.dto';
import { UpdateTenantDto } from './dto/update-tenant.dto';
import { Tenant } from './entities/tenant.entity';
import { TenantRepository } from './tenant.repository';

@Injectable()
export class TenantService {
  constructor(
    private readonly tenantRepository: TenantRepository,
    private readonly userService: UserService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  /**
   * Create a new tenant
   */
  async createTenant(
    creatorId: string,
    createTenantDto: CreateTenantDto,
  ): Promise<any> {
    // Provide default name if not provided
    const tenantName = createTenantDto?.name?.trim() || 'My Workspace';
    const [user, generatedSlug] = await Promise.all([
      this.userService.getUserById(creatorId),
      this.generateSlug(tenantName),
    ]);

    const existingTenant = await this.tenantRepository.findOne({
      where: [{  subdomain: generatedSlug }],
    });

    if (existingTenant) {
      throw new ConflictException(
        'Tenant with subdomain already exists',
      );
    }

    // Create tenant with default quotas and invite code if not provided
    const savedTenant = await this.tenantRepository.create({
      ...createTenantDto,
      name: tenantName,
      quotas: this.getDefaultQuotas() as any,
      inviteCode: this.generateInviteCode(),
      subdomain: generatedSlug,
      status: TenantStatus.ACTIVE,
      ownerId: creatorId, // Set the user who created this tenant
    });

    // Emit event for tenant creation - this will trigger tenant member creation
    this.eventEmitter.emit(
      'tenant.created',
      new TenantCreatedEvent(savedTenant, user),
    );

    return this.sanitizeTenant(savedTenant);
  }

  /**
   * Find all tenants with optional filtering
   */
  async getTenants(
    query: TenantQueryDto,
  ): Promise<IPaginatedData<Partial<Tenant>>> {
    const queryBuilder = this.tenantRepository
      .createQueryBuilder('tenant')
      .select([
        'tenant.id',
        'tenant.name',
        'tenant.subdomain',
        'tenant.inviteCode',
        'tenant.status',
      ]);

    // Apply filters
    if (query.status) {
      queryBuilder.andWhere('tenant.status = :status', {
        status: query.status,
      });
    }

    if (query.search) {
      queryBuilder.andWhere(
        '(tenant.name ILIKE :search OR tenant.subdomain ILIKE :search)',
        { search: `%${query.search}%` },
      );
    }

    // Apply sorting
    const sortField = query.sortBy || 'createdAt';
    const sortOrder = query.sortOrder || 'DESC';
    queryBuilder.orderBy(`tenant.${sortField}`, sortOrder);

    // Apply pagination
    const page = query.page || 1;
    const limit = query.limit || 10;
    const offset = (page - 1) * limit;

    queryBuilder.skip(offset).take(limit);

    const [tenants, total] = await queryBuilder.getManyAndCount();

    // Transform to only include necessary fields
    const sanitizedTenants = tenants.map((tenant) => ({
      id: tenant.id,
      name: tenant.name,
      subdomain: tenant.subdomain,
      inviteCode: tenant.inviteCode,
      status: tenant.status,
    }));

    return getPaginationSummary(
      sanitizedTenants,
      total,
      { page, limit },
      'tenants',
    );
  }

  /**
   * Find tenant by ID
   */
  async getTenantById(id: string): Promise<any> {
    const tenant = await this.tenantRepository.findById(id, false);

    if (!tenant) {
      throw new NotFoundException('Tenant not found');
    }

    return this.sanitizeTenant(tenant);
  }

  /**
   * Update tenant
   */
  async updateTenant(
    id: string,
    updateTenantDto: UpdateTenantDto,
  ): Promise<any> {
    await this.getTenantById(id);

    // Check for conflicts if updating name or subdomain
    if (updateTenantDto.name || updateTenantDto.subdomain) {
      const tenant = this.tenantRepository
        .createQueryBuilder('tenant')
        .where('tenant.id != :id', { id });

      if (updateTenantDto.name) {
        tenant.andWhere('tenant.name = :name', {
          name: updateTenantDto.name,
        });
      }

      if (updateTenantDto.subdomain) {
        tenant.andWhere('tenant.subdomain = :subdomain', {
          subdomain: updateTenantDto.subdomain,
        });
      }

      const conflictingTenant = await tenant.getOne();
      if (conflictingTenant) {
        throw new ConflictException(
          'Tenant with this name or subdomain already exists',
        );
      }
    }

    await this.tenantRepository.update(id, updateTenantDto);

    return this.getTenantById(id);
  }

  /**
   * Suspend tenant (soft delete)
   */
  async suspendTenant(id: string): Promise<any> {
    await this.tenantRepository.update(id, {
      status: TenantStatus.SUSPENDED,
    });

    return this.getTenantById(id);
  }

  /**
   * Activate suspended tenant
   */
  async activateTenant(id: string): Promise<any> {
    await this.tenantRepository.update(id, {
      status: TenantStatus.ACTIVE,
    });

    return this.getTenantById(id);
  }

  /**
   * Delete tenant (hard delete)
   */
  async removeTenant(id: string): Promise<void> {
    await this.getTenantById(id);
    await this.tenantRepository.delete(id);
  }

  /**
   * Update tenant usage statistics
   */
  async updateUsage(
    tenantId: string,
    channel: string,
    count: number = 1,
  ): Promise<void> {
    const tenant = await this.tenantRepository.findOne({
      where: { id: tenantId },
    });

    if (!tenant) {
      return; // Silently fail for non-existent tenants
    }

    const currentUsage = tenant.usage || { currentMonth: {} };
    const currentMonth = currentUsage.currentMonth || {};

    // Update total notifications count
    currentMonth.notifications = (currentMonth.notifications || 0) + count;

    // Update channel-specific count
    if (
      channel &&
      ['email', 'sms', 'push', 'whatsapp', 'inApp'].includes(channel)
    ) {
      currentMonth[channel] = (currentMonth[channel] || 0) + count;
    }

    await this.tenantRepository.update(tenantId, {
      usage: {
        ...currentUsage,
        currentMonth,
        lastUpdated: new Date(),
      },
    });
  }

  /**
   * Check if tenant has exceeded quotas
   */
  async checkQuotas(tenantId: string, channel?: string): Promise<boolean> {
    const tenant = await this.tenantRepository.findOne({
      where: { id: tenantId },
    });

    if (!tenant || !tenant.quotas) {
      return true; // Allow if no quotas defined
    }

    const usage = tenant.usage?.currentMonth || {};
    const quotas = tenant.quotas;

    // Check total notification quota
    if (
      quotas.notifications?.total &&
      quotas.notifications.total !== -1 && // -1 means unlimited
      (usage.notifications || 0) >= quotas.notifications.total
    ) {
      return false;
    }

    // Check channel-specific quotas
    if (channel && quotas.channels?.[channel]) {
      const channelUsage = usage[channel] || 0;
      const channelQuotas = quotas.channels[channel];

      if (
        channelQuotas.total &&
        channelQuotas.total !== -1 && // -1 means unlimited
        channelUsage >= channelQuotas.total
      ) {
        return false;
      }
    }

    return true;
  }

  /**
   * Get default quotas for new tenants
   */
  private getDefaultQuotas() {
    return {
      notifications: {
        total: -1, // unlimited
      },
      channels: {
        email: {
          total: 1000,
        },
        sms: {
          total: 10,
        },
        push: {
          total: 1000,
        },
        whatsapp: {
          total: 10,
        },
        inApp: {
          total: 1000,
        },
        voice: {
          total: 5, // in minutes
        },
      },
      templates: {
        // No limits on templates
      },
      providers: {
        total: 6, // email, sms, push, whatsapp, in-app, voice
      },
    };
  }

  /**
   * Generate invite code
   */
  private generateInviteCode(): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = '';
    for (let i = 0; i < 6; i++) {
      const randomIndex = crypto.randomInt(0, chars.length);
      result += chars[randomIndex];
    }
    return result;
  }

  /**
   * Remove sensitive data from tenant object
   */
  private sanitizeTenant(tenant: Tenant): any {
    return {
      id: tenant.id,
      name: tenant.name,
      subdomain: tenant.subdomain,
      inviteCode: tenant.inviteCode,
      status: tenant.status,
    };
  }

  private async generateSlug(slug: string): Promise<string> {
    const baseSlug = this.slugify(slug);

    const existingSlugs =
      await this.tenantRepository.findSlugsStartingWith(baseSlug);

    if (!existingSlugs.length) {
      return baseSlug;
    }

    const numbers = existingSlugs
      .map((slug) => slug.replace(`${baseSlug}-`, '')) // Remove base part
      .map((num) => parseInt(num, 10)) // Convert to integer
      .filter((num) => !isNaN(num)) // Filter out NaN values
      .toSorted((a, b) => a - b); // Sort numerically

    // Determine the next available number
    const nextNumber = numbers.length ? numbers[numbers.length - 1] + 1 : 1;

    return `${baseSlug}-${nextNumber}`;
  }

  private slugify(value: string) {
    return value
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');
  }
}
