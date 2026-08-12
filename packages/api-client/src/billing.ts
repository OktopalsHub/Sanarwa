import { ApiClient, createApiClient } from './client';

export interface TokenBalance {
  balance: number;
  reserved?: number;
  currency?: string;
}

export interface TokenTransaction {
  id: string;
  type: string;
  amount: number;
  balanceAfter: number;
  description?: string;
  reference?: string;
  createdAt: string;
}

export interface TokenUsageStats {
  totalUsed: number;
  byChannel?: Record<string, number>;
  period?: { start: string; end: string };
}

export interface TokenPackage {
  id: string;
  tokens: number;
  price: number;
  pricePerToken: number;
  savings: number;
  currency: string;
  kind?: string;
}

export interface TokenPackagesResponse {
  packages: TokenPackage[];
  shelves: {
    managed: Record<string, TokenPackage[]>;
    byo: Record<string, TokenPackage[]>;
  };
  welcomeSignupTokens: number;
}

export interface CheckoutContextResponse {
  defaultCurrency: 'USD' | 'NGN';
  availableCurrencies: Array<'USD' | 'NGN'>;
  bachsConfigured: boolean;
  nombaConfigured: boolean;
  providers: string[];
  countryCode?: string;
}

export interface TokenPurchaseCheckoutResponse {
  purchaseId: string;
  checkoutUrl: string;
  provider: string;
  status: string;
}

export interface TokenPurchaseStatusResponse {
  purchaseId: string;
  status: string;
  tokenAmount: number;
  totalPrice: number;
  currency?: 'USD' | 'NGN';
  provider?: string;
  completedAt?: string;
}

export interface SavedPaymentMethod {
  id: string;
  provider: string;
  currency: 'USD' | 'NGN';
  cardBrand?: string;
  cardLast4?: string;
  cardExpMonth?: number;
  cardExpYear?: number;
  isDefault: boolean;
  status: string;
}

export interface PaymentMethodSetupResponse {
  setupReference: string;
  checkoutUrl: string;
  provider: string;
}

export interface AutoTopupConfigResponse {
  enabled: boolean;
  trigger?: string;
  thresholdAmount?: number;
  packageId?: string;
  currency?: 'USD' | 'NGN';
  paymentMethodId?: string;
  paymentMethod?: Pick<
    SavedPaymentMethod,
    'id' | 'provider' | 'currency' | 'cardBrand' | 'cardLast4' | 'cardExpMonth' | 'cardExpYear'
  >;
  maxMonthlySpend?: number;
  lastTriggered?: string;
}

class BillingApiClient {
  private apiClient: ApiClient;

  constructor(apiClient?: ApiClient) {
    this.apiClient = apiClient || createApiClient();
  }

  async getTokenBalance(): Promise<{
    totalTokens: number;
    usedTokens: number;
    availableTokens: number;
    reservedTokens?: number;
  }> {
    return this.apiClient.get('/billing/tokens/balance');
  }

  async getTransactions(params?: {
    limit?: number;
    offset?: number;
    type?: string;
  }): Promise<{ data: TokenTransaction[]; total?: number }> {
    const result = await this.apiClient.get<TokenTransaction[] | { data: TokenTransaction[]; total?: number }>(
      '/billing/tokens/transactions',
      params,
    );
    if (Array.isArray(result)) {
      return { data: result };
    }
    return result;
  }

  async getUsageStats(startDate: string, endDate: string): Promise<TokenUsageStats> {
    return this.apiClient.get<TokenUsageStats>('/billing/tokens/usage-stats', {
      startDate,
      endDate,
    });
  }

  async getTokenPackages(): Promise<TokenPackagesResponse> {
    return this.apiClient.get<TokenPackagesResponse>('/billing/token-packages', {}, { tenantScoped: false });
  }

  async getCheckoutContext(): Promise<CheckoutContextResponse> {
    return this.apiClient.get<CheckoutContextResponse>('/billing/checkout/context', {}, { tenantScoped: false });
  }

  async purchaseTokens(data: {
    packageId: string;
    currency: 'USD' | 'NGN';
    customerEmail?: string;
    customerName?: string;
  }): Promise<TokenPurchaseCheckoutResponse> {
    return this.apiClient.post('/billing/tokens/purchase', data);
  }

  async getPurchaseStatus(purchaseId: string): Promise<TokenPurchaseStatusResponse> {
    return this.apiClient.get(`/billing/tokens/purchase/${purchaseId}`);
  }

  async syncPurchase(purchaseId: string): Promise<TokenPurchaseStatusResponse> {
    return this.apiClient.post(`/billing/tokens/purchase/${purchaseId}/sync`);
  }

  async startPaymentMethodSetup(currency: 'USD' | 'NGN'): Promise<PaymentMethodSetupResponse> {
    return this.apiClient.post('/billing/payment-methods/setup', { currency });
  }

  async listPaymentMethods(): Promise<{ data: SavedPaymentMethod[] }> {
    return this.apiClient.get('/billing/payment-methods');
  }

  async revokePaymentMethod(paymentMethodId: string): Promise<{ message: string }> {
    return this.apiClient.delete(`/billing/payment-methods/${paymentMethodId}`);
  }

  async configureAutoTopup(data: {
    enabled: boolean;
    thresholdAmount?: number;
    packageId?: string;
    currency?: 'USD' | 'NGN';
    paymentMethodId?: string;
    maxMonthlySpend?: number;
  }): Promise<AutoTopupConfigResponse> {
    return this.apiClient.post('/billing/auto-topup', data);
  }

  async getAutoTopupConfig(): Promise<AutoTopupConfigResponse> {
    return this.apiClient.get('/billing/auto-topup');
  }
}

export const billingApi = new BillingApiClient();
export { BillingApiClient };
