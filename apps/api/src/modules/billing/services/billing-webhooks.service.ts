import { BadRequestException, Injectable, Logger } from "@nestjs/common";
import { createHash } from "node:crypto";
import { PaymentProvider } from "../enums/payment-provider.enum";
import { BachsService } from "./bachs.service";
import { verifyBachsWebhook } from "../utils/bachs-webhook.util";
import type { BillingCurrency } from "../constants/token-packages";
import { AutoTopupService } from "./auto-topup.service";
import { TokenPurchaseService } from "./token-purchase.service";
import { BillingWebhookLedgerService } from "./billing-webhook-ledger.service";

@Injectable()
export class BillingWebhooksService {
  private readonly logger = new Logger(BillingWebhooksService.name);

  constructor(
    private readonly ledger: BillingWebhookLedgerService,
    private readonly bachsService: BachsService,
    private readonly tokenPurchaseService: TokenPurchaseService,
    private readonly autoTopupService: AutoTopupService,
  ) {}

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
    const payloadHash = createHash("sha256").update(rawBody).digest("hex");

    const claimed = await this.ledger.claim("bachs", eventId, payloadHash);
    if (!claimed) {
      return { received: true, duplicate: true };
    }

    try {
      if (verified.outcome === "ignored") {
        await this.ledger.mark("bachs", eventId, "processed", null);
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

      await this.ledger.mark("bachs", eventId, "processed", null);
      return { received: true };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`Failed processing Bachs webhook ${eventId}: ${message}`);
      await this.ledger.mark("bachs", eventId, "failed", message);
      throw error;
    }
  }
}
