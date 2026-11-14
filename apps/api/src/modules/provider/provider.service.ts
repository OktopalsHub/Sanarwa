import { ConflictException, Injectable, Logger } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { ProviderConfigValidator } from "./provider-config-validator";
import { ProviderConfig } from "./provider-config.entity";
import { ProviderEncryptionService } from "./provider-encryption.service";

@Injectable()
export class ProviderService {
  private readonly logger = new Logger(ProviderService.name);

  constructor(
    @InjectRepository(ProviderConfig)
    private readonly providerConfigRepository: Repository<ProviderConfig>,
    private readonly configValidator: ProviderConfigValidator,
    private readonly encryptionService: ProviderEncryptionService,
  ) {}

  async validateProviderConfig(config: ProviderConfig): Promise<boolean> {
    try {
      return await this.configValidator.validate(config);
    } catch (error) {
      this.logger.error(`Provider validation failed: ${error.message}`);
      return false;
    }
  }

  async createConfig(createDto: any): Promise<ProviderConfig> {
    const existing = await this.providerConfigRepository.findOne({
      where: {
        projectId: createDto.projectId,
        providerId: createDto.providerId,
        channel: createDto.channel,
      },
    });
    if (existing) {
      throw new ConflictException(
        `${createDto.providerName ?? createDto.providerId} is already connected to this project`,
      );
    }

    const encryptedConfig = await this.encryptionService.encrypt(createDto.config);

    const providerConfig = this.providerConfigRepository.create({
      ...createDto,
      config: encryptedConfig,
    });

    const savedConfig = await this.providerConfigRepository.save(providerConfig);

    const config = Array.isArray(savedConfig) ? savedConfig[0] : savedConfig;

    const isValid = await this.validateProviderConfig(config);
    if (!isValid) {
      this.logger.warn(`Created provider config ${config.id} failed validation`);
    }

    return config;
  }

  async findAllConfigs(
    tenantId: string,
    query: any,
  ): Promise<{
    configs: ProviderConfig[];
    total: number;
    page: number;
    limit: number;
  }> {
    const queryBuilder = this.providerConfigRepository
      .createQueryBuilder("config")
      .leftJoinAndSelect("config.project", "project")
      .leftJoinAndSelect("project.tenant", "tenant");

    queryBuilder.where("project.tenantId = :tenantId", { tenantId });

    if (query.channel) {
      queryBuilder.andWhere("config.channel = :channel", {
        channel: query.channel,
      });
    }

    if (query.isActive !== undefined) {
      queryBuilder.andWhere("config.isActive = :isActive", {
        isActive: query.isActive,
      });
    }

    if (query.providerType) {
      queryBuilder.andWhere("config.providerType = :providerType", {
        providerType: query.providerType,
      });
    }

    const total = await queryBuilder.getCount();

    const page = query.page || 1;
    const limit = query.limit || 10;
    const offset = (page - 1) * limit;

    queryBuilder
      .orderBy("config.priority", "ASC")
      .addOrderBy("config.createdAt", "DESC")
      .skip(offset)
      .take(limit);

    const configs = await queryBuilder.getMany();

    const decryptedConfigs = await Promise.all(
      configs.map(async (config) => {
        const decryptedConfig = await this.encryptionService.decrypt(config.config);
        return {
          ...config,
          config: decryptedConfig,
        } as ProviderConfig;
      }),
    );

    return {
      configs: decryptedConfigs,
      total,
      page,
      limit,
    };
  }

