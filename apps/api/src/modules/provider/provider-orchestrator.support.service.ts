import { Injectable, Logger } from "@nestjs/common";
import { randomUUID } from "crypto";
import { NotificationChannel } from "../../common/enums/notification-channel.enum";
import { BillingIntegrationService } from "../billing/services/billing-integration.service";
import { BillingMode, BillingChannel } from "../billing/constants/token-pricing";
import { ProviderConfigRepository } from "./provider-config.repository";

@Injectable()
export class ProviderOrchestratorSupportService {
  private readonly logger = new Logger(ProviderOrchestratorSupportService.name);

  constructor(
    private readonly providerConfigRepository: ProviderConfigRepository,
    private readonly billingIntegrationService: BillingIntegrationService,
  ) {}

  async chargeForSend(
    tenantId: string | undefined,
    channel: BillingChannel,
    billingMode: BillingMode,
    metadata?: Record<string, unknown>,
    eventCount = 1,
  ): Promise<void> {
    if (!tenantId) return;

    try {
      await this.billingIntegrationService.processNotificationTokenUsage(
        tenantId,
        channel,
        randomUUID(),
        billingMode,
        metadata,
        eventCount,
      );
    } catch (error) {
      this.logger.error(
        `Token billing failed for tenant ${tenantId} (${billingMode} ${channel}): ${error.message}`,
      );
      throw error;
    }
  }

  async getBYOPProvider(
    type: "email" | "chat" | "push" | "sms" | "voice" | "whatsapp",
    tenantId?: string,
    providerName?: string,
  ): Promise<{ providerName: string; config: any } | null> {
    if (!tenantId) return null;

    try {
      const channelMap: Record<string, NotificationChannel> = {
        email: NotificationChannel.EMAIL,
        chat: NotificationChannel.CHAT,
        push: NotificationChannel.PUSH,
        sms: NotificationChannel.SMS,
        voice: NotificationChannel.VOICE,
        whatsapp: NotificationChannel.WHATSAPP,
      };

      const configs = await this.providerConfigRepository.findActiveByTenantAndChannel(
        tenantId,
        channelMap[type],
      );

      if (providerName) {
        const config = configs.find((c) => c.providerId === providerName);
        return config
          ? {
              providerName: config.providerId,
              config: config.config,
            }
          : null;
      }

      const config = configs[0];
      return config
        ? {
            providerName: config.providerId,
            config: config.config,
          }
        : null;
    } catch (error) {
      this.logger.warn(`Failed to get BYOP config: ${error.message}`);
      return null;
    }
  }

  async validateProviderConfig(provider: any, _config: any): Promise<boolean> {
    try {
      return await provider.validateConfig();
    } catch (error) {
      this.logger.warn(`Provider config validation failed: ${error.message}`);
      return false;
    }
  }
}
