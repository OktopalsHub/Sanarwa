import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import {
  BillingCurrency,
  buildNotifiPurchaseReference,
  packagePriceMinor,
} from "../constants/token-packages";

export class BachsCheckoutInitError extends Error {
  readonly code: string;
  readonly httpStatus: number;
  readonly detail: string;

  constructor(options: { code: string; httpStatus: number; detail: string }) {
    super(options.detail);
    this.name = "BachsCheckoutInitError";
    this.code = options.code;
    this.httpStatus = options.httpStatus;
    this.detail = options.detail;
  }
}

export interface BachsCheckoutInput {
  purchaseId: string;
  tenantId: string;
  packageId: string;
  tokenAmount: number;
  currency: BillingCurrency;
  priceMinor: number;
  email: string;
  name: string;
  successUrl: string;
  cancelUrl: string;
}

export interface BachsCheckoutResult {
  checkoutUrl: string;
  checkoutId: string;
  reference: string;
}

@Injectable()
export class BachsService {
  private readonly logger = new Logger(BachsService.name);

  constructor(private readonly configService: ConfigService) {}

  isConfigured(currency?: BillingCurrency): boolean {
    if (!this.getSecretKey()) return false;
    if (!currency) {
      return Boolean(this.getProductId("USD") || this.getProductId("NGN"));
    }
    return Boolean(this.getProductId(currency));
  }

  getBaseUrl(): string {
    const configured = this.configService.get<string>("BACHS_BASE_URL")?.trim().replace(/\/$/, "");
    if (configured) {
      return configured.startsWith("http") ? configured : `https://${configured}`;
    }

    const secretKey = this.getSecretKey();
    return secretKey.startsWith("sk_sandbox_")
      ? "https://sandbox-api.bachs.io"
      : "https://api.bachs.io";
  }

  async initializeCheckout(input: BachsCheckoutInput): Promise<BachsCheckoutResult> {
    const secretKey = this.getSecretKey();
    if (!secretKey) {
      throw new Error("bachs_not_configured");
    }

    const productId = this.getProductId(input.currency);
    if (!productId) {
      throw new Error("bachs_product_unconfigured");
    }

    const reference = buildNotifiPurchaseReference(input.purchaseId);
    const amount = (input.priceMinor / 100).toFixed(2);

    // Currency-specific CUSTOM product; amount set per session.
    // See https://docs.bachs.io/api-reference/payments/create-checkout-session
    return this.createCheckoutSession({
      productId,
      currency: input.currency,
      email: input.email,
      name: input.name,
      successUrl: input.successUrl,
      cancelUrl: input.cancelUrl,
      reference,
      amount,
      metadata: {
        purchase_id: input.purchaseId,
        tenant_id: input.tenantId,
        package_id: input.packageId,
        currency: input.currency,
        token_amount: String(input.tokenAmount),
      },
    });
  }

  async verifyCheckoutSession(
    checkoutId: string,
  ): Promise<import("../types/payment-verify-result").PaymentVerifyResult> {
    const secretKey = this.getSecretKey();
    if (!secretKey) {
      throw new Error("bachs_not_configured");
    }

    const baseUrl = this.getBaseUrl();
    const response = await fetch(
      `${baseUrl}/v1/checkout-sessions/${encodeURIComponent(checkoutId)}`,
      {
        headers: { Authorization: `Bearer ${secretKey}` },
      },
    );

    if (response.status === 404) {
      return { status: "pending" };
    }

    const payload = (await response.json().catch(() => ({}))) as {
      status?: string;
      payment_status?: string;
      amount?: string | number;
      amount_total?: string | number;
      currency?: string;
      charge?: { status?: string; amount?: string | number };
      detail?: string;
    };

    if (!response.ok) {
      throw new Error(payload.detail ?? "bachs_verify_failed");
    }

    const sessionStatus = payload.status?.toUpperCase();
    const chargeStatus = payload.charge?.status?.toLowerCase();
    const paymentStatus = payload.payment_status?.toLowerCase();
    const amountRaw = payload.amount_total ?? payload.amount ?? payload.charge?.amount;
    const amount = amountRaw === undefined || amountRaw === null ? undefined : Number(amountRaw);

    if (
      sessionStatus === "COMPLETED" ||
      chargeStatus === "succeeded" ||
      chargeStatus === "accepted" ||
      paymentStatus === "succeeded"
    ) {
      return {
        status: "success",
        amount: Number.isFinite(amount) ? amount : undefined,
        currency: payload.currency,
      };
    }

    if (
      sessionStatus === "EXPIRED" ||
      sessionStatus === "CANCELLED" ||
      chargeStatus === "failed" ||
      chargeStatus === "expired" ||
      chargeStatus === "cancelled" ||
      paymentStatus === "failed" ||
      paymentStatus === "canceled"
    ) {
      return {
        status: "failed",
        amount: Number.isFinite(amount) ? amount : undefined,
        currency: payload.currency,
      };
    }

    return { status: "pending" };
  }

