import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosInstance } from 'axios';
import * as crypto from 'crypto';

export interface PaystackCustomer {
  id: number;
  customer_code: string;
  email: string;
  first_name?: string;
  last_name?: string;
  phone?: string;
  metadata?: Record<string, any>;
}

export interface PaystackSubscription {
  id: number;
  subscription_code: string;
  customer: PaystackCustomer;
  plan: PaystackPlan;
  status: 'active' | 'cancelled' | 'non-renewing' | 'attention';
  amount: number;
  next_payment_date: string;
  created_at: string;
  metadata?: Record<string, any>;
}

export interface PaystackPlan {
  id: number;
  plan_code: string;
  name: string;
  description?: string;
  amount: number;
  interval: 'daily' | 'weekly' | 'monthly' | 'annually';
  currency: string;
}

export interface PaystackTransaction {
  id: number;
  reference: string;
  amount: number;
  currency: string;
  status: 'success' | 'failed' | 'abandoned' | 'pending';
  customer: PaystackCustomer;
  authorization_url?: string;
  access_code?: string;
  metadata?: Record<string, any>;
}

@Injectable()
export class PaystackService {
  private readonly logger = new Logger(PaystackService.name);
  private readonly client: AxiosInstance;
  private readonly secretKey: string;
  private readonly publicKey: string;
  private readonly baseUrl: string;

  constructor(private configService: ConfigService) {
    this.secretKey = this.configService.get<string>('PAYSTACK_SECRET_KEY') || '';
    this.publicKey = this.configService.get<string>('PAYSTACK_PUBLIC_KEY') || '';
    this.baseUrl = this.configService.get<string>('PAYSTACK_BASE_URL', 'https://api.paystack.co');
    
    this.client = axios.create({
      baseURL: this.baseUrl,
      headers: {
        'Authorization': `Bearer ${this.secretKey}`,
        'Content-Type': 'application/json',
      },
    });

    this.client.interceptors.response.use(
      (response) => response,
      (error) => {
        this.logger.error('Paystack API Error:', error.response?.data || error.message);
        throw error;
      }
    );
  }

  async createCustomer(data: {
    email: string;
    first_name?: string;
    last_name?: string;
    phone?: string;
    metadata?: Record<string, any>;
  }): Promise<PaystackCustomer> {
    try {
      const response = await this.client.post('/customer', data);
      return response.data.data;
    } catch (error) {
      this.logger.error('Failed to create Paystack customer:', error);
      throw new Error('Failed to create customer');
    }
  }

  async getCustomer(customerCode: string): Promise<PaystackCustomer> {
    try {
      const response = await this.client.get(`/customer/${customerCode}`);
      return response.data.data;
    } catch (error) {
      this.logger.error('Failed to get Paystack customer:', error);
      throw new Error('Failed to get customer');
    }
  }

  async updateCustomer(customerCode: string, data: Partial<PaystackCustomer>): Promise<PaystackCustomer> {
    try {
      const response = await this.client.put(`/customer/${customerCode}`, data);
      return response.data.data;
    } catch (error) {
      this.logger.error('Failed to update Paystack customer:', error);
      throw new Error('Failed to update customer');
    }
  }

  async createPlan(data: {
    name: string;
    amount: number;
    interval: 'daily' | 'weekly' | 'monthly' | 'annually';
    description?: string;
    currency?: string;
  }): Promise<PaystackPlan> {
    try {
      const response = await this.client.post('/plan', {
        ...data,
        currency: data.currency || 'NGN',
      });
      return response.data.data;
    } catch (error) {
      this.logger.error('Failed to create Paystack plan:', error);
      throw new Error('Failed to create plan');
    }
  }

  async getPlans(): Promise<PaystackPlan[]> {
    try {
      const response = await this.client.get('/plan');
      return response.data.data;
    } catch (error) {
      this.logger.error('Failed to get Paystack plans:', error);
      throw new Error('Failed to get plans');
    }
  }

