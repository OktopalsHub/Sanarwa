import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { BillingCurrency } from "../constants/token-packages";

interface NombaTokenResponse {
  code?: string;
  data?: {
    access_token?: string;
    expiresAt?: string;
  };
}

interface NombaCheckoutResponse {
  code?: string;
  data?: {
    checkoutLink?: string;
    orderReference?: string;
  };
  description?: string;
}

interface NombaChargeResponse {
  code?: string;
  data?: {
    status?: boolean;
    message?: string;
  };
  description?: string;
}

interface NombaVerifyResponse {
  code?: string;
  data?: {
    status?: string;
    amount?: number | string;
    currency?: string;
  };
}

@Injectable()
export class NombaService {
  private readonly logger = new Logger(NombaService.name);
  private cachedToken?: { value: string; expiresAt: number };

  constructor(private readonly configService: ConfigService) {}

  isConfigured(): boolean {
    return Boolean(
      this.getClientId() &&
      this.getClientSecret() &&
      this.getParentAccountId() &&
      this.getSubAccountId(),
    );
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

  getWebhookSecret(): string {
    return this.configService.get<string>("NOMBA_WEBHOOK_SECRET") || "";
  }

  getCardSetupAmount(): number {
    const raw = this.configService.get<string | number>("NOMBA_CARD_SETUP_AMOUNT");
    const parsed = raw === undefined || raw === null || raw === "" ? NaN : Number(raw);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 100;
  }

  async createCheckoutOrder(input: {
    orderReference: string;
    amount: number;
    currency: BillingCurrency;
    customerEmail: string;
    callbackUrl: string;
    tokenizeCard?: boolean;
    orderMetaData?: Record<string, string>;
    allowedPaymentMethods?: string[];
  }): Promise<{ checkoutUrl: string; orderReference: string }> {
    const payload = {
      order: {
        orderReference: input.orderReference,
        customerEmail: input.customerEmail,
        amount: input.amount,
        currency: input.currency,
        callbackUrl: input.callbackUrl,
        accountId: this.getSubAccountId(),
        allowedPaymentMethods: input.allowedPaymentMethods ?? ["Card"],
        orderMetaData: input.orderMetaData,
      },
      tokenizeCard: input.tokenizeCard ?? false,
    };

    const response = await this.request<NombaCheckoutResponse>(
      "/v1/checkout/order",
      "POST",
      payload,
    );

    if (!response.data?.checkoutLink || !response.data?.orderReference) {
      throw new Error(response.description ?? "nomba_checkout_failed");
    }

    return {
      checkoutUrl: response.data.checkoutLink,
      orderReference: response.data.orderReference,
    };
  }

  async chargeTokenizedCard(input: {
    tokenKey: string;
    orderReference: string;
    amount: number;
    currency: BillingCurrency;
    customerEmail: string;
    callbackUrl: string;
    orderMetaData?: Record<string, string>;
  }): Promise<{
    status: "success" | "pending" | "failed";
    providerReference?: string;
    errorCode?: string;
  }> {
    const payload = {
      tokenKey: input.tokenKey,
      order: {
        orderReference: input.orderReference,
        customerEmail: input.customerEmail,
        amount: input.amount,
        currency: input.currency,
        callbackUrl: input.callbackUrl,
        accountId: this.getSubAccountId(),
        orderMetaData: input.orderMetaData,
      },
    };

    try {
      const response = await this.request<NombaChargeResponse>(
        "/v1/checkout/tokenized-card-payment",
        "POST",
        payload,
      );

      if (response.data?.status) {
        return { status: "success", providerReference: input.orderReference };
      }

      return {
        status: "failed",
        providerReference: input.orderReference,
        errorCode: response.description ?? "nomba_charge_failed",
      };
    } catch (error) {
      this.logger.warn("Nomba tokenized charge failed", error);
      return {
        status: "failed",
        errorCode: "nomba_off_session_failed",
      };
    }
  }

  async verifyOrder(
    orderReference: string,
  ): Promise<import("../types/payment-verify-result").PaymentVerifyResult> {
    try {
      const response = await this.request<NombaVerifyResponse>(
        `/v1/transactions/accounts/single?orderReference=${encodeURIComponent(orderReference)}`,
        "GET",
      );

      const status = response.data?.status?.toUpperCase();
      const amountRaw = response.data?.amount;
      const amount = amountRaw === undefined || amountRaw === null ? undefined : Number(amountRaw);
      const currency = response.data?.currency;

      if (status === "SUCCESS") {
        return {
          status: "success",
          amount: Number.isFinite(amount) ? amount : undefined,
          currency,
        };
      }
      if (status === "FAILED" || status === "CANCELLED" || status === "REVERSED_BY_VENDOR") {
        return {
          status: "failed",
          amount: Number.isFinite(amount) ? amount : undefined,
          currency,
        };
      }
      return { status: "pending" };
    } catch (error) {
      this.logger.warn(`Nomba verify failed for ${orderReference}`, error);
      return { status: "pending" };
    }
  }

  private async request<T>(path: string, method: "GET" | "POST", body?: unknown): Promise<T> {
    const token = await this.getAccessToken();
    const baseUrl = this.getBaseUrl();

    const init: RequestInit = {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        accountId: this.getParentAccountId(),
      },
    };
    if (method !== "GET" && body !== undefined) {
      init.body = JSON.stringify(body);
    }

    const response = await fetch(`${baseUrl}${path}`, init);

    const payload = (await response.json().catch(() => ({}))) as T & {
      description?: string;
    };

    if (!response.ok) {
      throw new Error(
        (payload as { description?: string }).description ?? `nomba_${response.status}`,
      );
    }

    return payload;
  }

  private async getAccessToken(): Promise<string> {
    if (this.cachedToken && this.cachedToken.expiresAt > Date.now() + 60_000) {
      return this.cachedToken.value;
    }

    const response = await fetch(`${this.getBaseUrl()}/v1/auth/token/issue`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        accountId: this.getParentAccountId(),
      },
      body: JSON.stringify({
        grant_type: "client_credentials",
        client_id: this.getClientId(),
        client_secret: this.getClientSecret(),
      }),
    });

    const payload = (await response.json().catch(() => ({}))) as NombaTokenResponse;
    const accessToken = payload.data?.access_token;

    if (!response.ok || !accessToken) {
      throw new Error("nomba_auth_failed");
    }

    const expiresAt = payload.data?.expiresAt
      ? new Date(payload.data.expiresAt).getTime()
      : Date.now() + 55 * 60 * 1000;

    this.cachedToken = { value: accessToken, expiresAt };
    return accessToken;
  }

  private getBaseUrl(): string {
    const configured = this.configService.get<string>("NOMBA_BASE_URL")?.trim().replace(/\/$/, "");
    if (configured) {
      return configured.startsWith("http") ? configured : `https://${configured}`;
    }
    return "https://sandbox.nomba.com";
  }

  private getClientId(): string {
    return this.configService.get<string>("NOMBA_CLIENT_ID") || "";
  }

  private getClientSecret(): string {
    return this.configService.get<string>("NOMBA_CLIENT_SECRET") || "";
  }

  getParentAccountId(): string {
    return this.configService.get<string>("NOMBA_PARENT_ACCOUNT_ID") || "";
  }

  getSubAccountId(): string {
    return this.configService.get<string>("NOMBA_SUB_ACCOUNT_ID") || "";
  }
}
