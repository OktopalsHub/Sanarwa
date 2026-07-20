import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { QueryDeepPartialEntity } from 'typeorm/query-builder/QueryPartialEntity';
import { EncryptionService } from '../../../common/security/services/encryption.service';
import {
  BulkConfigurationDto,
  ConfigurationQueryDto,
  CreateConfigurationDto,
  RollbackConfigurationDto,
  UpdateConfigurationDto,
} from '../dto/configuration.dto';
import {
  ConfigurationVersion,
  VersionAction,
} from '../entities/configuration-version.entity';
import {
  Configuration,
  ConfigurationScope,
  ConfigurationStatus,
} from '../entities/configuration.entity';
import {
  ConfigurationValidationService,
  ValidationResult,
} from './configuration-validation.service';

export interface ConfigurationResult {
  configuration: Configuration;
  validationResult?: ValidationResult;
}

export interface BulkOperationResult {
  successful: ConfigurationResult[];
  failed: Array<{
    configuration: CreateConfigurationDto;
    error: string;
  }>;
}

@Injectable()
export class ConfigurationService {
  private readonly logger = new Logger(ConfigurationService.name);

  constructor(
    @InjectRepository(Configuration)
    private readonly configRepository: Repository<Configuration>,
    @InjectRepository(ConfigurationVersion)
    private readonly versionRepository: Repository<ConfigurationVersion>,
    private readonly encryptionService: EncryptionService,
    private readonly validationService: ConfigurationValidationService,
    private readonly configService: ConfigService,
  ) { }

  /**
   * Create a new configuration
    */
   async create(
     dto: CreateConfigurationDto,
     memberId?: string,
   ): Promise<ConfigurationResult> {
    // Validate the configuration value
    const validationResult = await this.validationService.validateValue(
      dto.value,
      dto.validationSchema,
    );

    if (!validationResult.isValid) {
      return {
        configuration: null as any,
        validationResult,
      };
    }

    // Check if configuration already exists
    const existing = await this.findByKey(
      dto.key,
      dto.scope,
      dto.scopeId,
      dto.environment,
    );

    if (existing) {
      throw new Error(
        `Configuration with key '${dto.key}' already exists for scope '${dto.scope}' and environment '${dto.environment}'`,
      );
    }

    // Encrypt value if needed
    let value: any = dto.value;
    if (dto.isEncrypted || dto.isSecret) {
      const encryptionResult = await this.encryptionService.encrypt(dto.value);
      value = encryptionResult; // Store as object, not stringified JSON
    }

    // Create configuration
    const configuration = this.configRepository.create({
      key: dto.key,
      value,
      tenantId:
        dto.scope === ConfigurationScope.TENANT && dto.scopeId
          ? dto.scopeId
          : '00000000-0000-0000-0000-000000000000', // Use a default UUID for global configs
      configType: dto.scope || 'general',
      description: dto.description,
      isEncrypted: dto.isEncrypted || false,
      isSystem: false,
      isActive: true,
      validationSchema: dto.validationSchema,
      createdBy: memberId ? { id: memberId } : undefined,
    });

    const saved = await this.configRepository.save(configuration);

    // Create version record
    await this.createVersionRecord(
      saved.id,
      1,
      null,
      dto.value,
      VersionAction.CREATE,
      dto.changeReason,
      memberId,
    );

    this.logger.log(`Created configuration: ${dto.key}`);

    return {
      configuration: saved,
      validationResult,
    };
  }