  async createSubscription(data: {
    customer: string; // customer code or email
    plan: string; // plan code
    authorization?: string; // authorization code
    start_date?: string;
    metadata?: Record<string, any>;
  }): Promise<PaystackSubscription> {
    try {
      const response = await this.client.post('/subscription', data);
      return response.data.data;
    } catch (error) {
      this.logger.error('Failed to create Paystack subscription:', error);
      throw new Error('Failed to create subscription');
    }
  }

  async getSubscription(subscriptionCode: string): Promise<PaystackSubscription> {
    try {
      const response = await this.client.get(`/subscription/${subscriptionCode}`);
      return response.data.data;
    } catch (error) {
      this.logger.error('Failed to get Paystack subscription:', error);
      throw new Error('Failed to get subscription');
    }
  }

  async disableSubscription(subscriptionCode: string, token: string): Promise<any> {
    try {
      const response = await this.client.post('/subscription/disable', {
        code: subscriptionCode,
        token,
      });
      return response.data;
    } catch (error) {
      this.logger.error('Failed to disable Paystack subscription:', error);
      throw new Error('Failed to disable subscription');
    }
  }

  async enableSubscription(subscriptionCode: string, token: string): Promise<any> {
    try {
      const response = await this.client.post('/subscription/enable', {
        code: subscriptionCode,
        token,
      });
      return response.data;
    } catch (error) {
      this.logger.error('Failed to enable Paystack subscription:', error);
      throw new Error('Failed to enable subscription');
    }
  }

  async initializeTransaction(data: {
    email: string;
    amount: number; // in kobo (smallest currency unit)
    currency?: string;
    reference?: string;
    callback_url?: string;
    metadata?: Record<string, any>;
    channels?: string[];
  }): Promise<PaystackTransaction> {
    try {
      const response = await this.client.post('/transaction/initialize', {
        ...data,
        currency: data.currency || 'NGN',
      });
      return response.data.data;
    } catch (error) {
      this.logger.error('Failed to initialize Paystack transaction:', error);
      throw new Error('Failed to initialize transaction');
    }
  }

  async verifyTransaction(reference: string): Promise<PaystackTransaction> {
    try {
      const response = await this.client.get(`/transaction/verify/${reference}`);
      return response.data.data;
    } catch (error) {
      this.logger.error('Failed to verify Paystack transaction:', error);
      throw new Error('Failed to verify transaction');
    }
  }

  async chargeAuthorization(data: {
    authorization_code: string;
    email: string;
    amount: number;
    currency?: string;
    reference?: string;
    metadata?: Record<string, any>;
  }): Promise<PaystackTransaction> {
    try {
      const response = await this.client.post('/transaction/charge_authorization', {
        ...data,
        currency: data.currency || 'NGN',
      });
      return response.data.data;
    } catch (error) {
      this.logger.error('Failed to charge Paystack authorization:', error);
      throw new Error('Failed to charge authorization');
    }
  }

  async handleWebhook(payload: any, signature: string): Promise<any> {
    try {
      const webhookSecret = this.configService.get<string>('PAYSTACK_WEBHOOK_SECRET') || '';
      
      if (!webhookSecret) {
        throw new Error('Webhook secret not configured');
      }
      
      // Verify webhook signature
      const hash = crypto
        .createHmac('sha512', webhookSecret)
        .update(JSON.stringify(payload))
        .digest('hex');

      if (hash !== signature) {
        throw new Error('Invalid webhook signature');
      }

      this.logger.log('Received Paystack webhook:', payload.event);
      return payload;
    } catch (error) {
      this.logger.error('Failed to handle Paystack webhook:', error);
      throw new Error('Invalid webhook signature');
    }
  }

  // Helper method to convert amount to kobo (Paystack uses kobo for NGN)
  toKobo(amount: number): number {
    return Math.round(amount * 100);
  }

  // Helper method to convert from kobo to naira
  fromKobo(amount: number): number {
    return amount / 100;
  }
}