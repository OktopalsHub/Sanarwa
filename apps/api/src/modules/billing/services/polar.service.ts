import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosInstance } from 'axios';

export interface PolarCustomer {
  id: string;
  email: string;
  name?: string;
  metadata?: Record<string, any>;
}

export interface PolarSubscription {
  id: string;
  customer_id: string;
  product_id: string;
  price_id: string;
  status: 'active' | 'canceled' | 'incomplete' | 'past_due' | 'trialing' | 'unpaid';
  current_period_start: string;
  current_period_end: string;
  trial_end?: string;
  cancel_at_period_end: boolean;
  canceled_at?: string;
  metadata?: Record<string, any>;
}

export interface PolarProduct {
  id: string;
  name: string;
  description?: string;
  prices: PolarPrice[];
}

export interface PolarPrice {
  id: string;
  product_id: string;
  amount: number;
  currency: string;
  recurring?: {
    interval: 'month' | 'year';
    interval_count: number;
  };
}

export interface PolarPaymentIntent {
  id: string;
  amount: number;
  currency: string;
  status: 'requires_payment_method' | 'requires_confirmation' | 'requires_action' | 'processing' | 'succeeded' | 'canceled';
  client_secret: string;
  metadata?: Record<string, any>;
}

@Injectable()
export class PolarService {
  private readonly logger = new Logger(PolarService.name);
  private readonly client: AxiosInstance;
  private readonly apiKey: string;
  private readonly baseUrl: string;

  constructor(private configService: ConfigService) {
    this.apiKey = this.configService.get<string>('POLAR_API_KEY') || '';
    this.baseUrl = this.configService.get<string>('POLAR_BASE_URL', 'https://api.polar.sh');
    
    this.client = axios.create({
      baseURL: this.baseUrl,
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
    });

    this.client.interceptors.response.use(
      (response) => response,
      (error) => {
        this.logger.error('Polar API Error:', error.response?.data || error.message);
        throw error;
      }
    );
  }

  async createCustomer(data: {
    email: string;
    name?: string;
    metadata?: Record<string, any>;
  }): Promise<PolarCustomer> {
    try {
      const response = await this.client.post('/customers', data);
      return response.data;
    } catch (error) {
      this.logger.error('Failed to create Polar customer:', error);
      throw new Error('Failed to create customer');
    }
  }

  async getCustomer(customerId: string): Promise<PolarCustomer> {
    try {
      const response = await this.client.get(`/customers/${customerId}`);
      return response.data;
    } catch (error) {
      this.logger.error('Failed to get Polar customer:', error);
      throw new Error('Failed to get customer');
    }
  }

  async updateCustomer(customerId: string, data: Partial<PolarCustomer>): Promise<PolarCustomer> {
    try {
      const response = await this.client.patch(`/customers/${customerId}`, data);
      return response.data;
    } catch (error) {
      this.logger.error('Failed to update Polar customer:', error);
      throw new Error('Failed to update customer');
    }
  }

  async createSubscription(data: {
    customer_id: string;
    price_id: string;
    trial_period_days?: number;
    metadata?: Record<string, any>;
  }): Promise<PolarSubscription> {
    try {
      const response = await this.client.post('/subscriptions', data);
      return response.data;
    } catch (error) {
      this.logger.error('Failed to create Polar subscription:', error);
      throw new Error('Failed to create subscription');
    }
  }

  async getSubscription(subscriptionId: string): Promise<PolarSubscription> {
    try {
      const response = await this.client.get(`/subscriptions/${subscriptionId}`);
      return response.data;
    } catch (error) {
      this.logger.error('Failed to get Polar subscription:', error);
      throw new Error('Failed to get subscription');
    }
  }

  async updateSubscription(subscriptionId: string, data: Partial<PolarSubscription>): Promise<PolarSubscription> {
    try {
      const response = await this.client.patch(`/subscriptions/${subscriptionId}`, data);
      return response.data;
    } catch (error) {
      this.logger.error('Failed to update Polar subscription:', error);
      throw new Error('Failed to update subscription');
    }
  }

  async cancelSubscription(subscriptionId: string, cancelAtPeriodEnd = true): Promise<PolarSubscription> {
    try {
      const response = await this.client.delete(`/subscriptions/${subscriptionId}`, {
        data: { cancel_at_period_end: cancelAtPeriodEnd }
      });
      return response.data;
    } catch (error) {
      this.logger.error('Failed to cancel Polar subscription:', error);
      throw new Error('Failed to cancel subscription');
    }
  }

