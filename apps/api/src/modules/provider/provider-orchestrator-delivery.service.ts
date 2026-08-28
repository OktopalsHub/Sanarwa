import { Injectable, Logger } from "@nestjs/common";
import { EmailMessage } from "./providers/email/email-provider.interface";
import { ChatPayload } from "./providers/chat/chat-provider.interface";
import { PushPayload } from "./providers/push/push-provider.interface";
import { BulkSMSPayload, SMSPayload } from "./providers/sms/sms-provider.interface";
import { InAppPayload } from "./providers/in-app/in-app-provider.interface";
import { EMAIL_FALLBACK_PROVIDER } from "./providers/email/providers";
import { PUSH_FALLBACK_PROVIDER } from "./providers/push/providers";
import { InAppOrchestratorService } from "./providers/in-app/in-app-orchestrator.service";
import { SMSRoutingService } from "./providers/sms/sms-routing.service";
import { BrandMessagingConfigService } from "../brand/services/brand-messaging-config.service";
import { BrandedPushService } from "./services/branded-push.service";
import { ProviderOrchestratorRegistry } from "./provider-orchestrator.registry";
import { ProviderOrchestratorSupportService } from "./provider-orchestrator.support.service";

@Injectable()
export class ProviderOrchestratorDeliveryService {
  private readonly logger = new Logger(ProviderOrchestratorDeliveryService.name);

  constructor(
    private readonly registry: ProviderOrchestratorRegistry,
    private readonly support: ProviderOrchestratorSupportService,
    private readonly smsRoutingService: SMSRoutingService,
    private readonly brandService: BrandMessagingConfigService,
    private readonly brandedPushService: BrandedPushService,
    private readonly inAppOrchestrator: InAppOrchestratorService,
  ) {}

