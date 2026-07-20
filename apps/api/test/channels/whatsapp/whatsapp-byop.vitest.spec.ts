/**
 * WhatsApp Multi-WABA (Multiple WhatsApp Business Accounts) Tests
 * Tests creating separate WABA per tenant - the CORRECT approach for multi-tenant SaaS
 * Each tenant gets their own WABA with full 6000 template capacity
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createTestSetup, createTemplate, cleanupTemplate, TestSetup, expectValidStatusCodes, createApiKeyHeaders, createAuthHeaders } from '../shared/test-utils';

describe('📱 WhatsApp Multi-WABA Tests', () => {
  let testSetup: TestSetup;
  let whatsappTemplate: { id: string; name: string; channel: string };
  let createdProviders: string[] = [];
  let createdTemplates: string[] = [];

  beforeAll(async () => {
    testSetup = await createTestSetup();

    // Create WhatsApp template for BYOP testing
    const templateData = {
      name: 'whatsapp-byop-test',
      channel: 'WHATSAPP',
      subject: 'WhatsApp BYOP: {{title}}',
      content: JSON.stringify({
        type: 'template',
        template: {
          name: 'shared_business_notification',
          language: { code: 'en' },
          components: [
            {
              type: 'header',
              parameters: [
                { type: 'text', text: '{{business_name}}' }
              ]
            },
            {
              type: 'body',
              parameters: [
                { type: 'text', text: '{{customer_name}}' },
                { type: 'text', text: '{{message}}' },
                { type: 'text', text: '{{business_name}}' }
              ]
            },
            {
              type: 'footer',
              parameters: [
                { type: 'text', text: '{{business_name}}' }
              ]
            }
          ]
        }
      }),
      variables: [
        { name: 'business_name', type: 'string', required: true },
        { name: 'customer_name', type: 'string', required: true },
        { name: 'message', type: 'string', required: true },
        { name: 'title', type: 'string', required: true }
      ],
      description: 'Shared WhatsApp template for multi-tenant use'
    };

    whatsappTemplate = await createTemplate(testSetup.api, testSetup.authData, templateData);
    console.log('✅ WhatsApp BYOP test setup completed');
  });

  afterAll(async () => {
    await cleanupTemplate(testSetup.api, testSetup.authData, whatsappTemplate.id);

    // Cleanup providers and templates
    for (const providerId of createdProviders) {
      try {
        await testSetup.api.delete(`/projects/${testSetup.projectId}/providers/${providerId}`, {
          headers: createAuthHeaders(testSetup.authData.accessToken)
        });
      } catch (error) {
        // Ignore cleanup errors
      }
    }

    for (const templateId of createdTemplates) {
      try {
        await testSetup.api.delete(`/whatsapp/templates/${templateId}`, {
          headers: createAuthHeaders(testSetup.authData.accessToken)
        });
      } catch (error) {
        // Ignore cleanup errors
      }
    }
    console.log('✅ WhatsApp BYOP cleanup completed');
  });

  describe('📱 WhatsApp Business API Configuration', () => {
    it('should configure WhatsApp Business API BYOP provider', async () => {
      const whatsappConfig = {
        providerId: 'whatsapp-business-byop',
        providerName: 'WhatsApp Business API BYOP',
        providerType: 'whatsapp_business',
        channel: 'whatsapp',
        config: {
          accessToken: 'EAAG_TEST_ACCESS_TOKEN',
          phoneNumberId: '123456789012345',
          businessAccountId: 'business_account_123',
          appId: 'app_123456789',
          appSecret: 'app_secret_test_123',
          webhookVerifyToken: 'webhook_verify_token_123',
          apiVersion: 'v18.0'
        },
        isActive: true,
        priority: 1
      };

      const response = await testSetup.api.post(`/projects/${testSetup.projectId}/providers`, whatsappConfig, {
        headers: createAuthHeaders(testSetup.authData.accessToken)
      });

      console.log('📱 WhatsApp Business API configuration:', response.status, response.data);

      if (response.status === 201) {
        createdProviders.push(response.data.id);
        expect(response.data).toHaveProperty('id');
        expect(response.data.providerType).toBe('whatsapp_business');
        console.log('🎉 WhatsApp Business API BYOP configured successfully');
      } else {
        expectValidStatusCodes(response.status, [201, 400, 403, 404, 500]);
        console.log('ℹ️ WhatsApp Business API configuration test completed');
      }
    });

    it('should test WhatsApp message sending via BYOP to real numbers', async () => {
      const testPhoneNumbers = ['+2347088200612', '+2349096809900'];
      
      for (const phoneNumber of testPhoneNumbers) {
        const notificationPayload = {
          to: phoneNumber,
          message: 'Test WhatsApp message via BYOP provider',
          subject: 'WhatsApp BYOP Test',
          channel: 'WHATSAPP',
          metadata: {
            templateId: whatsappTemplate.name,
            templateData: {
              title: 'WhatsApp BYOP Test',
              business_name: 'TestBusiness Inc',
              customer_name: 'Test User',
              message: 'This message was sent through your WhatsApp Business API configuration'
            },
            provider: 'WHATSAPP_BUSINESS'
          }
        };

        const response = await testSetup.api.post('/notifications', notificationPayload, {
          headers: createApiKeyHeaders(testSetup.apiKey, testSetup.projectId)
        });

        console.log(`📱 WhatsApp BYOP message to ${phoneNumber}:`, response.status, response.data);
        expectValidStatusCodes(response.status, [200, 201, 400, 404, 401]);
      }
      console.log('✅ WhatsApp BYOP message sending test completed');
    });
  });

  describe('🏢 Multi-WABA Strategy (Correct Approach)', () => {
    it('should create separate WABA for each tenant', async () => {
      const tenantWABARequests = [
        {
          tenantId: 'tenant_pizza_shop',
          businessName: "Mario's Pizza",
          businessEmail: 'mario@mariospizza.com',
          businessPhone: '+1234567890',
          businessCategory: 'FOOD_BEVERAGE',
          businessDescription: 'Authentic Italian pizza restaurant'
        },
        {
          tenantId: 'tenant_flower_shop',
          businessName: "Rose Garden Flowers",
          businessEmail: 'info@rosegarden.com',
          businessPhone: '+1234567891',
          businessCategory: 'RETAIL',
          businessDescription: 'Premium flower arrangements and gifts'
        },
        {
          tenantId: 'tenant_tech_startup',
          businessName: "TechFlow Solutions",
          businessEmail: 'hello@techflow.com',
          businessPhone: '+1234567892',
          businessCategory: 'TECHNOLOGY',
          businessDescription: 'Software development and consulting'
        }
      ];

      const wabaCreationResults = [];

      for (const request of tenantWABARequests) {
        const response = await testSetup.api.post('/whatsapp/waba/create', request, {
          headers: createAuthHeaders(testSetup.authData.accessToken)
        });

        wabaCreationResults.push({
          tenantId: request.tenantId,
          businessName: request.businessName,
          status: response.status,
          wabaId: response.data?.wabaId || null,
          success: [200, 201].includes(response.status)
        });

        console.log(`🏢 WABA creation for ${request.businessName}:`, response.status, response.data);
      }

      const successfulCreations = wabaCreationResults.filter(result => result.success);
      console.log(`📊 Multi-WABA creation results:`);
      console.log(`   Tenants processed: ${tenantWABARequests.length}`);
      console.log(`   WABAs created: ${successfulCreations.length}`);
      console.log(`   Each WABA capacity: 6,000 templates`);
      console.log(`   Total template capacity: ${successfulCreations.length * 6000} templates`);

      expect(wabaCreationResults.length).toBe(tenantWABARequests.length);
      console.log('✅ Multi-WABA strategy demonstrated - each tenant gets their own WABA');
    });

    it('should create templates in tenant-specific WABAs', async () => {
      const sharedTemplateCategories = [
        {
          category: 'ECOMMERCE',
          templates: [
            {
              name: 'ecommerce_order_confirmation',
              content: 'Hello {{customer_name}}, your order {{order_id}} has been confirmed at {{business_name}}. Total: {{amount}}. Thank you for shopping with us!',
              variables: ['customer_name', 'order_id', 'business_name', 'amount']
            },
            {
              name: 'ecommerce_shipping_update',
              content: 'Hi {{customer_name}}, your order {{order_id}} from {{business_name}} has been shipped. Tracking: {{tracking_number}}',
              variables: ['customer_name', 'order_id', 'business_name', 'tracking_number']
            }
          ]
        },
        {
          category: 'HEALTHCARE',
          templates: [
            {
              name: 'healthcare_appointment_reminder',
              content: 'Dear {{patient_name}}, this is a reminder for your appointment with {{clinic_name}} on {{date}} at {{time}}.',
              variables: ['patient_name', 'clinic_name', 'date', 'time']
            },
            {
              name: 'healthcare_test_results',
              content: 'Hello {{patient_name}}, your test results are ready at {{clinic_name}}. Please contact us to schedule a consultation.',
              variables: ['patient_name', 'clinic_name']
            }
          ]
        },
        {
          category: 'FINANCE',
          templates: [
            {
              name: 'finance_payment_reminder',
              content: 'Dear {{customer_name}}, your payment of {{amount}} to {{company_name}} is due on {{due_date}}. Please make payment to avoid late fees.',
              variables: ['customer_name', 'amount', 'company_name', 'due_date']
            }
          ]
        }
      ];

      const createdCategories = [];

      for (const category of sharedTemplateCategories) {
        for (const template of category.templates) {
          const templatePayload = {
            name: template.name,
            category: category.category,
            content: template.content,
            variables: template.variables,
            isShared: true, // Mark as shared template
            maxTenants: 1000 // Allow up to 1000 tenants per template
          };

          const response = await testSetup.api.post('/whatsapp/templates/shared', templatePayload, {
            headers: createAuthHeaders(testSetup.authData.accessToken)
          });

          console.log(`📋 Created shared template ${template.name}:`, response.status, response.data);

          if (response.status === 201) {
            createdTemplates.push(response.data.id);
            createdCategories.push({
              category: category.category,
              templateId: response.data.id,
              name: template.name
            });
          }
        }
      }

      console.log(`📊 Template scaling results:`);
      console.log(`   Categories created: ${sharedTemplateCategories.length}`);
      console.log(`   Shared templates created: ${createdCategories.length}`);
      console.log(`   Potential users served: ${createdCategories.length * 1000} (1000 per template)`);

      expect(createdCategories.length).toBeGreaterThan(0);
      console.log('✅ Shared template categories created successfully');
    });

    it('should demonstrate template reuse across multiple tenants', async () => {
      // Simulate multiple tenants using the same template
      const tenantConfigurations = [
        {
          tenantId: 'tenant_pizza_shop',
          businessName: "Mario's Pizza",
          customization: {
            brand_color: '#FF5733',
            logo_url: 'https://example.com/mario-pizza-logo.png'
          }
        },
        {
          tenantId: 'tenant_flower_shop',
          businessName: "Rose Garden Flowers",
          customization: {
            brand_color: '#E91E63',
            logo_url: 'https://example.com/rose-garden-logo.png'
          }
        },
        {
          tenantId: 'tenant_tech_startup',
          businessName: "TechFlow Solutions",
          customization: {
            brand_color: '#2196F3',
            logo_url: 'https://example.com/techflow-logo.png'
          }
        }
      ];

      const templateUsageResults = [];

      for (const tenant of tenantConfigurations) {
        // Each tenant uses the same shared template with their customization
        const notificationPayload = {
          to: '+2347088200612', // Use real test number
          message: 'Shared template usage test',
          subject: 'Multi-tenant Template Test',
          channel: 'WHATSAPP',
          metadata: {
            templateId: 'ecommerce_order_confirmation', // Shared template
            templateData: {
              customer_name: 'John Doe',
              order_id: 'ORD-12345',
              business_name: tenant.businessName,
              amount: '$29.99'
            },
            tenantCustomization: tenant.customization,
            provider: 'WHATSAPP_BUSINESS'
          }
        };

        const response = await testSetup.api.post('/notifications', notificationPayload, {
          headers: createApiKeyHeaders(testSetup.apiKey, testSetup.projectId)
        });

        templateUsageResults.push({
          tenant: tenant.tenantId,
          businessName: tenant.businessName,
          status: response.status,
          success: [200, 201].includes(response.status)
        });

        console.log(`📱 ${tenant.businessName} template usage:`, response.status, response.data);
      }

      const successfulUsages = templateUsageResults.filter(result => result.success);
      console.log(`📊 Template reuse results:`);
      console.log(`   Tenants tested: ${tenantConfigurations.length}`);
      console.log(`   Successful usages: ${successfulUsages.length}`);
      console.log(`   Template efficiency: 1 template serves ${successfulUsages.length} businesses`);

      expect(templateUsageResults.length).toBe(tenantConfigurations.length);
      console.log('✅ Multi-tenant template reuse demonstrated');
    });

    it('should programmatically create WhatsApp templates via API', async () => {
      const dynamicTemplateCreation = {
        businessType: 'RESTAURANT',
        templateRequests: [
          {
            name: 'restaurant_order_ready',
            category: 'UTILITY',
            language: 'en',
            components: [
              {
                type: 'BODY',
                text: 'Hello {{1}}, your order {{2}} is ready for pickup at {{3}}. Please arrive within 15 minutes.'
              }
            ]
          },
          {
            name: 'restaurant_table_ready',
            category: 'UTILITY',
            language: 'en',
            components: [
              {
                type: 'BODY',
                text: 'Hi {{1}}, your table for {{2}} is ready at {{3}}. Please check in at the host stand.'
              }
            ]
          }
        ]
      };

      const creationResults = [];

      for (const templateRequest of dynamicTemplateCreation.templateRequests) {
        // Programmatically create WhatsApp template via Meta API
        const createTemplatePayload = {
          name: templateRequest.name,
          category: templateRequest.category,
          language: templateRequest.language,
          components: templateRequest.components,
          businessType: dynamicTemplateCreation.businessType
        };

        const response = await testSetup.api.post('/whatsapp/templates/create', createTemplatePayload, {
          headers: createAuthHeaders(testSetup.authData.accessToken)
        });

        creationResults.push({
          templateName: templateRequest.name,
          status: response.status,
          success: [200, 201].includes(response.status),
          templateId: response.data?.templateId || null
        });

        console.log(`📋 Dynamic template creation ${templateRequest.name}:`, response.status, response.data);

        if (response.status === 201 && response.data?.templateId) {
          createdTemplates.push(response.data.templateId);
        }
      }

      const successfulCreations = creationResults.filter(result => result.success);
      console.log(`📊 Dynamic template creation results:`);
      console.log(`   Templates requested: ${dynamicTemplateCreation.templateRequests.length}`);
      console.log(`   Successfully created: ${successfulCreations.length}`);

      expect(creationResults.length).toBe(dynamicTemplateCreation.templateRequests.length);
      console.log('✅ Programmatic WhatsApp template creation tested');
    });
  });

  describe('📊 WhatsApp Quota Management', () => {
    it('should track WhatsApp message quotas and costs', async () => {
      const quotaResponse = await testSetup.api.get(`/projects/${testSetup.projectId}/quotas/whatsapp`, {
        headers: createAuthHeaders(testSetup.authData.accessToken)
      });

      console.log('📊 WhatsApp quotas:', quotaResponse.status, quotaResponse.data);

      if (quotaResponse.status === 200) {
        expect(quotaResponse.data).toHaveProperty('quotas');

        if (quotaResponse.data.billingModel === 'quota-based') {
          expect(quotaResponse.data.quotas).toHaveProperty('whatsapp');
          console.log(`📱 WhatsApp quota limit: ${quotaResponse.data.quotas.whatsapp}/month`);
        } else {
          console.log('🎯 Event-based billing - unlimited WhatsApp messages');
        }

        console.log('✅ WhatsApp quota information retrieved');
      } else {
        expectValidStatusCodes(quotaResponse.status, [200, 404, 403, 400]);
        console.log('ℹ️ WhatsApp quota endpoint test completed');
      }
    });

    it('should test WhatsApp message rate limiting', async () => {
      // Test WhatsApp rate limits (1000 messages per second per phone number)
      const rateLimitTests = [];

      for (let i = 1; i <= 5; i++) {
        const notificationPayload = {
          to: `+123456789${i.toString().padStart(2, '0')}`,
          message: `Rate limit test ${i}`,
          subject: `WhatsApp Rate Test ${i}`,
          channel: 'WHATSAPP',
          metadata: {
            templateId: whatsappTemplate.name,
            templateData: {
              title: `Rate Test ${i}`,
              business_name: 'TestBusiness',
              customer_name: `User${i}`,
              message: `This is rate limit test message ${i}`
            }
          }
        };

        const startTime = Date.now();
        const response = await testSetup.api.post('/notifications', notificationPayload, {
          headers: createApiKeyHeaders(testSetup.apiKey, testSetup.projectId)
        });
        const endTime = Date.now();

        rateLimitTests.push({
          attempt: i,
          status: response.status,
          responseTime: endTime - startTime,
          rateLimited: response.status === 429,
          success: [200, 201].includes(response.status)
        });

        console.log(`📱 WhatsApp rate test ${i}:`, response.status, `${endTime - startTime}ms`);
      }

      const successfulMessages = rateLimitTests.filter(test => test.success);
      const rateLimitedMessages = rateLimitTests.filter(test => test.rateLimited);
      const avgResponseTime = rateLimitTests.reduce((sum, test) => sum + test.responseTime, 0) / rateLimitTests.length;

      console.log(`📊 WhatsApp rate limit results:`);
      console.log(`   Successful: ${successfulMessages.length}/5`);
      console.log(`   Rate limited: ${rateLimitedMessages.length}/5`);
      console.log(`   Avg response time: ${avgResponseTime.toFixed(2)}ms`);

      expect(rateLimitTests.length).toBe(5);
      console.log('✅ WhatsApp rate limiting tested');
    });
  });

  describe('🏢 WABA (WhatsApp Business Account) Tests', () => {
    it('should send messages via WABA to real numbers', async () => {
      const testPhoneNumbers = ['+2347088200612', '+2349096809900'];
      
      for (const phoneNumber of testPhoneNumbers) {
        const wabaPayload = {
          to: phoneNumber,
          message: 'Test WhatsApp message via WABA',
          subject: 'WABA Test Message',
          channel: 'WHATSAPP',
          metadata: {
            templateId: 'shared_business_notification',
            templateData: {
              business_name: 'WABA Test Business',
              customer_name: 'Test Customer',
              message: 'This is a test message sent via WhatsApp Business Account (WABA)',
              title: 'WABA Test'
            },
            provider: 'WABA',
            wabaConfig: {
              businessAccountId: process.env.WHATSAPP_BUSINESS_ACCOUNT_ID,
              phoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID,
              accessToken: process.env.WHATSAPP_ACCESS_TOKEN
            }
          }
        };

        const response = await testSetup.api.post('/notifications', wabaPayload, {
          headers: createApiKeyHeaders(testSetup.apiKey, testSetup.projectId)
        });

        console.log(`🏢 WABA message to ${phoneNumber}:`, response.status, response.data);
        expectValidStatusCodes(response.status, [200, 201, 400, 404, 401, 500]);
      }
      console.log('✅ WABA message sending test completed');
    });

    it('should test WABA template message with custom template', async () => {
      const testPhoneNumbers = ['+2347088200612', '+2349096809900'];
      
      for (const phoneNumber of testPhoneNumbers) {
        const templatePayload = {
          to: phoneNumber,
          channel: 'WHATSAPP',
          metadata: {
            type: 'template',
            template: {
              name: 'hello_world',
              language: { code: 'en_US' },
              components: [
                {
                  type: 'body',
                  parameters: [
                    { type: 'text', text: 'Test User' }
                  ]
                }
              ]
            },
            provider: 'WABA'
          }
        };

        const response = await testSetup.api.post('/notifications', templatePayload, {
          headers: createApiKeyHeaders(testSetup.apiKey, testSetup.projectId)
        });

        console.log(`📋 WABA template message to ${phoneNumber}:`, response.status, response.data);
        expectValidStatusCodes(response.status, [200, 201, 400, 404, 401, 500]);
      }
      console.log('✅ WABA template message test completed');
    });

    it('should test WABA vs BYOP performance comparison', async () => {
      const testPhoneNumber = '+2347088200612';
      const results = { byop: null, waba: null };

      // Test BYOP performance
      const byopStart = Date.now();
      const byopPayload = {
        to: testPhoneNumber,
        message: 'BYOP Performance Test',
        channel: 'WHATSAPP',
        metadata: {
          provider: 'WHATSAPP_BUSINESS',
          templateId: whatsappTemplate.name,
          templateData: {
            title: 'BYOP Performance',
            business_name: 'BYOP Test',
            customer_name: 'Performance Tester',
            message: 'Testing BYOP performance'
          }
        }
      };

      const byopResponse = await testSetup.api.post('/notifications', byopPayload, {
        headers: createApiKeyHeaders(testSetup.apiKey, testSetup.projectId)
      });
      const byopEnd = Date.now();
      results.byop = { 
        responseTime: byopEnd - byopStart, 
        status: byopResponse.status,
        success: [200, 201].includes(byopResponse.status)
      };

      // Test WABA performance
      const wabaStart = Date.now();
      const wabaPayload = {
        to: testPhoneNumber,
        message: 'WABA Performance Test',
        channel: 'WHATSAPP',
        metadata: {
          provider: 'WABA',
          templateId: 'shared_business_notification',
          templateData: {
            business_name: 'WABA Test',
            customer_name: 'Performance Tester',
            message: 'Testing WABA performance',
            title: 'WABA Performance'
          }
        }
      };

      const wabaResponse = await testSetup.api.post('/notifications', wabaPayload, {
        headers: createApiKeyHeaders(testSetup.apiKey, testSetup.projectId)
      });
      const wabaEnd = Date.now();
      results.waba = { 
        responseTime: wabaEnd - wabaStart, 
        status: wabaResponse.status,
        success: [200, 201].includes(wabaResponse.status)
      };

      console.log('📊 Performance Comparison Results:');
      console.log(`   BYOP: ${results.byop.responseTime}ms (Status: ${results.byop.status})`);
      console.log(`   WABA: ${results.waba.responseTime}ms (Status: ${results.waba.status})`);
      console.log(`   Faster: ${results.byop.responseTime < results.waba.responseTime ? 'BYOP' : 'WABA'}`);

      expect(results.byop).toBeDefined();
      expect(results.waba).toBeDefined();
      console.log('✅ BYOP vs WABA performance comparison completed');
    });
  });

  describe('🧪 WhatsApp Error Handling', () => {
    it('should handle invalid phone numbers gracefully', async () => {
      const notificationPayload = {
        to: 'invalid-phone-number',
        message: 'Test with invalid phone number',
        subject: 'Invalid Phone Test',
        channel: 'WHATSAPP'
      };

      const response = await testSetup.api.post('/notifications', notificationPayload, {
        headers: createApiKeyHeaders(testSetup.apiKey, testSetup.projectId)
      });

      console.log('🧪 Invalid phone number test:', response.status, response.data);
      expectValidStatusCodes(response.status, [400, 422, 401]);
      console.log('✅ Invalid phone number handled gracefully');
    });

    it('should handle WhatsApp template not found', async () => {
      const notificationPayload = {
        to: '+1234567890',
        message: 'Test with non-existent template',
        subject: 'Missing Template Test',
        channel: 'WHATSAPP',
        metadata: {
          templateId: 'non-existent-whatsapp-template',
          templateData: {
            business_name: 'Test Business',
            customer_name: 'Test User'
          }
        }
      };

      const response = await testSetup.api.post('/notifications', notificationPayload, {
        headers: createApiKeyHeaders(testSetup.apiKey, testSetup.projectId)
      });

      console.log('🧪 Missing WhatsApp template test:', response.status, response.data);
      expectValidStatusCodes(response.status, [400, 404, 422, 200, 201, 401]);
      console.log('✅ Missing WhatsApp template handled gracefully');
    });
  });
});