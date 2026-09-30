import type { BillingCurrency } from "../constants/token-packages";
import type { PaymentProvider } from "../enums/payment-provider.enum";
import type { TokenPurchaseStatus, TokenPurchaseType } from "../entities/token-purchase.entity";
import type { ScheduleFrequency, TopupTrigger } from "../entities/auto-topup-config.entity";

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