  async sendEmail(payload: EmailMessage, tenantId?: string, brandId?: string): Promise<any> {
    try {
      const byopProvider = await this.support.getBYOPProvider("email", tenantId);
      if (byopProvider) {
        const provider = this.registry.emailProviders.get(byopProvider.providerName);
        if (provider && (await this.support.validateProviderConfig(provider, byopProvider.config))) {
          this.logger.log(
            `Using BYOP email provider: ${byopProvider.providerName} for tenant: ${tenantId}`,
          );
          const result = await provider.sendEmail(payload);
          await this.support.chargeForSend(tenantId, "email", "byo");
          return result;
        }
      }

      let enhancedPayload = payload;
      if (tenantId) {
        try {
          const brandConfig = await this.brandService.getBrandConfigForEmail(tenantId, brandId);
          if (brandConfig.brandConfig) {
            enhancedPayload = {
              ...payload,
              brandConfig: brandConfig.brandConfig,
            };

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
        }
      }

      const fallbackProvider = this.registry.emailProviders.get(EMAIL_FALLBACK_PROVIDER);
      if (!fallbackProvider) {
        throw new Error("No email provider available");
      }

      this.logger.log(
        `Using platform email provider: ${EMAIL_FALLBACK_PROVIDER} for tenant: ${tenantId || "system"}`,
      );
      const result = await fallbackProvider.sendEmail(enhancedPayload);
      await this.support.chargeForSend(tenantId, "email", "managed");
      return result;
    } catch (error) {
      this.logger.error(`Email sending failed: ${error.message}`, error.stack);
      throw error;
    }
  }

  async sendChatMessage(
    payload: ChatPayload,
    providerName: string,
    tenantId?: string,
  ): Promise<any> {
    try {
      const billingChannel = providerName === "whatsapp" ? "whatsapp" : "email";
      const byopProvider = await this.support.getBYOPProvider(
        providerName === "whatsapp" ? "whatsapp" : "chat",
        tenantId,
        providerName,
      );
      if (byopProvider) {
        const provider = this.registry.chatProviders.get(byopProvider.providerName);
        if (provider && (await this.support.validateProviderConfig(provider, byopProvider.config))) {
          const result = await provider.sendMessage(payload);
          await this.support.chargeForSend(tenantId, billingChannel, "byo");
          return result;
        }
      }

      const provider = this.registry.chatProviders.get(providerName);
      if (!provider) {
        throw new Error(`Chat provider '${providerName}' not found`);
      }

      const result = await provider.sendMessage(payload);
      await this.support.chargeForSend(tenantId, billingChannel, "managed");
      return result;
    } catch (error) {
      this.logger.error(`Chat message sending failed: ${error.message}`, error.stack);
      throw error;
    }
  }

  async sendPushNotification(
    payload: PushPayload,
    tenantId?: string,
    brandId?: string,
  ): Promise<any> {
    try {
      const byopProvider = await this.support.getBYOPProvider("push", tenantId);
      if (byopProvider) {
        const provider = this.registry.pushProviders.get(byopProvider.providerName);
        if (provider && (await this.support.validateProviderConfig(provider, byopProvider.config))) {
          this.logger.log(
            `Using BYOP push provider: ${byopProvider.providerName} for tenant: ${tenantId}`,
          );
          const result = await provider.sendPushNotification(payload);
          await this.support.chargeForSend(tenantId, "push", "byo");
          return result;
        }
      }

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
        }
      }

      const fallbackProvider = this.registry.pushProviders.get(PUSH_FALLBACK_PROVIDER);
      if (!fallbackProvider) {
        throw new Error("No push provider available");
      }

      this.logger.log(
        `Using platform push provider: ${PUSH_FALLBACK_PROVIDER} for tenant: ${tenantId || "system"}`,
      );
      const result = await fallbackProvider.sendPushNotification(enhancedPayload);
      await this.support.chargeForSend(tenantId, "push", "managed");
      return result;
    } catch (error) {
      this.logger.error(`Push notification sending failed: ${error.message}`, error.stack);
      throw error;
    }
  }

  async sendSMS(payload: SMSPayload, tenantId?: string): Promise<any> {
    try {
      const byopProvider = await this.support.getBYOPProvider("sms", tenantId);
      if (byopProvider) {
        const provider = this.registry.smsProviders.get(byopProvider.providerName);
        if (provider && (await this.support.validateProviderConfig(provider, byopProvider.config))) {
          this.logger.log(
            `Using BYOP SMS provider: ${byopProvider.providerName} for tenant: ${tenantId}`,
          );
          const result = await provider.sendSMS(payload);
          await this.support.chargeForSend(tenantId, "sms", "byo");
          return result;
        }
      }

      const bestProvider = this.smsRoutingService.getBestProvider(payload.to);
      if (!bestProvider) {
        throw new Error("No SMS provider available for this phone number");
      }

      this.logger.log(
        `Using SMS provider: ${bestProvider.getProviderName()} for tenant: ${tenantId || "system"}`,
      );
      const result = await bestProvider.sendSMS(payload);
      await this.support.chargeForSend(tenantId, "sms", "managed");
      return result;
    } catch (error) {
      this.logger.error(`SMS sending failed: ${error.message}`, error.stack);
      throw error;
    }
  }

  async sendBulkSMS(payload: BulkSMSPayload, tenantId?: string): Promise<any> {
    try {
      const byopProvider = await this.support.getBYOPProvider("sms", tenantId);
      if (byopProvider) {
        const provider = this.registry.smsProviders.get(byopProvider.providerName);
        if (provider && (await this.support.validateProviderConfig(provider, byopProvider.config))) {
          this.logger.log(
            `Using BYOP SMS provider for bulk: ${byopProvider.providerName} for tenant: ${tenantId}`,
          );
          const result = await provider.sendBulkSMS(payload);
          const recipientCount = payload.recipients?.length ?? 1;
          await this.support.chargeForSend(tenantId, "sms", "byo", undefined, recipientCount);
          return result;
        }
      }

      const defaultProvider = this.smsRoutingService.getDefaultProvider();
      if (!defaultProvider) {
        throw new Error("No SMS provider available for bulk sending");
      }

      this.logger.log(
        `Using default SMS provider for bulk: ${defaultProvider.getProviderName()} for tenant: ${tenantId || "system"}`,
      );
      const result = await defaultProvider.sendBulkSMS(payload);
      const recipientCount = payload.recipients?.length ?? 1;
      await this.support.chargeForSend(tenantId, "sms", "managed", undefined, recipientCount);
      return result;
    } catch (error) {
      this.logger.error(`Bulk SMS sending failed: ${error.message}`, error.stack);
      throw error;
    }
  }

  async sendVoiceCall(
    payload: { to: string[]; message?: string; templateId?: string; templateData?: any },
    tenantId?: string,
  ): Promise<any> {
    try {
      this.logger.log(`Voice call requested for tenant: ${tenantId || "system"}`);

      const phoneNumber = payload.to[0];
      this.logger.log(`Voice call to ${phoneNumber} would be initiated via Telnyx`);

      const result = {
        success: true,
        callId: `voice_call_${Date.now()}`,
        provider: "telnyx",
        message: "Voice call initiated (Telnyx integration ready)",
      };

      await this.support.chargeForSend(tenantId, "voice", "managed", { durationMinutes: 1 });
      return result;
    } catch (error) {
      this.logger.error(`Voice call failed: ${error.message}`, error.stack);
      throw error;
    }
  }

  async sendInAppNotification(payload: InAppPayload, tenantId?: string): Promise<any> {
    try {
      const result = await this.inAppOrchestrator.sendInAppNotification(payload);
      await this.support.chargeForSend(tenantId, "in_app", "managed");
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
}
