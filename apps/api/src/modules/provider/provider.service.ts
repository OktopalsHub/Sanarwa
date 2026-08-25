import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { NotificationChannel } from "../../common/enums/notification-channel.enum";
import { BaseProviderPayload, IBaseProvider } from "../../providers/base/base-provider.interface";
import { ProviderFactory } from "../../providers/factory/provider-factory";
import { ProviderHealthMonitor } from "../../providers/health/provider-health-monitor";
import { Channel, ProviderHealth, ProviderResponse } from "../../providers/types";
import { ProviderConfigValidator } from "./provider-config-validator";
import { ProviderConfig } from "./provider-config.entity";
import { ProviderEncryptionService } from "./provider-encryption.service";
import { ProviderPerformanceTracker } from "./provider-performance-tracker";

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
  private readonly circuitBreakers = new Map<string, CircuitBreaker>();

  constructor(
    @InjectRepository(ProviderConfig)
    private readonly providerConfigRepository: Repository<ProviderConfig>,
    private readonly providerFactory: ProviderFactory,
    private readonly healthMonitor: ProviderHealthMonitor,
    private readonly performanceTracker: ProviderPerformanceTracker,
    private readonly configValidator: ProviderConfigValidator,
    private readonly encryptionService: ProviderEncryptionService,
    private readonly configService: ConfigService,
  ) {}

  /**
   * Send notification with automatic provider selection and failover
   */
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
      const circuitBreaker = this.getCircuitBreaker(providerConfig.id);

      // Skip if circuit breaker is open
      if (circuitBreaker.isOpen()) {
        this.logger.warn(
          `Circuit breaker open for provider ${providerConfig.providerId}, skipping`,
        );
        continue;
      }

      try {
        const startTime = Date.now();
        const provider = await this.getProviderInstance(providerConfig);

        const response = await provider.send(payload);
        const responseTime = Date.now() - startTime;

        // Record success
        await this.recordSuccess(providerConfig, responseTime);
        circuitBreaker.recordSuccess();

        return {
          success: true,
          response,
          providerId: providerConfig.providerId,
          responseTime,
        };
      } catch (error) {
        const responseTime = Date.now() - Date.now();
        lastError = error.message;

        // Record failure
        await this.recordFailure(providerConfig, error.message);
        circuitBreaker.recordFailure();

        this.logger.warn(
          `Provider ${providerConfig.providerId} failed: ${error.message}. Trying next provider...`,
        );
      }
    }

    // All providers failed
    throw new Error(`All providers failed. Last error: ${lastError}`);
  }

  /**
   * Send notification with bulk processing
   */
  async sendBulk(
    payloads: BaseProviderPayload[],
    options: ProviderSelectionOptions,
  ): Promise<ProviderSendResult[]> {
    const results: ProviderSendResult[] = [];

    // Process in batches to avoid overwhelming providers
    const batchSize = this.configService.get<number>("PROVIDER_BULK_BATCH_SIZE", 100);

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

  /**
   * Select providers based on options with failover priority
   */
  async selectProviders(options: ProviderSelectionOptions): Promise<ProviderConfig[]> {
    const query = this.providerConfigRepository
      .createQueryBuilder("provider")
      .where("provider.tenantId = :tenantId", { tenantId: options.tenantId })
      .andWhere("provider.channel = :channel", { channel: options.channel })
      .andWhere("provider.isActive = :isActive", { isActive: true });

    // Filter by country if specified
    if (options.country) {
      query.andWhere(
        "(provider.supportedCountries IS NULL OR JSON_CONTAINS(provider.supportedCountries, :country))",
        { country: JSON.stringify(options.country) },
      );
    }

    // Exclude specific providers if requested
    if (options.excludeProviders && options.excludeProviders.length > 0) {
      query.andWhere("provider.providerId NOT IN (:...excludeProviders)", {
        excludeProviders: options.excludeProviders,
      });
    }

    const providers = await query
      .orderBy("provider.priority", "ASC")
      .addOrderBy("provider.createdAt", "ASC")
      .getMany();

    // Decrypt configurations
    const decryptedProviders = await Promise.all(
      providers.map(async (provider) => {
        const decryptedConfig = await this.encryptionService.decrypt(provider.config);
        return {
          ...provider,
          config: decryptedConfig,
        } as ProviderConfig;
      }),
    );

    // Filter by health status and performance
    const healthyProviders = await this.filterHealthyProviders(decryptedProviders);

    return healthyProviders;
  }

  /**
   * Get available providers for a channel
   */
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
      relations: ["project", "project.tenant"],
      order: {
        priority: "ASC",
        createdAt: "ASC",
      },
    });
  }

  /**
   * Validate provider configuration
   */
  async validateProviderConfig(config: ProviderConfig): Promise<boolean> {
    try {
      // Validate configuration structure
      const isValidStructure = await this.configValidator.validate(config);
      if (!isValidStructure) {
        return false;
      }

      // Test provider connection
      const provider = await this.getProviderInstance(config);
      const healthStatus = await provider.checkHealth();

      return healthStatus.status === ProviderHealth.HEALTHY;
    } catch (error) {
      this.logger.error(`Provider validation failed: ${error.message}`);
      return false;
    }
  }

  /**
   * Create a new provider configuration
   */
  async createConfig(tenantId: string, createDto: any): Promise<ProviderConfig> {
    // Encrypt sensitive configuration data
    const encryptedConfig = await this.encryptionService.encrypt(createDto.config);

    const providerConfig = this.providerConfigRepository.create({
      ...createDto,
      tenantId,
      config: encryptedConfig,
    });

    const savedConfig = await this.providerConfigRepository.save(providerConfig);

    // The save method returns the saved entity, but TypeScript might infer it as an array
    // Let's handle both cases
    const config = Array.isArray(savedConfig) ? savedConfig[0] : savedConfig;

    // Validate the configuration
    const isValid = await this.validateProviderConfig(config);
    if (!isValid) {
      this.logger.warn(`Created provider config ${config.id} failed validation`);
    }

    return config;
  }

  /**
   * Find all provider configurations for a tenant
   */
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

    // Count total
    const total = await queryBuilder.getCount();

    // Apply pagination
    const page = query.page || 1;
    const limit = query.limit || 10;
    const offset = (page - 1) * limit;

    queryBuilder
      .orderBy("config.priority", "ASC")
      .addOrderBy("config.createdAt", "DESC")
      .skip(offset)
      .take(limit);

    const configs = await queryBuilder.getMany();

    // Decrypt configurations for response
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

  /**
   * Find provider configurations by project
   */
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

    // Count total
    const total = await queryBuilder.getCount();

    // Apply pagination
    const page = query.page || 1;
    const limit = query.limit || 10;
    const offset = (page - 1) * limit;

    queryBuilder
      .orderBy("config.priority", "ASC")
      .addOrderBy("config.createdAt", "DESC")
      .skip(offset)
      .take(limit);

    const configs = await queryBuilder.getMany();

    // Decrypt configurations for response
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

  /**
   * Find provider configuration by ID
   */
  async findConfigById(tenantId: string, id: string): Promise<ProviderConfig> {
    const config = await this.providerConfigRepository.findOne({
      where: { id, project: { tenant: { id: tenantId } } },
      relations: ["project", "project.tenant"],
    });

    if (!config) {
      throw new Error(`Provider configuration with ID ${id} not found`);
    }

    // Decrypt configuration for response
    const decryptedConfig = await this.encryptionService.decrypt(config.config);
    return {
      ...config,
      config: decryptedConfig,
    } as ProviderConfig;
  }

  /**
   * Update provider configuration
   */
  async updateConfig(tenantId: string, id: string, updateDto: any): Promise<ProviderConfig> {
    const existingConfig = await this.providerConfigRepository.findOne({
      where: { id, project: { tenant: { id: tenantId } } },
      relations: ["project", "project.tenant"],
    });

    if (!existingConfig) {
      throw new Error(`Provider configuration with ID ${id} not found`);
    }

    // Encrypt sensitive data if provided
    let encryptedConfig = updateDto.config;
    if (updateDto.config) {
      encryptedConfig = await this.encryptionService.encrypt(updateDto.config);
    }

    const updatedConfig = await this.providerConfigRepository.save({
      ...existingConfig,
      ...updateDto,
      config: encryptedConfig || existingConfig.config,
    });

    // Invalidate cached provider instance
    const cacheKey = this.getProviderCacheKey(updatedConfig);
    this.providerInstances.delete(cacheKey);

    // Decrypt configuration for response
    const decryptedConfig = await this.encryptionService.decrypt(updatedConfig.config);
    return {
      ...updatedConfig,
      config: decryptedConfig,
    } as ProviderConfig;
  }

  /**
   * Remove provider configuration
   */
  async removeConfig(tenantId: string, id: string): Promise<void> {
    const config = await this.providerConfigRepository.findOne({
      where: { id, project: { tenant: { id: tenantId } } },
      relations: ["project", "project.tenant"],
    });

    if (!config) {
      throw new Error(`Provider configuration with ID ${id} not found`);
    }

    await this.providerConfigRepository.remove(config);

    // Invalidate cached provider instance
    const cacheKey = this.getProviderCacheKey(config);
    this.providerInstances.delete(cacheKey);

    this.logger.log(`Removed provider configuration ${id} for tenant ${tenantId}`);
  }

  /**
   * Test provider configuration
   */
  async testConfig(
    tenantId: string,
    id: string,
  ): Promise<{
    success: boolean;
    message: string;
    responseTime?: number;
    error?: string;
  }> {
    const config = await this.findConfigById(tenantId, id);

    try {
      const startTime = Date.now();
      const provider = await this.getProviderInstance(config);
      const healthStatus = await provider.checkHealth();
      const responseTime = Date.now() - startTime;

      return {
        success: healthStatus.status === ProviderHealth.HEALTHY,
        message: "Provider test completed",
        responseTime,
      };
    } catch (error) {
      return {
        success: false,
        message: "Provider test failed",
        error: error.message,
      };
    }
  }

  /**
   * Activate provider configuration
   */
  async activateConfig(tenantId: string, id: string): Promise<ProviderConfig> {
    const config = await this.providerConfigRepository.findOne({
      where: { id, project: { tenant: { id: tenantId } } },
      relations: ["project", "project.tenant"],
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

  /**
   * Deactivate provider configuration
   */
  async deactivateConfig(tenantId: string, id: string): Promise<ProviderConfig> {
    const config = await this.providerConfigRepository.findOne({
      where: { id, project: { tenant: { id: tenantId } } },
      relations: ["project", "project.tenant"],
    });

    if (!config) {
      throw new Error(`Provider configuration with ID ${id} not found`);
    }

    config.isActive = false;
    const updatedConfig = await this.providerConfigRepository.save(config);

    // Invalidate cached provider instance
    const cacheKey = this.getProviderCacheKey(updatedConfig);
    this.providerInstances.delete(cacheKey);

    this.logger.log(`Deactivated provider configuration ${id} for tenant ${tenantId}`);

    const decryptedConfig = await this.encryptionService.decrypt(updatedConfig.config);
    return {
      ...updatedConfig,
      config: decryptedConfig,
    } as ProviderConfig;
  }

  /**
   * Check provider health status
   */
  async checkProviderHealth(
    tenantId: string,
    id: string,
  ): Promise<{
    status: string;
    message: string;
    lastCheck?: Date;
    responseTime?: number;
    metrics?: any;
  }> {
    const config = await this.findConfigById(tenantId, id);

    try {
      const startTime = Date.now();
      const provider = await this.getProviderInstance(config);
      const healthStatus = await provider.checkHealth();
      const responseTime = Date.now() - startTime;

      // Get performance metrics
      const metrics = await this.performanceTracker.getMetrics(
        config.providerId,
        config.channel as unknown as Channel,
      );

      return {
        status: healthStatus.status,
        message: "Health check completed",
        lastCheck: new Date(),
        responseTime,
        metrics,
      };
    } catch (error) {
      return {
        status: ProviderHealth.UNHEALTHY,
        message: `Health check failed: ${error.message}`,
        lastCheck: new Date(),
      };
    }
  }

  /**
   * Get provider health status
   */
  async getProviderHealth(providerId: string, channel: NotificationChannel): Promise<any> {
    return this.healthMonitor.checkProviderHealth(providerId, channel as unknown as Channel);
  }

  /**
   * Get provider performance metrics
   */
  async getProviderMetrics(providerId: string, channel: NotificationChannel): Promise<any> {
    return this.performanceTracker.getMetrics(providerId, channel as unknown as Channel);
  }

  /**
   * Update provider configuration
   */
  async updateProviderConfig(
    tenantId: string,
    providerId: string,
    channel: NotificationChannel,
    config: Partial<ProviderConfig>,
  ): Promise<ProviderConfig> {
    const existingConfig = await this.providerConfigRepository.findOne({
      where: { project: { tenant: { id: tenantId } }, providerId, channel },
      relations: ["project", "project.tenant"],
    });

    if (!existingConfig) {
      throw new Error(`Provider configuration not found: ${providerId} for ${channel}`);
    }

    // Encrypt sensitive data
    if (config.config) {
      config.config = await this.encryptionService.encrypt(config.config);
    }

    const updatedConfig = await this.providerConfigRepository.save({
      ...existingConfig,
      ...config,
    });

    // Invalidate cached provider instance
    const cacheKey = this.getProviderCacheKey(updatedConfig);
    this.providerInstances.delete(cacheKey);

    return updatedConfig;
  }

  /**
   * Enable/disable provider
   */
  async toggleProvider(
    tenantId: string,
    providerId: string,
    channel: NotificationChannel,
    isActive: boolean,
  ): Promise<void> {
    await this.providerConfigRepository.update({ tenantId, providerId, channel }, { isActive });

    this.logger.log(`Provider ${providerId} (${channel}) ${isActive ? "enabled" : "disabled"}`);
  }

  /**
   * Get provider instance with caching
   */
  private async getProviderInstance(config: ProviderConfig): Promise<IBaseProvider> {
    const cacheKey = this.getProviderCacheKey(config);

    if (this.providerInstances.has(cacheKey)) {
      return this.providerInstances.get(cacheKey)!;
    }

    const providerConfig = {
      id: config.id,
      name: config.providerName,
      channel: config.channel as unknown as Channel,
      priority: config.priority,
      isActive: config.isActive,
      credentials: config.config,
      settings: config.metadata,
    };

    const provider = await this.providerFactory.createProvider(
      config.providerId,
      config.channel as unknown as Channel,
      providerConfig,
    );

    // Register with health monitor
    this.healthMonitor.registerProvider(provider);

    // Cache the instance
    this.providerInstances.set(cacheKey, provider);

    return provider;
  }

  /**
   * Filter providers by health status
   */
  private async filterHealthyProviders(providers: ProviderConfig[]): Promise<ProviderConfig[]> {
    const healthyProviders: ProviderConfig[] = [];

    for (const provider of providers) {
      const circuitBreaker = this.getCircuitBreaker(provider.id);

      // Skip if circuit breaker is open
      if (circuitBreaker.isOpen()) {
        continue;
      }

      // Check recent performance
      const metrics = await this.performanceTracker.getMetrics(
        provider.providerId,
        provider.channel as unknown as Channel,
      );

      // Include provider if success rate is acceptable
      const minSuccessRate = this.configService.get<number>("PROVIDER_MIN_SUCCESS_RATE", 80);
      if (metrics.successRate >= minSuccessRate) {
        healthyProviders.push(provider);
      }
    }

    return healthyProviders;
  }

  /**
   * Record successful provider operation
   */
  private async recordSuccess(config: ProviderConfig, responseTime: number): Promise<void> {
    await Promise.all([
      this.healthMonitor.recordSuccess(
        config.providerId,
        config.channel as unknown as Channel,
        responseTime,
      ),
      this.performanceTracker.recordSuccess(
        config.providerId,
        config.channel as unknown as Channel,
        responseTime,
      ),
    ]);
  }

  /**
   * Record failed provider operation
   */
  private async recordFailure(config: ProviderConfig, error: string): Promise<void> {
    await Promise.all([
      this.healthMonitor.recordFailure(
        config.providerId,
        config.channel as unknown as Channel,
        error,
      ),
      this.performanceTracker.recordFailure(
        config.providerId,
        config.channel as unknown as Channel,
        error,
      ),
    ]);
  }

  /**
   * Get circuit breaker for provider
   */
  private getCircuitBreaker(providerId: string): CircuitBreaker {
    if (!this.circuitBreakers.has(providerId)) {
      const failureThreshold = this.configService.get<number>(
        "CIRCUIT_BREAKER_FAILURE_THRESHOLD",
        5,
      );
      const resetTimeout = Math.max(
        0,
        this.configService.get<number>("CIRCUIT_BREAKER_RESET_TIMEOUT", 60000),
      );

      this.circuitBreakers.set(providerId, new CircuitBreaker(failureThreshold, resetTimeout));
    }

    return this.circuitBreakers.get(providerId)!;
  }

  /**
   * Generate cache key for provider instance
   */
  private getProviderCacheKey(config: ProviderConfig): string {
    return `${config.tenantId}:${config.providerId}:${config.channel}`;
  }
}

/**
 * Simple circuit breaker implementation
 */
class CircuitBreaker {
  private failures = 0;
  private lastFailureTime = 0;
  private state: "CLOSED" | "OPEN" | "HALF_OPEN" = "CLOSED";

  constructor(
    private readonly failureThreshold: number,
    private readonly resetTimeout: number,
  ) {}

  recordSuccess(): void {
    this.failures = 0;
    this.state = "CLOSED";
  }

  recordFailure(): void {
    this.failures++;
    this.lastFailureTime = Date.now();

    if (this.failures >= this.failureThreshold) {
      this.state = "OPEN";
    }
  }

  isOpen(): boolean {
    if (this.state === "OPEN") {
      if (Date.now() - this.lastFailureTime >= this.resetTimeout) {
        this.state = "HALF_OPEN";
        return false;
      }
      return true;
    }

    return false;
  }
}
