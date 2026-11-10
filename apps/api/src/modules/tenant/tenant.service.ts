import { ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { EventEmitter2, OnEvent } from "@nestjs/event-emitter";
import * as crypto from "crypto";
import { IPaginatedData, getPaginationSummary } from "../../common/dto/pagination.dto";
import { TenantStatus } from "../../common/enums";
import { TenantCreatedEvent } from "../../common/events/tenant.event";
import { UserRegisteredEvent } from "../../common/events/user.event";
import { UserService } from "../user/user.service";
import { CreateTenantDto } from "./dto/create-tenant.dto";
import { TenantQueryDto } from "./dto/tenant-query.dto";
import { UpdateTenantDto } from "./dto/update-tenant.dto";
import { Tenant } from "./entities/tenant.entity";
import { TenantRepository } from "./tenant.repository";
import { slugify } from "../../common/utils/slugify";

@Injectable()
export class TenantService {
  constructor(
    private readonly tenantRepository: TenantRepository,
    private readonly userService: UserService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  @OnEvent("user.registered")
  async onUserRegistered(event: UserRegisteredEvent) {
    return this.createTenant(event.userId, { name: event.workspaceName });
  }

  async createTenant(creatorId: string, createTenantDto: CreateTenantDto): Promise<any> {
    const tenantName = createTenantDto?.name?.trim() || "My Workspace";
    const requestedSubdomain = createTenantDto.subdomain?.trim();
    const [user, generatedSlug] = await Promise.all([
      this.userService.getUserById(creatorId),
      requestedSubdomain ? Promise.resolve(requestedSubdomain) : this.generateSlug(tenantName),
    ]);

    const subdomain = requestedSubdomain || generatedSlug;

    const existingTenant = await this.tenantRepository.findOne({
      where: [{ subdomain }],
    });

    if (existingTenant) {
      throw new ConflictException("Tenant with subdomain already exists");
    }

    const savedTenant = await this.tenantRepository.create({
      name: tenantName,
      quotas: this.getDefaultQuotas() as any,
      inviteCode: this.generateInviteCode(),
      subdomain,
      status: TenantStatus.ACTIVE,
      ownerId: creatorId,
    });

    this.eventEmitter.emit("tenant.created", new TenantCreatedEvent(savedTenant, user));

    return this.sanitizeTenant(savedTenant);
  }

  async getTenants(query: TenantQueryDto): Promise<IPaginatedData<Partial<Tenant>>> {
    const queryBuilder = this.tenantRepository
      .createQueryBuilder("tenant")
      .select([
        "tenant.id",
        "tenant.name",
        "tenant.subdomain",
        "tenant.inviteCode",
        "tenant.status",
      ]);

    if (query.status) {
      queryBuilder.andWhere("tenant.status = :status", {
        status: query.status,
      });
    }

    if (query.search) {
      queryBuilder.andWhere("(tenant.name ILIKE :search OR tenant.subdomain ILIKE :search)", {
        search: `%${query.search}%`,
      });
    }

    const sortField = query.sortBy || "createdAt";
    const sortOrder = query.sortOrder || "DESC";
    queryBuilder.orderBy(`tenant.${sortField}`, sortOrder);

    const page = query.page || 1;
    const limit = query.limit || 10;
    const offset = (page - 1) * limit;

    queryBuilder.skip(offset).take(limit);

    const [tenants, total] = await queryBuilder.getManyAndCount();

    const sanitizedTenants = tenants.map((tenant) => ({
      id: tenant.id,
      name: tenant.name,
      subdomain: tenant.subdomain,
      inviteCode: tenant.inviteCode,
      status: tenant.status,
    }));

    return getPaginationSummary(sanitizedTenants, total, { page, limit }, "tenants");
  }

  async getTenantById(id: string): Promise<any> {
    const tenant = await this.tenantRepository.findById(id, false);

    if (!tenant) {
      throw new NotFoundException("Tenant not found");
    }

    return this.sanitizeTenant(tenant);
  }

  async updateTenant(id: string, updateTenantDto: UpdateTenantDto): Promise<any> {
    await this.getTenantById(id);

    if (updateTenantDto.name || updateTenantDto.subdomain) {
      const tenant = this.tenantRepository
        .createQueryBuilder("tenant")
        .where("tenant.id != :id", { id });

      if (updateTenantDto.name) {
        tenant.andWhere("tenant.name = :name", {
          name: updateTenantDto.name,
        });
      }

      if (updateTenantDto.subdomain) {
        tenant.andWhere("tenant.subdomain = :subdomain", {
          subdomain: updateTenantDto.subdomain,
        });
      }

      const conflictingTenant = await tenant.getOne();
      if (conflictingTenant) {
        throw new ConflictException("Tenant with this name or subdomain already exists");
      }
    }

    await this.tenantRepository.update(id, updateTenantDto);

    return this.getTenantById(id);
  }

  async suspendTenant(id: string): Promise<any> {
    await this.tenantRepository.update(id, {
      status: TenantStatus.SUSPENDED,
    });

    return this.getTenantById(id);
  }

  async activateTenant(id: string): Promise<any> {
    await this.tenantRepository.update(id, {
      status: TenantStatus.ACTIVE,
    });

    return this.getTenantById(id);
  }

  async removeTenant(id: string): Promise<void> {
    await this.getTenantById(id);
    await this.tenantRepository.delete(id);
  }

  async updateUsage(tenantId: string, channel: string, count: number = 1): Promise<void> {
    const tenant = await this.tenantRepository.findOne({
      where: { id: tenantId },
    });

    if (!tenant) {
      return;
    }

    const currentUsage = tenant.usage || { currentMonth: {} };
    const currentMonth = currentUsage.currentMonth || {};

    currentMonth.notifications = (currentMonth.notifications || 0) + count;

    if (channel && ["email", "sms", "push", "whatsapp", "inApp"].includes(channel)) {
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

  async checkQuotas(tenantId: string, channel?: string): Promise<boolean> {
    const tenant = await this.tenantRepository.findOne({
      where: { id: tenantId },
    });

    if (!tenant || !tenant.quotas) {
      return true;
    }

    const usage = tenant.usage?.currentMonth || {};
    const quotas = tenant.quotas;

    if (
      quotas.notifications?.total &&
      quotas.notifications.total !== -1 &&
      (usage.notifications || 0) >= quotas.notifications.total
    ) {
      return false;
    }

    if (channel && quotas.channels?.[channel]) {
      const channelUsage = usage[channel] || 0;
      const channelQuotas = quotas.channels[channel];

      if (
        channelQuotas.total &&
        channelQuotas.total !== -1 &&
        channelUsage >= channelQuotas.total
      ) {
        return false;
      }
    }

    return true;
  }

  private getDefaultQuotas() {
    return {
      notifications: {
        total: -1,
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
          total: 5,
        },
      },
      templates: {},
      providers: {
        total: 6,
      },
    };
  }

  private generateInviteCode(): string {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    let result = "";
    for (let i = 0; i < 6; i++) {
      const randomIndex = crypto.randomInt(0, chars.length);
      result += chars[randomIndex];
    }
    return result;
  }

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
    const baseSlug = slugify(slug);

    const existingSlugs = await this.tenantRepository.findSlugsStartingWith(baseSlug);

    if (!existingSlugs.length) {
      return baseSlug;
    }

    const numbers = existingSlugs
      .map((slug) => slug.replace(`${baseSlug}-`, ""))
      .map((num) => parseInt(num, 10))
      .filter((num) => !isNaN(num))
      .toSorted((a, b) => a - b);

    const nextNumber = numbers.length ? numbers[numbers.length - 1] + 1 : 1;

    return `${baseSlug}-${nextNumber}`;
  }
}
