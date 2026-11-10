import { Injectable, Logger, BadRequestException, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import {
  TokenPurchase,
  TokenPurchaseStatus,
  TokenPurchaseType,
} from "../entities/token-purchase.entity";
import { Tenant } from "../../tenant/entities/tenant.entity";
import { PaymentProvider } from "../enums/payment-provider.enum";
import { BachsService } from "./bachs.service";
import { TokenManagementService } from "../../token-management/services/token-management.service";
import { CheckoutProviderService } from "./checkout-provider.service";
import { TokenTransactionType } from "../entities/token-balance.entity";
import { AutoTopupConfig } from "../entities/auto-topup-config.entity";
import {
  BillingCurrency,
  buildPurchaseReference,
  packagePriceMinor,
  resolvePackage,
} from "../constants/token-packages";
import type {
  CheckoutContextResult,
  PurchaseTokenPackDto,
  TokenPurchaseCheckoutResult,
} from "./billing-dto";

@Injectable()
export class TokenPurchaseService {
  private readonly logger = new Logger(TokenPurchaseService.name);

  constructor(
    @InjectRepository(TokenPurchase)
    private tokenPurchaseRepository: Repository<TokenPurchase>,
    @InjectRepository(Tenant)
    private tenantRepository: Repository<Tenant>,
    @InjectRepository(AutoTopupConfig)
    private autoTopupConfigRepository: Repository<AutoTopupConfig>,
    private bachsService: BachsService,
    private tokenManagementService: TokenManagementService,
    private checkoutProvider: CheckoutProviderService,
  ) {}

  async purchaseTokens(dto: PurchaseTokenPackDto): Promise<TokenPurchaseCheckoutResult> {
    return this.purchaseTokenPack(dto);
  }

  async purchaseTokenPack(dto: PurchaseTokenPackDto): Promise<TokenPurchaseCheckoutResult> {
    let pkg;
    try {
      pkg = resolvePackage(dto.packageId, dto.currency);
    } catch {
      throw new BadRequestException("Invalid token package or currency");
    }

    const tenant = await this.tenantRepository.findOne({
      where: { id: dto.tenantId },
      relations: { owner: true },
    });

    if (!tenant) {
      throw new BadRequestException("Tenant not found");
    }

    const email = dto.customerEmail ?? tenant.owner?.email;
    const name = dto.customerName ?? tenant.owner?.name ?? tenant.name;

    if (!email) {
      throw new BadRequestException("Customer email is required for checkout");
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
    const provider = this.checkoutProvider.resolveCheckoutProvider(pkg.currency);

    try {
      const checkout = await this.checkoutProvider.initializeProviderCheckout({
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
      this.logger.error("Failed to purchase token pack:", error);
      throw new BadRequestException("Failed to initiate token purchase");
    }
  }

  async getPurchaseStatus(purchaseId: string, tenantId: string) {
    const purchase = await this.tokenPurchaseRepository.findOne({
      where: { id: purchaseId, tenantId },
    });

    if (!purchase) {
      throw new NotFoundException("Purchase not found");
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
      throw new NotFoundException("Purchase not found");
    }

    if (purchase.status === TokenPurchaseStatus.COMPLETED) {
      return this.getPurchaseStatus(purchaseId, tenantId);
    }

    const verified = await this.verifyWithProvider(purchase);

    if (verified.status === "success") {
      if (!this.isFullyPaid(purchase, verified.amount, verified.currency)) {
        this.logger.warn(
          `Underpayment for purchase ${purchaseId}: paid=${verified.amount} expected=${purchase.totalPrice}`,
        );
        await this.failTokenPurchase(purchaseId);
      } else {
        await this.confirmTokenPurchase(purchaseId);
      }
    } else if (verified.status === "failed") {
      await this.failTokenPurchase(purchaseId);
    }

    return this.getPurchaseStatus(purchaseId, tenantId);
  }

  getCheckoutContext(
    headers: Record<string, string | string[] | undefined>,
  ): CheckoutContextResult {
    const countryCode = this.resolveCountryCode(headers);
    const isNg = countryCode === "NG";
    const defaultCurrency: BillingCurrency = isNg ? "NGN" : "USD";
    const availableCurrencies: BillingCurrency[] = isNg ? ["NGN", "USD"] : ["USD"];
    const bachsConfigured = this.bachsService.isConfigured();
    const providers: PaymentProvider[] = bachsConfigured ? [PaymentProvider.BACHS] : [];

    return {
      defaultCurrency,
      availableCurrencies,
      bachsConfigured,
      providers,
      countryCode,
    };
  }

  async confirmTokenPurchase(purchaseId: string): Promise<void> {
    try {
      const claim = await this.tokenPurchaseRepository
        .createQueryBuilder()
        .update(TokenPurchase)
        .set({
          status: TokenPurchaseStatus.COMPLETED,
          completedAt: () => "CURRENT_TIMESTAMP",
        })
        .where("id = :id AND status = :pending", {
          id: purchaseId,
          pending: TokenPurchaseStatus.PENDING,
        })
        .execute();

      if (!claim.affected) {
        const existing = await this.tokenPurchaseRepository.findOne({
          where: { id: purchaseId },
        });
        if (!existing) {
          throw new NotFoundException("Purchase not found");
        }
        return;
      }

      const purchase = await this.tokenPurchaseRepository.findOne({
        where: { id: purchaseId },
      });
      if (!purchase) {
        throw new NotFoundException("Purchase not found");
      }

      try {
        await this.tokenManagementService.addTokens(
          purchase.tenantId,
          Number(purchase.tokenAmount),
          TokenTransactionType.PURCHASE,
          `Token purchase: ${purchase.tokenAmount} tokens`,
          { purchaseId: purchase.id },
          purchase.id,
        );
      } catch (error) {
        await this.tokenPurchaseRepository.update(
          { id: purchaseId, status: TokenPurchaseStatus.COMPLETED },
          {
            status: TokenPurchaseStatus.PENDING,
            completedAt: () => "NULL",
          },
        );
        throw error;
      }

      if (
        (purchase.type === TokenPurchaseType.AUTO_TOPUP ||
          purchase.type === TokenPurchaseType.SCHEDULED) &&
        typeof purchase.paymentMetadata?.autoTopupConfigId === "string"
      ) {
        const config = await this.autoTopupConfigRepository.findOne({
          where: { id: purchase.paymentMetadata.autoTopupConfigId, tenantId: purchase.tenantId },
        });

        if (config) {
          const currentMonth = new Date().getMonth() + 1;
          const currentYear = new Date().getFullYear();

          if (config.currentMonth !== currentMonth || config.currentYear !== currentYear) {
            config.currentMonthSpend = 0;
            config.currentMonth = currentMonth;
            config.currentYear = currentYear;
          }

          config.currentMonthSpend = Number(config.currentMonthSpend) + Number(purchase.totalPrice);
          config.lastTriggered = new Date();
          await this.autoTopupConfigRepository.save(config);
        }
      }

      this.logger.log(`Token purchase completed: ${purchase.id}`);
    } catch (error) {
      this.logger.error("Failed to confirm token purchase:", error);
      throw error;
    }
  }

  async failTokenPurchase(purchaseId: string): Promise<void> {
    const result = await this.tokenPurchaseRepository
      .createQueryBuilder()
      .update(TokenPurchase)
      .set({ status: TokenPurchaseStatus.FAILED })
      .where("id = :id AND status = :pending", {
        id: purchaseId,
        pending: TokenPurchaseStatus.PENDING,
      })
      .execute();

    if (result.affected) {
      this.logger.warn(`Token purchase failed: ${purchaseId}`);
    }
  }

  async confirmTokenPurchaseIfPaid(
    purchaseId: string,
    paidAmount?: number,
    currency?: string,
  ): Promise<void> {
    if (paidAmount !== undefined) {
      const purchase = await this.tokenPurchaseRepository.findOne({
        where: { id: purchaseId },
      });
      if (!purchase) {
        throw new NotFoundException("Purchase not found");
      }
      if (!this.isFullyPaid(purchase, paidAmount, currency)) {
        this.logger.warn(
          `Underpayment for purchase ${purchaseId}: paid=${paidAmount} expected=${purchase.totalPrice}`,
        );
        await this.failTokenPurchase(purchaseId);
        return;
      }
    } else {
      const purchase = await this.tokenPurchaseRepository.findOne({
        where: { id: purchaseId },
      });
      if (!purchase) {
        throw new NotFoundException("Purchase not found");
      }
      if (!purchase.transactionReference) {
        this.logger.warn(
          `Skipping confirm for purchase ${purchaseId}: webhook had no amount and purchase has no transaction reference`,
        );
        return;
      }
      const verified = await this.verifyWithProvider(purchase);
      if (verified.status !== "success") {
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

  async verifyWithProvider(
    purchase: TokenPurchase,
  ): Promise<import("../types/payment-verify-result").PaymentVerifyResult> {
    const provider = purchase.paymentMetadata?.provider as PaymentProvider | undefined;

    if (provider === PaymentProvider.BACHS && purchase.transactionReference) {
      return this.bachsService.verifyCheckoutSession(purchase.transactionReference);
    }
    return { status: "pending" };
  }

  isFullyPaid(purchase: TokenPurchase, paidAmount?: number, currency?: string): boolean {
    if (paidAmount === undefined || paidAmount === null) {
      return true;
    }
    const expected = Number(purchase.totalPrice);
    if (!Number.isFinite(expected)) return false;
    if (paidAmount + 0.01 < expected) return false;
    const expectedCurrency = purchase.paymentMetadata?.currency as string | undefined;
    if (
      currency &&
      expectedCurrency &&
      currency.toUpperCase() !== String(expectedCurrency).toUpperCase()
    ) {
      return false;
    }
    return true;
  }

  private getTokenPrice(tokenAmount: number): number {
    if (tokenAmount >= 100000) return 0.0005;
    if (tokenAmount >= 50000) return 0.0008;
    if (tokenAmount >= 10000) return 0.001;
    return 0.002;
  }

  private resolveCountryCode(
    headers: Record<string, string | string[] | undefined>,
  ): string | undefined {
    const cfCountry = this.getHeaderValue(headers, "cf-ipcountry");
    if (cfCountry && cfCountry !== "XX") {
      return cfCountry.toUpperCase();
    }

    const countryHeader = this.getHeaderValue(headers, "x-country-code");
    if (countryHeader) {
      return countryHeader.toUpperCase();
    }

    const acceptLanguage = this.getHeaderValue(headers, "accept-language")?.toLowerCase() ?? "";
    if (acceptLanguage.includes("-ng") || acceptLanguage.includes("_ng")) {
      return "NG";
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
