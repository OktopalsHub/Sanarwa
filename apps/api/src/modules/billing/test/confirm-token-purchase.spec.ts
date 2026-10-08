import { NotFoundException } from "@nestjs/common";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../entities/token-purchase.entity", () => ({
  TokenPurchase: class TokenPurchase {},
  TokenPurchaseStatus: {
    PENDING: "pending",
    COMPLETED: "completed",
    FAILED: "failed",
    REFUNDED: "refunded",
  },
  TokenPurchaseType: {
    MANUAL: "manual",
    AUTO_TOPUP: "auto_topup",
    SCHEDULED: "scheduled",
    OVERAGE: "overage",
  },
}));
vi.mock("../entities/token-balance.entity", () => ({
  TokenTransactionType: { PURCHASE: "purchase" },
  TokenBalance: class TokenBalance {},
  TokenTransaction: class TokenTransaction {},
}));
vi.mock("../../tenant/entities/tenant.entity", () => ({ Tenant: class Tenant {} }));
vi.mock("../entities/webhook-event.entity", () => ({ WebhookEvent: class WebhookEvent {} }));
vi.mock("../entities/tenant-payment-method.entity", () => ({
  TenantPaymentMethod: class TenantPaymentMethod {},
}));
vi.mock("../entities/auto-topup-config.entity", () => ({
  AutoTopupConfig: class AutoTopupConfig {},
  TopupTrigger: { THRESHOLD: "threshold", SCHEDULED: "scheduled", BOTH: "both" },
  ScheduleFrequency: { DAILY: "daily", WEEKLY: "weekly", MONTHLY: "monthly" },
}));
vi.mock("../services/polar.service", () => ({ PolarService: class PolarService {} }));
vi.mock("../services/bachs.service", () => ({ BachsService: class BachsService {} }));
vi.mock("../services/nomba.service", () => ({ NombaService: class NombaService {} }));
vi.mock("../services/payment-method.service", () => ({
  PaymentMethodService: class PaymentMethodService {},
}));
vi.mock("../../token-management/services/token-management.service", () => ({
  TokenManagementService: class TokenManagementService {},
}));
vi.mock("../utils/bachs-webhook.util", () => ({ verifyBachsWebhook: vi.fn() }));
vi.mock("../utils/nomba-webhook.util", () => ({ verifyNombaWebhook: vi.fn() }));
vi.mock("../constants/token-packages", () => ({
  buildNotifiPurchaseReference: (id: string) => `notifi_purchase_${id}`,
  packagePriceMinor: () => 0,
  resolvePackage: () => ({ id: "usd-3000", tokens: 3000, price: 1 }),
}));

const { TokenPurchaseService } = await import("../services/token-purchase.service");
const { TokenPurchaseStatus } = await import("../entities/token-purchase.entity");
const { TokenTransactionType } = await import("../entities/token-balance.entity");

describe("TokenPurchaseService.confirmTokenPurchase", () => {
  const purchaseId = "11111111-1111-1111-1111-111111111111";
  const tenantId = "22222222-2222-2222-2222-222222222222";

  let updateExecute: ReturnType<typeof vi.fn>;
  let findOne: ReturnType<typeof vi.fn>;
  let update: ReturnType<typeof vi.fn>;
  let addTokens: ReturnType<typeof vi.fn>;
  let service: InstanceType<typeof TokenPurchaseService>;

  beforeEach(() => {
    updateExecute = vi.fn();
    findOne = vi.fn();
    update = vi.fn().mockResolvedValue({ affected: 1 });
    addTokens = vi.fn().mockResolvedValue({});

    const queryBuilder = {
      update: vi.fn().mockReturnThis(),
      set: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      execute: updateExecute,
    };

    const tokenPurchaseRepository = {
      createQueryBuilder: vi.fn(() => queryBuilder),
      findOne,
      update,
    };

    service = new TokenPurchaseService(
      tokenPurchaseRepository as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      { addTokens } as never,
      {} as never,
      {} as never,
    );
  });

  it("credits tokens once when claiming a pending purchase", async () => {
    updateExecute.mockResolvedValue({ affected: 1 });
    findOne.mockResolvedValue({
      id: purchaseId,
      tenantId,
      tokenAmount: 3000,
    });

    await service.confirmTokenPurchase(purchaseId);

    expect(addTokens).toHaveBeenCalledOnce();
    expect(addTokens).toHaveBeenCalledWith(
      tenantId,
      3000,
      TokenTransactionType.PURCHASE,
      "Token purchase: 3000 tokens",
      { purchaseId },
      purchaseId,
    );
  });

  it("does not credit again when purchase was already claimed", async () => {
    updateExecute.mockResolvedValueOnce({ affected: 1 }).mockResolvedValueOnce({ affected: 0 });

    findOne
      .mockResolvedValueOnce({
        id: purchaseId,
        tenantId,
        tokenAmount: 3000,
      })
      .mockResolvedValueOnce({
        id: purchaseId,
        status: TokenPurchaseStatus.COMPLETED,
      });

    await service.confirmTokenPurchase(purchaseId);
    await service.confirmTokenPurchase(purchaseId);

    expect(addTokens).toHaveBeenCalledOnce();
  });

  it("throws when purchase does not exist", async () => {
    updateExecute.mockResolvedValue({ affected: 0 });
    findOne.mockResolvedValue(null);

    await expect(service.confirmTokenPurchase(purchaseId)).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(addTokens).not.toHaveBeenCalled();
  });

  it("releases the claim if addTokens fails so a retry can credit", async () => {
    updateExecute.mockResolvedValue({ affected: 1 });
    findOne.mockResolvedValue({
      id: purchaseId,
      tenantId,
      tokenAmount: 3000,
    });
    addTokens.mockRejectedValue(new Error("balance write failed"));

    await expect(service.confirmTokenPurchase(purchaseId)).rejects.toThrow("balance write failed");

    expect(update).toHaveBeenCalledWith(
      { id: purchaseId, status: TokenPurchaseStatus.COMPLETED },
      { status: TokenPurchaseStatus.PENDING, completedAt: expect.any(Function) },
    );
  });
});
