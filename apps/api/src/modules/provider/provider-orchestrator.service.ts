import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { BaseEmailProvider, EmailMessage } from "./providers/email/email-provider.interface";
import { IChatProvider, ChatPayload } from "./providers/chat/chat-provider.interface";
import { IPushProvider, PushPayload } from "./providers/push/push-provider.interface";
import { ISMSProvider, SMSPayload, BulkSMSPayload } from "./providers/sms/sms-provider.interface";
import { IInAppProvider, InAppPayload } from "./providers/in-app/in-app-provider.interface";
import { EMAIL_FALLBACK_PROVIDER } from "./providers/email/providers";
import { PUSH_FALLBACK_PROVIDER } from "./providers/push/providers";
import { InAppOrchestratorService } from "./providers/in-app/in-app-orchestrator.service";
import { SMSRoutingService } from "./providers/sms/sms-routing.service";
import { ProviderConfigRepository } from "./provider-config.repository";
import { BrandMessagingConfigService } from "../brand/services/brand-messaging-config.service";
import { BrandedPushService } from "./services/branded-push.service";
import { BillingIntegrationService } from "../billing/services/billing-integration.service";
import { VoiceService } from "./services/voice.service";
import { BillingMode, BillingChannel } from "../billing/constants/token-pricing";
import { randomUUID } from "crypto";

@Injectable()
export class ProviderOrchestratorService {
  private readonly logger = new Logger(ProviderOrchestratorService.name);

  private emailProviders = new Map<string, BaseEmailProvider>();
  private chatProviders = new Map<string, IChatProvider>();
  private pushProviders = new Map<string, IPushProvider>();
  private smsProviders = new Map<string, ISMSProvider>();

  constructor(
    private configService: ConfigService,
    private smsRoutingService: SMSRoutingService,
    private providerConfigRepository: ProviderConfigRepository,
    private inAppOrchestrator: InAppOrchestratorService,
    private brandService: BrandMessagingConfigService,
    private brandedPushService: BrandedPushService,
    private billingIntegrationService: BillingIntegrationService,
    private voiceService: VoiceService,
  ) {}

  // Register providers
  registerEmailProvider(name: string, provider: BaseEmailProvider): void {
    this.emailProviders.set(name, provider);
    this.logger.log(`Registered email provider: ${name}`);
  }

  registerChatProvider(name: string, provider: IChatProvider): void {
    this.chatProviders.set(name, provider);
    this.logger.log(`Registered chat provider: ${name}`);
  }

  registerPushProvider(name: string, provider: IPushProvider): void {
    this.pushProviders.set(name, provider);
    this.logger.log(`Registered push provider: ${name}`);
  }

  registerSMSProvider(name: string, provider: ISMSProvider): void {
    this.smsProviders.set(name, provider);
    this.smsRoutingService.registerProvider(provider);
    this.logger.log(`Registered SMS provider: ${name}`);
  }