  /**
   * Update an existing configuration
    */
   async update(
     id: string,
     dto: UpdateConfigurationDto,
     memberId?: string,
   ): Promise<ConfigurationResult> {
    const configuration = await this.configRepository.findOne({
      where: { id },
    });

    if (!configuration) {
      throw new NotFoundException(`Configuration with ID '${id}' not found`);
    }

    // Validate new value if provided
    let validationResult: ValidationResult = { isValid: true };
    if (dto.value) {
      validationResult = await this.validationService.validateValue(
        dto.value,
        dto.validationSchema || configuration.validationSchema,
      );

      if (!validationResult.isValid) {
        return {
          configuration,
          validationResult,
        };
      }
    }

    const previousValue =
      configuration.isEncrypted || configuration.isSecret
        ? await this.encryptionService.decrypt(configuration.value)
        : configuration.value;

    // Encrypt new value if needed
    let newValue: any = dto.value;
    if (
      newValue &&
      (dto.isEncrypted ||
        configuration.isEncrypted ||
        dto.isSecret ||
        configuration.isSecret)
    ) {
      const encryptionResult = await this.encryptionService.encrypt(dto.value!);
      newValue = encryptionResult; // Store as object, not stringified JSON
    }

    // Update configuration
    const updateData: Partial<Configuration> = {};

    if (dto.value !== undefined) {
      updateData.value = newValue;
    }
    if (dto.description !== undefined) {
      updateData.description = dto.description;
    }
    if (dto.isEncrypted !== undefined) {
      updateData.isEncrypted = dto.isEncrypted;
    }
    if (dto.isSecret !== undefined) {
      updateData.isEncrypted = dto.isSecret; // Map isSecret to isEncrypted
    }
    if (dto.status !== undefined) {
      updateData.isActive = dto.status === ConfigurationStatus.ACTIVE;
    }
    if (dto.validationSchema !== undefined) {
      updateData.validationSchema = dto.validationSchema;
    }

    if (newValue) {
      updateData.value = newValue;
    }

    await this.configRepository.update(
      id,
      updateData as QueryDeepPartialEntity<Configuration>,
    );

    // Get latest version number
    const latestVersion = await this.getLatestVersion(id);
    const nextVersion = latestVersion ? latestVersion.version + 1 : 1;

    // Create version record if value changed
    if (dto.value && dto.value !== previousValue) {
      await this.createVersionRecord(
        id,
        nextVersion,
        previousValue,
        dto.value,
        VersionAction.UPDATE,
        dto.changeReason,
        memberId,
      );
    }

    const updated = await this.configRepository.findOne({ where: { id } });

    if (!updated) {
      throw new Error(`Configuration with id ${id} not found after update`);
    }

    this.logger.log(`Updated configuration: ${configuration.key}`);

    return {
      configuration: updated,
      validationResult,
    };
  }

  /**
   * Find configurations by query
   */
  async find(query: ConfigurationQueryDto): Promise<Configuration[]> {
    const queryBuilder = this.configRepository.createQueryBuilder('config');

    if (query.key) {
      queryBuilder.andWhere('config.key ILIKE :key', { key: `%${query.key}%` });
    }

    if (query.scope) {
      queryBuilder.andWhere('config.scope = :scope', { scope: query.scope });
    }

    if (query.scopeId) {
      queryBuilder.andWhere('config.scopeId = :scopeId', {
        scopeId: query.scopeId,
      });
    }

    if (query.environment) {
      queryBuilder.andWhere('config.environment = :environment', {
        environment: query.environment,
      });
    }

    if (query.status) {
      queryBuilder.andWhere('config.status = :status', {
        status: query.status,
      });
    }

    if (!query.includeSecrets) {
      queryBuilder.andWhere('config.isSecret = :isSecret', { isSecret: false });
    }

    queryBuilder.orderBy('config.key', 'ASC');

    return queryBuilder.getMany();
  }

  /**
   * Get configuration by ID
   */
  async findById(id: string, includeSecrets = false): Promise<Configuration> {
    const queryBuilder = this.configRepository
      .createQueryBuilder('config')
      .where('config.id = :id', { id });

    if (!includeSecrets) {
      queryBuilder.andWhere('config.isSecret = :isSecret', { isSecret: false });
    }

    const configuration = await queryBuilder.getOne();

    if (!configuration) {
      throw new NotFoundException(`Configuration with ID '${id}' not found`);
    }

    return configuration;
  }

