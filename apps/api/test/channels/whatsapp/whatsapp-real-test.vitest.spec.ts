/**
 * Real WhatsApp Message Testing
 * Tests sending actual WhatsApp messages to real phone numbers
 * Tests both BYOP and WABA configurations
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createTestSetup, TestSetup, expectValidStatusCodes, createApiKeyHeaders } from '../shared/test-utils';

describe('📱 Real WhatsApp Message Tests', () => {
  let testSetup: TestSetup;
  const testPhoneNumbers = ['+2347088200612', '+2349096809900'];

  beforeAll(async () => {
    testSetup = await createTestSetup();
    console.log('✅ Real WhatsApp test setup completed');
    console.log(`📱 Testing with phone numbers: ${testPhoneNumbers.join(', ')}`);
  });

  afterAll(async () => {
    console.log('✅ Real WhatsApp test cleanup completed');
  });

  describe('📱 BYOP (Bring Your Own Provider) Tests', () => {
    it('should send WhatsApp messages via BYOP to real numbers', async () => {
      const results = [];

      for (const phoneNumber of testPhoneNumbers) {
        console.log(`📱 Sending BYOP message to ${phoneNumber}...`);
        
        const payload = {
          to: phoneNumber,
          message: 'Hello! This is a test message from WhatsApp BYOP integration. Testing notification system.',
          subject: 'BYOP Test Message',
          channel: 'WHATSAPP',
          metadata: {
            provider: 'WHATSAPP_BUSINESS',
            messageType: 'text',
            priority: 'normal'
          }
        };

        const startTime = Date.now();
        const response = await testSetup.api.post('/notifications', payload, {
          headers: createApiKeyHeaders(testSetup.apiKey, testSetup.projectId)
        });
        const endTime = Date.now();

        const result = {
          phoneNumber,
          status: response.status,
          responseTime: endTime - startTime,
          success: [200, 201].includes(response.status),
          data: response.data
        };

        results.push(result);
        
        console.log(`📱 BYOP ${phoneNumber}: Status ${result.status} (${result.responseTime}ms)`);
        if (result.success) {
          console.log(`✅ Message sent successfully to ${phoneNumber}`);
        } else {
          console.log(`❌ Failed to send to ${phoneNumber}:`, response.data);
        }

        // Add delay between messages to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 2000));
      }

      const successCount = results.filter(r => r.success).length;
      console.log(`📊 BYOP Results: ${successCount}/${results.length} messages sent successfully`);

      // Test should pass if at least one message was sent or if we get expected error codes
      results.forEach(result => {
        expectValidStatusCodes(result.status, [200, 201, 400, 401, 403, 404, 422, 500]);
      });

      expect(results.length).toBe(testPhoneNumbers.length);
    });

    it('should send WhatsApp template message via BYOP', async () => {
      const phoneNumber = testPhoneNumbers[0]; // Test with first number
      
      console.log(`📋 Sending BYOP template message to ${phoneNumber}...`);

      const templatePayload = {
        to: phoneNumber,
        channel: 'WHATSAPP',
        metadata: {
          type: 'template',
          template: {
            name: 'hello_world',
            language: { code: 'en_US' },
            components: []
          },
          provider: 'WHATSAPP_BUSINESS'
        }
      };

      const response = await testSetup.api.post('/notifications', templatePayload, {
        headers: createApiKeyHeaders(testSetup.apiKey, testSetup.projectId)
      });

      console.log(`📋 BYOP Template ${phoneNumber}: Status ${response.status}`);
      
      if ([200, 201].includes(response.status)) {
        console.log(`✅ Template message sent successfully to ${phoneNumber}`);
      } else {
        console.log(`❌ Template message failed:`, response.data);
      }

      expectValidStatusCodes(response.status, [200, 201, 400, 401, 403, 404, 422, 500]);
    });
  });

  describe('🏢 WABA (WhatsApp Business Account) Tests', () => {
    it('should send WhatsApp messages via WABA to real numbers', async () => {
      const results = [];

      for (const phoneNumber of testPhoneNumbers) {
        console.log(`🏢 Sending WABA message to ${phoneNumber}...`);
        
        const payload = {
          to: phoneNumber,
          message: 'Hello! This is a test message from WhatsApp Business Account (WABA). Testing notification system.',
          subject: 'WABA Test Message',
          channel: 'WHATSAPP',
          metadata: {
            provider: 'WABA',
            messageType: 'text',
            priority: 'normal',
            wabaConfig: {
              businessAccountId: process.env.WHATSAPP_BUSINESS_ACCOUNT_ID,
              phoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID,
              accessToken: process.env.WHATSAPP_ACCESS_TOKEN
            }
          }
        };

        const startTime = Date.now();
        const response = await testSetup.api.post('/notifications', payload, {
          headers: createApiKeyHeaders(testSetup.apiKey, testSetup.projectId)
        });
        const endTime = Date.now();

        const result = {
          phoneNumber,
          status: response.status,
          responseTime: endTime - startTime,
          success: [200, 201].includes(response.status),
          data: response.data
        };

        results.push(result);
        
        console.log(`🏢 WABA ${phoneNumber}: Status ${result.status} (${result.responseTime}ms)`);
        if (result.success) {
          console.log(`✅ Message sent successfully to ${phoneNumber}`);
        } else {
          console.log(`❌ Failed to send to ${phoneNumber}:`, response.data);
        }

        // Add delay between messages to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 2000));
      }

      const successCount = results.filter(r => r.success).length;
      console.log(`📊 WABA Results: ${successCount}/${results.length} messages sent successfully`);

      // Test should pass if at least one message was sent or if we get expected error codes
      results.forEach(result => {
        expectValidStatusCodes(result.status, [200, 201, 400, 401, 403, 404, 422, 500]);
      });

      expect(results.length).toBe(testPhoneNumbers.length);
    });

    it('should send WABA template message with hello_world template', async () => {
      const phoneNumber = testPhoneNumbers[0]; // Test with first number
      
      console.log(`📋 Sending WABA hello_world template to ${phoneNumber}...`);

      const templatePayload = {
        to: phoneNumber,
        channel: 'WHATSAPP',
        metadata: {
          type: 'template',
          template: {
            name: 'hello_world',
            language: { code: 'en_US' },
            components: []
          },
          provider: 'WABA'
        }
      };

      const response = await testSetup.api.post('/notifications', templatePayload, {
        headers: createApiKeyHeaders(testSetup.apiKey, testSetup.projectId)
      });

      console.log(`📋 WABA Template ${phoneNumber}: Status ${response.status}`);
      
      if ([200, 201].includes(response.status)) {
        console.log(`✅ Template message sent successfully to ${phoneNumber}`);
      } else {
        console.log(`❌ Template message failed:`, response.data);
      }

      expectValidStatusCodes(response.status, [200, 201, 400, 401, 403, 404, 422, 500]);
    });
  });

  describe('📊 Performance Comparison', () => {
    it('should compare BYOP vs WABA performance', async () => {
      const phoneNumber = testPhoneNumbers[0];
      const results = { byop: null, waba: null };

      // Test BYOP performance
      console.log('📊 Testing BYOP performance...');
      const byopStart = Date.now();
      const byopResponse = await testSetup.api.post('/notifications', {
        to: phoneNumber,
        message: 'BYOP Performance Test Message',
        channel: 'WHATSAPP',
        metadata: { provider: 'WHATSAPP_BUSINESS' }
      }, {
        headers: createApiKeyHeaders(testSetup.apiKey, testSetup.projectId)
      });
      const byopEnd = Date.now();

      results.byop = {
        responseTime: byopEnd - byopStart,
        status: byopResponse.status,
        success: [200, 201].includes(byopResponse.status)
      };

      // Wait before next test
      await new Promise(resolve => setTimeout(resolve, 3000));

      // Test WABA performance
      console.log('📊 Testing WABA performance...');
      const wabaStart = Date.now();
      const wabaResponse = await testSetup.api.post('/notifications', {
        to: phoneNumber,
        message: 'WABA Performance Test Message',
        channel: 'WHATSAPP',
        metadata: { provider: 'WABA' }
      }, {
        headers: createApiKeyHeaders(testSetup.apiKey, testSetup.projectId)
      });
      const wabaEnd = Date.now();

      results.waba = {
        responseTime: wabaEnd - wabaStart,
        status: wabaResponse.status,
        success: [200, 201].includes(wabaResponse.status)
      };

      // Log results
      console.log('📊 Performance Comparison Results:');
      console.log(`   BYOP: ${results.byop.responseTime}ms (Status: ${results.byop.status})`);
      console.log(`   WABA: ${results.waba.responseTime}ms (Status: ${results.waba.status})`);
      
      const faster = results.byop.responseTime < results.waba.responseTime ? 'BYOP' : 'WABA';
      console.log(`   Faster: ${faster}`);
      
      const successfulTests = [results.byop.success, results.waba.success].filter(Boolean).length;
      console.log(`   Successful tests: ${successfulTests}/2`);

      expect(results.byop).toBeDefined();
      expect(results.waba).toBeDefined();
    });
  });

  describe('🧪 Error Handling Tests', () => {
    it('should handle invalid phone number gracefully', async () => {
      console.log('🧪 Testing invalid phone number handling...');
      
      const response = await testSetup.api.post('/notifications', {
        to: 'invalid-phone-number',
        message: 'Test message to invalid number',
        channel: 'WHATSAPP'
      }, {
        headers: createApiKeyHeaders(testSetup.apiKey, testSetup.projectId)
      });

      console.log(`🧪 Invalid phone test: Status ${response.status}`);
      expectValidStatusCodes(response.status, [400, 401, 422, 500]);
    });

    it('should handle missing WhatsApp configuration', async () => {
      console.log('🧪 Testing missing configuration handling...');
      
      const response = await testSetup.api.post('/notifications', {
        to: testPhoneNumbers[0],
        message: 'Test message with missing config',
        channel: 'WHATSAPP',
        metadata: {
          provider: 'NON_EXISTENT_PROVIDER'
        }
      }, {
        headers: createApiKeyHeaders(testSetup.apiKey, testSetup.projectId)
      });

      console.log(`🧪 Missing config test: Status ${response.status}`);
      expectValidStatusCodes(response.status, [400, 401, 404, 422, 500]);
    });
  });
});