  // Email orchestration with brand integration
  async sendEmail(payload: EmailMessage, tenantId?: string, brandId?: string): Promise<any> {
    try {
      const byopProvider = await this.getBYOPProvider("email", tenantId);
      if (byopProvider) {
        const provider = this.emailProviders.get(byopProvider.providerName);
        if (provider && (await this.validateProviderConfig(provider, byopProvider.config))) {
          this.logger.log(
            `Using BYOP email provider: ${byopProvider.providerName} for tenant: ${tenantId}`,
          );
          const result = await provider.sendEmail(payload);
          await this.chargeForSend(tenantId, "email", "byo");
          return result;
        }
      }

      // Step 2: Try to enhance with brand configuration (if no BYOP)
      let enhancedPayload = payload;
      if (tenantId) {
        try {
          const brandConfig = await this.brandService.getBrandConfigForEmail(tenantId, brandId);
          if (brandConfig.brandConfig) {
            enhancedPayload = {
              ...payload,
              brandConfig: brandConfig.brandConfig,
            };

            // Use brand's from email if not already specified
            if (
              !payload.from &&
              brandConfig.brandConfig.defaultFromEmail &&
              brandConfig.brandConfig.defaultFromName
            ) {
              enhancedPayload.from = `${brandConfig.brandConfig.defaultFromName} <${brandConfig.brandConfig.defaultFromEmail}>`;
            }

            this.logger.log(`Enhanced email with brand configuration for tenant: ${tenantId}`);
          }
        } catch (error) {
          this.logger.warn(`Failed to enhance email with brand config: ${error.message}`);
          // Continue with original payload
        }
      }

      // Step 3: Use platform SES provider (fallback)
      const fallbackProvider = this.emailProviders.get(EMAIL_FALLBACK_PROVIDER);
      if (!fallbackProvider) {
        throw new Error("No email provider available");
      }

      this.logger.log(
        `Using platform email provider: ${EMAIL_FALLBACK_PROVIDER} for tenant: ${tenantId || "system"}`,
      );
      const result = await fallbackProvider.sendEmail(enhancedPayload);
      await this.chargeForSend(tenantId, "email", "managed");
      return result;
    } catch (error) {
      this.logger.error(`Email sending failed: ${error.message}`, error.stack);
      throw error;
    }
  }

  // Chat orchestration
  async sendChatMessage(
    payload: ChatPayload,
    providerName: string,
    tenantId?: string,
  ): Promise<any> {
    try {
      const billingChannel: BillingChannel = providerName === "whatsapp" ? "whatsapp" : "email";
      const byopProvider = await this.getBYOPProvider(
        providerName === "whatsapp" ? "whatsapp" : "chat",
        tenantId,
        providerName,
      );
      if (byopProvider) {
        const provider = this.chatProviders.get(byopProvider.providerName);
        if (provider && (await this.validateProviderConfig(provider, byopProvider.config))) {
          const result = await provider.sendMessage(payload);
          await this.chargeForSend(tenantId, billingChannel, "byo");
          return result;
        }
      }

      const provider = this.chatProviders.get(providerName);
      if (!provider) {
        throw new Error(`Chat provider '${providerName}' not found`);
      }

      const result = await provider.sendMessage(payload);
      await this.chargeForSend(tenantId, billingChannel, "managed");
      return result;
    } catch (error) {
      this.logger.error(`Chat message sending failed: ${error.message}`, error.stack);
      throw error;
    }
  }

  // Push orchestration with brand integration
  async sendPushNotification(
    payload: PushPayload,
    tenantId?: string,
    brandId?: string,
  ): Promise<any> {
    try {
      // Step 1: Check for BYOP configuration (highest priority)
      const byopProvider = await this.getBYOPProvider("push", tenantId);
      if (byopProvider) {
        const provider = this.pushProviders.get(byopProvider.providerName);
        if (provider && (await this.validateProviderConfig(provider, byopProvider.config))) {
          this.logger.log(
            `Using BYOP push provider: ${byopProvider.providerName} for tenant: ${tenantId}`,
          );
          const result = await provider.sendPushNotification(payload);
          await this.chargeForSend(tenantId, "push", "byo");
          return result;
        }
      }

      // Step 2: Try to enhance with brand configuration (if no BYOP)
      let enhancedPayload = payload;
      if (tenantId) {
        try {
          enhancedPayload = await this.brandedPushService.enhancePushWithBrand(
            tenantId,
            payload,
            brandId,
          );
          this.logger.log(
            `Enhanced push notification with brand configuration for tenant: ${tenantId}`,
          );
        } catch (error) {
          this.logger.warn(
            `Failed to enhance push notification with brand config: ${error.message}`,
          );
          // Continue with original payload
        }
      }

      // Step 3: Use platform push provider (fallback)
      const fallbackProvider = this.pushProviders.get(PUSH_FALLBACK_PROVIDER);
      if (!fallbackProvider) {
        throw new Error("No push provider available");
      }

      this.logger.log(
        `Using platform push provider: ${PUSH_FALLBACK_PROVIDER} for tenant: ${tenantId || "system"}`,
      );
      const result = await fallbackProvider.sendPushNotification(enhancedPayload);
      await this.chargeForSend(tenantId, "push", "managed");
      return result;
    } catch (error) {
      this.logger.error(`Push notification sending failed: ${error.message}`, error.stack);
      throw error;
    }
  }

