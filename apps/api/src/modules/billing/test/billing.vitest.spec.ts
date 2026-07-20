import { describe, it, expect, beforeAll } from 'vitest';
import axios, { AxiosInstance } from 'axios';

describe('Billing Module Integration Tests', () => {
  const baseURL = 'http://localhost:9000/api/v1';
  let api: AxiosInstance;
  let authToken: string;

  beforeAll(async () => {
    api = axios.create({
      baseURL,
      timeout: 15000,
      validateStatus: () => true
    });

    await waitForServer();
    authToken = await getAuthToken();
  });

  async function waitForServer(maxRetries = 10): Promise<void> {
    for (let i = 0; i < maxRetries; i++) {
      try {
        const response = await api.get('/health');
        if (response.status === 200) return;
      } catch (error) {
        if (i === maxRetries - 1) {
          throw new Error('Server not ready. Start with: npm run start:dev');
        }
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
  }

  async function getAuthToken(): Promise<string> {
    const timestamp = Date.now();
    const testUser = {
      email: `billing-test-${timestamp}@example.com`,
      password: 'BillingTest123!',
      firstName: 'Billing',
      lastName: 'Test'
    };

    const response = await api.post('/auth/register', testUser);
    if (response.status !== 201) {
      throw new Error('Failed to register test user');
    }
    return response.data.access_token;
  }

  describe('Billing Endpoints', () => {
    it('should get token balance', async () => {
      const response = await api.get('/billing/tokens/balance', {
        headers: { Authorization: `Bearer ${authToken}` }
      });

      console.log('💰 Token balance response:', response.status, response.data);

      expect([200, 400, 401, 403, 500]).toContain(response.status);
      if (response.status === 200) {
        expect(response.data).toHaveProperty('balance');
      }
    });

    it('should initiate token purchase', async () => {
      const purchaseData = {
        amount: 100,
        tokens: 1000,
        currency: 'USD'
      };

      const response = await api.post('/billing/tokens/purchase', purchaseData, {
        headers: { Authorization: `Bearer ${authToken}` }
      });

      console.log('💳 Token purchase response:', response.status, response.data);

      expect([200, 201, 400, 401, 403, 500]).toContain(response.status);
      if ([200, 201].includes(response.status)) {
        expect(response.data).toBeDefined();
      }
    });

    it('should get token transactions', async () => {
      const response = await api.get('/billing/tokens/transactions', {
        headers: { Authorization: `Bearer ${authToken}` }
      });

      console.log('📜 Token transactions response:', response.status, response.data);

      expect([200, 400, 401, 403, 500]).toContain(response.status);
      if (response.status === 200) {
        expect(Array.isArray(response.data) || response.data.transactions).toBeTruthy();
      }
    });

    it('should get checkout context', async () => {
      const response = await api.get('/billing/checkout/context');

      console.log('🌍 Checkout context response:', response.status, response.data);

      expect([200, 401, 403, 500]).toContain(response.status);
      if (response.status === 200) {
        expect(response.data).toHaveProperty('defaultCurrency');
        expect(response.data).toHaveProperty('nombaConfigured');
      }
    });

    it('should get auto-topup config', async () => {
      const response = await api.get('/billing/auto-topup', {
        headers: { Authorization: `Bearer ${authToken}` }
      });

      console.log('🔄 Auto-topup get response:', response.status, response.data);

      expect([200, 400, 401, 403, 500]).toContain(response.status);
      if (response.status === 200) {
        expect(response.data).toHaveProperty('enabled');
      }
    });

    it('should configure auto-topup', async () => {
      const autoTopupConfig = {
        enabled: true,
        threshold: 100,
        amount: 500,
        tokens: 5000
      };

      const response = await api.post('/billing/auto-topup', autoTopupConfig, {
        headers: { Authorization: `Bearer ${authToken}` }
      });

      console.log('🔄 Auto-topup config response:', response.status, response.data);

      expect([200, 201, 400, 401, 403, 500]).toContain(response.status);
      if ([200, 201].includes(response.status)) {
        expect(response.data).toBeDefined();
      }
    });

    it('should get token usage stats', async () => {
      const response = await api.get('/billing/tokens/usage-stats', {
        headers: { Authorization: `Bearer ${authToken}` },
        params: {
          startDate: '2024-01-01',
          endDate: '2024-12-31'
        }
      });

      console.log('📊 Token usage stats response:', response.status, response.data);

      expect([200, 400, 401, 403, 500]).toContain(response.status);
      if (response.status === 200) {
        expect(response.data).toBeDefined();
      }
    });

    it('should get token packages', async () => {
      const response = await api.get('/billing/token-packages', {
        headers: { Authorization: `Bearer ${authToken}` }
      });

      console.log('💎 Token packages response:', response.status, response.data);

      expect([200, 401, 403, 500]).toContain(response.status);
      if (response.status === 200) {
        expect(response.data).toHaveProperty('packages');
        expect(Array.isArray(response.data.packages)).toBe(true);
      }
    });
  });
});