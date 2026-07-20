import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import * as argon2 from 'argon2';
import * as crypto from 'crypto';
import { Repository } from 'typeorm';
import { TenantMember } from '../tenant-member/entities/tenant-member.entity';
import { Tenant } from '../tenant/entities/tenant.entity';
import { CreateApiKeyDto } from './dto/create-api-key.dto';
import {
  ApiKey,
  ApiKeyEnvironment,
  ApiKeyStatus,
} from './entities/api-key.entity';
import { ApiKeyRepository } from './api-key.repository';
import { UpdateApiKeyDto } from './dto/update-api-key.dto';

export interface ApiKeyResponse {
  id: string;
  name: string;
  key?: string; // Only returned on creation
  keyPrefix: string;
  environment: ApiKeyEnvironment;
  status: ApiKeyStatus;
  permissions: string[];
  ipWhitelist?: string[];
  expiresAt?: Date;
  lastUsedAt?: Date;
  lastUsedIp?: string;
  usageCount: number;
  rateLimitPerMinute: number;
  rateLimitPerHour: number;
  rateLimitPerDay: number;
  metadata?: Record<string, any>;
  project: {id: string, name: string};
  createdById: string;
  createdAt: Date;
  updatedAt: Date;
}

@Injectable()
export class ApiKeyService {
  constructor(private readonly apiKeyRepository: ApiKeyRepository) {}

  /**
   * Validate an API key
   */
  async validateApiKey(
    key: string,
    projectId?: string,
    ipAddress?: string,
  ): Promise<ApiKey | null> {
    if (!key) {
      return null;
    }

    const keyPrefix = key.substring(0, 8);
    const apiKey = await this.apiKeyRepository.findByKeyPrefix(keyPrefix);

    if (!apiKey) {
      return null;
    }

    // Verify key hash
    const isValidKey = await this.verifyApiKey(apiKey.keyHash, key);
    if (!isValidKey) {
      return null;
    }

    // Check if key is active
    if (!apiKey.isActive) {
      return null;
    }

    // Check IP whitelist
    if (apiKey.ipWhitelist && apiKey.ipWhitelist.length > 0 && ipAddress) {
      if (!apiKey.ipWhitelist.includes(ipAddress)) {
        return null;
      }
    }

    // Update usage statistics
    await this.apiKeyRepository.updateUsage(apiKey.id, ipAddress);

    return apiKey;
  }

  /**
   * Generate a secure project-level API key
   */
  private generateApiKey(): string {
  const part1 = crypto.randomBytes(8).toString('base64url').slice(0, 8);
  const part2 = crypto.randomBytes(18).toString('base64url').slice(0, 24);

  return `sa_${part1}_${part2}`;
}


  /**
   * Hash an API key
   */
  private async hashApiKey(key: string): Promise<string> {
    return await argon2.hash(key);
  }

  /**
   * Verify an API key against its hash
   */
  private async verifyApiKey(hash: string, key: string): Promise<boolean> {
    try {
      return await argon2.verify(hash, key);
    } catch (error) {
      return false;
    }
  }

  /**
   * Create a new API key
   */
  async createApiKey(tenantId: string, projectId: string, createdBy: string, createDto: CreateApiKeyDto): Promise<ApiKeyResponse> {
    // Check if an API key with the same name already exists in this project
    const exists = await this.apiKeyRepository.existsByNameAndProject(
      createDto.name,
      projectId,
    );

    if (exists) {
      throw new ConflictException(
        `An API key with the name "${createDto.name}" already exists in this project`,
      );
    }

    const key = this.generateApiKey();
    const keyHash = await this.hashApiKey(key);
    const keyPrefix = key.substring(0, 16); // Longer prefix for project keys

    const savedApiKey = await this.apiKeyRepository.create({
      ...createDto,
      keyHash,
      keyPrefix,
      status: ApiKeyStatus.ACTIVE,
      projectId,
      createdById: createdBy,
    });

    // Reload with relations to get project and createdBy details
    const apiKeyWithRelations = await this.apiKeyRepository.findOne({
      where: { id: savedApiKey.id },
      relations: ['project', 'createdBy'],
    });

    if (!apiKeyWithRelations) {
      throw new NotFoundException('API key not found after creation');
    }

    return {
      id: apiKeyWithRelations.id,
      name: apiKeyWithRelations.name,
      key, // Only returned on creation
      keyPrefix: apiKeyWithRelations.keyPrefix,
      environment: apiKeyWithRelations.environment,
      status: apiKeyWithRelations.status,
      permissions: apiKeyWithRelations.permissions,
      ipWhitelist: apiKeyWithRelations.ipWhitelist,
      expiresAt: apiKeyWithRelations.expiresAt,
      lastUsedAt: apiKeyWithRelations.lastUsedAt,
      lastUsedIp: apiKeyWithRelations.lastUsedIp,
      usageCount: apiKeyWithRelations.usageCount,
      rateLimitPerMinute: apiKeyWithRelations.rateLimitPerMinute,
      rateLimitPerHour: apiKeyWithRelations.rateLimitPerHour,
      rateLimitPerDay: apiKeyWithRelations.rateLimitPerDay,
      metadata: apiKeyWithRelations.metadata,
      project: {id: apiKeyWithRelations.project.id, name: apiKeyWithRelations.project.name},
      createdById: apiKeyWithRelations.createdBy.id,
      createdAt: apiKeyWithRelations.createdAt,
      updatedAt: apiKeyWithRelations.updatedAt
    };
  }

