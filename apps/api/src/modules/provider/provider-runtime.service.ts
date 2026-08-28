import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { NotificationChannel } from "../../common/enums/notification-channel.enum";
import { BaseProviderPayload, IBaseProvider } from "../../providers/base/base-provider.interface";
import { ProviderFactory } from "../../providers/factory/provider-factory";
import { ProviderHealthMonitor } from "../../providers/health/provider-health-monitor";
import { Channel, ProviderHealth } from "../../providers/types";
import { CircuitBreaker } from "./provider-circuit-breaker";
import { ProviderConfigValidator } from "./provider-config-validator";
import { ProviderConfig } from "./provider-config.entity";
import { decryptProviderConfigs, getProviderCacheKey } from "./provider-config.helpers";
import { ProviderEncryptionService } from "./provider-encryption.service";
import { ProviderPerformanceTracker } from "./provider-performance-tracker";
import { ProviderSelectionOptions, ProviderSendResult } from "./provider.types";

@Injectable()
export class ProviderRuntimeService {
  private readonly logger = new Logger(ProviderRuntimeService.name);
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

  async send(
    payload: BaseProviderPayload,
    options: ProviderSelectionOptions,
  ): Promise<ProviderSendResult> {
    const providers = await this.selectProviders(options);

    if (providers.length === 0) {
      throw new Error(`No available providers for channel ${options.channel}`);
    }

    let lastError = "";

    for (const providerConfig of providers) {
      const circuitBreaker = this.getCircuitBreaker(providerConfig.id);

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

        await this.recordSuccess(providerConfig, responseTime);
        circuitBreaker.recordSuccess();

        return {
          success: true,
          response,
          providerId: providerConfig.providerId,
          responseTime,
        };
      } catch (error) {
        lastError = error.message;

        await this.recordFailure(providerConfig, error.message);
        circuitBreaker.recordFailure();

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

  async selectProviders(options: ProviderSelectionOptions): Promise<ProviderConfig[]> {
    const query = this.providerConfigRepository
      .createQueryBuilder("provider")
      .where("provider.tenantId = :tenantId", { tenantId: options.tenantId })
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

    const decryptedProviders = await decryptProviderConfigs(this.encryptionService, providers);

    return this.filterHealthyProviders(decryptedProviders);
  }

  async validateProviderConfig(config: ProviderConfig): Promise<boolean> {
    try {
      const isValidStructure = await this.configValidator.validate(config);
      if (!isValidStructure) {
        return false;
      }

      const provider = await this.getProviderInstance(config);
      const healthStatus = await provider.checkHealth();

      return healthStatus.status === ProviderHealth.HEALTHY;
    } catch (error) {
      this.logger.error(`Provider validation failed: ${error.message}`);
      return false;
    }
  }

  async getProviderHealth(providerId: string, channel: NotificationChannel): Promise<any> {
    return this.healthMonitor.checkProviderHealth(providerId, channel as unknown as Channel);
  }

  async getProviderMetrics(providerId: string, channel: NotificationChannel): Promise<any> {
    return this.performanceTracker.getMetrics(providerId, channel as unknown as Channel);
  }

  async getProviderInstance(config: ProviderConfig): Promise<IBaseProvider> {
    const cacheKey = getProviderCacheKey(config);

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

    this.healthMonitor.registerProvider(provider);
    this.providerInstances.set(cacheKey, provider);

    return provider;
  }

  invalidateProviderCache(config: ProviderConfig): void {
    this.providerInstances.delete(getProviderCacheKey(config));
  }

  private async filterHealthyProviders(providers: ProviderConfig[]): Promise<ProviderConfig[]> {
    const healthyProviders: ProviderConfig[] = [];
    const minSuccessRate = this.configService.get<number>("PROVIDER_MIN_SUCCESS_RATE", 80);

    for (const provider of providers) {
      const circuitBreaker = this.getCircuitBreaker(provider.id);

      if (circuitBreaker.isOpen()) {
        continue;
      }

      const metrics = await this.performanceTracker.getMetrics(
        provider.providerId,
        provider.channel as unknown as Channel,
      );

      if (metrics.successRate >= minSuccessRate) {
        healthyProviders.push(provider);
      }
    }

    return healthyProviders;
  }

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
}
