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

  async purchaseTokens(data: {
    packageId: string;
    currency: string;
    paymentMethod?: string;
  }): Promise<{ purchaseId: string; checkoutUrl?: string }> {
    return this.apiClient.post('/billing/tokens/purchase', data);
  }

  async configureAutoTopup(data: {
    enabled: boolean;
    threshold?: number;
    amount?: number;
    packageId?: string;
  }): Promise<unknown> {
    return this.apiClient.post('/billing/auto-topup', data);
  }

  async getAutoTopupConfig(): Promise<{
    enabled: boolean;
    threshold?: number;
    amount?: number;
  }> {
    return this.apiClient.get('/billing/auto-topup');
  }
}

export const billingApi = new BillingApiClient();
export { BillingApiClient };
