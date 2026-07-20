import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { Cron, CronExpression } from '@nestjs/schedule';
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
import { PaystackService } from './paystack.service';
import { TokenManagementService } from '../../token-management/services/token-management.service';

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
export class SubscriptionBillingService {
  private readonly logger = new Logger(SubscriptionBillingService.name);

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
    private paystackService: PaystackService,
    private tokenManagementService: TokenManagementService,
    private configService: ConfigService,
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
        const customer = await this.paystackService.createCustomer({
          email: dto.customerEmail,
          first_name: dto.customerName?.split(' ')[0],
          last_name: dto.customerName?.split(' ').slice(1).join(' '),
          metadata: { tenantId: dto.tenantId },
        });
        externalCustomerId = customer.customer_code;

        // Get the appropriate plan code
        const planCode = await this.getPaystackPlanCode(dto.plan);
        
        const subscription = await this.paystackService.createSubscription({
          customer: customer.customer_code,
          plan: planCode,
          metadata: { tenantId: dto.tenantId, plan: dto.plan },
        });
        externalSubscriptionId = subscription.subscription_code;
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
        const transaction = await this.paystackService.initializeTransaction({
          email: 'billing@tenant.com', // This should come from tenant info
          amount: this.paystackService.toKobo(totalPrice),
          currency: 'NGN',
          metadata: {
            tenantId: dto.tenantId,
            tokenAmount: dto.tokenAmount,
            type: dto.type || TokenPurchaseType.MANUAL,
          },
        });
        paymentIntentId = transaction.access_code || '';
        transactionReference = transaction.reference;
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
        // Paystack transaction
        const transaction = await this.paystackService.verifyTransaction(purchase.transactionReference);
        paymentConfirmed = transaction.status === 'success';
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

  async configureAutoTopup(dto: AutoTopupConfigDto): Promise<AutoTopupConfig> {
    try {
      let config = await this.autoTopupConfigRepository.findOne({
        where: { tenantId: dto.tenantId },
      });

      if (config) {
        // Update existing config
        Object.assign(config, dto);
      } else {
        // Create new config
        config = this.autoTopupConfigRepository.create(dto);
      }

      // Calculate next scheduled run if applicable
      if (dto.trigger === TopupTrigger.SCHEDULED || dto.trigger === TopupTrigger.BOTH) {
        config.nextScheduledRun = this.calculateNextScheduledRun(config);
      }

      return await this.autoTopupConfigRepository.save(config);
    } catch (error) {
      this.logger.error('Failed to configure auto topup:', error);
      throw new BadRequestException('Failed to configure auto topup');
    }
  }

  @Cron(CronExpression.EVERY_5_MINUTES)
  async processAutoTopups(): Promise<void> {
    try {
      this.logger.log('Processing auto topups...');

      // Get all enabled auto topup configs
      const configs = await this.autoTopupConfigRepository.find({
        where: { enabled: true },
      });

      for (const config of configs) {
        await this.processAutoTopupForTenant(config);
      }

      this.logger.log(`Processed ${configs.length} auto topup configs`);
    } catch (error) {
      this.logger.error('Failed to process auto topups:', error);
    }
  }