  async getProducts(): Promise<PolarProduct[]> {
    try {
      const response = await this.client.get('/products');
      return response.data.data || response.data;
    } catch (error) {
      this.logger.error('Failed to get Polar products:', error);
      throw new Error('Failed to get products');
    }
  }

  async createPaymentIntent(data: {
    amount: number;
    currency: string;
    customer_id?: string;
    metadata?: Record<string, any>;
  }): Promise<PolarPaymentIntent> {
    try {
      const response = await this.client.post('/payment_intents', data);
      return response.data;
    } catch (error) {
      this.logger.error('Failed to create Polar payment intent:', error);
      throw new Error('Failed to create payment intent');
    }
  }

  async confirmPaymentIntent(paymentIntentId: string): Promise<PolarPaymentIntent> {
    try {
      const response = await this.client.post(`/payment_intents/${paymentIntentId}/confirm`);
      return response.data;
    } catch (error) {
      this.logger.error('Failed to confirm Polar payment intent:', error);
      throw new Error('Failed to confirm payment intent');
    }
  }

  async getPaymentIntent(paymentIntentId: string): Promise<PolarPaymentIntent> {
    try {
      const response = await this.client.get(`/payment_intents/${paymentIntentId}`);
      return response.data;
    } catch (error) {
      this.logger.error('Failed to get Polar payment intent:', error);
      throw new Error('Failed to get payment intent');
    }
  }

  async createCheckout(data: {
    productId: string;
    email: string;
    amountMinor: number;
    currency: string;
    successUrl: string;
    metadata?: Record<string, any>;
  }): Promise<{ checkoutUrl: string; checkoutId: string }> {
    if (!this.apiKey) {
      throw new Error('polar_not_configured');
    }

    const requestBody: Record<string, unknown> = {
      products: [data.productId],
      customer_email: data.email,
      success_url: data.successUrl,
      metadata: data.metadata,
      prices: {
        [data.productId]: [
          {
            amount_type: 'fixed',
            price_amount: data.amountMinor,
            price_currency: data.currency.toLowerCase(),
          },
        ],
      },
    };

    try {
      const response = await this.client.post('/checkouts/', requestBody);
      const payload = response.data as { url?: string; id?: string };

      if (!payload.url || !payload.id) {
        throw new Error('polar_checkout_failed');
      }

      return { checkoutUrl: payload.url, checkoutId: payload.id };
    } catch (error) {
      this.logger.error('Failed to create Polar checkout:', error);
      throw new Error('Failed to create Polar checkout');
    }
  }

  async verifyCheckout(checkoutId: string): Promise<'success' | 'failed' | 'pending'> {
    if (!this.apiKey) {
      throw new Error('polar_not_configured');
    }

    try {
      const response = await this.client.get(`/checkouts/${encodeURIComponent(checkoutId)}`);
      const status = (response.data?.status as string | undefined)?.toLowerCase();

      if (status === 'succeeded' || status === 'paid') {
        return 'success';
      }
      if (status === 'failed' || status === 'expired' || status === 'canceled') {
        return 'failed';
      }
      return 'pending';
    } catch (error) {
      this.logger.error('Failed to verify Polar checkout:', error);
      throw new Error('Failed to verify Polar checkout');
    }
  }

  isConfigured(): boolean {
    return Boolean(this.apiKey && this.configService.get<string>('POLAR_TOKEN_PRODUCT_ID'));
  }

  getTokenProductId(): string | undefined {
    return this.configService.get<string>('POLAR_TOKEN_PRODUCT_ID')?.trim() || undefined;
  }

  getWebOrigin(): string {
    return (
      this.configService.get<string>('WEB_ORIGIN') ||
      this.configService.get<string>('FRONTEND_URL') ||
      'http://localhost:3001'
    ).replace(/\/$/, '');
  }

  buildSuccessUrl(tenantSlug: string, purchaseId?: string): string {
    const purchaseQuery = purchaseId ? `&purchase_id=${encodeURIComponent(purchaseId)}` : '';
    return `${this.getWebOrigin()}/${tenantSlug}/billing?checkout=success${purchaseQuery}`;
  }

  buildPaymentMethodSetupSuccessUrl(tenantSlug: string, setupReference: string): string {
    return `${this.getWebOrigin()}/${tenantSlug}/billing?setup=success&setup_reference=${encodeURIComponent(setupReference)}`;
  }

  getCardVaultProductId(): string | undefined {
    return (
      this.configService.get<string>('POLAR_CARD_VAULT_PRODUCT_ID')?.trim() ||
      this.configService.get<string>('POLAR_TOKEN_PRODUCT_ID')?.trim() ||
      undefined
    );
  }

