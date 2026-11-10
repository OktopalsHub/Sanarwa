import { ConfigService } from "@nestjs/config";
import { describe, expect, it, vi, afterEach } from "vitest";
import { BachsService } from "../services/bachs.service";

describe("BachsService", () => {
  const configValues: Record<string, string> = {
    BACHS_SECRET_KEY: "sk_sandbox_test",
    BACHS_PRODUCT_ID_USD: "prod_usd_custom",
    BACHS_PRODUCT_ID_NGN: "prod_ngn_custom",
    WEB_ORIGIN: "http://localhost:3001",
  };

  const configService = {
    get: (key: string) => configValues[key],
  } as ConfigService;

  const service = new BachsService(configService);

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("detects sandbox base URL from secret key", () => {
    expect(service.getBaseUrl()).toBe("https://sandbox-api.bachs.io");
  });

  it("resolves currency-specific product IDs", () => {
    expect(service.isConfigured()).toBe(true);
    expect(service.isConfigured("USD")).toBe(true);
    expect(service.isConfigured("NGN")).toBe(true);
    expect(service.getProductId("USD")).toBe("prod_usd_custom");
    expect(service.getProductId("NGN")).toBe("prod_ngn_custom");
  });

  it("builds checkout URLs with purchase id", () => {
    expect(service.buildCheckoutUrls("acme", "purchase-1")).toEqual({
      successUrl: "http://localhost:3001/acme/billing?checkout=success&purchase_id=purchase-1",
      cancelUrl: "http://localhost:3001/acme/billing?checkout=cancel",
    });
  });

  it("refuses invented off-session charges", async () => {
    const fetchMock = vi.spyOn(global, "fetch");

    const result = await service.chargeOffSession({
      customerId: "cust_1",
      paymentMethodId: "pm_1",
      purchaseId: "purchase-1",
      packageId: "usd-3000",
      currency: "USD",
      tokenAmount: 3000,
      priceMinor: 100,
    });

    expect(result).toEqual({ status: "failed", errorCode: "OFF_SESSION_NOT_SUPPORTED" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("logs non-2xx when cancelling a vault subscription", async () => {
    const warn = vi.spyOn(service["logger"], "warn").mockImplementation(() => undefined);
    vi.spyOn(global, "fetch").mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => ({ detail: "boom" }),
    } as Response);

    await service.cancelSubscriptionAtPeriodEnd("sub_1");

    expect(warn).toHaveBeenCalledWith(
      "Failed to cancel Bachs vault subscription sub_1: 500 - boom",
    );
  });

  it("cancels at period end with DELETE, the documented method", async () => {
    const fetchMock = vi.spyOn(global, "fetch").mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({}),
    } as Response);

    await service.cancelSubscriptionAtPeriodEnd("sub_1");

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain("/v1/subscriptions/sub_1");
    expect(init.method).toBe("DELETE");
    expect(JSON.parse(String(init.body))).toEqual({ cancel_at_period_end: true });
  });

  it("initializes checkout with CUSTOM amount on the USD product", async () => {
    const fetchMock = vi.spyOn(global, "fetch").mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        checkout_id: "co_123",
        checkout_url: "https://checkout.bachs.io/co_123",
      }),
    } as Response);

    const result = await service.initializeCheckout({
      purchaseId: "purchase-1",
      tenantId: "tenant-1",
      packageId: "usd-3000",
      tokenAmount: 3000,
      currency: "USD",
      priceMinor: 100,
      email: "owner@example.com",
      name: "Owner",
      successUrl: "http://localhost:3001/acme/billing?checkout=success",
      cancelUrl: "http://localhost:3001/acme/billing?checkout=cancel",
    });

    expect(result.checkoutUrl).toBe("https://checkout.bachs.io/co_123");
    expect(result.checkoutId).toBe("co_123");
    expect(result.reference).toBe("sanarwa_purchase_purchase-1");
    expect(fetchMock).toHaveBeenCalledOnce();

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(String(init.body));
    // Docs: a per-item price override is pricing: { price_type: "fixed", amount }.
    // A bare `amount` on the cart item is not a documented override and is ignored.
    expect(body.product_cart).toEqual([
      {
        product_id: "prod_usd_custom",
        quantity: 1,
        pricing: { price_type: "fixed", amount: "1.00" },
      },
    ]);
    expect(body.billing_currency).toBe("USD");
  });
});
