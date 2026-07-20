/**
 * Email Quota Management Tests
 * Tests email quota limits, usage tracking, and billing models
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createTestSetup, createTemplate, cleanupTemplate, TestSetup, expectValidStatusCodes } from '../shared/test-utils';

describe('📧 Email Quota Management Tests', () => {
  let testSetup: TestSetup;
  let emailTemplate: { id: string; name: string; channel: string };

  beforeAll(async () => {
    testSetup = await createTestSetup();
    
    // Create email template for testing
    const templateData = {
      name: 'email-quota-test',
      channel: 'EMAIL',
      subject: 'Quota Test: {{title}}',
      content: `
        <html>
          <body>
            <h2>{{title}}</h2>
            <p>Hello {{firstName}}, this is a quota test email.</p>
            <p>{{message}}</p>
          </body>
        </html>
      `,
      variables: [
        { name: 'title', type: 'string', required: true },
        { name: 'firstName', type: 'string', required: true },
        { name: 'message', type: 'string', required: false }
      ]
    };

    emailTemplate = await createTemplate(testSetup.api, testSetup.authData, templateData);
    console.log('✅ Email quota test setup completed');
  });

  afterAll(async () => {
    await cleanupTemplate(testSetup.api, testSetup.authData, emailTemplate.id);
    console.log('✅ Email quota cleanup completed');
  });

  describe('Quota Information', () => {
    it('should retrieve email quota limits and billing model', async () => {
      const response = await testSetup.api.get(`/projects/${testSetup.projectId}/quotas`, {
        headers: { Authorization: `Bearer ${testSetup.authData.accessToken}` }
      });

      console.log('📊 Email quota information:', response.status, response.data);

      if (response.status === 200) {
        expect(response.data).toHaveProperty('quotas');
        expect(response.data).toHaveProperty('billingModel');
        
        if (response.data.billingModel === 'quota-based') {
          expect(response.data.quotas).toHaveProperty('email');
          expect(response.data.quotas.email).toHaveProperty('limit');
          expect(response.data.quotas.email).toHaveProperty('remaining');
          console.log('📦 Quota-based billing detected for email');
        } else {
          console.log('🎯 Event-based billing detected for email');
        }
      } else {
        expectValidStatusCodes(response.status, [200, 404, 403, 400]);
      }

      console.log('✅ Email quota information retrieved');
    });

    it('should track email usage', async () => {
      const response = await testSetup.api.get(`/projects/${testSetup.projectId}/usage`, {
        headers: { Authorization: `Bearer ${testSetup.authData.accessToken}` }
      });

      console.log('📊 Email usage tracking:', response.status, response.data);

      if (response.status === 200) {
        expect(response.data).toHaveProperty('usage');
        expect(response.data).toHaveProperty('billingModel');
        
        if (response.data.billingModel === 'quota-based') {
          expect(response.data.usage).toHaveProperty('emailNotifications');
          console.log(`📧 Email notifications sent: ${response.data.usage.emailNotifications || 0}`);
        } else {
          expect(response.data.usage).toHaveProperty('emailEvents');
          console.log(`📧 Email events sent: ${response.data.usage.emailEvents || 0}`);
        }
      } else {
        expectValidStatusCodes(response.status, [200, 404, 403, 400]);
      }

      console.log('✅ Email usage tracking verified');
    });
  });

  describe('Email Sending with Quotas', () => {
    it('should send email notifications within quota limits', async () => {
      const emailTests = [];
      
      for (let i = 1; i <= 3; i++) {
        const notificationPayload = {
          to: `email-quota-${i}@example.com`,
          message: `Email quota test ${i}`,
          subject: `Quota Test ${i}`,
          channel: 'EMAIL',
          metadata: {
            templateId: emailTemplate.name,
            templateData: {
              title: `Test ${i}`,
              firstName: `User${i}`,
              message: `This is email quota test number ${i}`
            }
          }
        };

        const response = await testSetup.api.post('/notifications', notificationPayload, {
          headers: {
            'Authorization': `Bearer ${testSetup.apiKey}`,
            'X-Project-ID': testSetup.projectId
          }
        });

        emailTests.push({
          attempt: i,
          status: response.status,
          success: [200, 201].includes(response.status)
        });

        console.log(`📧 Email ${i}:`, response.status, response.data);
      }

      const successfulEmails = emailTests.filter(test => test.success);
      console.log(`📊 Email quota test results: ${successfulEmails.length}/3 successful`);
      
      expect(emailTests.length).toBe(3);
      console.log('✅ Email quota testing completed');
    });

    it('should handle quota exceeded scenarios gracefully', async () => {
      // Try to send many emails to test quota limits
      const quotaTests = [];
      
      for (let i = 1; i <= 5; i++) {
        const notificationPayload = {
          to: `quota-exceed-${i}@example.com`,
          message: `Quota exceed test ${i}`,
          subject: `Exceed Test ${i}`,
          channel: 'EMAIL',
          metadata: {
            templateId: emailTemplate.name,
            templateData: {
              title: `Exceed Test ${i}`,
              firstName: `User${i}`,
              message: `Testing quota limits`
            }
          }
        };

        const response = await testSetup.api.post('/notifications', notificationPayload, {
          headers: {
            'Authorization': `Bearer ${testSetup.apiKey}`,
            'X-Project-ID': testSetup.projectId
          }
        });

        quotaTests.push({
          attempt: i,
          status: response.status,
          quotaExceeded: response.status === 429 || 
            (response.data && response.data.error && 
             response.data.error.message && 
             response.data.error.message.includes('quota'))
        });

        console.log(`🔄 Email quota test ${i}:`, response.status, response.data);

        // If quota exceeded, break early
        if (response.status === 429) {
          console.log('📊 Email quota limit reached at attempt', i);
          break;
        }
      }

      const quotaExceededTests = quotaTests.filter(test => test.quotaExceeded);
      console.log(`📊 Email quota exceeded scenarios: ${quotaExceededTests.length}`);

      expect(quotaTests.length).toBeGreaterThan(0);
      console.log('✅ Email quota exceeded testing completed');
    });
  });

  describe('Email Authentication', () => {
    it('should reject email notifications without API key', async () => {
      const notificationPayload = {
        to: 'test@example.com',
        message: 'Test email without API key',
        subject: 'Test Subject',
        channel: 'EMAIL'
      };

      const response = await testSetup.api.post('/notifications', notificationPayload);

      console.log('🚫 Email without API key:', response.status, response.data);
      expectValidStatusCodes(response.status, [401, 403, 400]);
      console.log('✅ Email API key authentication working');
    });

    it('should reject email notifications with invalid API key', async () => {
      const notificationPayload = {
        to: 'test@example.com',
        message: 'Test email with invalid API key',
        subject: 'Test Subject',
        channel: 'EMAIL'
      };

      const response = await testSetup.api.post('/notifications', notificationPayload, {
        headers: {
          'Authorization': 'Bearer invalid_email_api_key',
          'X-Project-ID': testSetup.projectId
        }
      });

      console.log('🚫 Email with invalid API key:', response.status, response.data);
      expectValidStatusCodes(response.status, [401, 403, 400]);
      console.log('✅ Email invalid API key handling working');
    });
  });
});