import { Test, TestingModule } from "@nestjs/testing";
import { getRepositoryToken } from "@nestjs/typeorm";
import { BillingService } from "../services/billing.service";
import { PolarService } from "../services/polar.service";
import { TokenManagementService } from "../../token-management/services/token-management.service";
import { Subscription } from "../entities/subscription.entity";
import { TokenPurchase } from "../entities/token-purchase.entity";
import { AutoTopupConfig } from "../entities/auto-topup-config.entity";
import { TokenBalance, TokenTransaction } from "../entities/token-balance.entity";
import { ConfigService } from "@nestjs/config";
import { TenantService } from "../../tenant/tenant.service";

describe("BillingService", () => {
  let service: BillingService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BillingService,
        { provide: getRepositoryToken(Subscription), useValue: {} },
        { provide: getRepositoryToken(TokenPurchase), useValue: {} },
        { provide: getRepositoryToken(AutoTopupConfig), useValue: {} },
        { provide: getRepositoryToken(TokenBalance), useValue: {} },
        { provide: getRepositoryToken(TokenTransaction), useValue: {} },
        { provide: PolarService, useValue: {} },
        { provide: TokenManagementService, useValue: {} },
        { provide: ConfigService, useValue: { get: () => undefined } },
        { provide: TenantService, useValue: {} },
      ],
    }).compile();

    service = module.get<BillingService>(BillingService);
  });

  it("should be defined", () => {
    expect(service).toBeDefined();
  });
});
