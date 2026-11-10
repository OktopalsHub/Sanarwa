import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { NotificationChannel } from "../../common/enums/notification-channel.enum";
import { BaseProviderPayload, IBaseProvider } from "../../providers/base/base-provider.interface";
import { ProviderFactory } from "../../providers/factory/provider-factory";
import { ProviderResponse } from "../../providers/types";
import { ProviderConfigValidator } from "./provider-config-validator";
import { ProviderConfig } from "./provider-config.entity";
import { ProviderEncryptionService } from "./provider-encryption.service";
import { ProviderPerformanceTracker } from "./provider-performance-tracker";
import { CircuitBreakerService } from "../../common/errors/services/circuit-breaker.service";

export interface ProviderSelectionOptions {
  tenantId: string;
  channel: NotificationChannel;
  country?: string;
  priority?: number;
  excludeProviders?: string[];
}

export interface ProviderSendResult {
  success: boolean;
  response?: ProviderResponse;
  error?: string;
  providerId: string;
  responseTime: number;
}

@Injectable()
export class ProviderService {
  private readonly logger = new Logger(ProviderService.name);
  private readonly providerInstances = new Map<string, IBaseProvider>();
  private readonly registeredCircuits = new Set<string>();

  constructor(
    @InjectRepository(ProviderConfig)
    private readonly providerConfigRepository: Repository<ProviderConfig>,
    private readonly providerFactory: ProviderFactory,
    private readonly performanceTracker: ProviderPerformanceTracker,
    private readonly configValidator: ProviderConfigValidator,
    private readonly encryptionService: ProviderEncryptionService,
    private readonly configService: ConfigService,
    private readonly circuitBreaker: CircuitBreakerService,
  ) {}

  async send(
    payload: BaseProviderPayload,
    options: ProviderSelectionOptions,
  ): Promise<ProviderSendResult> {
    const providers = await this.selectProviders(options);

    if (providers.length === 0) {
      throw new Error(`No available providers for channel ${options.channel}`);
    }

    let lastError: string = "";

    for (const providerConfig of providers) {
      const circuitKey = providerConfig.id;
      await this.ensureCircuit(circuitKey);

      const state = await this.circuitBreaker.getCircuitState(circuitKey);
      if (state.state === "OPEN") {
        this.logger.warn(
          `Circuit breaker open for provider ${providerConfig.providerId}, skipping`,
        );
        continue;
      }

      try {
        const startTime = Date.now();
        const provider = await this.getProviderInstance(providerConfig);

        const response = await this.circuitBreaker.execute(circuitKey, () =>
          provider.send(payload),
        );
        const responseTime = Date.now() - startTime;

        await this.recordSuccess(providerConfig, responseTime);

        return {
          success: true,
          response,
          providerId: providerConfig.providerId,
          responseTime,
        };
      } catch (error) {
        lastError = error.message;

        await this.recordFailure(providerConfig, error.message);

        this.logger.warn(
          `Provider ${providerConfig.providerId} failed: ${error.message}. Trying next provider...`,
        );
      }
    }

    throw new Error(`All providers failed. Last error: ${lastError}`);
  }

  async sendBulk(
    payloads: BaseProviderPayload[],
    options: ProviderSelectionOptions,
  ): Promise<ProviderSendResult[]> {
    const results: ProviderSendResult[] = [];

    const defaultBatch = this.configService.get<number>("PROVIDER_BULK_BATCH_SIZE", 250);
    const batchSize = options.channel === "voice" ? 10 : defaultBatch;

    for (let i = 0; i < payloads.length; i += batchSize) {
      const batch = payloads.slice(i, i + batchSize);
      const batchPromises = batch.map((payload) =>
        this.send(payload, options).catch((error) => ({
          success: false,
          error: error.message,
          providerId: "unknown",
          responseTime: 0,
        })),
      );

      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults);
    }

