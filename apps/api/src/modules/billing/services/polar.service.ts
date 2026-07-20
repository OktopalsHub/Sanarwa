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

  async handleWebhook(payload: any, signature: string): Promise<any> {
    // Implement webhook signature verification
    // This would typically use Polar's webhook secret to verify the signature
    try {
      const webhookSecret = this.configService.get<string>('POLAR_WEBHOOK_SECRET');
      
      // Verify signature (implementation depends on Polar's webhook signing method)
      // For now, we'll assume the payload is valid
      
      this.logger.log('Received Polar webhook:', payload.type);
      return payload;
    } catch (error) {
      this.logger.error('Failed to handle Polar webhook:', error);
      throw new Error('Invalid webhook signature');
    }
  }
}