  // SMS orchestration with intelligent routing and default provider fallback
  async sendSMS(payload: SMSPayload, tenantId?: string): Promise<any> {
    try {
      // Step 1: Check for BYOP configuration (highest priority)
      const byopProvider = await this.getBYOPProvider("sms", tenantId);
      if (byopProvider) {
        const provider = this.smsProviders.get(byopProvider.providerName);
        if (provider && (await this.validateProviderConfig(provider, byopProvider.config))) {
          this.logger.log(
            `Using BYOP SMS provider: ${byopProvider.providerName} for tenant: ${tenantId}`,
          );
          const result = await provider.sendSMS(payload);
          await this.chargeForSend(tenantId, "sms", "byo");
          return result;
        }
      }

      // Step 2: Use intelligent routing to select best provider (includes default fallback)
      const bestProvider = this.smsRoutingService.getBestProvider(payload.to);
      if (!bestProvider) {
        throw new Error("No SMS provider available for this phone number");
      }

      this.logger.log(
        `Using SMS provider: ${bestProvider.getProviderName()} for tenant: ${tenantId || "system"}`,
      );
      const result = await bestProvider.sendSMS(payload);
      await this.chargeForSend(tenantId, "sms", "managed");
      return result;
    } catch (error) {
      this.logger.error(`SMS sending failed: ${error.message}`, error.stack);
      throw error;
    }
  }

  // Bulk SMS orchestration
  async sendBulkSMS(payload: BulkSMSPayload, tenantId?: string): Promise<any> {
    try {
      // Step 1: Check for BYOP configuration (highest priority)
      const byopProvider = await this.getBYOPProvider("sms", tenantId);
      if (byopProvider) {
        const provider = this.smsProviders.get(byopProvider.providerName);
        if (provider && (await this.validateProviderConfig(provider, byopProvider.config))) {
          this.logger.log(
            `Using BYOP SMS provider for bulk: ${byopProvider.providerName} for tenant: ${tenantId}`,
          );
          const result = await provider.sendBulkSMS(payload);
          const recipientCount = payload.recipients?.length ?? 1;
          await this.chargeForSend(tenantId, "sms", "byo", undefined, recipientCount);
          return result;
        }
      }

      // Step 2: Use default provider for bulk SMS (most reliable for bulk operations)
      const defaultProvider = this.smsRoutingService.getDefaultProvider();
      if (!defaultProvider) {
        throw new Error("No SMS provider available for bulk sending");
      }

      this.logger.log(
        `Using default SMS provider for bulk: ${defaultProvider.getProviderName()} for tenant: ${tenantId || "system"}`,
      );
      const result = await defaultProvider.sendBulkSMS(payload);
      const recipientCount = payload.recipients?.length ?? 1;
      await this.chargeForSend(tenantId, "sms", "managed", undefined, recipientCount);
      return result;
    } catch (error) {
      this.logger.error(`Bulk SMS sending failed: ${error.message}`, error.stack);
      throw error;
    }
  }