  getProductId(currency: BillingCurrency): string | undefined {
    const normalized = currency.toUpperCase() as BillingCurrency;
    if (normalized === "USD") {
      return this.configService.get<string>("BACHS_PRODUCT_ID_USD")?.trim() || undefined;
    }
    if (normalized === "NGN") {
      return this.configService.get<string>("BACHS_PRODUCT_ID_NGN")?.trim() || undefined;
    }
    return undefined;
  }

  getWebhookSecret(): string {
    return this.configService.get<string>("BACHS_WEBHOOK_SECRET") || "";
  }

  getWebOrigin(): string {
    return (
      this.configService.get<string>("WEB_ORIGIN") ||
      this.configService.get<string>("FRONTEND_URL") ||
      "http://localhost:3001"
    ).replace(/\/$/, "");
  }

  buildCheckoutUrls(
    tenantSlug: string,
    purchaseId?: string,
  ): { successUrl: string; cancelUrl: string } {
    const origin = this.getWebOrigin();
    const base = `${origin}/${tenantSlug}/billing`;
    const purchaseQuery = purchaseId ? `&purchase_id=${encodeURIComponent(purchaseId)}` : "";
    return {
      successUrl: `${base}?checkout=success${purchaseQuery}`,
      cancelUrl: `${base}?checkout=cancel`,
    };
  }

  buildPaymentMethodSetupUrls(
    tenantSlug: string,
    setupReference: string,
  ): { successUrl: string; cancelUrl: string } {
    const origin = this.getWebOrigin();
    const base = `${origin}/${tenantSlug}/billing`;
    const setupQuery = `setup=success&setup_reference=${encodeURIComponent(setupReference)}`;
    return {
      successUrl: `${base}?${setupQuery}`,
      cancelUrl: `${base}?setup=cancel`,
    };
  }

  isCardVaultConfigured(currency?: BillingCurrency): boolean {
    return this.isConfigured(currency);
  }

  getCardSetupAmount(): string {
    const configured = this.configService.get<string>("BACHS_CARD_SETUP_AMOUNT")?.trim();
    if (configured) return Number(configured).toFixed(2);
    return "1.00";
  }

  async initializePaymentMethodSetup(input: {
    tenantId: string;
    setupReference: string;
    currency: BillingCurrency;
    email: string;
    name: string;
    successUrl: string;
    cancelUrl: string;
    reference: string;
    metadata: Record<string, unknown>;
  }): Promise<BachsCheckoutResult> {
    const productId = this.getProductId(input.currency);
    if (!productId) {
      throw new Error("bachs_product_unconfigured");
    }

    // Same CUSTOM product for that currency; small amount to vault the card on Bachs.
    return this.createCheckoutSession({
      productId,
      currency: input.currency,
      email: input.email,
      name: input.name,
      successUrl: input.successUrl,
      cancelUrl: input.cancelUrl,
      reference: input.reference,
      amount: this.getCardSetupAmount(),
      metadata: input.metadata,
    });
  }

  async chargeOffSession(input: {
    customerId: string;
    paymentMethodId?: string;
    subscriptionId?: string;
    purchaseId: string;
    packageId: string;
    currency: BillingCurrency;
    tokenAmount: number;
    priceMinor: number;
  }): Promise<{
    status: "success" | "pending" | "failed";
    providerReference?: string;
    errorCode?: string;
  }> {
    // Bachs has no documented off-session / saved-card charge API (checkout + webhooks only).
    // Fail closed rather than invent POST /v1/payments/charges.
    this.logger.warn(
      `Bachs off-session charge refused for purchase ${input.purchaseId}: OFF_SESSION_NOT_SUPPORTED`,
    );
    return { status: "failed", errorCode: "OFF_SESSION_NOT_SUPPORTED" };
  }

