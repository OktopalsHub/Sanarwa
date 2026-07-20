import { Test, TestingModule } from '@nestjs/testing';
import { BillingService } from '../services/billing.service';
import { PaystackService } from '../services/paystack.service';
import { PolarService } from '../services/polar.service';
import { SubscriptionBillingService } from '../services/subscription-billing.service';
import { Repository } from 'typeorm';
import { getRepositoryToken } from '@nestjs/typeorm';
import { TokenBalance } from '../entities/token-balance.entity';
import { TokenPurchase } from '../entities/token-purchase.entity';
import { AutoTopupConfig } from '../entities/auto-topup-config.entity';
import type { Mocked } from 'vitest';

describe('BillingService', () => {
  let service: BillingService;
  let tokenBalanceRepository: Mocked<Repository<TokenBalance>>;
  let tokenPurchaseRepository: Mocked<Repository<TokenPurchase>>;
  let autoTopupRepository: Mocked<Repository<AutoTopupConfig>>;
  let paystackService: Mocked<PaystackService>;
  let polarService: Mocked<PolarService>;
  let subscriptionBillingService: Mocked<SubscriptionBillingService>;

  beforeEach(async () => {
    const mockRepository = {
      find: vi.fn(),
      findOne: vi.fn(),
      save: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    };

    const mockPaystackService = {
      initializePayment: vi.fn(),
      verifyPayment: vi.fn(),
      createCustomer: vi.fn(),
    };

    const mockPolarService = {
      createSubscription: vi.fn(),
      cancelSubscription: vi.fn(),
      getSubscription: vi.fn(),
    };

    const mockSubscriptionBillingService = {
      processSubscriptionBilling: vi.fn(),
      calculateUsage: vi.fn(),
      generateInvoice: vi.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BillingService,
        {
          provide: getRepositoryToken(TokenBalance),
          useValue: mockRepository,
        },
        {
          provide: getRepositoryToken(TokenPurchase),
          useValue: mockRepository,
        },
        {
          provide: getRepositoryToken(AutoTopupConfig),
          useValue: mockRepository,
        },
        {
          provide: PaystackService,
          useValue: mockPaystackService,
        },
        {
          provide: PolarService,
          useValue: mockPolarService,
        },
        {
          provide: SubscriptionBillingService,
          useValue: mockSubscriptionBillingService,
        },
      ],
    }).compile();

    service = module.get<BillingService>(BillingService);
    tokenBalanceRepository = module.get(getRepositoryToken(TokenBalance));
    tokenPurchaseRepository = module.get(getRepositoryToken(TokenPurchase));
    autoTopupRepository = module.get(getRepositoryToken(AutoTopupConfig));
    paystackService = module.get(PaystackService);
    polarService = module.get(PolarService);
    subscriptionBillingService = module.get(SubscriptionBillingService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getTokenBalance', () => {
    it('should return token balance for tenant', async () => {
      const mockBalance = {
        id: '1',
        tenantId: 'tenant-1',
        balance: 1000,
        currency: 'USD',
      };

      tokenBalanceRepository.findOne.mockResolvedValue(mockBalance as TokenBalance);

      const result = await service.getTokenBalance('tenant-1');

      expect(result).toEqual(mockBalance);
      expect(tokenBalanceRepository.findOne).toHaveBeenCalledWith({
        where: { tenantId: 'tenant-1' },
      });
    });
  });

  describe('purchaseTokens', () => {
    it('should initiate token purchase', async () => {
      const purchaseData = {
        tenantId: 'tenant-1',
        amount: 100,
        tokens: 1000,
      };

      const mockPaymentResponse = {
        reference: 'ref-123',
        authorization_url: 'https://checkout.paystack.com/ref-123',
      };

      paystackService.initializePayment.mockResolvedValue(mockPaymentResponse);

      const result = await service.purchaseTokens(purchaseData);

      expect(result).toEqual(mockPaymentResponse);
      expect(paystackService.initializePayment).toHaveBeenCalledWith({
        amount: purchaseData.amount * 100, // Convert to kobo
        email: expect.any(String),
        reference: expect.any(String),
      });
    });
  });

  describe('deductTokens', () => {
    it('should deduct tokens from balance', async () => {
      const mockBalance = {
        id: '1',
        tenantId: 'tenant-1',
        balance: 1000,
        currency: 'USD',
      };

      tokenBalanceRepository.findOne.mockResolvedValue(mockBalance as TokenBalance);
      tokenBalanceRepository.save.mockResolvedValue({ ...mockBalance, balance: 900 } as TokenBalance);

      const result = await service.deductTokens('tenant-1', 100);

      expect(result.balance).toBe(900);
      expect(tokenBalanceRepository.save).toHaveBeenCalledWith({
        ...mockBalance,
        balance: 900,
      });
    });

    it('should throw error if insufficient balance', async () => {
      const mockBalance = {
        id: '1',
        tenantId: 'tenant-1',
        balance: 50,
        currency: 'USD',
      };

      tokenBalanceRepository.findOne.mockResolvedValue(mockBalance as TokenBalance);

      await expect(service.deductTokens('tenant-1', 100)).rejects.toThrow('Insufficient token balance');
    });
  });
});