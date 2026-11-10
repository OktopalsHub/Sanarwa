import { describe, expect, it } from "vitest";
import {
  buildPaymentMethodSetupReference,
  buildPurchaseReference,
  parsePaymentMethodSetupReference,
  parsePurchaseReference,
  resolvePackage,
} from "../constants/token-packages";

describe("token-packages catalog", () => {
  it("resolves USD managed packages server-side", () => {
    const pkg = resolvePackage("usd-3000", "USD");
    expect(pkg.tokens).toBe(3000);
    expect(pkg.price).toBe(1);
    expect(pkg.currency).toBe("USD");
  });

  it("rejects mismatched currency", () => {
    expect(() => resolvePackage("usd-3000", "NGN")).toThrow();
  });

  it("round-trips purchase references", () => {
    const purchaseId = "abc-123";
    const reference = buildPurchaseReference(purchaseId);
    expect(parsePurchaseReference(reference)).toBe(purchaseId);
  });
});

describe("payment references", () => {
  it("writes the sanarwa prefix", () => {
    expect(buildPurchaseReference("abc-123")).toBe("sanarwa_purchase_abc-123");
    expect(buildPaymentMethodSetupReference("set-9")).toBe("sanarwa_pm_setup_set-9");
  });

  it("parses the current prefix", () => {
    expect(parsePurchaseReference("sanarwa_purchase_abc-123")).toBe("abc-123");
    expect(parsePaymentMethodSetupReference("sanarwa_pm_setup_set-9")).toBe("set-9");
  });

  it("does not mistake a prefix for another", () => {
    expect(parsePaymentMethodSetupReference("sanarwa_purchase_abc-123")).toBeNull();
    expect(parsePurchaseReference("sanarwa_pm_setup_set-9")).toBeNull();
  });

  it("rejects unrelated and empty references", () => {
    expect(parsePurchaseReference(null)).toBeNull();
    expect(parsePurchaseReference(undefined)).toBeNull();
    expect(parsePurchaseReference("")).toBeNull();
    expect(parsePurchaseReference("some-other-reference")).toBeNull();
    expect(parsePurchaseReference("sanarwa_purchase_")).toBeNull();
  });
});