  isCardVaultConfigured(): boolean {
    return Boolean(this.apiKey && this.getCardVaultProductId());
  }

  async createPaymentMethodSetupCheckout(data: {
    productId: string;
    email: string;
    successUrl: string;
    metadata?: Record<string, unknown>;
    externalCustomerId?: string;
  }): Promise<{ checkoutUrl: string; checkoutId: string }> {
    if (!this.apiKey) {
      throw new Error('polar_not_configured');
    }

    const requestBody: Record<string, unknown> = {
      products: [data.productId],
      customer_email: data.email,
      success_url: data.successUrl,
      metadata: data.metadata,
    };

    if (data.externalCustomerId) {
      requestBody.external_customer_id = data.externalCustomerId;
    }

    try {
      const response = await this.client.post('/checkouts/', requestBody);
      const payload = response.data as { url?: string; id?: string };

      if (!payload.url || !payload.id) {
        throw new Error('polar_checkout_failed');
      }

      return { checkoutUrl: payload.url, checkoutId: payload.id };
    } catch (error) {
      this.logger.error('Failed to create Polar payment method setup checkout:', error);
      throw new Error('Failed to create Polar payment method setup checkout');
    }
  }

  async chargeOffSession(data: {
    customerId: string;
    productId: string;
    amountMinor: number;
    currency: string;
    paymentMethodId?: string;
    metadata?: Record<string, unknown>;
  }): Promise<{ status: 'success' | 'pending' | 'failed'; providerReference?: string; errorCode?: string }> {
    if (!this.apiKey) {
      throw new Error('polar_not_configured');
    }

    try {
      const createResponse = await this.client.post('/orders/', {
        customer_id: data.customerId,
        product_id: data.productId,
        amount: data.amountMinor,
        currency: data.currency.toLowerCase(),
        metadata: data.metadata,
      });

      const orderId = createResponse.data?.id as string | undefined;
      if (!orderId) {
        return { status: 'failed', errorCode: 'polar_order_create_failed' };
      }

      const finalizeBody: Record<string, unknown> = {};
      if (data.paymentMethodId) {
        finalizeBody.payment_method_id = data.paymentMethodId;
      }

      const finalizeResponse = await this.client.post(
        `/orders/${encodeURIComponent(orderId)}/finalize`,
        finalizeBody,
      );

      const status = (finalizeResponse.data?.status as string | undefined)?.toLowerCase();
      if (status === 'paid' || status === 'succeeded') {
        return { status: 'success', providerReference: orderId };
      }

      return { status: 'pending', providerReference: orderId };
    } catch (error: unknown) {
      const axiosError = error as { response?: { status?: number; data?: { detail?: string } } };
      const statusCode = axiosError.response?.status;
      this.logger.warn(
        `Polar off-session charge failed (${statusCode ?? 'unknown'}): ${
          axiosError.response?.data?.detail ?? 'charge_failed'
        }`,
      );
      return {
        status: 'failed',
        errorCode: statusCode === 402 ? 'payment_declined' : 'polar_off_session_failed',
      };
    }
  }

  async getCheckoutDetails(checkoutId: string): Promise<{
    customerId?: string;
    paymentMethodId?: string;
    status?: string;
  }> {
    if (!this.apiKey) {
      throw new Error('polar_not_configured');
    }

    try {
      const response = await this.client.get(`/checkouts/${encodeURIComponent(checkoutId)}`);
      const payload = response.data as {
        status?: string;
        customer_id?: string;
        customer?: { id?: string };
        payment_method_id?: string;
      };

      return {
        status: payload.status,
        customerId: payload.customer_id ?? payload.customer?.id,
        paymentMethodId: payload.payment_method_id,
      };
    } catch (error) {
      this.logger.error('Failed to get Polar checkout details:', error);
      return {};
    }
  }

  async handleWebhook(rawBody: string, headers: Record<string, string | string[] | undefined>) {
    const webhookSecret = this.configService.get<string>('POLAR_WEBHOOK_SECRET');
    if (!webhookSecret) {
      throw new Error('Polar webhook secret not configured');
    }

    const { verifyPolarWebhook } = await import('../utils/polar-webhook.util');
    const verified = verifyPolarWebhook({ rawBody, headers }, webhookSecret);
    if (!verified) {
      throw new Error('Invalid Polar webhook signature');
    }

    this.logger.log(`Received Polar webhook: ${verified.eventType}`);
    return verified;
  }
}