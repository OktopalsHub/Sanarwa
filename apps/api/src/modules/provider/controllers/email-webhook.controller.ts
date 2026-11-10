import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Logger,
  Param,
  Post,
  RawBody,
  Req,
  UnauthorizedException,
} from "@nestjs/common";
import { ApiTags, ApiOperation, ApiResponse } from "@nestjs/swagger";
import { SkipThrottle } from "@nestjs/throttler";
import { Public } from "../../auth/decorators/public.decorator";
import { NotificationChannel } from "../../../common/enums/notification-channel.enum";
import { DeliveryEventService } from "../../messaging/events/delivery-event.service";
import {
  normalizeMailgunEvent,
  normalizeResendEvent,
  normalizeSendGridEvent,
  normalizeSesEvent,
  RawRecord,
} from "../../messaging/events/email-event-normalizer";
import { WebhookValidatorService } from "../services/webhook-validator.service";
import { SnsEnvelope, SnsMessageVerifierService } from "../services/sns-message-verifier.service";
import { ProviderConfigRepository } from "../provider-config.repository";
import { ProviderEncryptionService } from "../provider-encryption.service";
import { Request } from "express";

interface IngestOutcome {
  recorded: boolean;
  reason?: string;
}

/**
 * Inbound email delivery events. All four providers are BYOP: the tenant's
 * own provider config carries the webhook signing key (`webhookPublicKey`
 * for SendGrid, `webhookSecret` for Mailgun/Resend), and the webhook URL is
 * tenant-scoped (`/webhooks/email/<provider>/<tenantId>`) so verification
 * happens against that tenant's key. SES/SNS is certificate-verified and
 * needs no per-tenant key; ingestion correlates via provider message id.
 */
@ApiTags("Email Webhooks")
@Controller("webhooks/email")
@Public()
@SkipThrottle()
export class EmailWebhookController {
  private readonly logger = new Logger(EmailWebhookController.name);

  constructor(
    private readonly webhookValidator: WebhookValidatorService,
    private readonly events: DeliveryEventService,
    private readonly snsVerifier: SnsMessageVerifierService,
    private readonly providerConfigRepository: ProviderConfigRepository,
    private readonly encryptionService: ProviderEncryptionService,
  ) {}

  @Post("sendgrid/:tenantId")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Handle SendGrid Event Webhook (BYOP, ECDSA-verified)" })
  @ApiResponse({ status: 200, description: "Events stored" })
  @ApiResponse({ status: 401, description: "Invalid signature or key not configured" })
  async sendgrid(
    @Param("tenantId") tenantId: string,
    @Body() payload: RawRecord[],
    @RawBody() rawBody: Buffer,
    @Req() req: Request,
  ): Promise<{ success: boolean; results: IngestOutcome[] }> {
    const verification = this.webhookValidator.verify({
      provider: "sendgrid",
      publicKey: await this.resolveWebhookKey(tenantId, "sendgrid", "webhookPublicKey"),
      rawBody: rawBody ? rawBody.toString("utf8") : JSON.stringify(payload),
      headers: flattenHeaders(req),
    });
    if (verification.kind === "rejected") {
      this.logger.warn(`SendGrid webhook rejected for tenant ${tenantId}: ${verification.reason}`);
      throw new UnauthorizedException("Invalid webhook signature");
    }

    const entries = Array.isArray(payload) ? payload : [];
    const results: IngestOutcome[] = [];
    for (const entry of entries) {
      results.push(await this.ingest(entry, normalizeSendGridEvent));
    }
    return { success: true, results };
  }

  @Post("mailgun/:tenantId")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Handle Mailgun webhook (BYOP, HMAC-verified)" })
  @ApiResponse({ status: 200, description: "Event stored" })
  @ApiResponse({ status: 401, description: "Invalid signature or key not configured" })
  async mailgun(
    @Param("tenantId") tenantId: string,
    @Body() payload: RawRecord,
    @RawBody() rawBody: Buffer,
    @Req() req: Request,
  ): Promise<{ success: boolean; results: IngestOutcome[] }> {
    const verification = this.webhookValidator.verify({
      provider: "mailgun",
      secret: await this.resolveWebhookKey(tenantId, "mailgun", "webhookSecret"),
      rawBody: rawBody ? rawBody.toString("utf8") : JSON.stringify(payload),
      headers: flattenHeaders(req),
    });
    if (verification.kind === "rejected") {
      this.logger.warn(`Mailgun webhook rejected for tenant ${tenantId}: ${verification.reason}`);
      throw new UnauthorizedException("Invalid webhook signature");
    }

    return { success: true, results: [await this.ingest(payload, normalizeMailgunEvent)] };
  }

