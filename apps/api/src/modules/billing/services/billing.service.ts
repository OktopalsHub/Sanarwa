import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { QueryDeepPartialEntity } from 'typeorm/query-builder/QueryPartialEntity';
import { ConfigService } from '@nestjs/config';
import { Cron, CronExpression } from '@nestjs/schedule';
import { OnEvent } from '@nestjs/event-emitter';
import {
  Subscription,
  SubscriptionStatus,
  SubscriptionPlan,
  PaymentProvider
} from '../entities/subscription.entity';
import {
  TokenPurchase,
  TokenPurchaseStatus,
  TokenPurchaseType
} from '../entities/token-purchase.entity';
import {
  AutoTopupConfig,
  TopupTrigger,
  ScheduleFrequency
} from '../entities/auto-topup-config.entity';
import {
  TokenBalance,
  TokenTransaction,
  TokenTransactionType
} from '../entities/token-balance.entity';
import { PolarService } from './polar.service';
import { TokenManagementService } from '../../token-management/services/token-management.service';
import { TenantService } from '../../tenant/tenant.service';

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
    private polarService: PolarService,
    private tokenManagementService: TokenManagementService,
    private configService: ConfigService,
    private tenantService: TenantService,
  ) {}

  async createSubscription(dto: CreateSubscriptionDto): Promise<Subscription> {
    try {
      let externalCustomerId: string;
      let externalSubscriptionId: string;

      // Create customer and subscription with the chosen provider
      if (dto.paymentProvider === PaymentProvider.POLAR) {
        const customer = await this.polarService.createCustomer({
          email: dto.customerEmail,
          name: dto.customerName,
          metadata: { tenantId: dto.tenantId },
        });
        externalCustomerId = customer.id;

        // Get the appropriate price ID for the plan
        const priceId = await this.getPolarPriceId(dto.plan);
        
        const subscription = await this.polarService.createSubscription({
          customer_id: customer.id,
          price_id: priceId,
          trial_period_days: dto.trialDays,
          metadata: { tenantId: dto.tenantId, plan: dto.plan },
        });
        externalSubscriptionId = subscription.id;
      } else {
        throw new BadRequestException('Only Polar subscriptions are supported');
      }

      // Create local subscription record
      const planConfig = this.getPlanConfiguration(dto.plan);
      const subscription = this.subscriptionRepository.create({
        tenantId: dto.tenantId,
        plan: dto.plan,
        status: SubscriptionStatus.ACTIVE,
        paymentProvider: dto.paymentProvider,
        externalSubscriptionId,
        externalCustomerId,
        monthlyPrice: planConfig.monthlyPrice,
        includedTokens: planConfig.includedTokens,
        overageRate: planConfig.overageRate,
        currentPeriodStart: new Date(),
        currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
        trialEnd: dto.trialDays ? new Date(Date.now() + dto.trialDays * 24 * 60 * 60 * 1000) : undefined,
      });

      const savedSubscription = await this.subscriptionRepository.save(subscription);

      // Initialize token balance if plan includes tokens
      if (planConfig.includedTokens > 0) {
        await this.tokenManagementService.addTokens(
          dto.tenantId,
          planConfig.includedTokens,
          TokenTransactionType.PURCHASE,
          'Monthly subscription tokens',
          { subscriptionId: savedSubscription.id }
        );
      }

      return savedSubscription;
    } catch (error) {
      this.logger.error('Failed to create subscription:', error);
      throw new BadRequestException('Failed to create subscription');
    }
  }

  async purchaseTokens(dto: PurchaseTokensDto): Promise<TokenPurchase> {
    try {
      const pricePerToken = this.getTokenPrice(dto.tokenAmount);
      const totalPrice = dto.tokenAmount * pricePerToken;

      let paymentIntentId: string;
      let transactionReference: string;

      if (dto.paymentProvider === PaymentProvider.POLAR) {
        const paymentIntent = await this.polarService.createPaymentIntent({
          amount: Math.round(totalPrice * 100), // Convert to cents
          currency: 'USD',
          metadata: {
            tenantId: dto.tenantId,
            tokenAmount: dto.tokenAmount,
            type: dto.type || TokenPurchaseType.MANUAL,
          },
        });
        paymentIntentId = paymentIntent.id;
        transactionReference = paymentIntent.id;
      } else {
        throw new BadRequestException('Use Bachs or Polar checkout for token purchases');
      }

      // Create token purchase record
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
      this.logger.error('Failed to purchase tokens:', error);
      throw new BadRequestException('Failed to initiate token purchase');
    }
  }

  async confirmTokenPurchase(purchaseId: string): Promise<void> {
    try {
      const purchase = await this.tokenPurchaseRepository.findOne({
        where: { id: purchaseId },
      });

      if (!purchase) {
        throw new Error('Purchase not found');
      }

      if (purchase.status !== TokenPurchaseStatus.PENDING) {
        return; // Already processed
      }

      // Verify payment with provider
      let paymentConfirmed = false;

      if (purchase.transactionReference.startsWith('pi_')) {
        // Polar payment intent
        const paymentIntent = await this.polarService.getPaymentIntent(purchase.paymentIntentId);
        paymentConfirmed = paymentIntent.status === 'succeeded';
      } else {
        paymentConfirmed = false;
      }

      if (paymentConfirmed) {
        // Add tokens to balance
        await this.tokenManagementService.addTokens(
          purchase.tenantId,
          purchase.tokenAmount,
          TokenTransactionType.PURCHASE,
          `Token purchase: ${purchase.tokenAmount} tokens`,
          { purchaseId: purchase.id }
        );

        // Update purchase status
        purchase.status = TokenPurchaseStatus.COMPLETED;
        purchase.completedAt = new Date();
        await this.tokenPurchaseRepository.save(purchase);

        this.logger.log(`Token purchase completed: ${purchase.id}`);
      } else {
        purchase.status = TokenPurchaseStatus.FAILED;
        await this.tokenPurchaseRepository.save(purchase);
        
        this.logger.warn(`Token purchase failed: ${purchase.id}`);
      }
    } catch (error) {
      this.logger.error('Failed to confirm token purchase:', error);
      throw error;
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
    // Tiered pricing - more tokens = lower price per token
    if (tokenAmount >= 100000) return 0.0005;
    if (tokenAmount >= 50000) return 0.0008;
    if (tokenAmount >= 10000) return 0.001;
    return 0.002;
  }

  private async getPolarPriceId(plan: SubscriptionPlan): Promise<string> {
    // This would typically be stored in configuration or fetched from Polar
    const priceIds = {
      [SubscriptionPlan.STARTER]: this.configService.get('POLAR_STARTER_PRICE_ID'),
      [SubscriptionPlan.PROFESSIONAL]: this.configService.get('POLAR_PROFESSIONAL_PRICE_ID'),
      [SubscriptionPlan.ENTERPRISE]: this.configService.get('POLAR_ENTERPRISE_PRICE_ID'),
    };

    return priceIds[plan];
  }

  // Additional methods for compatibility with existing code
  async getSubscriptionByTenantId(tenantId: string): Promise<Subscription | null> {
    return await this.subscriptionRepository.findOne({
      where: { tenantId, status: SubscriptionStatus.ACTIVE },
    });
  }

  async updateSubscription(subscriptionId: string, updates: Partial<Subscription>): Promise<Subscription | null> {
    await this.subscriptionRepository.update(
      subscriptionId,
      updates as QueryDeepPartialEntity<Subscription>,
    );
    return await this.subscriptionRepository.findOne({ where: { id: subscriptionId } });
  }

  /**
   * Calculate event-based billing for BYOP usage
   */
  async calculateEventBilling(
    tenantId: string,
    eventType: string,
    eventCount: number = 1,
    metadata?: Record<string, any>
  ): Promise<{ charged: boolean; amount: number; currency: string; reason: string; metadata?: any }> {
    try {
      // For BYOP usage, we charge per event regardless of channels
      const costPerEvent = 0.01; // $0.01 per event
      const totalCost = costPerEvent * eventCount;

      return {
        charged: true,
        amount: totalCost,
        currency: 'USD',
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
        currency: 'USD',
        reason: `Billing error: ${error.message}`,
      };
    }
  }


}