  async getCheckoutSessionDetails(checkoutId: string): Promise<{
    status?: string;
    customerId?: string;
    paymentMethodId?: string;
    subscriptionId?: string;
    cardBrand?: string;
    cardLast4?: string;
    cardExpMonth?: number;
    cardExpYear?: number;
  }> {
    const secretKey = this.getSecretKey();
    if (!secretKey) {
      throw new Error("bachs_not_configured");
    }

    const baseUrl = this.getBaseUrl();
    const response = await fetch(
      `${baseUrl}/v1/checkout-sessions/${encodeURIComponent(checkoutId)}`,
      { headers: { Authorization: `Bearer ${secretKey}` } },
    );

    const payload = (await response.json().catch(() => ({}))) as {
      status?: string;
      customer?: { customer_id?: string };
      charge?: {
        payment_method_id?: string;
        subscription_id?: string;
        card?: {
          brand?: string;
          last4?: string;
          exp_month?: number;
          exp_year?: number;
        };
      };
      subscription?: { id?: string; subscription_id?: string };
    };

    if (!response.ok) {
      return {};
    }

    return {
      status: payload.status,
      customerId: payload.customer?.customer_id,
      paymentMethodId: payload.charge?.payment_method_id,
      subscriptionId:
        payload.charge?.subscription_id ??
        payload.subscription?.subscription_id ??
        payload.subscription?.id,
      cardBrand: payload.charge?.card?.brand,
      cardLast4: payload.charge?.card?.last4,
      cardExpMonth: payload.charge?.card?.exp_month,
      cardExpYear: payload.charge?.card?.exp_year,
    };
  }

  async cancelSubscriptionAtPeriodEnd(subscriptionId: string): Promise<void> {
    const secretKey = this.getSecretKey();
    if (!secretKey) return;

    const baseUrl = this.getBaseUrl();
    try {
      const response = await fetch(
        `${baseUrl}/v1/subscriptions/${encodeURIComponent(subscriptionId)}`,
        {
          method: "PATCH",
          headers: {
            Authorization: `Bearer ${secretKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ cancel_at_period_end: true }),
        },
      );
      if (!response.ok) {
        const payload = (await response.json().catch(() => ({}))) as { detail?: string };
        this.logger.warn(
          `Failed to cancel Bachs vault subscription ${subscriptionId}: ${response.status} - ${payload.detail ?? "Unknown error"}`,
        );
      }
    } catch (error) {
      this.logger.warn(`Failed to cancel Bachs vault subscription ${subscriptionId}:`, error);
    }
  }

  private async createCheckoutSession(input: {
    productId: string;
    currency: BillingCurrency;
    email: string;
    name: string;
    successUrl: string;
    cancelUrl: string;
    reference: string;
    metadata: Record<string, unknown>;
    amount?: string;
    customerId?: string;
  }): Promise<BachsCheckoutResult> {
    const secretKey = this.getSecretKey();
    if (!secretKey) {
      throw new Error("bachs_not_configured");
    }

    const baseUrl = this.getBaseUrl();
    const customer = input.customerId
      ? { customer_id: input.customerId, email: input.email, name: input.name }
      : { email: input.email, name: input.name };

    const lineItem: Record<string, unknown> = {
      product_id: input.productId,
      quantity: 1,
    };
    if (input.amount) {
      lineItem.amount = input.amount;
    }

    const response = await fetch(`${baseUrl}/v1/checkout-sessions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${secretKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        product_cart: [lineItem],
        customer,
        billing_currency: input.currency,
        success_url: input.successUrl,
        cancel_url: input.cancelUrl,
        reference: input.reference,
        metadata: input.metadata,
      }),
    });

    const payload = (await response.json().catch(() => ({}))) as {
      checkout_id?: string;
      checkout_url?: string;
      detail?: string;
      error?: { message?: string };
    };

    if (!response.ok || !payload.checkout_url || !payload.checkout_id) {
      const detail = payload.detail ?? payload.error?.message ?? "bachs_checkout_failed";
      throw new BachsCheckoutInitError({
        code: "bachs_checkout_failed",
        httpStatus: response.status,
        detail,
      });
    }

    return {
      checkoutUrl: payload.checkout_url,
      checkoutId: payload.checkout_id,
      reference: input.reference,
    };
  }

  private getSecretKey(): string {
    return this.configService.get<string>("BACHS_SECRET_KEY") || "";
  }
}

export { packagePriceMinor };