  async findConfigsByProject(
    tenantId: string,
    projectId: string,
    query: any,
  ): Promise<{
    configs: ProviderConfig[];
    total: number;
    page: number;
    limit: number;
  }> {
    const queryBuilder = this.providerConfigRepository
      .createQueryBuilder("config")
      .leftJoinAndSelect("config.project", "project")
      .leftJoinAndSelect("project.tenant", "tenant");

    queryBuilder
      .where("project.tenantId = :tenantId", { tenantId })
      .andWhere("config.projectId = :projectId", { projectId });

    if (query.channel) {
      queryBuilder.andWhere("config.channel = :channel", {
        channel: query.channel,
      });
    }

    if (query.isActive !== undefined) {
      queryBuilder.andWhere("config.isActive = :isActive", {
        isActive: query.isActive,
      });
    }

    const total = await queryBuilder.getCount();

    const page = query.page || 1;
    const limit = query.limit || 10;
    const offset = (page - 1) * limit;

    queryBuilder
      .orderBy("config.priority", "ASC")
      .addOrderBy("config.createdAt", "DESC")
      .skip(offset)
      .take(limit);

    const configs = await queryBuilder.getMany();

    const decryptedConfigs = await Promise.all(
      configs.map(async (config) => {
        const decryptedConfig = await this.encryptionService.decrypt(config.config);
        return {
          ...config,
          config: decryptedConfig,
        } as ProviderConfig;
      }),
    );

    return {
      configs: decryptedConfigs,
      total,
      page,
      limit,
    };
  }

  async findConfigById(tenantId: string, id: string): Promise<ProviderConfig> {
    const config = await this.providerConfigRepository.findOne({
      where: { id, project: { tenant: { id: tenantId } } },
      relations: {
        project: {
          tenant: true,
        },
      },
    });

    if (!config) {
      throw new Error(`Provider configuration with ID ${id} not found`);
    }

    const decryptedConfig = await this.encryptionService.decrypt(config.config);
    return {
      ...config,
      config: decryptedConfig,
    } as ProviderConfig;
  }

  async updateConfig(tenantId: string, id: string, updateDto: any): Promise<ProviderConfig> {
    const existingConfig = await this.providerConfigRepository.findOne({
      where: { id, project: { tenant: { id: tenantId } } },
      relations: {
        project: {
          tenant: true,
        },
      },
    });

    if (!existingConfig) {
      throw new Error(`Provider configuration with ID ${id} not found`);
    }

    let encryptedConfig = updateDto.config;
    if (updateDto.config) {
      encryptedConfig = await this.encryptionService.encrypt(updateDto.config);
    }

    const updatedConfig = await this.providerConfigRepository.save({
      ...existingConfig,
      ...updateDto,
      config: encryptedConfig || existingConfig.config,
    });

    const decryptedConfig = await this.encryptionService.decrypt(updatedConfig.config);
    return {
      ...updatedConfig,
      config: decryptedConfig,
    } as ProviderConfig;
  }

  async removeConfig(tenantId: string, id: string): Promise<void> {
    const config = await this.providerConfigRepository.findOne({
      where: { id, project: { tenant: { id: tenantId } } },
      relations: {
        project: {
          tenant: true,
        },
      },
    });

    if (!config) {
      throw new Error(`Provider configuration with ID ${id} not found`);
    }

    await this.providerConfigRepository.remove(config);

    this.logger.log(`Removed provider configuration ${id} for tenant ${tenantId}`);
  }

  async activateConfig(tenantId: string, id: string): Promise<ProviderConfig> {
    const config = await this.providerConfigRepository.findOne({
      where: { id, project: { tenant: { id: tenantId } } },
      relations: {
        project: {
          tenant: true,
        },
      },
    });

    if (!config) {
      throw new Error(`Provider configuration with ID ${id} not found`);
    }

    config.isActive = true;
    const updatedConfig = await this.providerConfigRepository.save(config);

    this.logger.log(`Activated provider configuration ${id} for tenant ${tenantId}`);

    const decryptedConfig = await this.encryptionService.decrypt(updatedConfig.config);
    return {
      ...updatedConfig,
      config: decryptedConfig,
    } as ProviderConfig;
  }

  async deactivateConfig(tenantId: string, id: string): Promise<ProviderConfig> {
    const config = await this.providerConfigRepository.findOne({
      where: { id, project: { tenant: { id: tenantId } } },
      relations: {
        project: {
          tenant: true,
        },
      },
    });

    if (!config) {
      throw new Error(`Provider configuration with ID ${id} not found`);
    }

    config.isActive = false;
    const updatedConfig = await this.providerConfigRepository.save(config);

    this.logger.log(`Deactivated provider configuration ${id} for tenant ${tenantId}`);

    const decryptedConfig = await this.encryptionService.decrypt(updatedConfig.config);
    return {
      ...updatedConfig,
      config: decryptedConfig,
    } as ProviderConfig;
  }
}
