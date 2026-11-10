import {
  BadRequestException,
  Injectable,
  Logger,
  Optional,
  UnauthorizedException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { EventEmitter2 } from "@nestjs/event-emitter";
import { NotificationChannel } from "../../../common/enums/notification-channel.enum";
import { WebhookValidatorService } from "./webhook-validator.service";
import { ProviderConfigRepository } from "../provider-config.repository";
import { ProviderEncryptionService } from "../provider-encryption.service";
import type { InboundSMSPayload, SMSStatusPayload } from "../controllers/sms-webhook.controller";

@Injectable()
export class SmsWebhookIntakeService {
  private readonly logger = new Logger(SmsWebhookIntakeService.name);

  constructor(
    private readonly eventEmitter: EventEmitter2,
    private readonly webhookValidator: WebhookValidatorService,
    private readonly configService: ConfigService,
    @Optional() private readonly providerConfigRepository?: ProviderConfigRepository,
    @Optional() private readonly providerEncryptionService?: ProviderEncryptionService,
  ) {}

  acceptTelnyx(
    rawBody: string | undefined,
    headers: { signature?: string; timestamp?: string },
    body: any,
    publicKey?: string,
  ): { success: boolean } {
    const key = publicKey ?? this.configService.get<string>("TELNYX_PUBLIC_KEY");
    this.verifyTelnyxWithKey(rawBody, headers, key);
    return this.processTelnyxInbound(body);
  }

  acceptTelnyxStatus(
    rawBody: string | undefined,
    headers: { signature?: string; timestamp?: string },
    body: any,
    publicKey?: string,
  ): { success: boolean } {
    const key = publicKey ?? this.configService.get<string>("TELNYX_PUBLIC_KEY");
    this.verifyTelnyxWithKey(rawBody, headers, key);
    return this.processTelnyxStatus(body);
  }

  async acceptTelnyxByTenant(
    rawBody: string | undefined,
    headers: { signature?: string; timestamp?: string },
    body: any,
    tenantId: string,
  ): Promise<{ success: boolean }> {
    const publicKey = await this.resolveTenantSmsKey(tenantId, "telnyx", [
      "webhookPublicKey",
      "publicKey",
      "TELNYX_PUBLIC_KEY",
      "telnyxPublicKey",
    ]);
    if (!publicKey) {
      throw new UnauthorizedException("Telnyx webhook public key is not configured for tenant");
    }
    this.verifyTelnyxWithKey(rawBody, headers, publicKey);
    return this.processTelnyxInbound(body);
  }

  async acceptTelnyxStatusByTenant(
    rawBody: string | undefined,
    headers: { signature?: string; timestamp?: string },
    body: any,
    tenantId: string,
  ): Promise<{ success: boolean }> {
    const publicKey = await this.resolveTenantSmsKey(tenantId, "telnyx", [
      "webhookPublicKey",
      "publicKey",
      "TELNYX_PUBLIC_KEY",
      "telnyxPublicKey",
    ]);
    if (!publicKey) {
      throw new UnauthorizedException("Telnyx webhook public key is not configured for tenant");
    }
    this.verifyTelnyxWithKey(rawBody, headers, publicKey);
    return this.processTelnyxStatus(body);
  }

  acceptAfricasTalking(
    headers: Record<string, string>,
    body: any,
    secret?: string,
  ): { success: boolean } {
    const expected = secret ?? this.configService.get<string>("AFRICASTALKING_WEBHOOK_SECRET");
    this.verifyAfricasTalkingWithSecret(headers, body, expected);
    return this.processAfricasTalkingInbound(body);
  }

  acceptAfricasTalkingStatus(
    headers: Record<string, string>,
    body: any,
    secret?: string,
  ): { success: boolean } {
    const expected = secret ?? this.configService.get<string>("AFRICASTALKING_WEBHOOK_SECRET");
    this.verifyAfricasTalkingWithSecret(headers, body, expected);
    return this.processAfricasTalkingStatus(body);
  }

  async acceptAfricasTalkingByTenant(
    headers: Record<string, string>,
    body: any,
    tenantId: string,
  ): Promise<{ success: boolean }> {
    const secret = await this.resolveTenantSmsKey(tenantId, "africastalking", [
      "webhookSecret",
      "AFRICASTALKING_WEBHOOK_SECRET",
      "africastalkingWebhookSecret",
    ]);
    if (!secret) {
      throw new UnauthorizedException(
        "Africa's Talking webhook secret is not configured for tenant",
      );
    }
    this.verifyAfricasTalkingWithSecret(headers, body, secret);
    return this.processAfricasTalkingInbound(body);
  }

  async acceptAfricasTalkingStatusByTenant(
    headers: Record<string, string>,
    body: any,
    tenantId: string,
  ): Promise<{ success: boolean }> {
    const secret = await this.resolveTenantSmsKey(tenantId, "africastalking", [
      "webhookSecret",
      "AFRICASTALKING_WEBHOOK_SECRET",
      "africastalkingWebhookSecret",
    ]);
    if (!secret) {
      throw new UnauthorizedException(
        "Africa's Talking webhook secret is not configured for tenant",
      );
    }
    this.verifyAfricasTalkingWithSecret(headers, body, secret);
    return this.processAfricasTalkingStatus(body);
  }

  acceptTwilioInbound(
    rawBody: string,
    signature: string | undefined,
    body: any,
  ): { success: boolean } {
    this.verifyTwilioIfConfigured(rawBody, signature);
    const inboundSMS: InboundSMSPayload = {
      messageId: body?.MessageSid,
      from: body?.From,
      to: body?.To,
      text: body?.Body,
      timestamp: new Date(),
      provider: "twilio",
      metadata: {
        accountSid: body?.AccountSid,
        messagingServiceSid: body?.MessagingServiceSid,
        numMedia: body?.NumMedia,
        numSegments: body?.NumSegments,
        conversationId: this.generateConversationId(body?.From, "twilio"),
      },
    };
    this.eventEmitter.emit("sms.inbound.received", inboundSMS);
    this.logger.log(`Inbound SMS received from Twilio: ${body?.MessageSid}`);
    return { success: true };
  }

  acceptTwilioStatus(
    rawBody: string,
    signature: string | undefined,
    body: any,
  ): { success: boolean } {
    this.verifyTwilioIfConfigured(rawBody, signature);
    const statusUpdate: SMSStatusPayload = {
      messageId: body?.MessageSid,
      status: this.mapTwilioStatus(body?.MessageStatus),
      timestamp: new Date(),
      provider: "twilio",
      errorCode: body?.ErrorCode,
      errorMessage: body?.ErrorMessage,
      metadata: { accountSid: body?.AccountSid, price: body?.Price, priceUnit: body?.PriceUnit },
    };
    this.eventEmitter.emit("sms.status.updated", statusUpdate);
    this.logger.log(
      `SMS status updated from Twilio: ${body?.MessageSid} -> ${body?.MessageStatus}`,
    );
    return { success: true };
  }

  acceptTermiiInbound(headers: Record<string, string>, body: any): { success: boolean } {
    this.verifyOptionalSharedSecret(headers, body, "TERMII_WEBHOOK_SECRET", "termii");
    const inboundSMS: InboundSMSPayload = {
      messageId: body?.message_id || `termii_${Date.now()}`,
      from: body?.from,
      to: body?.to,
      text: body?.text || body?.message,
      timestamp: new Date(body?.date || Date.now()),
      provider: "termii",
      metadata: {
        channel: body?.channel,
        type: body?.type,
        conversationId: this.generateConversationId(body?.from, "termii"),
      },
    };
    this.eventEmitter.emit("sms.inbound.received", inboundSMS);
    this.logger.log(`Inbound SMS received from Termii: ${inboundSMS.messageId}`);
    return { success: true };
  }

  acceptTermiiStatus(headers: Record<string, string>, body: any): { success: boolean } {
    this.verifyOptionalSharedSecret(headers, body, "TERMII_WEBHOOK_SECRET", "termii");
    const messageId = body?.message_id ?? body?.id ?? body?.messageId;
    if (!messageId) throw new BadRequestException("Invalid Termii status payload");
    const statusUpdate: SMSStatusPayload = {
      messageId,
      status: this.mapGenericProviderStatus(body?.status),
      timestamp: new Date(body?.date || Date.now()),
      provider: "termii",
      errorMessage: body?.error || body?.reason,
      metadata: { provider: "termii", rawStatus: body?.status },
    };
    this.eventEmitter.emit("sms.status.updated", statusUpdate);
    this.logger.log(`SMS status updated from Termii: ${messageId} -> ${statusUpdate.status}`);
    return { success: true };
  }

  acceptInfobipInbound(headers: Record<string, string>, body: any): { success: boolean } {
    this.verifyOptionalSharedSecret(headers, body, "INFOBIP_WEBHOOK_SECRET", "infobip");
    const results = Array.isArray(body?.results) ? body.results : [body];
    for (const result of results) {
      const inboundSMS: InboundSMSPayload = {
        messageId: result?.messageId || `infobip_${Date.now()}`,
        from: result?.from,
        to: result?.to,
        text: result?.text,
        timestamp: new Date(result?.receivedAt || Date.now()),
        provider: "infobip",
        metadata: {
          keyword: result?.keyword,
          cleanText: result?.cleanText,
          smsCount: result?.smsCount,
          conversationId: this.generateConversationId(result?.from, "infobip"),
        },
      };
      this.eventEmitter.emit("sms.inbound.received", inboundSMS);
    }
    this.logger.log(`Processed ${results.length} inbound SMS from Infobip`);
    return { success: true };
  }

  acceptInfobipStatus(headers: Record<string, string>, body: any): { success: boolean } {
    this.verifyOptionalSharedSecret(headers, body, "INFOBIP_WEBHOOK_SECRET", "infobip");
    const reports = Array.isArray(body?.results) ? body.results : [body];
    for (const report of reports) {
      const messageId = report?.messageId ?? report?.id;
      if (!messageId) continue;
      const status = report?.status?.name ?? report?.status ?? report?.statusGroupName;
      const statusUpdate: SMSStatusPayload = {
        messageId,
        status: this.mapGenericProviderStatus(status),
        timestamp: new Date(report?.doneAt || report?.sentAt || Date.now()),
        provider: "infobip",
        errorCode: report?.error?.groupId?.toString(),
        errorMessage: report?.error?.description || report?.error?.name,
        metadata: { provider: "infobip", rawStatus: status },
      };
      this.eventEmitter.emit("sms.status.updated", statusUpdate);
      this.logger.log(`SMS status updated from Infobip: ${messageId} -> ${statusUpdate.status}`);
    }
    return { success: true };
  }

  private processTelnyxInbound(body: any): { success: boolean } {
    const eventData = body?.data;
    const payload = eventData?.payload ?? eventData;
    if (!payload || (!eventData?.id && !payload?.id))
      throw new BadRequestException("Invalid Telnyx webhook payload");
    const inboundSMS: InboundSMSPayload = {
      messageId: payload.id ?? eventData.id,
      from: payload.from?.phone_number ?? payload.from ?? "",
      to: this.firstPhoneNumber(payload.to),
      text: payload.text ?? "",
      timestamp: new Date(payload.received_at ?? eventData.occurred_at ?? Date.now()),
      provider: "telnyx",
      metadata: {
        eventType: eventData?.event_type ?? body?.meta?.event_type,
        messagingProfileId: payload.messaging_profile_id,
        direction: payload.direction,
        parts: payload.parts,
        conversationId: this.generateConversationId(
          payload.from?.phone_number ?? payload.from ?? "",
          "telnyx",
        ),
      },
    };
    this.eventEmitter.emit("sms.inbound.received", inboundSMS);
    this.logger.log(`Inbound SMS received from Telnyx: ${inboundSMS.messageId}`);
    return { success: true };
  }

  private processTelnyxStatus(body: any): { success: boolean } {
    const eventData = body?.data;
    const payload = eventData?.payload ?? eventData;
    const eventType = eventData?.event_type ?? body?.meta?.event_type ?? "";
    if (!payload?.id) throw new BadRequestException("Invalid Telnyx status payload");
    const errorMessage = payload.errors?.[0]?.detail ?? payload.errors?.[0]?.title;
    const statusUpdate: SMSStatusPayload = {
      messageId: payload.id,
      status: this.mapTelnyxStatus(eventType, payload),
      timestamp: new Date(eventData?.occurred_at ?? payload.completed_at ?? Date.now()),
      provider: "telnyx",
      error: errorMessage,
      errorCode: payload.errors?.[0]?.code,
      errorMessage,
      metadata: {
        provider: "telnyx",
        eventType,
        to: this.firstPhoneNumber(payload.to),
        from: payload.from?.phone_number ?? payload.from,
      },
    };
    this.eventEmitter.emit("sms.status.updated", statusUpdate);
    this.logger.log(`SMS status updated from Telnyx: ${payload.id} -> ${statusUpdate.status}`);
    return { success: true };
  }

  private processAfricasTalkingInbound(body: any): { success: boolean } {
    const from = body?.from ?? "";
    const to = body?.to ?? "";
    if (!from || !to) throw new BadRequestException("Invalid Africa's Talking inbound payload");
    const inboundSMS: InboundSMSPayload = {
      messageId: body?.id ?? body?.messageId ?? `at_${Date.now()}`,
      from,
      to,
      text: body?.text ?? body?.message ?? "",
      timestamp: body?.date ? new Date(body.date) : new Date(),
      provider: "africastalking",
      metadata: {
        linkId: body?.linkId,
        networkCode: body?.networkCode,
        conversationId: this.generateConversationId(from, "africastalking"),
      },
    };
    this.eventEmitter.emit("sms.inbound.received", inboundSMS);
    this.logger.log(`Inbound SMS received from Africa's Talking: ${inboundSMS.messageId}`);
    return { success: true };
  }

  private processAfricasTalkingStatus(body: any): { success: boolean } {
    const messageId = body?.id ?? body?.messageId;
    if (!messageId)
      throw new BadRequestException("Invalid Africa's Talking delivery report payload");
    const statusUpdate: SMSStatusPayload = {
      messageId,
      status: this.mapAfricasTalkingStatus(body?.status),
      timestamp: new Date(),
      provider: "africastalking",
      error: body?.failureReason,
      errorMessage: body?.failureReason,
      metadata: {
        provider: "africastalking",
        phoneNumber: body?.phoneNumber,
        networkCode: body?.networkCode,
        retryCount: body?.retryCount,
      },
    };
    this.eventEmitter.emit("sms.status.updated", statusUpdate);
    this.logger.log(
      `SMS status updated from Africa's Talking: ${messageId} -> ${statusUpdate.status}`,
    );
    return { success: true };
  }

  private async resolveTenantSmsKey(
    tenantId: string,
    providerId: string,
    fields: string[],
  ): Promise<string | undefined> {
    if (!this.providerConfigRepository || !this.providerEncryptionService) return undefined;
    const configs = await this.providerConfigRepository.findActiveByTenantAndChannel(
      tenantId,
      NotificationChannel.SMS,
    );
    const config = configs.find((c) => c.providerId === providerId);
    if (!config) return undefined;
    const decrypted = await this.providerEncryptionService.decrypt(config.config || {});
    for (const field of fields) {
      const value = decrypted?.[field];
      if (typeof value === "string" && value.trim()) return value.trim();
    }
    return undefined;
  }

  private verifyTwilioIfConfigured(rawBody: string, signature?: string): void {
    const secret = this.configService.get<string>("TWILIO_AUTH_TOKEN");
    if (!secret) {
      this.logger.warn(
        "Twilio webhook accepted without signature verification: TWILIO_AUTH_TOKEN not configured (BYOP/global secret unavailable)",
      );
      return;
    }
    const verification = this.webhookValidator.verify({
      provider: "twilio",
      secret,
      rawBody,
      headers: { "x-twilio-signature": signature },
      url: this.configService.get<string>("TWILIO_WEBHOOK_URL"),
    });
    if (verification.kind === "rejected") {
      this.logger.warn(`Rejected Twilio SMS webhook: ${verification.reason}`);
      throw new UnauthorizedException("Invalid Twilio webhook signature");
    }
  }

  private verifyTelnyxWithKey(
    rawBody: string | undefined,
    headers: { signature?: string; timestamp?: string },
    publicKey?: string,
  ): void {
    if (!rawBody)
      throw new BadRequestException("Missing raw request body for webhook verification");
    const verification = this.webhookValidator.verify({
      provider: "telnyx",
      publicKey,
      rawBody,
      headers: {
        "telnyx-signature-ed25519": headers.signature,
        "telnyx-timestamp": headers.timestamp,
      },
    });
    if (verification.kind === "rejected") {
      this.logger.warn(`Rejected Telnyx SMS webhook: ${verification.reason}`);
      throw new UnauthorizedException("Invalid Telnyx webhook signature");
    }
  }

  private verifyAfricasTalkingWithSecret(
    headers: Record<string, string>,
    body: any,
    expected?: string,
  ): void {
    if (!expected)
      throw new UnauthorizedException(
        "Africa's Talking webhook secret is not configured (AFRICASTALKING_WEBHOOK_SECRET or tenant BYOP config)",
      );
    const provided =
      headers["x-africastalking-webhook-secret"] ??
      headers["x-at-webhook-secret"] ??
      headers["authorization"]?.replace(/^Bearer\s+/i, "") ??
      body?.webhookSecret ??
      body?.secret;
    if (!provided || provided !== expected) {
      this.logger.warn("Rejected Africa's Talking SMS webhook: invalid or missing secret");
      throw new UnauthorizedException("Invalid Africa's Talking webhook secret");
    }
  }

  private verifyOptionalSharedSecret(
    headers: Record<string, string>,
    body: any,
    envKey: string,
    provider: string,
  ): void {
    const expected = this.configService.get<string>(envKey);
    if (!expected) return;
    const provided =
      headers[`x-${provider}-webhook-secret`] ??
      headers["x-webhook-secret"] ??
      headers["authorization"]?.replace(/^Bearer\s+/i, "") ??
      body?.webhookSecret ??
      body?.secret;
    if (!provided || provided !== expected) {
      this.logger.warn(`Rejected ${provider} SMS webhook: invalid or missing secret`);
      throw new UnauthorizedException(`Invalid ${provider} webhook secret`);
    }
  }

  private mapTwilioStatus(twilioStatus: string): "delivered" | "failed" | "sent" | "received" {
    const statusMap: Record<string, "delivered" | "failed" | "sent" | "received"> = {
      queued: "sent",
      sending: "sent",
      sent: "sent",
      delivered: "delivered",
      undelivered: "failed",
      failed: "failed",
      received: "received",
    };
    return statusMap[twilioStatus] || "failed";
  }
  private mapTelnyxStatus(
    eventType: string,
    payload: any,
  ): "delivered" | "failed" | "sent" | "received" {
    const t = (eventType || "").toLowerCase();
    if (t.includes("delivered")) return "delivered";
    if (t.includes("received")) return "received";
    if (t.includes("failed") || t.includes("delivery_failed")) return "failed";
    if (t.includes("sent") || t.includes("queued") || t.includes("sending")) return "sent";
    if (Array.isArray(payload?.errors) && payload.errors.length > 0) return "failed";
    return "sent";
  }
  private mapAfricasTalkingStatus(status: string): "delivered" | "failed" | "sent" | "received" {
    const s = (status || "").toLowerCase();
    if (s === "success" || s === "delivered") return "delivered";
    if (s === "sent" || s === "submitted" || s === "buffered") return "sent";
    if (s === "received") return "received";
    return "failed";
  }
  private mapGenericProviderStatus(status: string): "delivered" | "failed" | "sent" | "received" {
    const s = (status || "").toLowerCase();
    if (["delivered", "success", "delivered_to_handset"].includes(s)) return "delivered";
    if (["sent", "submitted", "queued", "accepted", "pending", "buffered"].includes(s))
      return "sent";
    if (["received"].includes(s)) return "received";
    return "failed";
  }
  private firstPhoneNumber(to: any): string {
    if (typeof to === "string") return to;
    if (Array.isArray(to)) {
      const first = to[0];
      if (typeof first === "string") return first;
      return first?.phone_number ?? "";
    }
    return to?.phone_number ?? "";
  }
  private generateConversationId(phoneNumber: string, provider: string): string {
    const normalized = (phoneNumber || "").replace(/[^\d]/g, "");
    return `${provider}_${normalized}`;
  }
}
