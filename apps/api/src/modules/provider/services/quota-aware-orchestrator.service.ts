import { Injectable, Logger, BadRequestException } from "@nestjs/common";
import { NotificationChannel } from "../../../common/enums/notification-channel.enum";
import { TenantService } from "../../tenant/tenant.service";
import { ProviderOrchestratorService } from "../provider-orchestrator.service";
import { ProviderConfigRepository } from "../provider-config.repository";
import { BillingService } from "../../billing/services/billing.service";
import { EmailMessage } from "../providers/email/email-provider.interface";
import { ChatPayload } from "../providers/chat/chat-provider.interface";
import { PushPayload } from "../providers/push/push-provider.interface";
import { SMSPayload } from "../providers/sms/sms-provider.interface";
import { InAppPayload } from "../providers/in-app/in-app-provider.interface";

@Injectable()
export class QuotaAwareOrchestratorService {
  private readonly logger = new Logger(QuotaAwareOrchestratorService.name);

  constructor(
    private readonly providerOrchestrator: ProviderOrchestratorService,
    private readonly tenantService: TenantService,
    private readonly providerConfigRepository: ProviderConfigRepository,
    private readonly billingService: BillingService,
  ) {}

  /**
   * Send email with quota checking and brand support
   */
  async sendEmail(payload: EmailMessage, tenantId: string, brandId?: string): Promise<any> {
    return this.sendWithQuotaCheck("email", tenantId, () =>
      this.providerOrchestrator.sendEmail(payload, tenantId, brandId),
    );
  }

  /**
   * Send SMS with quota checking
   */
  async sendSMS(payload: SMSPayload, tenantId: string): Promise<any> {
    return this.sendWithQuotaCheck("sms", tenantId, () =>
      this.providerOrchestrator.sendSMS(payload, tenantId),
    );
  }

  /**
   * Send push notification with quota checking and brand support
   */
  async sendPushNotification(
    payload: PushPayload,
    tenantId: string,
    brandId?: string,
  ): Promise<any> {
    return this.sendWithQuotaCheck("push", tenantId, () =>
      this.providerOrchestrator.sendPushNotification(payload, tenantId, brandId),
    );
  }

  /**
   * Send chat message with quota checking
   */
  async sendChatMessage(
    payload: ChatPayload,
    providerName: string,
    tenantId: string,
  ): Promise<any> {
    return this.sendWithQuotaCheck("chat", tenantId, () =>
      this.providerOrchestrator.sendChatMessage(payload, providerName, tenantId),
    );
  }

  /**
   * Send in-app notification (no quota - always free)
   */
  async sendInAppNotification(payload: InAppPayload): Promise<any> {
    // In-app notifications are always free - no quota checking needed
    return this.providerOrchestrator.sendInAppNotification(payload);
  }

  /**
   * Send voice call with quota checking
   */
  async sendVoiceCall(
    payload: { to: string[]; message?: string; templateId?: string; templateData?: any },
    tenantId: string,
  ): Promise<any> {
    return this.sendWithQuotaCheck("voice", tenantId, () =>
      this.providerOrchestrator.sendVoiceCall(payload, tenantId),
    );
  }

