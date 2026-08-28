import { Injectable } from "@nestjs/common";
import { NotificationChannel } from "../../common/enums/notification-channel.enum";
import { BaseProviderPayload } from "../../providers/base/base-provider.interface";
import { ProviderConfig } from "./provider-config.entity";
import { ProviderConfigLifecycleService } from "./provider-config-lifecycle.service";
import { ProviderConfigQueryService } from "./provider-config-query.service";
import { ProviderRuntimeService } from "./provider-runtime.service";
import { ProviderSelectionOptions, ProviderSendResult } from "./provider.types";

export type { ProviderSelectionOptions, ProviderSendResult } from "./provider.types";

@Injectable()
export class ProviderService {
  constructor(
    private readonly runtime: ProviderRuntimeService,
    private readonly configQuery: ProviderConfigQueryService,
    private readonly configLifecycle: ProviderConfigLifecycleService,
  ) {}

  send(payload: BaseProviderPayload, options: ProviderSelectionOptions): Promise<ProviderSendResult> {
    return this.runtime.send(payload, options);
  }

  sendBulk(
    payloads: BaseProviderPayload[],
    options: ProviderSelectionOptions,
  ): Promise<ProviderSendResult[]> {
    return this.runtime.sendBulk(payloads, options);
  }

  selectProviders(options: ProviderSelectionOptions): Promise<ProviderConfig[]> {
    return this.runtime.selectProviders(options);
  }

  getAvailableProviders(tenantId: string, channel: NotificationChannel): Promise<ProviderConfig[]> {
    return this.configQuery.getAvailableProviders(tenantId, channel);
  }

  validateProviderConfig(config: ProviderConfig): Promise<boolean> {
    return this.runtime.validateProviderConfig(config);
  }

  createConfig(tenantId: string, createDto: any): Promise<ProviderConfig> {
    return this.configLifecycle.createConfig(tenantId, createDto);
  }

  findAllConfigs(tenantId: string, query: any) {
    return this.configQuery.findAllConfigs(tenantId, query);
  }

  findConfigsByProject(tenantId: string, projectId: string, query: any) {
    return this.configQuery.findConfigsByProject(tenantId, projectId, query);
  }

  findConfigById(tenantId: string, id: string): Promise<ProviderConfig> {
    return this.configQuery.findConfigById(tenantId, id);
  }

  updateConfig(tenantId: string, id: string, updateDto: any): Promise<ProviderConfig> {
    return this.configLifecycle.updateConfig(tenantId, id, updateDto);
  }

  removeConfig(tenantId: string, id: string): Promise<void> {
    return this.configLifecycle.removeConfig(tenantId, id);
  }

  testConfig(tenantId: string, id: string) {
    return this.configLifecycle.testConfig(tenantId, id);
  }

  activateConfig(tenantId: string, id: string): Promise<ProviderConfig> {
    return this.configLifecycle.activateConfig(tenantId, id);
  }

  deactivateConfig(tenantId: string, id: string): Promise<ProviderConfig> {
    return this.configLifecycle.deactivateConfig(tenantId, id);
  }

  checkProviderHealth(tenantId: string, id: string) {
    return this.configLifecycle.checkProviderHealth(tenantId, id);
  }

  getProviderHealth(providerId: string, channel: NotificationChannel) {
    return this.runtime.getProviderHealth(providerId, channel);
  }

  getProviderMetrics(providerId: string, channel: NotificationChannel) {
    return this.runtime.getProviderMetrics(providerId, channel);
  }

  updateProviderConfig(
    tenantId: string,
    providerId: string,
    channel: NotificationChannel,
    config: Partial<ProviderConfig>,
  ): Promise<ProviderConfig> {
    return this.configLifecycle.updateProviderConfig(tenantId, providerId, channel, config);
  }

  toggleProvider(
    tenantId: string,
    providerId: string,
    channel: NotificationChannel,
    isActive: boolean,
  ): Promise<void> {
    return this.configLifecycle.toggleProvider(tenantId, providerId, channel, isActive);
  }
}
