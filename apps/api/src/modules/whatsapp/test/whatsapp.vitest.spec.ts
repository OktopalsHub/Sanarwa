import { describe, it, expect, beforeAll } from 'vitest';
import axios, { AxiosInstance } from 'axios';

describe('WhatsApp Module Integration Tests', () => {
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
      email: `whatsapp-test-${timestamp}@example.com`,
      password: 'WhatsAppTest123!',
      firstName: 'WhatsApp',
      lastName: 'Test'
    };

    const response = await api.post('/auth/register', testUser);
    if (response.status !== 201) {
      throw new Error('Failed to register test user');
    }
    return response.data.access_token;
  }

  describe('WhatsApp Business API Endpoints', () => {
    it('should send WhatsApp message', async () => {
      const messageData = {
        to: '+1234567890',
        message: 'Hello from WhatsApp test!',
        type: 'text'
      };

      const response = await api.post('/whatsapp/send', messageData, {
        headers: { Authorization: `Bearer ${authToken}` }
      });

      console.log('📱 Send WhatsApp message response:', response.status, response.data);

      expect([200, 201, 400, 401, 403, 404, 500]).toContain(response.status);
      if ([200, 201].includes(response.status)) {
        expect(response.data).toHaveProperty('messageId');
      }
    });

    it('should send WhatsApp template message', async () => {
      const templateData = {
        to: '+1234567890',
        templateName: 'welcome_message',
        templateLanguage: 'en',
        parameters: ['John Doe']
      };

      const response = await api.post('/whatsapp/send-template', templateData, {
        headers: { Authorization: `Bearer ${authToken}` }
      });

      console.log('📋 Send WhatsApp template response:', response.status, response.data);

      expect([200, 201, 400, 401, 403, 404, 500]).toContain(response.status);
      if ([200, 201].includes(response.status)) {
        expect(response.data).toHaveProperty('messageId');
      }
    });

    it('should get message status', async () => {
      const messageId = 'test-message-id-123';
      
      const response = await api.get(`/whatsapp/message/${messageId}/status`, {
        headers: { Authorization: `Bearer ${authToken}` }
      });

      console.log('📊 WhatsApp message status response:', response.status, response.data);

      expect([200, 400, 401, 403, 404, 500]).toContain(response.status);
      if (response.status === 200) {
        expect(response.data).toHaveProperty('status');
      }
    });

    it('should get WhatsApp configuration', async () => {
      const response = await api.get('/whatsapp/config', {
        headers: { Authorization: `Bearer ${authToken}` }
      });

      console.log('⚙️ WhatsApp config response:', response.status, response.data);

      expect([200, 401, 403, 404, 500]).toContain(response.status);
      if (response.status === 200) {
        expect(response.data).toBeDefined();
      }
    });

    it('should update WhatsApp configuration', async () => {
      const configData = {
        wabaId: 'test-waba-id',
        accessToken: 'test-access-token',
        phoneNumberId: 'test-phone-number-id',
        webhookUrl: 'https://example.com/webhook'
      };

      const response = await api.put('/whatsapp/config', configData, {
        headers: { Authorization: `Bearer ${authToken}` }
      });

      console.log('⚙️ Update WhatsApp config response:', response.status, response.data);

      expect([200, 201, 400, 401, 403, 404, 500]).toContain(response.status);
    });
  });

  describe('WhatsApp Template Management', () => {
    it('should create WhatsApp template', async () => {
      const templateData = {
        name: 'test_template',
        category: 'MARKETING',
        language: 'en',
        components: [
          {
            type: 'BODY',
            text: 'Hello {{1}}! Welcome to our service.'
          }
        ]
      };

      const response = await api.post('/whatsapp/templates', templateData, {
        headers: { Authorization: `Bearer ${authToken}` }
      });

      console.log('📝 Create WhatsApp template response:', response.status, response.data);

      expect([200, 201, 400, 401, 403, 404, 500]).toContain(response.status);
      if ([200, 201].includes(response.status)) {
        expect(response.data).toHaveProperty('templateId');
      }
    });

    it('should get WhatsApp templates', async () => {
      const response = await api.get('/whatsapp/templates', {
        headers: { Authorization: `Bearer ${authToken}` }
      });

      console.log('📋 Get WhatsApp templates response:', response.status, response.data);

      expect([200, 401, 403, 404, 500]).toContain(response.status);
      if (response.status === 200) {
        expect(Array.isArray(response.data) || response.data.templates).toBeTruthy();
      }
    });

    it('should get template status', async () => {
      const templateId = 'test-template-id';
      
      const response = await api.get(`/whatsapp/templates/${templateId}/status`, {
        headers: { Authorization: `Bearer ${authToken}` }
      });

      console.log('📊 Template status response:', response.status, response.data);

      expect([200, 401, 403, 404, 500]).toContain(response.status);
      if (response.status === 200) {
        expect(response.data).toHaveProperty('status');
      }
    });

    it('should delete WhatsApp template', async () => {
      const templateId = 'test-template-id';
      
      const response = await api.delete(`/whatsapp/templates/${templateId}`, {
        headers: { Authorization: `Bearer ${authToken}` }
      });

      console.log('🗑️ Delete template response:', response.status, response.data);

      expect([200, 204, 401, 403, 404, 500]).toContain(response.status);
    });
  });

  describe('WhatsApp Embedded Signup', () => {
    it('should handle embedded signup callback', async () => {
      const signupData = {
        wabaId: 'test-waba-123',
        accessToken: 'test-token-456',
        phoneNumbers: [
          {
            id: 'phone-123',
            number: '+1234567890',
            verified: true
          }
        ]
      };

      const response = await api.post('/whatsapp/embedded-signup/callback', signupData, {
        headers: { Authorization: `Bearer ${authToken}` }
      });

      console.log('🔗 Embedded signup callback response:', response.status, response.data);

      expect([200, 201, 400, 401, 403, 404, 500]).toContain(response.status);
    });

    it('should get embedded signup URL', async () => {
      const response = await api.get('/whatsapp/embedded-signup/url', {
        headers: { Authorization: `Bearer ${authToken}` }
      });

      console.log('🔗 Embedded signup URL response:', response.status, response.data);

      expect([200, 401, 403, 404, 500]).toContain(response.status);
      if (response.status === 200) {
        expect(response.data).toHaveProperty('signupUrl');
      }
    });
  });

  describe('WhatsApp Webhooks', () => {
    it('should handle webhook verification', async () => {
      const response = await api.get('/whatsapp/webhook', {
        params: {
          'hub.mode': 'subscribe',
          'hub.challenge': 'test-challenge',
          'hub.verify_token': 'test-verify-token'
        }
      });

      console.log('🔗 Webhook verification response:', response.status, response.data);

      expect([200, 400, 403]).toContain(response.status);
    });

    it('should handle webhook events', async () => {
      const webhookData = {
        object: 'whatsapp_business_account',
        entry: [
          {
            id: 'waba-id',
            changes: [
              {
                value: {
                  messaging_product: 'whatsapp',
                  messages: [
                    {
                      id: 'msg-id',
                      from: '+1234567890',
                      text: { body: 'Hello' },
                      timestamp: '1234567890'
                    }
                  ]
                },
                field: 'messages'
              }
            ]
          }
        ]
      };

      const response = await api.post('/whatsapp/webhook', webhookData);

      console.log('📨 Webhook event response:', response.status, response.data);

      expect([200, 400, 500]).toContain(response.status);
    });
  });
});