  // BYOP helper methods
  private async chargeForSend(
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

  private async getBYOPProvider(
    type: "email" | "chat" | "push" | "sms" | "voice" | "whatsapp",
    tenantId?: string,
    providerName?: string,
  ): Promise<{ providerName: string; config: any } | null> {
    if (!tenantId) return null;

    try {
      const channelMap = {
        email: "EMAIL",
        chat: "CHAT",
        push: "PUSH",
        sms: "SMS",
        voice: "VOICE",
        whatsapp: "WHATSAPP",
      };

      const channel = channelMap[type] as any;
      const configs = await this.providerConfigRepository.findActiveByTenantAndChannel(
        tenantId,
        channel,
      );

      // If specific provider requested, find it
      if (providerName) {
        const config = configs.find((c) => c.providerId === providerName);
        return config
          ? {
              providerName: config.providerId,
              config: config.config,
            }
          : null;
      }

      // Otherwise return first active config
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

  private async validateProviderConfig(provider: any, config: any): Promise<boolean> {
    try {
      // Temporarily set config and validate
      // This would need to be implemented based on how each provider handles config
      return await provider.validateConfig();
    } catch (error) {
      this.logger.warn(`Provider config validation failed: ${error.message}`);
      return false;
    }
  }

  // Voice call orchestration with Telnyx - real via VoiceService (was stub voice_call_${Date.now()})
  async sendVoiceCall(
    payload: { to: string[]; message?: string; templateId?: string; templateData?: any },
    tenantId?: string,
  ): Promise<any> {
    try {
      const phoneNumber = payload.to[0];
      if (!phoneNumber) throw new Error("Voice call requires 'to' phone number");
      this.logger.log(`Voice call via Telnyx to ${phoneNumber} tenant:${tenantId || "system"}`);

      // BYOK check: if tenant has voice provider config, they manage own Telnyx; still use VoiceService which validates per-tenant creds
      const result = await this.voiceService.createOutboundCall(
        {
          phoneNumber,
          message: payload.message || "Sanarwa voice notification",
          voice: { voice: "Telnyx.Natural.abbie", language: "en-US" },
        },
        tenantId || "system",
      );

      if (!result.success) throw new Error(result.error || "Telnyx voice call failed");

      await this.chargeForSend(tenantId, "voice", "managed", { durationMinutes: 1, callControlId: result.callControlId });
      return { success: true, callId: result.callId, callControlId: result.callControlId, provider: "telnyx" };
    } catch (error) {
      this.logger.error(`Voice call failed: ${error.message}`, error.stack);
      throw error;
    }
  }

  // In-app notification orchestration (no BYOP - internal system only)
  async sendInAppNotification(payload: InAppPayload, tenantId?: string): Promise<any> {
    try {
      const result = await this.inAppOrchestrator.sendInAppNotification(payload);
      await this.chargeForSend(tenantId, "in_app", "managed");
      return result;
    } catch (error) {
      this.logger.error(`In-app notification failed: ${error.message}`, error.stack);
      throw error;
    }
  }

  async sendToRoom(roomId: string, payload: InAppPayload): Promise<any> {
    try {
      return await this.inAppOrchestrator.sendToRoom(roomId, payload);
    } catch (error) {
      this.logger.error(`Room notification failed: ${error.message}`, error.stack);
      throw error;
    }
  }

  async sendCallNotification(
    payload: InAppPayload & { callData: NonNullable<InAppPayload["callData"]> },
  ): Promise<any> {
    try {
      return await this.inAppOrchestrator.sendCallNotification(payload);
    } catch (error) {
      this.logger.error(`Call notification failed: ${error.message}`, error.stack);
      throw error;
    }
  }

  // Utility methods
  getAvailableProviders(type: "email" | "chat" | "push" | "sms" | "voice"): string[] {
    switch (type) {
      case "email":
        return Array.from(this.emailProviders.keys());
      case "chat":
        return Array.from(this.chatProviders.keys());
      case "push":
        return Array.from(this.pushProviders.keys());
      case "sms":
        return Array.from(this.smsProviders.keys());
      case "voice":
        return ["telnyx"]; // For now, only Telnyx is supported
      default:
        return [];
    }
  }

  async getInAppProviderStatus() {
    return this.inAppOrchestrator.getProviderStatus();
  }

  async validatePhoneNumber(phoneNumber: string) {
    return this.smsRoutingService.validatePhoneNumber(phoneNumber);
  }
}