  private async processAutoTopupForTenant(config: AutoTopupConfig): Promise<void> {
    try {
      const balance = await this.tokenManagementService.getBalance(config.tenantId);
      let shouldTopup = false;
      let topupAmount = 0;
      let topupType = TokenPurchaseType.AUTO_TOPUP;

      // Check threshold trigger
      if (
        (config.trigger === TopupTrigger.THRESHOLD || config.trigger === TopupTrigger.BOTH) &&
        config.thresholdAmount &&
        config.topupAmount &&
        balance.availableTokens <= config.thresholdAmount
      ) {
        shouldTopup = true;
        topupAmount = config.topupAmount;
      }

      // Check scheduled trigger
      if (
        (config.trigger === TopupTrigger.SCHEDULED || config.trigger === TopupTrigger.BOTH) &&
        config.nextScheduledRun &&
        config.scheduledAmount &&
        new Date() >= config.nextScheduledRun
      ) {
        shouldTopup = true;
        topupAmount = Math.max(topupAmount, config.scheduledAmount);
        topupType = TokenPurchaseType.SCHEDULED;
        
        // Update next scheduled run
        config.nextScheduledRun = this.calculateNextScheduledRun(config);
        await this.autoTopupConfigRepository.save(config);
      }

      if (!shouldTopup || topupAmount === 0) {
        return;
      }

      // Check monthly spending limit
      const currentMonth = new Date().getMonth() + 1;
      const currentYear = new Date().getFullYear();
      
      if (config.currentMonth !== currentMonth || config.currentYear !== currentYear) {
        // Reset monthly spending for new month
        config.currentMonthSpend = 0;
        config.currentMonth = currentMonth;
        config.currentYear = currentYear;
      }

      const tokenPrice = this.getTokenPrice(topupAmount);
      const purchaseAmount = topupAmount * tokenPrice;

      if (
        config.maxMonthlySpend &&
        config.currentMonthSpend + purchaseAmount > config.maxMonthlySpend
      ) {
        this.logger.warn(
          `Auto topup skipped for tenant ${config.tenantId}: would exceed monthly spending limit`
        );
        return;
      }

      // Get tenant's preferred payment provider (default to first available subscription)
      const subscription = await this.subscriptionRepository.findOne({
        where: { tenantId: config.tenantId, status: SubscriptionStatus.ACTIVE },
      });

      const paymentProvider = subscription?.paymentProvider || PaymentProvider.PAYSTACK;

      // Initiate auto purchase
      await this.purchaseTokens({
        tenantId: config.tenantId,
        tokenAmount: topupAmount,
        paymentProvider,
        type: topupType,
        metadata: { autoTopupConfigId: config.id },
      });

      // Update spending tracking
      config.currentMonthSpend += purchaseAmount;
      config.lastTriggered = new Date();
      await this.autoTopupConfigRepository.save(config);

      this.logger.log(
        `Auto topup initiated for tenant ${config.tenantId}: ${topupAmount} tokens`
      );
    } catch (error) {
      this.logger.error(`Failed to process auto topup for tenant ${config.tenantId}:`, error);
    }
  }

  private calculateNextScheduledRun(config: AutoTopupConfig): Date {
    const now = new Date();
    const [hours, minutes] = (config.scheduleTime || '09:00').split(':').map(Number);

    let nextRun = new Date(now);
    nextRun.setHours(hours, minutes, 0, 0);

    switch (config.scheduleFrequency) {
      case ScheduleFrequency.DAILY:
        if (nextRun <= now) {
          nextRun.setDate(nextRun.getDate() + 1);
        }
        break;

      case ScheduleFrequency.WEEKLY:
        const targetDay = config.scheduleDayOfWeek || 1; // Default to Monday
        const currentDay = nextRun.getDay();
        let daysUntilTarget = targetDay - currentDay;
        
        if (daysUntilTarget <= 0 || (daysUntilTarget === 0 && nextRun <= now)) {
          daysUntilTarget += 7;
        }
        
        nextRun.setDate(nextRun.getDate() + daysUntilTarget);
        break;

      case ScheduleFrequency.MONTHLY:
        const targetDate = config.scheduleDayOfMonth || 1;
        nextRun.setDate(targetDate);
        
        if (nextRun <= now) {
          nextRun.setMonth(nextRun.getMonth() + 1);
        }
        break;
    }

    return nextRun;
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

  private async getPaystackPlanCode(plan: SubscriptionPlan): Promise<string> {
    // This would typically be stored in configuration or fetched from Paystack
    const planCodes = {
      [SubscriptionPlan.STARTER]: this.configService.get('PAYSTACK_STARTER_PLAN_CODE'),
      [SubscriptionPlan.PROFESSIONAL]: this.configService.get('PAYSTACK_PROFESSIONAL_PLAN_CODE'),
      [SubscriptionPlan.ENTERPRISE]: this.configService.get('PAYSTACK_ENTERPRISE_PLAN_CODE'),
    };

    return planCodes[plan];
  }
}