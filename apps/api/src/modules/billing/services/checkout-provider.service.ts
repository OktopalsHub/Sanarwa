import { Injectable, BadRequestException } from "@nestjs/common";
import { TokenPurchase } from "../entities/token-purchase.entity";
import { Tenant } from "../../tenant/entities/tenant.entity";
import { PaymentProvider } from "../enums/payment-provider.enum";
import { PolarService } from "./polar.service";
import { BachsService } from "./bachs.service";
import { NombaService } from "./nomba.service";
import { BillingCurrency, buildNotifiPurchaseReference } from "../constants/token-packages";

@Injectable()
export class CheckoutProviderService {
  constructor(
    private polarService: PolarService,
    private bachsService: BachsService,
    private nombaService: NombaService,
  ) {}

  resolveCheckoutProvider(currency: BillingCurrency): PaymentProvider {
    if (currency === "NGN" && this.nombaService.isConfigured()) {
      return PaymentProvider.NOMBA;
    }
    if (this.bachsService.isConfigured(currency)) {
      return PaymentProvider.BACHS;
    }
    if (currency === "USD" && this.polarService.isConfigured()) {
      return PaymentProvider.POLAR;
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
    const metadata = {
      purchaseId: input.purchase.id,
      tenantId: input.tenant.id,
      packageId: input.packageId,
      currency: input.currency,
      tokenAmount: input.purchase.tokenAmount,
    };
    const tenantSlug = input.tenant.subdomain;

    if (input.provider === PaymentProvider.NOMBA) {
      const { successUrl } = this.nombaService.buildCheckoutUrls(tenantSlug, input.purchase.id);
      const orderReference = buildNotifiPurchaseReference(input.purchase.id);
      const result = await this.nombaService.createCheckoutOrder({
        orderReference,
        amount: input.purchase.totalPrice,
        currency: input.currency,
        customerEmail: input.email,
        callbackUrl: successUrl,
        orderMetaData: {
          purchase_id: input.purchase.id,
          tenant_id: input.tenant.id,
          package_id: input.packageId,
          currency: input.currency,
          token_amount: String(input.purchase.tokenAmount),
        },
        allowedPaymentMethods: ["Card", "Transfer"],
      });

      return {
        checkoutUrl: result.checkoutUrl,
        paymentIntentId: result.orderReference,
        transactionReference: result.orderReference,
      };
    }

    if (input.provider === PaymentProvider.BACHS) {
      const { successUrl, cancelUrl } = this.bachsService.buildCheckoutUrls(
        tenantSlug,
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

    if (input.provider === PaymentProvider.POLAR) {
      const productId = this.polarService.getProductId();
      if (!productId) {
        throw new Error("polar_product_not_configured");
      }

      const result = await this.polarService.createCheckout({
        productId,
        email: input.email,
        amountMinor: input.priceMinor,
        currency: input.currency,
        successUrl: this.polarService.buildSuccessUrl(tenantSlug, input.purchase.id),
        metadata,
      });

      return {
        checkoutUrl: result.checkoutUrl,
        paymentIntentId: result.checkoutId,
        transactionReference: result.checkoutId,
      };
    }

    throw new Error("unsupported_checkout_provider");
  }
}
