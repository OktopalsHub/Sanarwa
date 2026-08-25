import { Injectable, Logger, BadRequestException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { createHash } from "node:crypto";
import { QueryFailedError, Repository } from "typeorm";
import { WebhookEvent } from "../entities/webhook-event.entity";
import { PaymentProvider } from "../enums/payment-provider.enum";
import { PolarService } from "./polar.service";
import { BachsService } from "./bachs.service";
import { NombaService } from "./nomba.service";
import { verifyBachsWebhook } from "../utils/bachs-webhook.util";
import { verifyNombaWebhook } from "../utils/nomba-webhook.util";
import type { BillingCurrency } from "../constants/token-packages";
import { AutoTopupService } from "./auto-topup.service";
import { TokenPurchaseService } from "./token-purchase.service";

@Injectable()
export class BillingWebhooksService {
  private readonly logger = new Logger(BillingWebhooksService.name);

  constructor(
    @InjectRepository(WebhookEvent)
    private webhookEventRepository: Repository<WebhookEvent>,
    private polarService: PolarService,
    private bachsService: BachsService,
    private nombaService: NombaService,
    private tokenPurchaseService: TokenPurchaseService,
    private autoTopupService: AutoTopupService,
  ) {}

  async handleNombaWebhook(
    rawBody: string,
    headers: Record<string, string | string[] | undefined>,
  ): Promise<{ received: boolean; duplicate?: boolean }> {
    const verified = verifyNombaWebhook({ rawBody, headers }, this.nombaService.getWebhookSecret());

    if (!verified) {
      throw new BadRequestException("Invalid Nomba webhook");
    }

    if (verified.outcome === "ignored") {
      return { received: true };
    }

    const claimed = await this.claimWebhookEvent("nomba", verified.eventId, rawBody);
    if (!claimed) {
      return { received: true, duplicate: true };
    }

    if (verified.setupReference && verified.tenantId && verified.outcome === "success") {
      await this.autoTopupService.completePaymentMethodSetup({
        tenantId: verified.tenantId,
        provider: PaymentProvider.NOMBA,
        currency: (verified.currency as BillingCurrency | undefined) ?? "NGN",
        setupReference: verified.setupReference,
        externalCustomerId: verified.customerEmail ?? verified.customerId ?? verified.tenantId,
        externalPaymentMethodId: verified.tokenKey,
        cardBrand: verified.cardBrand,
        cardLast4: verified.cardLast4,
      });
    } else if (verified.outcome === "success" && verified.purchaseId) {
      await this.tokenPurchaseService.confirmTokenPurchaseIfPaid(
        verified.purchaseId,
        undefined,
        verified.currency,
      );
    }

    return { received: true };
  }

  async handleBachsWebhook(
    rawBody: string,
    headers: Record<string, string | string[] | undefined>,
  ): Promise<{ received: boolean; duplicate?: boolean }> {
    const verified = verifyBachsWebhook({ rawBody, headers }, this.bachsService.getWebhookSecret());

    if (!verified) {
      throw new BadRequestException("Invalid Bachs webhook");
    }

    const eventId =
      verified.eventId ??
      createHash("sha256").update(`${verified.eventType}:${rawBody}`).digest("hex");

    const claimed = await this.claimWebhookEvent("bachs", eventId, rawBody);
    if (!claimed) {
      return { received: true, duplicate: true };
    }

    if (verified.outcome === "ignored") {
      return { received: true };
    }

    if (verified.setupReference && verified.tenantId && verified.outcome === "success") {
      await this.autoTopupService.completePaymentMethodSetup({
        tenantId: verified.tenantId,
        provider: PaymentProvider.BACHS,
        currency: (verified.currency as BillingCurrency | undefined) ?? "USD",
        setupReference: verified.setupReference,
        externalCustomerId: verified.customerId,
        externalPaymentMethodId: verified.paymentMethodId,
      });
    } else if (verified.outcome === "success" && verified.purchaseId) {
      await this.tokenPurchaseService.confirmTokenPurchaseIfPaid(
        verified.purchaseId,
        undefined,
        verified.currency,
      );
    } else if (verified.outcome === "failed" && verified.purchaseId) {
      await this.tokenPurchaseService.failTokenPurchase(verified.purchaseId);
    }

    return { received: true };
  }

  async handlePolarWebhook(
    rawBody: string,
    headers: Record<string, string | string[] | undefined>,
  ): Promise<{ received: boolean; duplicate?: boolean }> {
    const verified = await this.polarService.handleWebhook(rawBody, headers);

    if (verified.outcome === "ignored") {
      return { received: true };
    }

    const claimed = await this.claimWebhookEvent("polar", verified.eventId, rawBody);
    if (!claimed) {
      return { received: true, duplicate: true };
    }

    if (verified.outcome === "success" && verified.setupReference && verified.tenantId) {
      await this.autoTopupService.completePaymentMethodSetup({
        tenantId: verified.tenantId,
        provider: PaymentProvider.POLAR,
        currency: (verified.currency as BillingCurrency | undefined) ?? "USD",
        setupReference: verified.setupReference,
        externalCustomerId: verified.customerId,
        externalPaymentMethodId: verified.paymentMethodId,
        providerReference: verified.providerReference,
      });
    } else if (verified.outcome === "success" && verified.purchaseId) {
      await this.tokenPurchaseService.confirmTokenPurchaseIfPaid(
        verified.purchaseId,
        verified.amount,
        verified.currency,
      );
    } else if (verified.outcome === "failed" && verified.purchaseId) {
      await this.tokenPurchaseService.failTokenPurchase(verified.purchaseId);
    }

    return { received: true };
  }

  private async claimWebhookEvent(
    provider: string,
    eventId: string,
    rawBody: string,
  ): Promise<boolean> {
    const payloadHash = createHash("sha256").update(rawBody).digest("hex");

    try {
      await this.webhookEventRepository.insert({
        provider,
        eventId,
        payloadHash,
      });
      return true;
    } catch (error) {
      if (
        error instanceof QueryFailedError &&
        (error as QueryFailedError & { driverError?: { code?: string } }).driverError?.code ===
          "23505"
      ) {
        return false;
      }
      throw error;
    }
  }
}
