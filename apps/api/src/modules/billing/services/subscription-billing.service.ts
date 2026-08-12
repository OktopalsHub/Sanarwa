import { Injectable, Logger, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, QueryFailedError, Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { Cron, CronExpression } from '@nestjs/schedule';
import { createHash } from 'node:crypto';
import {
  TokenPurchase,
  TokenPurchaseStatus,
  TokenPurchaseType,
} from '../entities/token-purchase.entity';
import {
  AutoTopupConfig,
  TopupTrigger,
  ScheduleFrequency,
} from '../entities/auto-topup-config.entity';
import { WebhookEvent } from '../entities/webhook-event.entity';
import { TenantPaymentMethod } from '../entities/tenant-payment-method.entity';
import { Tenant } from '../../tenant/entities/tenant.entity';
import { PaymentProvider } from '../enums/payment-provider.enum';
import { PolarService } from './polar.service';
import { BachsService } from './bachs.service';
import { NombaService } from './nomba.service';
import { PaymentMethodService } from './payment-method.service';
import { TokenManagementService } from '../../token-management/services/token-management.service';
import { TokenTransactionType } from '../entities/token-balance.entity';
import {
  BillingCurrency,
  buildNotifiPurchaseReference,
  packagePriceMinor,
  resolvePackage,
} from '../constants/token-packages';
import { verifyBachsWebhook } from '../utils/bachs-webhook.util';
import { verifyNombaWebhook } from '../utils/nomba-webhook.util';

export interface PurchaseTokenPackDto {
  tenantId: string;
  packageId: string;
  currency: BillingCurrency;
  customerEmail?: string;
  customerName?: string;
  type?: TokenPurchaseType;
}

export interface LegacyPurchaseTokensDto {
  tenantId: string;
  tokenAmount: number;
  paymentProvider: PaymentProvider;
  type?: TokenPurchaseType;
  metadata?: Record<string, unknown>;
}

export type PurchaseTokensDto = PurchaseTokenPackDto | LegacyPurchaseTokensDto;

export interface TokenPurchaseCheckoutResult {
  purchaseId: string;
  checkoutUrl: string;
  provider: PaymentProvider;
  status: TokenPurchaseStatus;
}

export interface CheckoutContextResult {
  defaultCurrency: BillingCurrency;
  availableCurrencies: BillingCurrency[];
  bachsConfigured: boolean;
  nombaConfigured: boolean;
  providers: PaymentProvider[];
  countryCode?: string;
}

export interface AutoTopupConfigDto {
  tenantId: string;
  enabled: boolean;
  trigger?: TopupTrigger;
  thresholdAmount?: number;
  packageId?: string;
  currency?: BillingCurrency;
  paymentMethodId?: string;
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
    @InjectRepository(TokenPurchase)
    private tokenPurchaseRepository: Repository<TokenPurchase>,
    @InjectRepository(AutoTopupConfig)
    private autoTopupConfigRepository: Repository<AutoTopupConfig>,
    @InjectRepository(WebhookEvent)
    private webhookEventRepository: Repository<WebhookEvent>,
    @InjectRepository(Tenant)
    private tenantRepository: Repository<Tenant>,
    @InjectRepository(TenantPaymentMethod)
    private paymentMethodRepository: Repository<TenantPaymentMethod>,
    private polarService: PolarService,
    private bachsService: BachsService,
    private nombaService: NombaService,
    private paymentMethodService: PaymentMethodService,
    private tokenManagementService: TokenManagementService,
    private configService: ConfigService,
    private dataSource: DataSource,
  ) {}

  async purchaseTokens(
    dto: PurchaseTokensDto,
  ): Promise<TokenPurchaseCheckoutResult | TokenPurchase> {
    if (this.isLegacyPurchaseDto(dto)) {
      return this.initiateLegacyTokenPurchase(dto);
    }
    return this.purchaseTokenPack(dto);
  }

  async purchaseTokenPack(dto: PurchaseTokenPackDto): Promise<TokenPurchaseCheckoutResult> {
    let pkg;
    try {
      pkg = resolvePackage(dto.packageId, dto.currency);
    } catch {
      throw new BadRequestException('Invalid token package or currency');
    }

    const tenant = await this.tenantRepository.findOne({
      where: { id: dto.tenantId },
      relations: ['owner'],
    });

    if (!tenant) {
      throw new BadRequestException('Tenant not found');
    }

    const email = dto.customerEmail ?? tenant.owner?.email;
    const name = dto.customerName ?? tenant.owner?.name ?? tenant.name;

    if (!email) {
      throw new BadRequestException('Customer email is required for checkout');
    }

    const priceMinor = packagePriceMinor(pkg);
    const purchase = this.tokenPurchaseRepository.create({
      tenantId: dto.tenantId,
      tokenAmount: pkg.tokens,
      totalPrice: pkg.price,
      pricePerToken: pkg.pricePerToken,
      status: TokenPurchaseStatus.PENDING,
      type: dto.type ?? TokenPurchaseType.MANUAL,
      paymentMetadata: {
        packageId: pkg.id,
        currency: pkg.currency,
      },
    });

    const savedPurchase = await this.tokenPurchaseRepository.save(purchase);
    const provider = this.resolveCheckoutProvider(pkg.currency);

    try {
      const checkout = await this.initializeProviderCheckout({
        provider,
        purchase: savedPurchase,
        tenant,
        email,
        name,
        packageId: pkg.id,
        currency: pkg.currency,
        priceMinor,
      });

      savedPurchase.paymentIntentId = checkout.paymentIntentId;
      savedPurchase.transactionReference = checkout.transactionReference;
      savedPurchase.paymentMetadata = {
        ...savedPurchase.paymentMetadata,
        provider,
        checkoutUrl: checkout.checkoutUrl,
      };
      await this.tokenPurchaseRepository.save(savedPurchase);

      return {
        purchaseId: savedPurchase.id,
        checkoutUrl: checkout.checkoutUrl,
        provider,
        status: savedPurchase.status,
      };
    } catch (error) {
      savedPurchase.status = TokenPurchaseStatus.FAILED;
      await this.tokenPurchaseRepository.save(savedPurchase);
      this.logger.error('Failed to purchase token pack:', error);
      throw new BadRequestException('Failed to initiate token purchase');
    }
  }

  async initiateLegacyTokenPurchase(dto: LegacyPurchaseTokensDto): Promise<TokenPurchase> {
    try {
      const pricePerToken = this.getTokenPrice(dto.tokenAmount);
      const totalPrice = dto.tokenAmount * pricePerToken;

      let paymentIntentId = '';
      let transactionReference = '';

      if (dto.paymentProvider === PaymentProvider.POLAR) {
        const paymentIntent = await this.polarService.createPaymentIntent({
          amount: Math.round(totalPrice * 100),
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
        throw new BadRequestException('Legacy token purchase requires Polar');
      }

      const tokenPurchase = this.tokenPurchaseRepository.create({
        tenantId: dto.tenantId,
        tokenAmount: dto.tokenAmount,
        totalPrice,
        pricePerToken,
        status: TokenPurchaseStatus.PENDING,
        type: dto.type || TokenPurchaseType.MANUAL,
        paymentIntentId,
        transactionReference,
        paymentMetadata: {
          ...dto.metadata,
          provider: dto.paymentProvider,
        },
      });

      return await this.tokenPurchaseRepository.save(tokenPurchase);
    } catch (error) {
      this.logger.error('Failed to purchase tokens (legacy):', error);
      throw new BadRequestException('Failed to initiate token purchase');
    }
  }

  async getPurchaseStatus(purchaseId: string, tenantId: string) {
    const purchase = await this.tokenPurchaseRepository.findOne({
      where: { id: purchaseId, tenantId },
    });

    if (!purchase) {
      throw new NotFoundException('Purchase not found');
    }

    return {
      purchaseId: purchase.id,
      status: purchase.status,
      tokenAmount: purchase.tokenAmount,
      totalPrice: Number(purchase.totalPrice),
      currency: purchase.paymentMetadata?.currency as BillingCurrency | undefined,
      provider: purchase.paymentMetadata?.provider as PaymentProvider | undefined,
      completedAt: purchase.completedAt,
    };
  }

  async syncPurchase(purchaseId: string, tenantId: string) {
    const purchase = await this.tokenPurchaseRepository.findOne({
      where: { id: purchaseId, tenantId },
    });

    if (!purchase) {
      throw new NotFoundException('Purchase not found');
    }

    if (purchase.status === TokenPurchaseStatus.COMPLETED) {
      return this.getPurchaseStatus(purchaseId, tenantId);
    }

    const provider = purchase.paymentMetadata?.provider as PaymentProvider | undefined;
    let verified: import('../types/payment-verify-result').PaymentVerifyResult = {
      status: 'pending',
    };

    if (provider === PaymentProvider.BACHS && purchase.transactionReference) {
      verified = await this.bachsService.verifyCheckoutSession(purchase.transactionReference);
    } else if (provider === PaymentProvider.NOMBA && purchase.transactionReference) {
      verified = await this.nombaService.verifyOrder(purchase.transactionReference);
    } else if (provider === PaymentProvider.POLAR && purchase.transactionReference) {
      verified = await this.polarService.verifyCheckout(purchase.transactionReference);
    } else if (purchase.paymentIntentId?.startsWith('pi_')) {
      const paymentIntent = await this.polarService.getPaymentIntent(purchase.paymentIntentId);
      verified = {
        status:
          paymentIntent.status === 'succeeded'
            ? 'success'
            : paymentIntent.status === 'canceled'
              ? 'failed'
              : 'pending',
        amount:
          typeof paymentIntent.amount === 'number' ? paymentIntent.amount / 100 : undefined,
        currency: paymentIntent.currency,
      };
    }

    if (verified.status === 'success') {
      if (!this.isFullyPaid(purchase, verified.amount, verified.currency)) {
        this.logger.warn(
          `Underpayment for purchase ${purchaseId}: paid=${verified.amount} expected=${purchase.totalPrice}`,
        );
        await this.failTokenPurchase(purchaseId);
      } else {
        await this.confirmTokenPurchase(purchaseId);
      }
    } else if (verified.status === 'failed') {
      await this.failTokenPurchase(purchaseId);
    }

    return this.getPurchaseStatus(purchaseId, tenantId);
  }

  getCheckoutContext(headers: Record<string, string | string[] | undefined>): CheckoutContextResult {
    const countryCode = this.resolveCountryCode(headers);
    const isNg = countryCode === 'NG';
    const defaultCurrency: BillingCurrency = isNg ? 'NGN' : 'USD';
    const availableCurrencies: BillingCurrency[] = isNg ? ['NGN', 'USD'] : ['USD'];
    const bachsConfigured = this.bachsService.isConfigured();
    const nombaConfigured = this.nombaService.isConfigured();
    const providers: PaymentProvider[] = [];

    if (nombaConfigured) {
      providers.push(PaymentProvider.NOMBA);
    }
    if (bachsConfigured) {
      providers.push(PaymentProvider.BACHS);
    }
    if (this.polarService.isConfigured()) {
      providers.push(PaymentProvider.POLAR);
    }

    return {
      defaultCurrency,
      availableCurrencies,
      bachsConfigured,
      nombaConfigured,
      providers,
      countryCode,
    };
  }

  async handleNombaWebhook(
    rawBody: string,
    headers: Record<string, string | string[] | undefined>,
  ): Promise<{ received: boolean; duplicate?: boolean }> {
    const verified = verifyNombaWebhook(
      { rawBody, headers },
      this.nombaService.getWebhookSecret(),
    );

    if (!verified) {
      throw new BadRequestException('Invalid Nomba webhook');
    }

    if (verified.outcome === 'ignored') {
      return { received: true };
    }

    const claimed = await this.claimWebhookEvent('nomba', verified.eventId, rawBody);
    if (!claimed) {
      return { received: true, duplicate: true };
    }

    if (verified.setupReference && verified.tenantId && verified.outcome === 'success') {
      await this.completePaymentMethodSetup({
        tenantId: verified.tenantId,
        provider: PaymentProvider.NOMBA,
        currency: (verified.currency as BillingCurrency | undefined) ?? 'NGN',
        setupReference: verified.setupReference,
        externalCustomerId: verified.customerEmail ?? verified.customerId ?? verified.tenantId,
        externalPaymentMethodId: verified.tokenKey,
        cardBrand: verified.cardBrand,
        cardLast4: verified.cardLast4,
      });
    } else if (verified.outcome === 'success' && verified.purchaseId) {
      await this.confirmTokenPurchaseIfPaid(verified.purchaseId, undefined, verified.currency);
    }

    return { received: true };
  }

  async handleBachsWebhook(
    rawBody: string,
    headers: Record<string, string | string[] | undefined>,
  ): Promise<{ received: boolean; duplicate?: boolean }> {
    const verified = verifyBachsWebhook(
      { rawBody, headers },
      this.bachsService.getWebhookSecret(),
    );

    if (!verified) {
      throw new BadRequestException('Invalid Bachs webhook');
    }

    const eventId =
      verified.eventId ??
      createHash('sha256').update(`${verified.eventType}:${rawBody}`).digest('hex');

    const claimed = await this.claimWebhookEvent('bachs', eventId, rawBody);
    if (!claimed) {
      return { received: true, duplicate: true };
    }

    if (verified.outcome === 'ignored') {
      return { received: true };
    }

    if (verified.setupReference && verified.tenantId && verified.outcome === 'success') {
      await this.completePaymentMethodSetup({
        tenantId: verified.tenantId,
        provider: PaymentProvider.BACHS,
        currency: (verified.currency as BillingCurrency | undefined) ?? 'USD',
        setupReference: verified.setupReference,
        externalCustomerId: verified.customerId,
        externalPaymentMethodId: verified.paymentMethodId,
      });
    } else if (verified.outcome === 'success' && verified.purchaseId) {
      await this.confirmTokenPurchaseIfPaid(verified.purchaseId, undefined, verified.currency);
    } else if (verified.outcome === 'failed' && verified.purchaseId) {
      await this.failTokenPurchase(verified.purchaseId);
    }

    return { received: true };
  }

  async handlePolarWebhook(
    rawBody: string,
    headers: Record<string, string | string[] | undefined>,
  ): Promise<{ received: boolean; duplicate?: boolean }> {
    const verified = await this.polarService.handleWebhook(rawBody, headers);

    if (verified.outcome === 'ignored') {
      return { received: true };
    }

    const claimed = await this.claimWebhookEvent('polar', verified.eventId, rawBody);
    if (!claimed) {
      return { received: true, duplicate: true };
    }

    if (verified.outcome === 'success' && verified.setupReference && verified.tenantId) {
      await this.completePaymentMethodSetup({
        tenantId: verified.tenantId,
        provider: PaymentProvider.POLAR,
        currency: (verified.currency as BillingCurrency | undefined) ?? 'USD',
        setupReference: verified.setupReference,
        externalCustomerId: verified.customerId,
        externalPaymentMethodId: verified.paymentMethodId,
        providerReference: verified.providerReference,
      });
    } else if (verified.outcome === 'success' && verified.purchaseId) {
      await this.confirmTokenPurchaseIfPaid(
        verified.purchaseId,
        verified.amount,
        verified.currency,
      );
    } else if (verified.outcome === 'failed' && verified.purchaseId) {
      await this.failTokenPurchase(verified.purchaseId);
    }

    return { received: true };
  }

  async getAutoTopupConfig(tenantId: string) {
    const config = await this.autoTopupConfigRepository.findOne({
      where: { tenantId },
      relations: ['paymentMethod'],
    });

    if (!config) {
      return {
        enabled: false,
        trigger: TopupTrigger.THRESHOLD,
      };
    }

    return {
      enabled: config.enabled,
      trigger: config.trigger,
      thresholdAmount: config.thresholdAmount,
      packageId: config.packageId,
      currency: config.currency,
      paymentMethodId: config.paymentMethodId,
      paymentMethod: config.paymentMethod
        ? {
            id: config.paymentMethod.id,
            provider: config.paymentMethod.provider,
            currency: config.paymentMethod.currency,
            cardBrand: config.paymentMethod.cardBrand,
            cardLast4: config.paymentMethod.cardLast4,
            cardExpMonth: config.paymentMethod.cardExpMonth,
            cardExpYear: config.paymentMethod.cardExpYear,
          }
        : undefined,
      maxMonthlySpend: config.maxMonthlySpend ? Number(config.maxMonthlySpend) : undefined,
      lastTriggered: config.lastTriggered,
    };
  }

  async confirmTokenPurchase(purchaseId: string): Promise<void> {
    try {
      // Atomically claim PENDING → COMPLETED so concurrent webhook/sync cannot double-credit.
      const claim = await this.tokenPurchaseRepository
        .createQueryBuilder()
        .update(TokenPurchase)
        .set({
          status: TokenPurchaseStatus.COMPLETED,
          completedAt: () => 'CURRENT_TIMESTAMP',
        })
        .where('id = :id AND status = :pending', {
          id: purchaseId,
          pending: TokenPurchaseStatus.PENDING,
        })
        .execute();

      if (!claim.affected) {
        const existing = await this.tokenPurchaseRepository.findOne({
          where: { id: purchaseId },
        });
        if (!existing) {
          throw new NotFoundException('Purchase not found');
        }
        return;
      }

      const purchase = await this.tokenPurchaseRepository.findOne({
        where: { id: purchaseId },
      });
      if (!purchase) {
        throw new NotFoundException('Purchase not found');
      }

      try {
        await this.tokenManagementService.addTokens(
          purchase.tenantId,
          Number(purchase.tokenAmount),
          TokenTransactionType.PURCHASE,
          `Token purchase: ${purchase.tokenAmount} tokens`,
          { purchaseId: purchase.id },
        );
      } catch (error) {
        // Release claim so a later sync/webhook retry can credit tokens.
        await this.tokenPurchaseRepository.update(
          { id: purchaseId, status: TokenPurchaseStatus.COMPLETED },
          {
            status: TokenPurchaseStatus.PENDING,
            completedAt: () => 'NULL',
          },
        );
        throw error;
      }

      this.logger.log(`Token purchase completed: ${purchase.id}`);
    } catch (error) {
      this.logger.error('Failed to confirm token purchase:', error);
      throw error;
    }
  }

  async failTokenPurchase(purchaseId: string): Promise<void> {
    const result = await this.tokenPurchaseRepository
      .createQueryBuilder()
      .update(TokenPurchase)
      .set({ status: TokenPurchaseStatus.FAILED })
      .where('id = :id AND status = :pending', {
        id: purchaseId,
        pending: TokenPurchaseStatus.PENDING,
      })
      .execute();

    if (result.affected) {
      this.logger.warn(`Token purchase failed: ${purchaseId}`);
    }
  }

  /** Confirm only when paid amount covers purchase price (when amount is known). */
  private async confirmTokenPurchaseIfPaid(
    purchaseId: string,
    paidAmount?: number,
    currency?: string,
  ): Promise<void> {
    if (paidAmount !== undefined) {
      const purchase = await this.tokenPurchaseRepository.findOne({
        where: { id: purchaseId },
      });
      if (!purchase) {
        throw new NotFoundException('Purchase not found');
      }
      if (!this.isFullyPaid(purchase, paidAmount, currency)) {
        this.logger.warn(
          `Underpayment for purchase ${purchaseId}: paid=${paidAmount} expected=${purchase.totalPrice}`,
        );
        await this.failTokenPurchase(purchaseId);
        return;
      }
    } else {
      // No amount in webhook — re-verify via provider API before crediting.
      const purchase = await this.tokenPurchaseRepository.findOne({
        where: { id: purchaseId },
      });
      if (!purchase) {
        throw new NotFoundException('Purchase not found');
      }
      if (!purchase.transactionReference) {
        this.logger.warn(
          `Skipping confirm for purchase ${purchaseId}: webhook had no amount and purchase has no transaction reference`,
        );
        return;
      }
      const provider = purchase.paymentMetadata?.provider as PaymentProvider | undefined;
      let verified: import('../types/payment-verify-result').PaymentVerifyResult = {
        status: 'pending',
      };
      if (provider === PaymentProvider.BACHS) {
        verified = await this.bachsService.verifyCheckoutSession(purchase.transactionReference);
      } else if (provider === PaymentProvider.NOMBA) {
        verified = await this.nombaService.verifyOrder(purchase.transactionReference);
      } else if (provider === PaymentProvider.POLAR) {
        verified = await this.polarService.verifyCheckout(purchase.transactionReference);
      }
      if (verified.status !== 'success') {
        return;
      }
      if (!this.isFullyPaid(purchase, verified.amount, verified.currency ?? currency)) {
        this.logger.warn(
          `Underpayment for purchase ${purchaseId}: paid=${verified.amount} expected=${purchase.totalPrice}`,
        );
        await this.failTokenPurchase(purchaseId);
        return;
      }
    }

    await this.confirmTokenPurchase(purchaseId);
  }

  private isFullyPaid(
    purchase: TokenPurchase,
    paidAmount?: number,
    currency?: string,
  ): boolean {
    if (paidAmount === undefined || paidAmount === null) {
      // ponytail: amount missing from provider — trust signed success/status verify; add required amount when providers always return it
      return true;
    }
    const expected = Number(purchase.totalPrice);
    if (!Number.isFinite(expected)) return false;
    if (paidAmount + 0.01 < expected) return false;
    const expectedCurrency = purchase.paymentMetadata?.currency as string | undefined;
    if (currency && expectedCurrency && currency.toUpperCase() !== String(expectedCurrency).toUpperCase()) {
      return false;
    }
    return true;
  }

  async configureAutoTopup(dto: AutoTopupConfigDto): Promise<AutoTopupConfig> {
    try {
      if (dto.enabled) {
        if (!dto.thresholdAmount || !dto.packageId || !dto.currency || !dto.paymentMethodId) {
          throw new BadRequestException(
            'Threshold, token pack, currency, and saved card are required for auto top-up',
          );
        }

        const paymentMethod = await this.paymentMethodRepository.findOne({
          where: { id: dto.paymentMethodId, tenantId: dto.tenantId },
        });

        if (!paymentMethod) {
          throw new BadRequestException('Saved payment method not found');
        }

        if (paymentMethod.provider === PaymentProvider.BACHS) {
          throw new BadRequestException(
            'Bachs cards cannot be used for auto top-up. Use Nomba (NGN) or Polar (USD).',
          );
        }

        resolvePackage(dto.packageId, dto.currency);
      }

      let config = await this.autoTopupConfigRepository.findOne({
        where: { tenantId: dto.tenantId },
      });

      const topupPackage =
        dto.packageId && dto.currency ? resolvePackage(dto.packageId, dto.currency) : undefined;

      if (config) {
        Object.assign(config, {
          ...dto,
          trigger: dto.trigger ?? TopupTrigger.THRESHOLD,
          topupAmount: topupPackage?.tokens ?? config.topupAmount,
        });
      } else {
        config = this.autoTopupConfigRepository.create({
          ...dto,
          trigger: dto.trigger ?? TopupTrigger.THRESHOLD,
          topupAmount: topupPackage?.tokens,
        });
      }

      if (
        config.trigger === TopupTrigger.SCHEDULED ||
        config.trigger === TopupTrigger.BOTH
      ) {
        config.nextScheduledRun = this.calculateNextScheduledRun(config);
      }

      return await this.autoTopupConfigRepository.save(config);
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }
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
    // Claim under a row lock so multi-instance crons cannot double-charge.
    // Create the PENDING purchase inside the transaction, then charge outside.
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    let savedPurchase: TokenPurchase | undefined;
    let paymentMethod: TenantPaymentMethod | undefined;
    let pkg: ReturnType<typeof resolvePackage> | undefined;
    let purchaseAmount = 0;
    let lockedConfig: AutoTopupConfig | undefined;

    try {
      lockedConfig = await queryRunner.manager.findOne(AutoTopupConfig, {
        where: { id: config.id },
        lock: { mode: 'pessimistic_write' },
      });

      if (
        !lockedConfig?.enabled ||
        !lockedConfig.paymentMethodId ||
        !lockedConfig.packageId ||
        !lockedConfig.currency
      ) {
        await queryRunner.rollbackTransaction();
        return;
      }

      paymentMethod = await queryRunner.manager.findOne(TenantPaymentMethod, {
        where: { id: lockedConfig.paymentMethodId, tenantId: lockedConfig.tenantId },
      });

      if (!paymentMethod) {
        this.logger.warn(
          `Auto topup skipped for tenant ${lockedConfig.tenantId}: no payment method`,
        );
        await queryRunner.rollbackTransaction();
        return;
      }

      if (paymentMethod.provider === PaymentProvider.BACHS) {
        this.logger.warn(
          `Auto topup skipped for tenant ${lockedConfig.tenantId}: Bachs off-session charging is not supported`,
        );
        await queryRunner.rollbackTransaction();
        return;
      }

      const balance = await this.tokenManagementService.getBalance(lockedConfig.tenantId);
      let shouldTopup = false;
      let topupType = TokenPurchaseType.AUTO_TOPUP;

      if (
        (lockedConfig.trigger === TopupTrigger.THRESHOLD ||
          lockedConfig.trigger === TopupTrigger.BOTH) &&
        lockedConfig.thresholdAmount &&
        balance.availableTokens <= lockedConfig.thresholdAmount
      ) {
        shouldTopup = true;
      }

      if (
        (lockedConfig.trigger === TopupTrigger.SCHEDULED ||
          lockedConfig.trigger === TopupTrigger.BOTH) &&
        lockedConfig.nextScheduledRun &&
        lockedConfig.scheduledAmount &&
        new Date() >= lockedConfig.nextScheduledRun
      ) {
        shouldTopup = true;
        topupType = TokenPurchaseType.SCHEDULED;
        lockedConfig.nextScheduledRun = this.calculateNextScheduledRun(lockedConfig);
        await queryRunner.manager.save(lockedConfig);
      }

      if (!shouldTopup) {
        await queryRunner.rollbackTransaction();
        return;
      }

      const recentPending = await queryRunner.manager.findOne(TokenPurchase, {
        where: {
          tenantId: lockedConfig.tenantId,
          type: In([TokenPurchaseType.AUTO_TOPUP, TokenPurchaseType.SCHEDULED]),
          status: TokenPurchaseStatus.PENDING,
        },
        order: { createdAt: 'DESC' },
      });

      if (recentPending && Date.now() - recentPending.createdAt.getTime() < 30 * 60 * 1000) {
        await queryRunner.rollbackTransaction();
        return;
      }

      pkg = resolvePackage(lockedConfig.packageId, lockedConfig.currency as BillingCurrency);
      purchaseAmount = pkg.price;

      const currentMonth = new Date().getMonth() + 1;
      const currentYear = new Date().getFullYear();

      if (
        lockedConfig.currentMonth !== currentMonth ||
        lockedConfig.currentYear !== currentYear
      ) {
        lockedConfig.currentMonthSpend = 0;
        lockedConfig.currentMonth = currentMonth;
        lockedConfig.currentYear = currentYear;
      }

      if (
        lockedConfig.maxMonthlySpend &&
        Number(lockedConfig.currentMonthSpend) + purchaseAmount >
          Number(lockedConfig.maxMonthlySpend)
      ) {
        this.logger.warn(
          `Auto topup skipped for tenant ${lockedConfig.tenantId}: would exceed monthly spending limit`,
        );
        await queryRunner.rollbackTransaction();
        return;
      }

      const purchase = queryRunner.manager.create(TokenPurchase, {
        tenantId: lockedConfig.tenantId,
        tokenAmount: pkg.tokens,
        totalPrice: pkg.price,
        pricePerToken: pkg.pricePerToken,
        status: TokenPurchaseStatus.PENDING,
        type: topupType,
        paymentMetadata: {
          packageId: pkg.id,
          currency: pkg.currency,
          provider: paymentMethod.provider,
          autoTopupConfigId: lockedConfig.id,
          purpose: 'auto_topup',
        },
      });

      savedPurchase = await queryRunner.manager.save(purchase);
      await queryRunner.commitTransaction();
    } catch (error) {
      await queryRunner.rollbackTransaction();
      this.logger.error(`Failed to process auto topup for tenant ${config.tenantId}:`, error);
      return;
    } finally {
      await queryRunner.release();
    }

    if (!savedPurchase || !paymentMethod || !pkg || !lockedConfig) {
      return;
    }

    try {
      const tenant = await this.tenantRepository.findOne({
        where: { id: lockedConfig.tenantId },
        relations: ['owner'],
      });

      const charge = await this.paymentMethodService.chargeOffSession({
        tenantId: lockedConfig.tenantId,
        purchaseId: savedPurchase.id,
        packageId: pkg.id,
        currency: pkg.currency,
        paymentMethod,
        customerEmail: tenant?.owner?.email ?? paymentMethod.externalCustomerId,
      });

      savedPurchase.paymentIntentId = charge.providerReference ?? '';
      savedPurchase.transactionReference = charge.providerReference ?? '';
      await this.tokenPurchaseRepository.save(savedPurchase);

      if (charge.status === 'failed') {
        await this.failTokenPurchase(savedPurchase.id);
        return;
      }

      if (charge.status !== 'success') {
        // Leave PENDING so the 30-minute guard blocks a second charge; webhook/sync can confirm.
        return;
      }

      await this.confirmTokenPurchase(savedPurchase.id);

      lockedConfig.currentMonthSpend = Number(lockedConfig.currentMonthSpend) + purchaseAmount;
      lockedConfig.lastTriggered = new Date();
      lockedConfig.topupAmount = pkg.tokens;
      await this.autoTopupConfigRepository.save(lockedConfig);

      this.logger.log(
        `Auto topup initiated for tenant ${lockedConfig.tenantId}: ${pkg.tokens} tokens via ${paymentMethod.provider}`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to charge auto topup for tenant ${lockedConfig.tenantId}:`,
        error,
      );
    }
  }

  private async completePaymentMethodSetup(input: {
    tenantId: string;
    provider: PaymentProvider;
    currency: BillingCurrency;
    setupReference: string;
    externalCustomerId?: string;
    externalPaymentMethodId?: string;
    providerReference?: string;
    cardBrand?: string;
    cardLast4?: string;
  }): Promise<void> {
    if (!input.externalCustomerId) {
      if (input.providerReference) {
        const details = await this.polarService.getCheckoutDetails(input.providerReference);
        input.externalCustomerId = details.customerId;
        input.externalPaymentMethodId = details.paymentMethodId ?? input.externalPaymentMethodId;
      }
    }

    if (!input.externalCustomerId) {
      this.logger.warn(`Payment method setup missing customer for tenant ${input.tenantId}`);
      return;
    }

    const saved = await this.paymentMethodService.saveFromProvider({
      tenantId: input.tenantId,
      provider: input.provider,
      currency: input.currency,
      externalCustomerId: input.externalCustomerId,
      externalPaymentMethodId: input.externalPaymentMethodId,
      cardBrand: input.cardBrand,
      cardLast4: input.cardLast4,
    });

    const config = await this.autoTopupConfigRepository.findOne({
      where: { tenantId: input.tenantId, setupReference: input.setupReference },
    });

    if (config) {
      config.paymentMethodId = saved.id;
      await this.autoTopupConfigRepository.save(config);
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

  private resolveCheckoutProvider(currency: BillingCurrency): PaymentProvider {
    if (currency === 'NGN' && this.nombaService.isConfigured()) {
      return PaymentProvider.NOMBA;
    }
    if (this.bachsService.isConfigured(currency)) {
      return PaymentProvider.BACHS;
    }
    if (currency === 'USD' && this.polarService.isConfigured()) {
      return PaymentProvider.POLAR;
    }
    throw new BadRequestException(`No payment provider configured for ${currency}`);
  }

  private async initializeProviderCheckout(input: {
    provider: PaymentProvider;
    purchase: TokenPurchase;
    tenant: Tenant;
    email: string;
    name: string;
    packageId: string;
    currency: BillingCurrency;
    priceMinor: number;
  }): Promise<{
    checkoutUrl: string;
    paymentIntentId: string;
    transactionReference: string;
  }> {
    const metadata = {
      purchaseId: input.purchase.id,
      tenantId: input.tenant.id,
      packageId: input.packageId,
      currency: input.currency,
      tokenAmount: input.purchase.tokenAmount,
    };
    const tenantSlug = input.tenant.subdomain;

    if (input.provider === PaymentProvider.NOMBA) {
      const { successUrl } = this.nombaService.buildCheckoutUrls(
        tenantSlug,
        input.purchase.id,
      );
      const orderReference = buildNotifiPurchaseReference(input.purchase.id);
      const result = await this.nombaService.createCheckoutOrder({
        orderReference,
        amount: input.purchase.totalPrice,
        currency: input.currency,
        customerEmail: input.email,
        callbackUrl: successUrl,
        orderMetaData: {
          purchase_id: input.purchase.id,
          tenant_id: input.tenant.id,
          package_id: input.packageId,
          currency: input.currency,
          token_amount: String(input.purchase.tokenAmount),
        },
        allowedPaymentMethods: ['Card', 'Transfer'],
      });

      return {
        checkoutUrl: result.checkoutUrl,
        paymentIntentId: result.orderReference,
        transactionReference: result.orderReference,
      };
    }

    if (input.provider === PaymentProvider.BACHS) {
      const { successUrl, cancelUrl } = this.bachsService.buildCheckoutUrls(
        tenantSlug,
        input.purchase.id,
      );
      const result = await this.bachsService.initializeCheckout({
        purchaseId: input.purchase.id,
        tenantId: input.tenant.id,
        packageId: input.packageId,
        tokenAmount: input.purchase.tokenAmount,
        currency: input.currency,
        priceMinor: input.priceMinor,
        email: input.email,
        name: input.name,
        successUrl,
        cancelUrl,
      });

      return {
        checkoutUrl: result.checkoutUrl,
        paymentIntentId: result.checkoutId,
        transactionReference: result.checkoutId,
      };
    }

    if (input.provider === PaymentProvider.POLAR) {
      const productId = this.polarService.getProductId();
      if (!productId) {
        throw new Error('polar_product_not_configured');
      }

      const result = await this.polarService.createCheckout({
        productId,
        email: input.email,
        amountMinor: input.priceMinor,
        currency: input.currency,
        successUrl: this.polarService.buildSuccessUrl(tenantSlug, input.purchase.id),
        metadata,
      });

      return {
        checkoutUrl: result.checkoutUrl,
        paymentIntentId: result.checkoutId,
        transactionReference: result.checkoutId,
      };
    }

    throw new Error('unsupported_checkout_provider');
  }

  private isLegacyPurchaseDto(dto: PurchaseTokensDto): dto is LegacyPurchaseTokensDto {
    return 'tokenAmount' in dto && 'paymentProvider' in dto;
  }

  private getTokenPrice(tokenAmount: number): number {
    if (tokenAmount >= 100000) return 0.0005;
    if (tokenAmount >= 50000) return 0.0008;
    if (tokenAmount >= 10000) return 0.001;
    return 0.002;
  }

  private async claimWebhookEvent(
    provider: string,
    eventId: string,
    rawBody: string,
  ): Promise<boolean> {
    const payloadHash = createHash('sha256').update(rawBody).digest('hex');

    try {
      await this.webhookEventRepository.insert({
        provider,
        eventId,
        payloadHash,
      });
      return true;
    } catch (error) {
      if (
        error instanceof QueryFailedError &&
        (error as QueryFailedError & { driverError?: { code?: string } }).driverError?.code ===
          '23505'
      ) {
        return false;
      }
      throw error;
    }
  }

  private resolveCountryCode(
    headers: Record<string, string | string[] | undefined>,
  ): string | undefined {
    const cfCountry = this.getHeaderValue(headers, 'cf-ipcountry');
    if (cfCountry && cfCountry !== 'XX') {
      return cfCountry.toUpperCase();
    }

    const countryHeader = this.getHeaderValue(headers, 'x-country-code');
    if (countryHeader) {
      return countryHeader.toUpperCase();
    }

    const acceptLanguage = this.getHeaderValue(headers, 'accept-language')?.toLowerCase() ?? '';
    if (acceptLanguage.includes('-ng') || acceptLanguage.includes('_ng')) {
      return 'NG';
    }

    return undefined;
  }

  private getHeaderValue(
    headers: Record<string, string | string[] | undefined>,
    name: string,
  ): string | undefined {
    const value = headers[name] ?? headers[name.toLowerCase()];
    if (!value) return undefined;
    return Array.isArray(value) ? value[0] : value;
  }
}