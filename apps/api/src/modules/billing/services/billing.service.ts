import { Injectable, Logger, BadRequestException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { QueryDeepPartialEntity } from "typeorm/query-builder/QueryPartialEntity";
import { ConfigService } from "@nestjs/config";
import { Cron, CronExpression } from "@nestjs/schedule";
import { OnEvent } from "@nestjs/event-emitter";
import {
  Subscription,
  SubscriptionStatus,
  SubscriptionPlan,
  PaymentProvider,
} from "../entities/subscription.entity";
import {
  TokenPurchase,
  TokenPurchaseStatus,
  TokenPurchaseType,
} from "../entities/token-purchase.entity";
import {
  AutoTopupConfig,
  TopupTrigger,
  ScheduleFrequency,
} from "../entities/auto-topup-config.entity";
import {
  TokenBalance,
  TokenTransaction,
  TokenTransactionType,
} from "../entities/token-balance.entity";
import { TokenManagementService } from "../../token-management/services/token-management.service";

export interface CreateSubscriptionDto {
  tenantId: string;
  plan: SubscriptionPlan;
  paymentProvider: PaymentProvider;
  customerEmail: string;
  customerName?: string;
  trialDays?: number;
}

export interface PurchaseTokensDto {
  tenantId: string;
  tokenAmount: number;
  paymentProvider: PaymentProvider;
  type?: TokenPurchaseType;
  metadata?: any;
}

export interface AutoTopupConfigDto {
  tenantId: string;
  enabled: boolean;
  trigger: TopupTrigger;
  thresholdAmount?: number;
  topupAmount?: number;
  scheduleFrequency?: ScheduleFrequency;
  scheduledAmount?: number;
  scheduleTime?: string;
  scheduleDayOfWeek?: number;
  scheduleDayOfMonth?: number;
  maxMonthlySpend?: number;
}

@Injectable()
export class BillingService {
  private readonly logger = new Logger(BillingService.name);

  constructor(
    @InjectRepository(Subscription)
    private subscriptionRepository: Repository<Subscription>,
    @InjectRepository(TokenPurchase)
    private tokenPurchaseRepository: Repository<TokenPurchase>,
    @InjectRepository(AutoTopupConfig)
    private autoTopupConfigRepository: Repository<AutoTopupConfig>,
    @InjectRepository(TokenBalance)
    private tokenBalanceRepository: Repository<TokenBalance>,
    @InjectRepository(TokenTransaction)
    private tokenTransactionRepository: Repository<TokenTransaction>,
    private tokenManagementService: TokenManagementService,
    private configService: ConfigService,
  ) {}

  async purchaseTokens(dto: PurchaseTokensDto): Promise<TokenPurchase> {
    try {
      const pricePerToken = this.getTokenPrice(dto.tokenAmount);
      const totalPrice = dto.tokenAmount * pricePerToken;

      let paymentIntentId: string;
      let transactionReference: string;

      throw new BadRequestException("Use the Bachs checkout flow for token purchases");

      const tokenPurchase = this.tokenPurchaseRepository.create({
        tenantId: dto.tenantId,
        tokenAmount: dto.tokenAmount,
        totalPrice,
        pricePerToken,
        status: TokenPurchaseStatus.PENDING,
        type: dto.type || TokenPurchaseType.MANUAL,
        paymentIntentId,
        transactionReference,
        paymentMetadata: dto.metadata,
      });

      return await this.tokenPurchaseRepository.save(tokenPurchase);
    } catch (error) {
      this.logger.error("Failed to purchase tokens:", error);
      throw new BadRequestException("Failed to initiate token purchase");
    }
  }

  private getPlanConfiguration(plan: SubscriptionPlan) {
    const configs = {
      [SubscriptionPlan.STARTER]: {
        monthlyPrice: 29,
        includedTokens: 10000,
        overageRate: 0.001,
      },
      [SubscriptionPlan.PROFESSIONAL]: {
        monthlyPrice: 99,
        includedTokens: 50000,
        overageRate: 0.0008,
      },
      [SubscriptionPlan.ENTERPRISE]: {
        monthlyPrice: 299,
        includedTokens: 200000,
        overageRate: 0.0005,
      },
      [SubscriptionPlan.PAY_AS_YOU_GO]: {
        monthlyPrice: 0,
        includedTokens: 0,
        overageRate: 0.002,
      },
    };

    return configs[plan];
  }

  private getTokenPrice(tokenAmount: number): number {
    if (tokenAmount >= 100000) return 0.0005;
    if (tokenAmount >= 50000) return 0.0008;
    if (tokenAmount >= 10000) return 0.001;
    return 0.002;
  }

  async getSubscriptionByTenantId(tenantId: string): Promise<Subscription | null> {
    return await this.subscriptionRepository.findOne({
      where: { tenantId, status: SubscriptionStatus.ACTIVE },
    });
  }

  async updateSubscription(
    subscriptionId: string,
    updates: Partial<Subscription>,
  ): Promise<Subscription | null> {
    await this.subscriptionRepository.update(
      subscriptionId,
      updates as QueryDeepPartialEntity<Subscription>,
    );
    return await this.subscriptionRepository.findOne({ where: { id: subscriptionId } });
  }

  async calculateEventBilling(
    tenantId: string,
    eventType: string,
    eventCount: number = 1,
    metadata?: Record<string, any>,
  ): Promise<{
    charged: boolean;
    amount: number;
    currency: string;
    reason: string;
    metadata?: any;
  }> {
    try {
      const costPerEvent = 0.01;
      const totalCost = costPerEvent * eventCount;

      return {
        charged: true,
        amount: totalCost,
        currency: "USD",
        reason: `BYOP event billing: ${eventCount} event(s) at $${costPerEvent} each`,
        metadata: {
          eventType,
          eventCount,
          costPerEvent,
          ...metadata,
        },
      };
    } catch (error) {
      this.logger.error(`Failed to calculate event billing: ${error.message}`);
      return {
        charged: false,
        amount: 0,
        currency: "USD",
        reason: `Billing error: ${error.message}`,
      };
    }
  }
}