    return results;
  }

  async selectProviders(options: ProviderSelectionOptions): Promise<ProviderConfig[]> {
    const query = this.providerConfigRepository
      .createQueryBuilder("provider")
      .innerJoin("provider.project", "project")
      .where("project.tenantId = :tenantId", { tenantId: options.tenantId })
      .andWhere("provider.channel = :channel", { channel: options.channel })
      .andWhere("provider.isActive = :isActive", { isActive: true });

    if (options.country) {
      query.andWhere(
        "(provider.supportedCountries IS NULL OR JSON_CONTAINS(provider.supportedCountries, :country))",
        { country: JSON.stringify(options.country) },
      );
    }

    if (options.excludeProviders && options.excludeProviders.length > 0) {
      query.andWhere("provider.providerId NOT IN (:...excludeProviders)", {
        excludeProviders: options.excludeProviders,
      });
    }

    const providers = await query
      .orderBy("provider.priority", "ASC")
      .addOrderBy("provider.createdAt", "ASC")
      .getMany();

    const decryptedProviders = await Promise.all(
      providers.map(async (provider) => {
        const decryptedConfig = await this.encryptionService.decrypt(provider.config);
        return {
          ...provider,
          config: decryptedConfig,
        } as ProviderConfig;
      }),
    );

    const healthyProviders = await this.filterHealthyProviders(decryptedProviders);

    return healthyProviders;
  }

  async getAvailableProviders(
    tenantId: string,
    channel: NotificationChannel,
  ): Promise<ProviderConfig[]> {
    return this.providerConfigRepository.find({
      where: {
        project: { tenant: { id: tenantId } },
        channel,
        isActive: true,
      },
      relations: {
        project: {
          tenant: true,
        },
      },
      order: {
        priority: "ASC",
        createdAt: "ASC",
      },
    });
  }

  async validateProviderConfig(config: ProviderConfig): Promise<boolean> {
    try {
      return await this.configValidator.validate(config);
    } catch (error) {
      this.logger.error(`Provider validation failed: ${error.message}`);
      return false;
    }
  }

  async createConfig(createDto: any): Promise<ProviderConfig> {
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

    const cacheKey = this.getProviderCacheKey(updatedConfig);
    this.providerInstances.delete(cacheKey);

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

    const cacheKey = this.getProviderCacheKey(config);
    this.providerInstances.delete(cacheKey);

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

    const cacheKey = this.getProviderCacheKey(updatedConfig);
    this.providerInstances.delete(cacheKey);

    this.logger.log(`Deactivated provider configuration ${id} for tenant ${tenantId}`);

    const decryptedConfig = await this.encryptionService.decrypt(updatedConfig.config);
    return {
      ...updatedConfig,
      config: decryptedConfig,
    } as ProviderConfig;
  }

  async getProviderMetrics(providerId: string, channel: NotificationChannel): Promise<any> {
    return this.performanceTracker.getMetrics(providerId, channel);
  }

  async updateProviderConfig(
    tenantId: string,
    providerId: string,
    channel: NotificationChannel,
    config: Partial<ProviderConfig>,
  ): Promise<ProviderConfig> {
    const existingConfig = await this.providerConfigRepository.findOne({
      where: { project: { tenant: { id: tenantId } }, providerId, channel },
      relations: {
        project: {
          tenant: true,
        },
      },
    });

    if (!existingConfig) {
      throw new Error(`Provider configuration not found: ${providerId} for ${channel}`);
    }

    const update = { ...config };
    if (update.config) {
      update.config = await this.encryptionService.encrypt(update.config);
    }

    const updatedConfig = await this.providerConfigRepository.save({
      ...existingConfig,
      ...update,
    });

    const cacheKey = this.getProviderCacheKey(updatedConfig);
    this.providerInstances.delete(cacheKey);

    return updatedConfig;
  }

  async toggleProvider(
    tenantId: string,
    providerId: string,
    channel: NotificationChannel,
    isActive: boolean,
  ): Promise<void> {
    const configs = await this.providerConfigRepository.find({
      where: { project: { tenant: { id: tenantId } }, providerId, channel },
      relations: {
        project: {
          tenant: true,
        },
      },
    });

    if (configs.length === 0) {
      this.logger.warn(
        `No provider configurations found for ${providerId} (${channel}) in tenant ${tenantId}`,
      );
      return;
    }

    for (const config of configs) {
      config.isActive = isActive;
      await this.providerConfigRepository.save(config);
      this.providerInstances.delete(this.getProviderCacheKey(config));
    }

    this.logger.log(`Provider ${providerId} (${channel}) ${isActive ? "enabled" : "disabled"}`);
  }

  private async getProviderInstance(config: ProviderConfig): Promise<IBaseProvider> {
    const cacheKey = this.getProviderCacheKey(config);

    if (this.providerInstances.has(cacheKey)) {
      return this.providerInstances.get(cacheKey)!;
    }

    const providerConfig = {
      id: config.id,
      name: config.providerName,
      channel: config.channel,
      priority: config.priority,
      isActive: config.isActive,
      credentials: config.config,
      settings: config.metadata,
    };

    const provider = await this.providerFactory.createProvider(
      config.providerId,
      config.channel,
      providerConfig,
    );

    this.providerInstances.set(cacheKey, provider);

    return provider;
  }

  private async filterHealthyProviders(providers: ProviderConfig[]): Promise<ProviderConfig[]> {
    const healthyProviders: ProviderConfig[] = [];

    for (const provider of providers) {
      const circuitKey = provider.id;
      await this.ensureCircuit(circuitKey);

      const state = await this.circuitBreaker.getCircuitState(circuitKey);
      if (state.state === "OPEN") {
        continue;
      }

      const metrics = await this.performanceTracker.getMetrics(
        provider.providerId,
        provider.channel,
      );

      const minSuccessRate = this.configService.get<number>("PROVIDER_MIN_SUCCESS_RATE", 80);
      if (metrics.successRate >= minSuccessRate) {
        healthyProviders.push(provider);
      }
    }

    return healthyProviders;
  }

  private async recordSuccess(config: ProviderConfig, responseTime: number): Promise<void> {
    await this.performanceTracker.recordSuccess(config.providerId, config.channel, responseTime);
  }

  private async recordFailure(config: ProviderConfig, error: string): Promise<void> {
    await this.performanceTracker.recordFailure(config.providerId, config.channel, error);
  }

  private async ensureCircuit(serviceName: string): Promise<void> {
    if (this.registeredCircuits.has(serviceName)) {
      return;
    }

    const failureThreshold = this.configService.get<number>("CIRCUIT_BREAKER_FAILURE_THRESHOLD", 5);
    const recoveryTimeout = Math.max(
      0,
      this.configService.get<number>("CIRCUIT_BREAKER_RESET_TIMEOUT", 60000),
    );

    await this.circuitBreaker.registerCircuit(serviceName, {
      failureThreshold,
      recoveryTimeout,
    });
    this.registeredCircuits.add(serviceName);
  }

  private getProviderCacheKey(config: ProviderConfig): string {
    const tenantId = config.project?.tenant?.id ?? "unknown";
    return `${tenantId}:${config.projectId}:${config.providerId}:${config.channel}`;
  }
}
