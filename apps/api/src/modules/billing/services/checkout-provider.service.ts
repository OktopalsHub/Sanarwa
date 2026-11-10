import { BadRequestException, Injectable } from "@nestjs/common";

import { Tenant } from "../../tenant/entities/tenant.entity";
import { TokenPurchase } from "../entities/token-purchase.entity";
import { PaymentProvider } from "../enums/payment-provider.enum";
import { BillingCurrency } from "../constants/token-packages";
import { BachsService } from "./bachs.service";

@Injectable()
export class CheckoutProviderService {
  constructor(private readonly bachsService: BachsService) {}

  resolveCheckoutProvider(currency: BillingCurrency): PaymentProvider {
    if (this.bachsService.isConfigured(currency)) {
      return PaymentProvider.BACHS;
    }
    throw new BadRequestException(`No payment provider configured for ${currency}`);
  }

  async initializeProviderCheckout(input: {
    provider: PaymentProvider;
    purchase: TokenPurchase;
    tenant: Tenant;
    email: string;
    name: string;
    packageId: string;
    currency: BillingCurrency;
    priceMinor: number;
  }): Promise<{
    checkoutUrl: string;
    paymentIntentId: string;
    transactionReference: string;
  }> {
    if (input.provider !== PaymentProvider.BACHS) {
      throw new Error("unsupported_checkout_provider");
    }

    const { successUrl, cancelUrl } = this.bachsService.buildCheckoutUrls(
      input.tenant.subdomain,
      input.purchase.id,
    );

    const result = await this.bachsService.initializeCheckout({
      purchaseId: input.purchase.id,
      tenantId: input.tenant.id,
      packageId: input.packageId,
      tokenAmount: input.purchase.tokenAmount,
      currency: input.currency,
      priceMinor: input.priceMinor,
      email: input.email,
      name: input.name,
      successUrl,
      cancelUrl,
    });

    return {
      checkoutUrl: result.checkoutUrl,
      paymentIntentId: result.checkoutId,
      transactionReference: result.checkoutId,
    };
  }
}