  /**
   * Get API keys for a tenant (through projects)
   */
  async getApiKeys(
    tenantId: string,
    projectId: string,
  ): Promise<ApiKeyResponse[]> {
    const apiKeys = await this.apiKeyRepository.findByTenantId(
      tenantId,
      projectId,
    );

    return apiKeys.map((apiKey) => ({
      id: apiKey.id,
      name: apiKey.name,
      keyPrefix: apiKey.keyPrefix,
      environment: apiKey.environment,
      status: apiKey.status,
      permissions: apiKey.permissions,
      ipWhitelist: apiKey.ipWhitelist,
      expiresAt: apiKey.expiresAt,
      lastUsedAt: apiKey.lastUsedAt,
      lastUsedIp: apiKey.lastUsedIp,
      usageCount: apiKey.usageCount,
      rateLimitPerMinute: apiKey.rateLimitPerMinute,
      rateLimitPerHour: apiKey.rateLimitPerHour,
      rateLimitPerDay: apiKey.rateLimitPerDay,
      metadata: apiKey.metadata,
      project: {id: apiKey.project.id, name: apiKey.project.name},
      createdById: apiKey.createdBy.id,
      createdAt: apiKey.createdAt,
      updatedAt: apiKey.updatedAt
    }));
  }

  /**
   * Update an API key
   */
  async updateApiKey(
    id: string,
    tenantId: string,
    projectId: string,
    updateData: UpdateApiKeyDto,
  ): Promise<ApiKeyResponse> {
    const apiKey = await this.apiKeyRepository.findByIdAndTenant(id, tenantId, projectId);

    if (!apiKey) {
      throw new NotFoundException('API key not found');
    }

    // Check if updating the name would create a duplicate
    if (updateData.name && updateData.name !== apiKey.name) {
      const exists = await this.apiKeyRepository.existsByNameAndProject(
        updateData.name,
        projectId,
        id,
      );

      if (exists) {
        throw new ConflictException(
          `An API key with the name "${updateData.name}" already exists in this project`,
        );
      }
    }

    const updatedApiKey = await this.apiKeyRepository.update(id, updateData);

    if (!updatedApiKey) {
      throw new NotFoundException('API key not found');
    }

    return {
      id: updatedApiKey.id,
      name: updatedApiKey.name,
      keyPrefix: updatedApiKey.keyPrefix,
      environment: updatedApiKey.environment,
      status: updatedApiKey.status,
      permissions: updatedApiKey.permissions,
      ipWhitelist: updatedApiKey.ipWhitelist,
      expiresAt: updatedApiKey.expiresAt,
      lastUsedAt: updatedApiKey.lastUsedAt,
      lastUsedIp: updatedApiKey.lastUsedIp,
      usageCount: updatedApiKey.usageCount,
      rateLimitPerMinute: updatedApiKey.rateLimitPerMinute,
      rateLimitPerHour: updatedApiKey.rateLimitPerHour,
      rateLimitPerDay: updatedApiKey.rateLimitPerDay,
      metadata: updatedApiKey.metadata,
      project: {id: updatedApiKey.project.id, name: updatedApiKey.project.name},
      createdById: updatedApiKey.createdBy.id,
      createdAt: updatedApiKey.createdAt,
      updatedAt: updatedApiKey.updatedAt
    };
  }

  /**
   * Revoke an API key
   */
  async revokeApiKey(id: string, tenantId: string, projectId: string): Promise<void> {
    const apiKey = await this.apiKeyRepository.findByIdAndTenant(id, tenantId, projectId);

    if (!apiKey) {
      throw new NotFoundException('API key not found');
    }

    await this.apiKeyRepository.update(id, {
      status: ApiKeyStatus.REVOKED,
    });
  }
}
