import { Injectable, Logger, BadRequestException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { DataSource, In, Repository } from "typeorm";
import { Cron, CronExpression } from "@nestjs/schedule";
import {
  TokenPurchase,
  TokenPurchaseStatus,
  TokenPurchaseType,
} from "../entities/token-purchase.entity";
import {
  AutoTopupConfig,
  ScheduleFrequency,
  TopupTrigger,
} from "../entities/auto-topup-config.entity";
import { TenantPaymentMethod } from "../entities/tenant-payment-method.entity";
import { Tenant } from "../../tenant/entities/tenant.entity";
import { PaymentProvider } from "../enums/payment-provider.enum";
import { PolarService } from "./polar.service";
import { PaymentMethodService } from "./payment-method.service";
import { TokenManagementService } from "../../token-management/services/token-management.service";
import { resolvePackage, BillingCurrency } from "../constants/token-packages";
import type { AutoTopupConfigDto } from "./billing-dto";
import { TokenPurchaseService } from "./token-purchase.service";

@Injectable()
export class AutoTopupService {
  private readonly logger = new Logger(AutoTopupService.name);

  constructor(
    @InjectRepository(AutoTopupConfig)
    private autoTopupConfigRepository: Repository<AutoTopupConfig>,
    @InjectRepository(TokenPurchase)
    private tokenPurchaseRepository: Repository<TokenPurchase>,
    @InjectRepository(TenantPaymentMethod)
    private paymentMethodRepository: Repository<TenantPaymentMethod>,
    @InjectRepository(Tenant)
    private tenantRepository: Repository<Tenant>,
    private polarService: PolarService,
    private paymentMethodService: PaymentMethodService,
    private tokenManagementService: TokenManagementService,
    private dataSource: DataSource,
    private tokenPurchaseService: TokenPurchaseService,
  ) {}

  async getAutoTopupConfig(tenantId: string) {
    const config = await this.autoTopupConfigRepository.findOne({
      where: { tenantId },
      relations: ["paymentMethod"],
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

  async configureAutoTopup(dto: AutoTopupConfigDto): Promise<AutoTopupConfig> {
    try {
      if (dto.enabled) {
        if (!dto.thresholdAmount || !dto.packageId || !dto.currency || !dto.paymentMethodId) {
          throw new BadRequestException(
            "Threshold, token pack, currency, and saved card are required for auto top-up",
          );
        }

        const paymentMethod = await this.paymentMethodRepository.findOne({
          where: { id: dto.paymentMethodId, tenantId: dto.tenantId },
        });

        if (!paymentMethod) {
          throw new BadRequestException("Saved payment method not found");
        }

        if (paymentMethod.provider === PaymentProvider.BACHS) {
          throw new BadRequestException(
            "Bachs cards cannot be used for auto top-up. Use Nomba (NGN) or Polar (USD).",
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

      if (config.trigger === TopupTrigger.SCHEDULED || config.trigger === TopupTrigger.BOTH) {
        config.nextScheduledRun = this.calculateNextScheduledRun(config);
      }

      return await this.autoTopupConfigRepository.save(config);
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      this.logger.error("Failed to configure auto topup:", error);
      throw new BadRequestException("Failed to configure auto topup");
    }
  }

  @Cron(CronExpression.EVERY_5_MINUTES)
  async processAutoTopups(): Promise<void> {
    try {
      this.logger.log("Processing auto topups...");

      // Get all enabled auto topup configs
      const configs = await this.autoTopupConfigRepository.find({
        where: { enabled: true },
      });

      for (const config of configs) {
        await this.processAutoTopupForTenant(config);
      }

      this.logger.log(`Processed ${configs.length} auto topup configs`);
    } catch (error) {
      this.logger.error("Failed to process auto topups:", error);
    }
  }

  /** Called by webhook handlers when a provider reports a completed setup intent. */
  async completePaymentMethodSetup(input: {
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
      lockedConfig =
        (await queryRunner.manager.findOne(AutoTopupConfig, {
          where: { id: config.id },
          lock: { mode: "pessimistic_write" },
        })) ?? undefined;

      if (
        !lockedConfig?.enabled ||
        !lockedConfig.paymentMethodId ||
        !lockedConfig.packageId ||
        !lockedConfig.currency
      ) {
        await queryRunner.rollbackTransaction();
        return;
      }

      paymentMethod =
        (await queryRunner.manager.findOne(TenantPaymentMethod, {
          where: { id: lockedConfig.paymentMethodId, tenantId: lockedConfig.tenantId },
        })) ?? undefined;

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
        order: { createdAt: "DESC" },
      });

      if (recentPending && Date.now() - recentPending.createdAt.getTime() < 30 * 60 * 1000) {
        await queryRunner.rollbackTransaction();
        return;
      }

      pkg = resolvePackage(lockedConfig.packageId, lockedConfig.currency as BillingCurrency);
      purchaseAmount = pkg.price;

      const currentMonth = new Date().getMonth() + 1;
      const currentYear = new Date().getFullYear();

      if (lockedConfig.currentMonth !== currentMonth || lockedConfig.currentYear !== currentYear) {
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
          purpose: "auto_topup",
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
        relations: ["owner"],
      });

      const charge = await this.paymentMethodService.chargeOffSession({
        tenantId: lockedConfig.tenantId,
        purchaseId: savedPurchase.id,
        packageId: pkg.id,
        currency: pkg.currency,
        paymentMethod,
        customerEmail: tenant?.owner?.email ?? paymentMethod.externalCustomerId,
      });

      savedPurchase.paymentIntentId = charge.providerReference ?? "";
      savedPurchase.transactionReference = charge.providerReference ?? "";
      await this.tokenPurchaseRepository.save(savedPurchase);

      if (charge.status === "failed") {
        await this.tokenPurchaseService.failTokenPurchase(savedPurchase.id);
        return;
      }

      if (charge.status !== "success") {
        // Leave PENDING so the 30-minute guard blocks a second charge; webhook/sync can confirm.
        return;
      }

      await this.tokenPurchaseService.confirmTokenPurchase(savedPurchase.id);

      lockedConfig.currentMonthSpend = Number(lockedConfig.currentMonthSpend) + purchaseAmount;
      lockedConfig.lastTriggered = new Date();
      lockedConfig.topupAmount = pkg.tokens;
      await this.autoTopupConfigRepository.save(lockedConfig);

      this.logger.log(
        `Auto topup initiated for tenant ${lockedConfig.tenantId}: ${pkg.tokens} tokens via ${paymentMethod.provider}`,
      );
    } catch (error) {
      this.logger.error(`Failed to charge auto topup for tenant ${lockedConfig.tenantId}:`, error);
    }
  }

  private calculateNextScheduledRun(config: AutoTopupConfig): Date {
    const now = new Date();
    const [hours, minutes] = (config.scheduleTime || "09:00").split(":").map(Number);

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
}