  /**
   * Send multi-channel event (TeamLyf/Novu style - 1 event = multiple channels)
   */
  async sendMultiChannelEvent(
    tenantId: string,
    channels: string[],
    payloads: Record<string, any>,
  ): Promise<{
    eventId: string;
    results: Array<{ channel: string; success: boolean; result?: any; error?: string }>;
    billing: any;
  }> {
    const eventId = `event_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const results: Array<{
      channel: string;
      success: boolean;
      result?: any;
      error?: string;
    }> = [];
    let hasBYOP = false;
    let hasSystemProvider = false;

    // Check if any channel uses BYOP
    for (const channel of channels) {
      const channelHasBYOP = await this.checkBYOPConfiguration(tenantId, channel);
      if (channelHasBYOP) {
        hasBYOP = true;
      } else {
        hasSystemProvider = true;
      }
    }

    let billing;
    if (hasBYOP && !hasSystemProvider) {
      // All channels use BYOP - charge 1 event
      billing = await this.billingService.calculateEventBilling(tenantId, "event", 1, {
        eventId,
        channels,
        allBYOP: true,
      });
    } else if (!hasBYOP && hasSystemProvider) {
      // All channels use system providers - use quota system
      billing = { charged: false, amount: 0, reason: "Using quota system for all channels" };
    } else {
      // Mixed BYOP and system providers - charge 1 event for BYOP portion
      billing = await this.billingService.calculateEventBilling(tenantId, "event", 1, {
        eventId,
        channels,
        mixed: true,
      });
    }

    // Send to each channel
    for (const channel of channels) {
      try {
        let result;
        const payload = payloads[channel];

        switch (channel) {
          case "email":
            result = await this.sendEmail(payload, tenantId);
            break;
          case "sms":
            result = await this.sendSMS(payload, tenantId);
            break;
          case "push":
            result = await this.sendPushNotification(payload, tenantId);
            break;
          case "whatsapp":
            result = await this.sendChatMessage(payload, "whatsapp", tenantId);
            break;
          case "inApp":
            result = await this.sendInAppNotification(payload);
            break;
          default:
            throw new Error(`Unsupported channel: ${channel}`);
        }

        results.push({ channel, success: true, result });
      } catch (error) {
        results.push({ channel, success: false, error: error.message });
      }
    }

    return { eventId, results, billing };
  }

  /**
   * Core method that handles quota checking and usage tracking
   */
  private async sendWithQuotaCheck<T>(
    channel: string,
    tenantId: string,
    sendFunction: () => Promise<T>,
    messageCount: number = 1,
  ): Promise<T> {
    // Step 1: Check if tenant has BYOP configured for this channel
    const hasBYOP = await this.checkBYOPConfiguration(tenantId, channel);

    if (hasBYOP) {
      // BYOP configured - send via customer's provider
      try {
        const result = await sendFunction();

        // Calculate and track event-based billing for BYOP usage
        const billingResult = await this.billingService.calculateEventBilling(
          tenantId,
          "event",
          1, // 1 event regardless of channels (like Novu)
          { byop: true, channels: [channel], provider: "customer" },
        );

        this.logger.log(
          `BYOP ${channel} sent - tenant: ${tenantId} - infrastructure fee: $${billingResult.amount}`,
        );
        return result;
      } catch (error) {
        this.logger.error(`BYOP ${channel} failed - tenant: ${tenantId} - no charges applied`);
        throw error;
      }
    }

    // Step 2: No BYOP - check channel quota before using system provider
    const hasQuota = await this.tenantService.checkQuotas(tenantId, channel);

    if (!hasQuota) {
      throw new BadRequestException(
        `${channel.toUpperCase()} quota exhausted. Please configure your own provider (BYOP) or purchase more tokens.`,
      );
    }

    // Step 3: Send using system provider
    try {
      const result = await sendFunction();

      // Step 4: Deduct from quota after successful send (full service charge)
      await this.tenantService.updateUsage(tenantId, channel, messageCount);

      this.logger.log(
        `System provider ${channel} sent - tenant: ${tenantId} - quota deducted: ${messageCount}`,
      );
      return result;
    } catch (error) {
      // Don't deduct quota if sending failed
      this.logger.error(
        `System provider failed for ${channel} - tenant: ${tenantId} - no quota deducted`,
      );
      throw error;
    }
  }

  /**
   * Check if tenant has BYOP configured for a specific channel
   */
  private async checkBYOPConfiguration(tenantId: string, channel: string): Promise<boolean> {
    try {
      const channelMap = {
        email: NotificationChannel.EMAIL,
        sms: NotificationChannel.SMS,
        push: NotificationChannel.PUSH,
        chat: NotificationChannel.CHAT,
        whatsapp: NotificationChannel.CHAT, // WhatsApp is a chat channel
        inApp: NotificationChannel.IN_APP,
        voice: NotificationChannel.VOICE,
      };

      const notificationChannel = channelMap[channel];
      if (!notificationChannel) {
        return false;
      }

      // Check if tenant has active BYOP provider for this channel
      const activeProviders = await this.providerConfigRepository.findActiveByTenantAndChannel(
        tenantId,
        notificationChannel,
      );

      return activeProviders.length > 0;
    } catch (error) {
      this.logger.warn(`Failed to check BYOP configuration: ${error.message}`);
      return false;
    }
  }

  /**
   * Get quota status for a tenant
   */
  async getQuotaStatus(tenantId: string): Promise<{
    channels: Record<
      string,
      {
        hasQuota: boolean;
        hasBYOP: boolean;
        usage?: number;
        limit?: number;
      }
    >;
  }> {
    const channels = ["email", "sms", "push", "whatsapp", "inApp", "voice"];
    const status: Record<string, any> = {};

    for (const channel of channels) {
      const hasQuota = await this.tenantService.checkQuotas(tenantId, channel);
      const hasBYOP = await this.checkBYOPConfiguration(tenantId, channel);

      status[channel] = {
        hasQuota,
        hasBYOP,
        // You could add usage/limit details here
      };
    }

    return { channels: status };
  }

  /**
   * Bulk send with quota checking
   */
  async sendBulk<T>(
    channel: string,
    tenantId: string,
    payloads: any[],
    sendFunction: (payload: any) => Promise<T>,
  ): Promise<Array<{ success: boolean; result?: T; error?: string }>> {
    const results: Array<{ success: boolean; result?: T; error?: string }> = [];

    // Check if we have BYOP or enough quota for all messages
    const hasBYOP = await this.checkBYOPConfiguration(tenantId, channel);

    if (!hasBYOP) {
      // Check if we have enough quota for all messages
      const hasQuota = await this.tenantService.checkQuotas(tenantId, channel);
      if (!hasQuota) {
        throw new BadRequestException(
          `Insufficient ${channel.toUpperCase()} quota for bulk send. Configure BYOP or purchase more tokens.`,
        );
      }
    }

    // Process each payload
    for (const payload of payloads) {
      try {
        const result = await this.sendWithQuotaCheck(channel, tenantId, () =>
          sendFunction(payload),
        );
        results.push({ success: true, result });
      } catch (error) {
        results.push({ success: false, error: error.message });
      }
    }

    return results;
  }
}