  /**
   * Get configuration value (decrypted if needed)
   */
  async getValue(
    key: string,
    scope: ConfigurationScope = ConfigurationScope.GLOBAL,
    scopeId?: string,
    environment?: string,
  ): Promise<string | null> {
    const config = await this.findByKey(key, scope, scopeId, environment);

    if (!config || config.status !== ConfigurationStatus.ACTIVE) {
      return null;
    }

    if (config.isEncrypted || config.isSecret) {
      return this.encryptionService.decrypt(JSON.parse(config.value));
    }

    return config.value;
  }

  /**
   * Get multiple configuration values
   */
  async getValues(
    keys: string[],
    scope: ConfigurationScope = ConfigurationScope.GLOBAL,
    scopeId?: string,
    environment?: string,
  ): Promise<Record<string, string>> {
    const queryBuilder = this.configRepository
      .createQueryBuilder('config')
      .where('config.scope = :scope', { scope })
      .andWhere('config.status = :status', {
        status: ConfigurationStatus.ACTIVE,
      });

    if (keys.length > 0) {
      queryBuilder.andWhere('config.key IN (:...keys)', { keys });
    }

    if (scopeId !== undefined) {
      queryBuilder.andWhere('config.scopeId = :scopeId', { scopeId });
    } else {
      queryBuilder.andWhere('config.scopeId IS NULL');
    }

    if (environment) {
      queryBuilder.andWhere('config.environment = :environment', {
        environment,
      });
    }

    const configurations = await queryBuilder.getMany();

    const result: Record<string, string> = {};

    for (const config of configurations) {
      if (config.isEncrypted || config.isSecret) {
        result[config.key] = await this.encryptionService.decrypt(
          JSON.parse(config.value),
        );
      } else {
        result[config.key] = config.value;
      }
    }

    return result;
  }

  /**
   * Delete configuration
    */
   async delete(id: string, memberId?: string): Promise<void> {
    const configuration = await this.findById(id);

    // Create version record for deletion
    const latestVersion = await this.getLatestVersion(id);
    const nextVersion = latestVersion ? latestVersion.version + 1 : 1;

    const previousValue =
      configuration.isEncrypted || configuration.isSecret
        ? await this.encryptionService.decrypt(configuration.value)
        : configuration.value;

    await this.createVersionRecord(
      id,
      nextVersion,
      previousValue,
      '',
      VersionAction.DELETE,
      'Configuration deleted',
      memberId,
    );

    await this.configRepository.delete(id);

    this.logger.log(`Deleted configuration: ${configuration.key}`);
  }

  /**
   * Rollback configuration to a previous version
    */
   async rollback(
     id: string,
     dto: RollbackConfigurationDto,
     memberId?: string,
   ): Promise<Configuration> {
    const configuration = await this.findById(id);
    const version = await this.versionRepository.findOne({
      where: { id: dto.versionId },
    });

    if (!version) {
      throw new NotFoundException(
        `Version with ID '${dto.versionId}' not found`,
      );
    }

    if (version.configurationId !== id) {
      throw new Error('Version does not belong to this configuration');
    }

    // Get current value for version record
    const currentValue =
      configuration.isEncrypted || configuration.isSecret
        ? await this.encryptionService.decrypt(configuration.value)
        : configuration.value;

    // Encrypt rollback value if needed
    let rollbackValue: any = version.newValue;
    if (configuration.isEncrypted || configuration.isSecret) {
      const encryptionResult = await this.encryptionService.encrypt(
        version.newValue,
      );
      rollbackValue = encryptionResult; // Store as object, not stringified JSON
    }

    // Update configuration
    await this.configRepository.update(id, {
      value: rollbackValue,
    });

    // Create version record for rollback
    const latestVersion = await this.getLatestVersion(id);
    const nextVersion = latestVersion ? latestVersion.version + 1 : 1;

    await this.createVersionRecord(
      id,
      nextVersion,
      currentValue,
      version.newValue,
      VersionAction.ROLLBACK,
      dto.reason || `Rolled back to version ${version.version}`,
      memberId,
      { rolledBackToVersion: version.version },
    );

    const updated = await this.findById(id);

    this.logger.log(
      `Rolled back configuration '${configuration.key}' to version ${version.version}`,
    );

    return updated;
  }

