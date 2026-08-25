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
import { PolarService } from "./polar.service";
import { BachsService } from "./bachs.service";
import { NombaService } from "./nomba.service";
import { TokenManagementService } from "../../token-management/services/token-management.service";
import { CheckoutProviderService } from "./checkout-provider.service";
import { TokenTransactionType } from "../entities/token-balance.entity";
import {
  BillingCurrency,
  buildNotifiPurchaseReference,
  packagePriceMinor,
  resolvePackage,
} from "../constants/token-packages";
import type {
  CheckoutContextResult,
  LegacyPurchaseTokensDto,
  PurchaseTokenPackDto,
  PurchaseTokensDto,
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
    private polarService: PolarService,
    private bachsService: BachsService,
    private nombaService: NombaService,
    private tokenManagementService: TokenManagementService,
    private checkoutProvider: CheckoutProviderService,
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
      throw new BadRequestException("Invalid token package or currency");
    }

    const tenant = await this.tenantRepository.findOne({
      where: { id: dto.tenantId },
      relations: ["owner"],
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

  async initiateLegacyTokenPurchase(dto: LegacyPurchaseTokensDto): Promise<TokenPurchase> {
    try {
      const pricePerToken = this.getTokenPrice(dto.tokenAmount);
      const totalPrice = dto.tokenAmount * pricePerToken;

      let paymentIntentId = "";
      let transactionReference = "";

      if (dto.paymentProvider === PaymentProvider.POLAR) {
        const paymentIntent = await this.polarService.createPaymentIntent({
          amount: Math.round(totalPrice * 100),
          currency: "USD",
          metadata: {
            tenantId: dto.tenantId,
            tokenAmount: dto.tokenAmount,
            type: dto.type || TokenPurchaseType.MANUAL,
          },
        });
        paymentIntentId = paymentIntent.id;
        transactionReference = paymentIntent.id;
      } else {
        throw new BadRequestException("Legacy token purchase requires Polar");
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
      this.logger.error("Failed to purchase tokens (legacy):", error);
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

  async confirmTokenPurchase(purchaseId: string): Promise<void> {
    try {
      // Atomically claim PENDING → COMPLETED so concurrent webhook/sync cannot double-credit.
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
        );
      } catch (error) {
        // Release claim so a later sync/webhook retry can credit tokens.
        await this.tokenPurchaseRepository.update(
          { id: purchaseId, status: TokenPurchaseStatus.COMPLETED },
          {
            status: TokenPurchaseStatus.PENDING,
            completedAt: () => "NULL",
          },
        );
        throw error;
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

  /** Confirm only when paid amount covers purchase price (when amount is known). */
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
      // No amount in webhook — re-verify via provider API before crediting.
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

  /** Re-verify a purchase's payment status with its provider. */
  async verifyWithProvider(
    purchase: TokenPurchase,
  ): Promise<import("../types/payment-verify-result").PaymentVerifyResult> {
    const provider = purchase.paymentMetadata?.provider as PaymentProvider | undefined;

    if (provider === PaymentProvider.BACHS && purchase.transactionReference) {
      return this.bachsService.verifyCheckoutSession(purchase.transactionReference);
    }
    if (provider === PaymentProvider.NOMBA && purchase.transactionReference) {
      return this.nombaService.verifyOrder(purchase.transactionReference);
    }
    if (provider === PaymentProvider.POLAR && purchase.transactionReference) {
      return this.polarService.verifyCheckout(purchase.transactionReference);
    }
    if (purchase.paymentIntentId?.startsWith("pi_")) {
      const paymentIntent = await this.polarService.getPaymentIntent(purchase.paymentIntentId);
      return {
        status:
          paymentIntent.status === "succeeded"
            ? "success"
            : paymentIntent.status === "canceled"
              ? "failed"
              : "pending",
        amount: typeof paymentIntent.amount === "number" ? paymentIntent.amount / 100 : undefined,
        currency: paymentIntent.currency,
      };
    }
    return { status: "pending" };
  }

  isFullyPaid(purchase: TokenPurchase, paidAmount?: number, currency?: string): boolean {
    if (paidAmount === undefined || paidAmount === null) {
      // ponytail: amount missing from provider — trust signed success/status verify; add required amount when providers always return it
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

  private isLegacyPurchaseDto(dto: PurchaseTokensDto): dto is LegacyPurchaseTokensDto {
    return "tokenAmount" in dto && "paymentProvider" in dto;
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
