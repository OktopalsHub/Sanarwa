import { BadRequestException, Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import {
  BaseEmailProvider,
  EmailMessage,
  EmailProviderConfig,
} from "./providers/email/email-provider.interface";
import { IChatProvider, ChatPayload } from "./providers/chat/chat-provider.interface";
import { IPushProvider, PushPayload } from "./providers/push/push-provider.interface";
import { ISMSProvider, SMSPayload, BulkSMSPayload } from "./providers/sms/sms-provider.interface";
import { InAppPayload } from "./providers/in-app/in-app-provider.interface";
import { CircuitBreakerService } from "../../common/errors/services/circuit-breaker.service";
import { CircuitBreakerException } from "../../common/errors/exceptions/base.exception";
import { DeviceRegistrationService } from "./services/device-registration.service";
import { InAppOrchestratorService } from "./providers/in-app/in-app-orchestrator.service";
import { SMSRoutingService } from "./providers/sms/sms-routing.service";
import { NotificationChannel } from "../../common/enums/notification-channel.enum";
import { ProviderConfigRepository } from "./provider-config.repository";
import { BrandMessagingConfigService } from "../brand/services/brand-messaging-config.service";
import { BrandedPushService } from "./services/branded-push.service";
import { BillingIntegrationService } from "../billing/services/billing-integration.service";
import { VoiceService } from "./services/voice.service";
import { BillingMode, BillingChannel } from "../billing/constants/token-pricing";
import { randomUUID } from "crypto";
import { ProviderSendOutcome, toProviderSendOutcome } from "./provider-send-outcome";
import { ProviderEncryptionService } from "./provider-encryption.service";

type EmailProviderFactory = (config: EmailProviderConfig) => BaseEmailProvider;
type PushProviderFactory = (config: Record<string, any>) => IPushProvider;
type SmsProviderFactory = (config: Record<string, any>) => ISMSProvider;
type ChatProviderFactory = (config: Record<string, any>) => IChatProvider;
type ChatProviderConfigAlias = "whatsapp_business";

const CHAT_PROVIDER_ALIASES: Record<ChatProviderConfigAlias, string> = {
  whatsapp_business: "whatsapp",
};

/**
 * Marks a provider-reported failure so the circuit breaker records it. The
 * operation throws this inside `circuitBreaker.execute`; callers that need a
 * failed outcome (single-provider BYOP sends) convert it back.
 */
class ProviderOutcomeFailure extends Error {
  constructor(readonly outcome: ProviderSendOutcome) {
    super(outcome.status === "failed" ? outcome.reason : "provider failed");
    this.name = "ProviderOutcomeFailure";
  }
}

/**
 * Totally-transient outcomes (network/5xx/429 reported as `{ success: false }`)
 * count toward the circuit; permanent ones (`retryable: false`, e.g. invalid
 * recipient) still fall through the managed chain but never open the circuit.
 */
function isRetryableFailure(outcome: ProviderSendOutcome): boolean {
  return outcome.status === "failed" && outcome.retryable !== false;
}

@Injectable()
export class ProviderOrchestratorService {
  private readonly logger = new Logger(ProviderOrchestratorService.name);

  private static readonly EMAIL_MANAGED_CHAIN = ["zeptomail", "mailgun", "sendgrid"] as const;
  /**
   * Managed push chain: FCM covers Android devices and browser push, APNs
   * covers iOS, Expo covers React Native. SNS is intentionally not in this
   * position: it is available only as BYOP (tenants bring their own AWS
   * platform-endpoint proxy), mirroring how SES is BYOP-only for email.
   */
  private static readonly PUSH_MANAGED_CHAIN = ["fcm", "apple-push", "expo-push"] as const;

  private emailProviders = new Map<string, BaseEmailProvider>();
  private emailProviderFactories = new Map<string, EmailProviderFactory>();
  private chatProviders = new Map<string, IChatProvider>();
  private chatProviderFactories = new Map<string, ChatProviderFactory>();
  private pushProviders = new Map<string, IPushProvider>();
  private pushProviderFactories = new Map<string, PushProviderFactory>();
  private smsProviders = new Map<string, ISMSProvider>();
  private smsProviderFactories = new Map<string, SmsProviderFactory>();

  constructor(
    private readonly configService: ConfigService,
    private readonly smsRoutingService: SMSRoutingService,
    private readonly providerConfigRepository: ProviderConfigRepository,
    private readonly inAppOrchestrator: InAppOrchestratorService,
    private readonly brandService: BrandMessagingConfigService,
    private readonly brandedPushService: BrandedPushService,
    private readonly billingIntegrationService: BillingIntegrationService,
    private readonly voiceService: VoiceService,
    private readonly providerEncryptionService: ProviderEncryptionService,
    private readonly circuitBreaker: CircuitBreakerService,
    private readonly deviceRegistrationService: DeviceRegistrationService,
  ) {}

  private assertTenantId(tenantId: string | undefined): asserts tenantId is string {
    if (typeof tenantId !== "string" || tenantId.trim().length === 0) {
      throw new BadRequestException("A tenant is required to send a message");
    }
  }

  private async attemptManagedChain<T>(
    registry: Map<string, T>,
    chain: readonly string[],
    channel: "email" | "push" | "sms",
    tenantId: string,
    call: (provider: T) => Promise<unknown>,
  ): Promise<{ outcome: ProviderSendOutcome; provider: string } | null> {
    const attempts: string[] = [];

    for (const name of chain) {
      const provider = registry.get(name);

      if (!provider) {
        continue;
      }

      attempts.push(name);

      try {
        const outcome = await this.circuitBreaker.execute(
          `managed-${channel}:${name}`,
          async () => {
            const raw = await call(provider);
            const mapped = toProviderSendOutcome(raw);

            if (mapped.failedTokens && mapped.failedTokens.length > 0) {
              await this.deviceRegistrationService.pruneInvalidTokens(mapped.failedTokens);
            }

            if (isRetryableFailure(mapped)) {
              throw new ProviderOutcomeFailure(mapped);
            }

            return mapped;
          },
        );

        if (outcome.status === "sent") {
          this.logger.log(
            `${channel} sent via ${name} for tenant: ${tenantId} (attempts: ${attempts.join(" → ")})`,
          );
          return { outcome: { ...outcome, providerId: name }, provider: name };
        }

        this.logger.warn(`Managed ${channel} provider ${name} reported failure: ${outcome.reason}`);
      } catch (error) {
        this.logger.warn(`Managed ${channel} provider ${name} threw: ${(error as Error).message}`);
      }
    }

    this.logger.error(`All managed ${channel} providers failed (${attempts.join(", ")})`);

    return null;
  }

  /**
   * Runs a single-provider (BYOP) send behind its per-tenant circuit. Provider
   * failures reported as `{ success: false }` count toward the circuit and are
   * returned as failed outcomes (never charged); thrown errors propagate.
   */
  private async attemptByopSend(
    key: string,
    call: () => Promise<unknown>,
    providerName?: string,
  ): Promise<ProviderSendOutcome> {
    try {
      return await this.circuitBreaker.execute(key, async () => {
        const raw = await call();
        const mapped = providerName
          ? { ...toProviderSendOutcome(raw), providerId: providerName }
          : toProviderSendOutcome(raw);
        if (isRetryableFailure(mapped)) {
          throw new ProviderOutcomeFailure(mapped);
        }
        return mapped;
      });
    } catch (error) {
      if (error instanceof ProviderOutcomeFailure) {
        return providerName ? { ...error.outcome, providerId: providerName } : error.outcome;
      }
      if (error instanceof CircuitBreakerException) {
        return {
          status: "failed",
          reason: `Provider circuit open for ${key}`,
          providerId: providerName,
          retryable: true,
        };
      }
      throw error;
    }
  }

  registerEmailProvider(
    name: string,
    provider: BaseEmailProvider,
    factory?: EmailProviderFactory,
  ): void {
    this.emailProviders.set(name, provider);
    if (factory) {
      this.emailProviderFactories.set(name, factory);
    }
    this.logger.log(`Registered email provider: ${name}`);
  }

  registerChatProvider(name: string, provider: IChatProvider, factory?: ChatProviderFactory): void {
    this.chatProviders.set(name, provider);
    if (factory) {
      this.chatProviderFactories.set(name, factory);
    }
    this.logger.log(`Registered chat provider: ${name}`);
  }

  registerPushProvider(name: string, provider: IPushProvider, factory?: PushProviderFactory): void {
    this.pushProviders.set(name, provider);
    if (factory) {
      this.pushProviderFactories.set(name, factory);
    }
    this.logger.log(`Registered push provider: ${name}`);
  }

  registerSMSProvider(name: string, provider: ISMSProvider, factory?: SmsProviderFactory): void {
    this.smsProviders.set(name, provider);
    if (factory) {
      this.smsProviderFactories.set(name, factory);
    }
    this.smsRoutingService.registerProvider(provider);
    this.logger.log(`Registered SMS provider: ${name}`);
  }

  async sendEmail(
    payload: EmailMessage,
    tenantId: string,
    brandId?: string,
  ): Promise<ProviderSendOutcome> {
    this.assertTenantId(tenantId);
    try {
      const resolved = await this.resolveManagedProvider(
        NotificationChannel.EMAIL,
        this.emailProviders,
        tenantId,
      );
      if (resolved?.mode === "byo") {
        const provider = await this.createByopEmailProvider(resolved);
        const outcome = await this.attemptByopSend(
          `byo-email:${tenantId}:${resolved.providerName}`,
          () => provider.sendEmail(payload),
          resolved.providerName,
        );
        if (outcome.status === "sent") {
          await this.chargeForSend(tenantId, NotificationChannel.EMAIL, "byo");
        }
        return outcome;
      }

      let enhancedPayload = payload;
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

      const managed = await this.attemptManagedChain(
        this.emailProviders,
        ProviderOrchestratorService.EMAIL_MANAGED_CHAIN,
        "email",
        tenantId,
        (provider) => provider.sendEmail(enhancedPayload),
      );

      if (!managed) {
        throw new Error("All managed email providers failed");
      }

      await this.chargeForSend(tenantId, NotificationChannel.EMAIL, "managed");
      return managed.outcome;
    } catch (error) {
      this.logger.error(`Email sending failed: ${error.message}`, error.stack);
      throw error;
    }
  }

  async sendChatMessage(
    payload: ChatPayload,
    providerName: string,
    tenantId: string,
  ): Promise<ProviderSendOutcome> {
    this.assertTenantId(tenantId);
    try {
      const resolvedName = this.resolveProviderName(providerName);
      const channel =
        resolvedName === "whatsapp" ? NotificationChannel.WHATSAPP : NotificationChannel.CHAT;
      const billingChannel: BillingChannel =
        resolvedName === "whatsapp" ? NotificationChannel.WHATSAPP : NotificationChannel.CHAT;
      const breakerChannel = channel === NotificationChannel.WHATSAPP ? "whatsapp" : "chat";

      if (!this.chatProviders.has(resolvedName)) {
        throw new Error(`Chat provider '${resolvedName}' not found`);
      }

      const resolved = await this.resolveManagedProvider(
        channel,
        this.chatProviders,
        tenantId,
        resolvedName,
      );

      // Chat and WhatsApp are BYOP-only. There is deliberately no platform
      // fallback: a tenant without a connection gets a clear error instead of
      // sending from someone else's account.
      if (!resolved?.mode) {
        throw new BadRequestException(
          `No ${resolvedName} connection is configured for this tenant. Connect it under Channels.`,
        );
      }

      const provider = this.createByopChatProvider(resolved);
      const outcome = await this.attemptByopSend(
        `byo-${breakerChannel}:${tenantId}:${resolvedName}`,
        () => provider.sendMessage(payload),
        resolvedName,
      );
      if (outcome.status === "sent") {
        await this.chargeForSend(tenantId, billingChannel, "byo");
      }
      return outcome;
    } catch (error) {
      this.logger.error(`Chat message sending failed: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Sends through the tenant's own chat connection without touching managed
   * providers or token billing. Used by the "send test message" button so a
   * tenant can validate credentials before routing production traffic.
   * Deliberately bypasses the circuit breaker: a probe must work even while
   * the production circuit is open.
   */
  async testChatConnection(
    payload: ChatPayload,
    providerName: string,
    tenantId: string,
    options: { verifyOnly?: boolean } = {},
  ): Promise<ProviderSendOutcome> {
    this.assertTenantId(tenantId);
    const resolvedName = this.resolveProviderName(providerName);
    const channel =
      resolvedName === "whatsapp" ? NotificationChannel.WHATSAPP : NotificationChannel.CHAT;
    const byop = await this.getBYOPProvider(channel, tenantId, resolvedName);
    if (!byop) {
      throw new BadRequestException(`No ${resolvedName} connection is configured for this tenant`);
    }

    const registered = this.chatProviders.get(byop.providerName);
    if (!registered) {
      throw new BadRequestException(`Chat provider '${byop.providerName}' is not registered`);
    }

    const provider = this.createByopChatProvider({ ...byop, provider: registered });

    if (options.verifyOnly) {
      const verifier = (
        provider as IChatProvider & {
          verifyCredentials?: (config?: unknown) => Promise<boolean>;
        }
      ).verifyCredentials;
      if (typeof verifier === "function") {
        const ok = await verifier.call(provider, byop.config);
        return ok
          ? { status: "sent", externalId: undefined }
          : { status: "failed", reason: "Credential check failed" };
      }
    }

    const result = await provider.sendMessage(payload);
    return toProviderSendOutcome(result);
  }

  async sendPushNotification(
    payload: PushPayload,
    tenantId: string,
    brandId?: string,
  ): Promise<ProviderSendOutcome> {
    this.assertTenantId(tenantId);
    try {
      const resolved = await this.resolveManagedProvider(
        NotificationChannel.PUSH,
        this.pushProviders,
        tenantId,
      );
      if (resolved?.mode === "byo") {
        const outcome = await this.attemptByopSend(
          `byo-push:${tenantId}:${resolved.providerName}`,
          () => this.createByopPushProvider(resolved).sendPushNotification(payload),
          resolved.providerName,
        );
        if (outcome.status === "sent") {
          await this.chargeForSend(tenantId, NotificationChannel.PUSH, "byo");
        }
        return outcome;
      }

      let enhancedPayload = payload;
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
        this.logger.warn(`Failed to enhance push notification with brand config: ${error.message}`);
      }

      const managed = await this.attemptManagedChain(
        this.pushProviders,
        ProviderOrchestratorService.PUSH_MANAGED_CHAIN,
        "push",
        tenantId,
        (provider) => provider.sendPushNotification(enhancedPayload),
      );

      if (!managed) {
        throw new Error("All managed push providers failed");
      }

      await this.chargeForSend(tenantId, NotificationChannel.PUSH, "managed");
      return managed.outcome;
    } catch (error) {
      this.logger.error(`Push notification sending failed: ${error.message}`, error.stack);
      throw error;
    }
  }

  async sendSMS(payload: SMSPayload, tenantId: string): Promise<ProviderSendOutcome> {
    this.assertTenantId(tenantId);
    try {
      const resolved = await this.resolveManagedProvider(
        NotificationChannel.SMS,
        this.smsProviders,
        tenantId,
      );
      if (resolved?.mode === "byo") {
        const outcome = await this.attemptByopSend(
          `byo-sms:${tenantId}:${resolved.providerName}`,
          () => this.createByopSmsProvider(resolved).sendSMS(payload),
          resolved.providerName,
        );
        if (outcome.status === "sent") {
          await this.chargeForSend(tenantId, NotificationChannel.SMS, "byo");
        }
        return outcome;
      }

      const preferred = this.smsRoutingService.getPreferredProviders(payload.to);
      if (preferred.length === 0) {
        throw new Error("No SMS provider available for this phone number");
      }

      const chain = [...new Set(preferred.map((provider) => provider.getProviderName()))];
      const managed = await this.attemptManagedChain(
        this.smsProviders,
        chain,
        "sms",
        tenantId,
        (provider) => provider.sendSMS(payload),
      );

      if (!managed) {
        throw new Error("All managed SMS providers failed");
      }

      await this.chargeForSend(tenantId, NotificationChannel.SMS, "managed");
      return managed.outcome;
    } catch (error) {
      this.logger.error(`SMS sending failed: ${error.message}`, error.stack);
      throw error;
    }
  }

  async sendBulkSMS(payload: BulkSMSPayload, tenantId: string): Promise<ProviderSendOutcome> {
    this.assertTenantId(tenantId);
    try {
      const resolved = await this.resolveManagedProvider(
        NotificationChannel.SMS,
        this.smsProviders,
        tenantId,
      );
      if (resolved?.mode === "byo") {
        const outcome = await this.attemptByopSend(
          `byo-sms:${tenantId}:${resolved.providerName}`,
          () => this.createByopSmsProvider(resolved).sendBulkSMS(payload),
          resolved.providerName,
        );
        if (outcome.status === "sent") {
          const recipientCount = payload.recipients?.length ?? 1;
          await this.chargeForSend(
            tenantId,
            NotificationChannel.SMS,
            "byo",
            undefined,
            recipientCount,
          );
        }
        return outcome;
      }

      // Bulk sends have no recipient country spread to optimise for; order by
      // the first recipient and fall through the rest on failure.
      const preferred = this.smsRoutingService.getPreferredProviders(payload.recipients?.[0] ?? "");
      if (preferred.length === 0) {
        throw new Error("No SMS provider available for bulk sending");
      }

      const chain = [...new Set(preferred.map((provider) => provider.getProviderName()))];
      const recipientCount = payload.recipients?.length ?? 1;
      const managed = await this.attemptManagedChain(
        this.smsProviders,
        chain,
        "sms",
        tenantId,
        (provider) => provider.sendBulkSMS(payload),
      );

      if (!managed) {
        throw new Error("All managed SMS providers failed");
      }

      await this.chargeForSend(
        tenantId,
        NotificationChannel.SMS,
        "managed",
        undefined,
        recipientCount,
      );
      return managed.outcome;
    } catch (error) {
      this.logger.error(`Bulk SMS sending failed: ${error.message}`, error.stack);
      throw error;
    }
  }

  private async chargeForSend(
    tenantId: string,
    channel: BillingChannel,
    billingMode: BillingMode,
    metadata?: Record<string, unknown>,
    eventCount = 1,
  ): Promise<void> {
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
    channel: NotificationChannel,
    tenantId: string,
    providerName?: string,
  ): Promise<{ providerName: string; config: any } | null> {
    try {
      const configs = await this.providerConfigRepository.findActiveByTenantAndChannel(
        tenantId,
        channel,
      );

      if (providerName) {
        const config = configs.find(
          (candidate) => this.resolveProviderName(candidate.providerId) === providerName,
        );
        return config ? await this.toByopConfig(config) : null;
      }

      const config = configs[0];
      return config ? await this.toByopConfig(config) : null;
    } catch (error) {
      this.logger.warn(`Failed to get BYOP config: ${error.message}`);
      return null;
    }
  }

  private async toByopConfig(config: {
    providerId: string;
    config: Record<string, any>;
  }): Promise<{ providerName: string; config: Record<string, any> }> {
    return {
      providerName: this.resolveProviderName(config.providerId),
      config: await this.providerEncryptionService.decrypt(config.config),
    };
  }

  private resolveProviderName(providerId: string): string {
    if (providerId === "aws_ses") {
      return "ses";
    }
    return CHAT_PROVIDER_ALIASES[providerId as ChatProviderConfigAlias] ?? providerId;
  }

  private createByopChatProvider(resolved: {
    provider: IChatProvider;
    providerName: string;
    config: Record<string, any>;
  }): IChatProvider {
    const factory = this.chatProviderFactories.get(resolved.providerName);
    return factory ? factory(resolved.config) : resolved.provider;
  }

  private createByopPushProvider(resolved: {
    provider: IPushProvider;
    providerName: string;
    config: Record<string, any>;
  }): IPushProvider {
    const factory = this.pushProviderFactories.get(resolved.providerName);
    return factory ? factory(resolved.config) : resolved.provider;
  }

  private createByopSmsProvider(resolved: {
    provider: ISMSProvider;
    providerName: string;
    config: Record<string, any>;
  }): ISMSProvider {
    const factory = this.smsProviderFactories.get(resolved.providerName);
    return factory ? factory(resolved.config) : resolved.provider;
  }

  private async createByopEmailProvider(resolved: {
    provider: BaseEmailProvider;
    providerName: string;
    config: Record<string, any>;
  }): Promise<BaseEmailProvider> {
    const factory = this.emailProviderFactories.get(resolved.providerName);
    if (!factory) {
      return resolved.provider;
    }

    const provider = factory({
      providerId: resolved.providerName,
      name: resolved.providerName,
      isActive: true,
      priority: 1,
      config: resolved.config,
    });
    await provider.initialize();

    return provider;
  }

  private async validateProviderConfig(provider: any, config?: unknown): Promise<boolean> {
    try {
      return await provider.validateConfig(config);
    } catch (error) {
      this.logger.warn(`Provider config validation failed: ${error.message}`);
      return false;
    }
  }

  private async resolveManagedProvider<T>(
    channel: NotificationChannel,
    registry: Map<string, T>,
    tenantId: string,
    providerName?: string,
  ): Promise<{
    provider: T;
    mode: "byo" | "managed";
    providerName: string;
    config: Record<string, any>;
  } | null> {
    const byopProvider = await this.getBYOPProvider(channel, tenantId, providerName);

    if (byopProvider) {
      const provider = registry.get(byopProvider.providerName);
      if (provider && (await this.validateProviderConfig(provider, byopProvider.config))) {
        this.logger.log(`Using BYOP ${channel} provider: ${byopProvider.providerName}`);
        return {
          provider,
          mode: "byo",
          providerName: byopProvider.providerName,
          config: byopProvider.config,
        };
      }
    }

    return null;
  }

  async sendVoiceCall(
    payload: { to: string[]; message?: string; templateId?: string; templateData?: any },
    tenantId: string,
  ): Promise<ProviderSendOutcome> {
    this.assertTenantId(tenantId);
    try {
      const phoneNumber = payload.to[0];
      if (!phoneNumber) throw new Error("Voice call requires 'to' phone number");
      this.logger.log(`Voice call via Telnyx to ${phoneNumber} tenant:${tenantId}`);

      const result = await this.circuitBreaker.execute(`voice:${tenantId}:telnyx`, async () => {
        const call = await this.voiceService.createOutboundCall(
          {
            phoneNumber,
            message: payload.message || "Sanarwa voice notification",
            voice: { voice: "Telnyx.Natural.abbie", language: "en-US" },
          },
          tenantId,
        );

        if (!call.success) {
          throw new Error(call.error || "Telnyx voice call failed");
        }

        return call;
      });

      await this.chargeForSend(tenantId, NotificationChannel.VOICE, "managed", {
        durationMinutes: 1,
        callControlId: result.callControlId,
      });
      return { status: "sent", externalId: result.callControlId, providerId: "telnyx" };
    } catch (error) {
      this.logger.error(`Voice call failed: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * In-app is an internal database write, not an external provider call, so it
   * runs without a circuit breaker.
   */
  async sendInAppNotification(
    payload: InAppPayload,
    tenantId: string,
  ): Promise<ProviderSendOutcome> {
    this.assertTenantId(tenantId);
    try {
      const result = await this.inAppOrchestrator.sendInAppNotification({ ...payload, tenantId });
      await this.chargeForSend(tenantId, NotificationChannel.IN_APP, "managed");
      return { ...toProviderSendOutcome(result), providerId: "in-app" };
    } catch (error) {
      this.logger.error(`In-app notification failed: ${error.message}`, error.stack);
      throw error;
    }
  }

  async sendToRoom(roomId: string, payload: InAppPayload): Promise<ProviderSendOutcome> {
    try {
      return {
        ...toProviderSendOutcome(await this.inAppOrchestrator.sendToRoom(roomId, payload)),
        providerId: "in-app",
      };
    } catch (error) {
      this.logger.error(`Room notification failed: ${error.message}`, error.stack);
      throw error;
    }
  }

  async sendCallNotification(
    payload: InAppPayload & { callData: NonNullable<InAppPayload["callData"]> },
  ): Promise<ProviderSendOutcome> {
    try {
      return {
        ...toProviderSendOutcome(await this.inAppOrchestrator.sendCallNotification(payload)),
        providerId: "in-app",
      };
    } catch (error) {
      this.logger.error(`Call notification failed: ${error.message}`, error.stack);
      throw error;
    }
  }

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
        return ["telnyx"];
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