  @Post("resend/:tenantId")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Handle Resend webhook (BYOP, Svix-verified)" })
  @ApiResponse({ status: 200, description: "Event stored" })
  @ApiResponse({ status: 401, description: "Invalid signature or key not configured" })
  async resend(
    @Param("tenantId") tenantId: string,
    @Body() payload: RawRecord,
    @RawBody() rawBody: Buffer,
    @Req() req: Request,
  ): Promise<{ success: boolean; results: IngestOutcome[] }> {
    const verification = this.webhookValidator.verify({
      provider: "resend",
      secret: await this.resolveWebhookKey(tenantId, "resend", "webhookSecret"),
      rawBody: rawBody ? rawBody.toString("utf8") : JSON.stringify(payload),
      headers: flattenHeaders(req),
    });
    if (verification.kind === "rejected") {
      this.logger.warn(`Resend webhook rejected for tenant ${tenantId}: ${verification.reason}`);
      throw new UnauthorizedException("Invalid webhook signature");
    }

    return { success: true, results: [await this.ingest(payload, normalizeResendEvent)] };
  }

  @Post("ses")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Handle SES notifications delivered via SNS (certificate-verified)" })
  @ApiResponse({ status: 200, description: "Event stored" })
  @ApiResponse({ status: 401, description: "Invalid signature" })
  async ses(
    @Body() payload: SnsEnvelope & RawRecord,
  ): Promise<{ success: boolean; results: IngestOutcome[] }> {
    if (!(await this.snsVerifier.verify(payload))) {
      this.logger.warn("SES webhook rejected: invalid SNS signature");
      throw new UnauthorizedException("Invalid webhook signature");
    }

    if (payload.Type === "SubscriptionConfirmation") {
      this.logger.log(`SNS subscription confirmation id=${payload.MessageId}`);
      return { success: true, results: [] };
    }

    let message: RawRecord | null = null;
    try {
      message = JSON.parse(payload.Message) as RawRecord;
    } catch {
      this.logger.warn(`SNS Message was not JSON for id=${payload.MessageId}`);
    }

    const result = await this.ingest(message, normalizeSesEvent, payload.MessageId);
    return { success: true, results: [result] };
  }

  private async resolveWebhookKey(
    tenantId: string,
    providerId: string,
    field: string,
  ): Promise<string | undefined> {
    const configs = await this.providerConfigRepository.findActiveByTenantAndChannel(
      tenantId,
      NotificationChannel.EMAIL,
    );
    const config = configs.find((candidate) => candidate.providerId === providerId);
    if (!config) {
      this.logger.warn(`No ${providerId} email provider configured for tenant ${tenantId}`);
      return undefined;
    }

    const decrypted = await this.encryptionService.decrypt(config.config);
    const value = decrypted[field];
    return typeof value === "string" && value ? value : undefined;
  }

  private async ingest(
    raw: unknown,
    normalize: (value: unknown) => ReturnType<typeof normalizeSendGridEvent>,
    providerEventId?: string,
  ): Promise<IngestOutcome> {
    const normalized = normalize(raw);
    if (!normalized) {
      return { recorded: false, reason: "unknown" };
    }

    // Deduplicate SNS deliveries by their envelope MessageId.
    if (providerEventId) {
      normalized.providerEventId = providerEventId;
    }

    const outcome = await this.events.ingestProviderFeedback(normalized);
    if (!outcome.recorded) {
      return { recorded: false, reason: outcome.reason };
    }
    return { recorded: true };
  }
}

function flattenHeaders(req: Request): Record<string, string | undefined> {
  const out: Record<string, string | undefined> = {};
  for (const [name, value] of Object.entries(req.headers)) {
    out[name.toLowerCase()] = Array.isArray(value) ? value.join(",") : value;
  }
  return out;
}