  /**
   * Get configuration versions
   */
  async getVersions(configurationId: string): Promise<ConfigurationVersion[]> {
    return this.versionRepository.find({
      where: { configurationId },
      order: { version: 'DESC' },
    });
  }

  /**
   * Bulk create/update configurations
    */
   async bulkOperation(
     dto: BulkConfigurationDto,
     memberId?: string,
   ): Promise<BulkOperationResult> {
    const result: BulkOperationResult = {
      successful: [],
      failed: [],
    };

    // Validate all configurations first if requested
    if (dto.validateAll) {
      const validationResults =
        await this.validationService.validateConfigurations(
          dto.configurations.map((config) => ({
            key: config.key,
            value: config.value,
            validationSchema: config.validationSchema,
          })),
        );

      const hasValidationErrors = Object.values(validationResults).some(
        (result) => !result.isValid,
      );

      if (hasValidationErrors) {
        for (const config of dto.configurations) {
          const validationResult = validationResults[config.key];
          if (!validationResult.isValid) {
            result.failed.push({
              configuration: config,
              error: `Validation failed: ${validationResult.errors?.join(', ')}`,
            });
          }
        }
        return result;
      }
    }

    // Process each configuration
    for (const configDto of dto.configurations) {
      try {
        const existing = await this.findByKey(
          configDto.key,
          configDto.scope,
          configDto.scopeId,
          configDto.environment,
        );

        let configResult: ConfigurationResult;

        if (existing) {
           // Update existing
           configResult = await this.update(existing.id, configDto, memberId);
         } else {
           // Create new
           configResult = await this.create(configDto, memberId);
         }

        if (configResult.validationResult?.isValid !== false) {
          result.successful.push(configResult);
        } else {
          result.failed.push({
            configuration: configDto,
            error: `Validation failed: ${configResult.validationResult?.errors?.join(', ')}`,
          });
        }
      } catch (error) {
        result.failed.push({
          configuration: configDto,
          error: error.message,
        });
      }
    }

    this.logger.log(
      `Bulk operation completed: ${result.successful.length} successful, ${result.failed.length} failed`,
    );

    return result;
  }

  /**
   * Find configuration by key and scope
   */
  private async findByKey(
    key: string,
    scope: ConfigurationScope = ConfigurationScope.GLOBAL,
    scopeId?: string,
    environment?: string,
  ): Promise<Configuration | null> {
    const queryBuilder = this.configRepository
      .createQueryBuilder('config')
      .where('config.key = :key', { key })
      .andWhere('config.isActive = :isActive', { isActive: true });

    if (scope === ConfigurationScope.TENANT && scopeId) {
      queryBuilder.andWhere('config.tenantId = :tenantId', {
        tenantId: scopeId,
      });
    } else {
      // For global scope, use the default global tenant ID
      queryBuilder.andWhere('config.tenantId = :tenantId', {
        tenantId: '00000000-0000-0000-0000-000000000000',
      });
    }

    return queryBuilder.getOne();
  }

  /**
   * Create a version record
   */
  private async createVersionRecord(
    configurationId: string,
    version: number,
    previousValue: string | null,
    newValue: string,
    action: VersionAction,
    changeReason?: string,
    changedBy?: string,
    changeMetadata?: Record<string, any>,
  ): Promise<ConfigurationVersion> {
    const versionRecord = this.versionRepository.create({
      configurationId,
      version,
      previousValue: previousValue || undefined,
      newValue,
      action,
      changeReason,
      changedBy,
      changeMetadata,
    });

    return this.versionRepository.save(versionRecord);
  }

  /**
   * Get latest version for a configuration
   */
  private async getLatestVersion(
    configurationId: string,
  ): Promise<ConfigurationVersion | null> {
    return this.versionRepository.findOne({
      where: { configurationId },
      order: { version: 'DESC' },
    });
  }
}
