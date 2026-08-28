import { Injectable, Logger } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { NotificationChannel } from "../../common/enums/notification-channel.enum";
import { ProviderHealth } from "../../providers/types";
import { ProviderConfigValidator } from "./provider-config-validator";
import { ProviderConfig } from "./provider-config.entity";
import { decryptProviderConfig, getProviderCacheKey } from "./provider-config.helpers";
import { ProviderConfigQueryService } from "./provider-config-query.service";
import { ProviderEncryptionService } from "./provider-encryption.service";
import { ProviderPerformanceTracker } from "./provider-performance-tracker";
import { ProviderRuntimeService } from "./provider-runtime.service";

@Injectable()
export class ProviderConfigLifecycleService {
  private readonly logger = new Logger(ProviderConfigLifecycleService.name);

  constructor(
    @InjectRepository(ProviderConfig)
    private readonly providerConfigRepository: Repository<ProviderConfig>,
    private readonly encryptionService: ProviderEncryptionService,
    private readonly configValidator: ProviderConfigValidator,
    private readonly performanceTracker: ProviderPerformanceTracker,
    private readonly configQuery: ProviderConfigQueryService,
    private readonly runtime: ProviderRuntimeService,
  ) {}

  async createConfig(tenantId: string, createDto: any): Promise<ProviderConfig> {
    const encryptedConfig = await this.encryptionService.encrypt(createDto.config);

    const providerConfig = this.providerConfigRepository.create({
      ...createDto,
      tenantId,
      config: encryptedConfig,
    });

    const savedConfig = await this.providerConfigRepository.save(providerConfig);
    const config = Array.isArray(savedConfig) ? savedConfig[0] : savedConfig;

    const isValid = await this.runtime.validateProviderConfig(config);
    if (!isValid) {
      this.logger.warn(`Created provider config ${config.id} failed validation`);
    }

    return config;
  }

  async updateConfig(tenantId: string, id: string, updateDto: any): Promise<ProviderConfig> {
    const existingConfig = await this.providerConfigRepository.findOne({
      where: { id, project: { tenant: { id: tenantId } } },
      relations: ["project", "project.tenant"],
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

    this.runtime.invalidateProviderCache(updatedConfig);

    return decryptProviderConfig(this.encryptionService, updatedConfig);
  }

  async removeConfig(tenantId: string, id: string): Promise<void> {
    const config = await this.providerConfigRepository.findOne({
      where: { id, project: { tenant: { id: tenantId } } },
      relations: ["project", "project.tenant"],
    });

    if (!config) {
      throw new Error(`Provider configuration with ID ${id} not found`);
    }

    await this.providerConfigRepository.remove(config);
    this.runtime.invalidateProviderCache(config);

    this.logger.log(`Removed provider configuration ${id} for tenant ${tenantId}`);
  }

  async testConfig(
    tenantId: string,
    id: string,
  ): Promise<{
    success: boolean;
    message: string;
    responseTime?: number;
    error?: string;
  }> {
    const config = await this.configQuery.findConfigById(tenantId, id);

    try {
      const startTime = Date.now();
      const provider = await this.runtime.getProviderInstance(config);
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

    return decryptProviderConfig(this.encryptionService, updatedConfig);
  }

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

    this.runtime.invalidateProviderCache(updatedConfig);

    this.logger.log(`Deactivated provider configuration ${id} for tenant ${tenantId}`);

    return decryptProviderConfig(this.encryptionService, updatedConfig);
  }

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
    const config = await this.configQuery.findConfigById(tenantId, id);

    try {
      const startTime = Date.now();
      const provider = await this.runtime.getProviderInstance(config);
      const healthStatus = await provider.checkHealth();
      const responseTime = Date.now() - startTime;

      const metrics = await this.performanceTracker.getMetrics(
        config.providerId,
        config.channel as any,
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

    if (config.config) {
      config.config = await this.encryptionService.encrypt(config.config);
    }

    const updatedConfig = await this.providerConfigRepository.save({
      ...existingConfig,
      ...config,
    });

    this.runtime.invalidateProviderCache(updatedConfig);

    return updatedConfig;
  }

  async toggleProvider(
    tenantId: string,
    providerId: string,
    channel: NotificationChannel,
    isActive: boolean,
  ): Promise<void> {
    await this.providerConfigRepository.update({ tenantId, providerId, channel }, { isActive });

    this.logger.log(`Provider ${providerId} (${channel}) ${isActive ? "enabled" : "disabled"}`);
  }
}
