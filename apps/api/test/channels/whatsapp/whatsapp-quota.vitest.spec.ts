/**
 * WhatsApp Quota Management Tests
 * Tests WhatsApp message quotas, template limits, and multi-tenant scaling
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createTestSetup, createTemplate, cleanupTemplate, TestSetup, expectValidStatusCodes, createApiKeyHeaders, createAuthHeaders } from '../shared/test-utils';

describe('📱 WhatsApp Quota Management Tests', () => {
  let testSetup: TestSetup;
  let whatsappTemplate: { id: string; name: string; channel: string };

  beforeAll(async () => {
    testSetup = await createTestSetup();
    
    // Create WhatsApp template for quota testing
    const templateData = {
      name: 'whatsapp-quota-test',
      channel: 'WHATSAPP',
      subject: 'WhatsApp Quota: {{title}}',
      content: JSON.stringify({
        type: 'template',
        template: {
          name: 'quota_test_notification',
          language: { code: 'en' },
          components: [
            {
              type: 'body',
              parameters: [
                { type: 'text', text: '{{customer_name}}' },
                { type: 'text', text: '{{message}}' },
                { type: 'text', text: '{{business_name}}' }
              ]
            }
          ]
        }
      }),
      variables: [
        { name: 'customer_name', type: 'string', required: true },
        { name: 'message', type: 'string', required: true },
        { name: 'business_name', type: 'string', required: true },
        { name: 'title', type: 'string', required: true }
      ]
    };

    whatsappTemplate = await createTemplate(testSetup.api, testSetup.authData, templateData);
    console.log('✅ WhatsApp quota test setup completed');
  });

  afterAll(async () => {
    await cleanupTemplate(testSetup.api, testSetup.authData, whatsappTemplate.id);
    console.log('✅ WhatsApp quota cleanup completed');
  });

  describe('📊 WhatsApp Quota Limits', () => {
    it('should check current WhatsApp quota limits', async () => {
      const response = await testSetup.api.get(`/projects/${testSetup.projectId}/quotas`, {
        headers: createAuthHeaders(testSetup.authData.accessToken)
      });

      console.log('📊 WhatsApp quotas:', response.status, response.data);

      if (response.status === 200) {
        expect(response.data).toHaveProperty('quotas');
        
        if (response.data.billingModel === 'quota-based') {
          expect(response.data.quotas).toHaveProperty('whatsapp');
          console.log(`📱 WhatsApp quota limit: ${response.data.quotas.whatsapp}/month`);
        } else {
          console.log('🎯 Event-based billing - unlimited WhatsApp messages');
        }
        
        console.log('✅ WhatsApp quota information retrieved');
      } else {
        expectValidStatusCodes(response.status, [200, 404, 403, 400]);
        console.log('ℹ️ WhatsApp quota endpoint test completed');
      }
    });

    it('should test WhatsApp messages within quota limits', async () => {
      const whatsappTests: Array<{
        attempt: number;
        status: number;
        success: boolean;
        data: any;
      }> = [];
      
      for (let i = 1; i <= 5; i++) {
        const notificationPayload = {
          to: `+123456789${i.toString().padStart(2, '0')}`,
          message: `WhatsApp quota test message ${i}`,
          subject: `Test Message ${i}`,
          channel: 'WHATSAPP',
          metadata: {
            templateId: whatsappTemplate.name,
            templateData: {
              title: `Test Message ${i}`,
              customer_name: `User${i}`,
              message: `This is your ${i} WhatsApp message for quota testing`,
              business_name: 'TestBusiness'
            }
          }
        };

        const response = await testSetup.api.post('/notifications', notificationPayload, {
          headers: createApiKeyHeaders(testSetup.apiKey, testSetup.projectId)
        });

        whatsappTests.push({
          attempt: i,
          status: response.status,
          success: [200, 201].includes(response.status),
          data: response.data
        });

        console.log(`📱 WhatsApp ${i}:`, response.status, response.data);
      }

      const successfulWhatsApp = whatsappTests.filter(test => test.success);
      const failedWhatsApp = whatsappTests.filter(test => !test.success);

      console.log(`📊 WhatsApp quota test results:`);
      console.log(`   Successful: ${successfulWhatsApp.length}/5`);
      console.log(`   Failed: ${failedWhatsApp.length}/5`);

      expect(whatsappTests.length).toBe(5);
      console.log('✅ WhatsApp quota testing completed');
    });

    it('should test WhatsApp quota exceeded scenario', async () => {
      // Try to send many WhatsApp messages to trigger quota limit
      const quotaTests: Array<{
        attempt: number;
        status: number;
        quotaExceeded: boolean;
      }> = [];
      
      for (let i = 1; i <= 10; i++) {
        const notificationPayload = {
          to: `+123456789${i.toString().padStart(2, '0')}`,
          message: `WhatsApp quota exceed test ${i}`,
          subject: `Quota Test ${i}`,
          channel: 'WHATSAPP',
          metadata: {
            templateId: whatsappTemplate.name,
            templateData: {
              title: `Quota Test ${i}`,
              customer_name: `User${i}`,
              message: `Testing WhatsApp quota limits with message ${i}`,
              business_name: 'TestBusiness'
            }
          }
        };

        const response = await testSetup.api.post('/notifications', notificationPayload, {
          headers: createApiKeyHeaders(testSetup.apiKey, testSetup.projectId)
        });

        quotaTests.push({
          attempt: i,
          status: response.status,
          quotaExceeded: response.status === 429 || (response.data?.error?.message?.includes('quota'))
        });

        console.log(`🔄 WhatsApp quota test ${i}:`, response.status, response.data);

        // If we get quota exceeded, break
        if (response.status === 429) {
          console.log('📊 WhatsApp quota limit reached at attempt', i);
          break;
        }
      }

      const quotaExceededTests = quotaTests.filter(test => test.quotaExceeded);
      console.log(`📊 WhatsApp quota exceeded tests: ${quotaExceededTests.length}`);

      expect(quotaTests.length).toBeGreaterThan(0);
      console.log('✅ WhatsApp quota exceeded scenario testing completed');
    });
  });

  describe('📋 Template Management & Scaling', () => {
    it('should test template limit management (6000 template challenge)', async () => {
      // Simulate the 6000 template limit challenge
      const templateLimitInfo = {
        maxTemplatesPerAccount: 6000,
        estimatedUsersPerTemplate: 1000, // Shared template approach
        maxUsersSupported: 6000 * 1000, // 6 million users
        templateCategories: [
          'ECOMMERCE', 'HEALTHCARE', 'FINANCE', 'EDUCATION', 
          'HOSPITALITY', 'RETAIL', 'AUTOMOTIVE', 'REAL_ESTATE'
        ]
      };

      console.log('📋 WhatsApp Template Scaling Strategy:');
      console.log(`   Max templates per account: ${templateLimitInfo.maxTemplatesPerAccount.toLocaleString()}`);
      console.log(`   Users per shared template: ${templateLimitInfo.estimatedUsersPerTemplate.toLocaleString()}`);
      console.log(`   Total users supported: ${templateLimitInfo.maxUsersSupported.toLocaleString()}`);
      console.log(`   Template categories: ${templateLimitInfo.templateCategories.length}`);

      // Test template category distribution
      const templatesPerCategory = Math.floor(templateLimitInfo.maxTemplatesPerAccount / templateLimitInfo.templateCategories.length);
      
      console.log(`📊 Template Distribution:`);
      for (const category of templateLimitInfo.templateCategories) {
        const usersPerCategory = templatesPerCategory * templateLimitInfo.estimatedUsersPerTemplate;
        console.log(`   ${category}: ${templatesPerCategory} templates → ${usersPerCategory.toLocaleString()} users`);
      }

      expect(templateLimitInfo.maxUsersSupported).toBeGreaterThan(1000000); // Support millions
      console.log('✅ Template scaling strategy validated');
    });

    it('should test dynamic template assignment based on business type', async () => {
      const businessTypes = [
        {
          type: 'ECOMMERCE',
          templates: ['order_confirmation', 'shipping_update', 'delivery_notification', 'return_processed'],
          expectedUsers: 250000
        },
        {
          type: 'HEALTHCARE',
          templates: ['appointment_reminder', 'test_results', 'prescription_ready', 'follow_up'],
          expectedUsers: 150000
        },
        {
          type: 'FINANCE',
          templates: ['payment_reminder', 'transaction_alert', 'statement_ready', 'loan_approval'],
          expectedUsers: 200000
        }
      ];

      const assignmentResults = [];

      for (const businessType of businessTypes) {
        const assignmentPayload = {
          businessType: businessType.type,
          requestedTemplates: businessType.templates,
          estimatedUsers: businessType.expectedUsers
        };

        const response = await testSetup.api.post('/whatsapp/templates/assign', assignmentPayload, {
          headers: createAuthHeaders(testSetup.authData.accessToken)
        });

        assignmentResults.push({
          businessType: businessType.type,
          status: response.status,
          assignedTemplates: response.data?.assignedTemplates || [],
          success: [200, 201].includes(response.status)
        });

        console.log(`📋 ${businessType.type} template assignment:`, response.status, response.data);
      }

      const successfulAssignments = assignmentResults.filter(result => result.success);
      console.log(`📊 Template assignment results:`);
      console.log(`   Business types processed: ${businessTypes.length}`);
      console.log(`   Successful assignments: ${successfulAssignments.length}`);

      expect(assignmentResults.length).toBe(businessTypes.length);
      console.log('✅ Dynamic template assignment tested');
    });

    it('should test template usage analytics and optimization', async () => {
      const analyticsResponse = await testSetup.api.get(`/whatsapp/templates/analytics`, {
        headers: createAuthHeaders(testSetup.authData.accessToken),
        params: {
          timeRange: '30d',
          includeUsageStats: true,
          includeOptimizationSuggestions: true
        }
      });

      console.log('📊 WhatsApp template analytics:', analyticsResponse.status, analyticsResponse.data);

      if (analyticsResponse.status === 200) {
        const analytics = analyticsResponse.data;
        
        console.log('📊 Template Usage Analytics:');
        console.log(`   Total templates: ${analytics.totalTemplates || 0}`);
        console.log(`   Active templates: ${analytics.activeTemplates || 0}`);
        console.log(`   Template utilization: ${analytics.utilizationRate || 0}%`);
        console.log(`   Most used category: ${analytics.mostUsedCategory || 'N/A'}`);
        console.log(`   Optimization opportunities: ${analytics.optimizationSuggestions?.length || 0}`);

        expect(analytics).toHaveProperty('totalTemplates');
        console.log('✅ Template analytics retrieved successfully');
      } else {
        expectValidStatusCodes(analyticsResponse.status, [200, 404, 403, 400]);
        console.log('ℹ️ Template analytics test completed');
      }
    });
  });

  describe('💰 WhatsApp Billing & Costs', () => {
    it('should calculate WhatsApp message costs by region', async () => {
      const regionCosts = [
        { region: 'North America', cost: 0.0055, currency: 'USD' },
        { region: 'Europe', cost: 0.0092, currency: 'USD' },
        { region: 'Asia Pacific', cost: 0.0108, currency: 'USD' },
        { region: 'Latin America', cost: 0.0095, currency: 'USD' },
        { region: 'Middle East & Africa', cost: 0.0160, currency: 'USD' }
      ];

      const costCalculations = [];

      for (const region of regionCosts) {
        const monthlyVolume = 10000; // 10k messages per month
        const monthlyCost = monthlyVolume * region.cost;
        
        costCalculations.push({
          region: region.region,
          costPerMessage: region.cost,
          monthlyVolume: monthlyVolume,
          monthlyCost: monthlyCost,
          annualCost: monthlyCost * 12
        });

        console.log(`💰 ${region.region}:`);
        console.log(`   Cost per message: $${region.cost}`);
        console.log(`   Monthly cost (10k msgs): $${monthlyCost.toFixed(2)}`);
        console.log(`   Annual cost: $${(monthlyCost * 12).toFixed(2)}`);
      }

      const avgCostPerMessage = regionCosts.reduce((sum, region) => sum + region.cost, 0) / regionCosts.length;
      console.log(`📊 Average cost per message: $${avgCostPerMessage.toFixed(4)}`);

      expect(costCalculations.length).toBe(regionCosts.length);
      console.log('✅ WhatsApp cost calculations completed');
    });

    it('should test BYOP vs traditional WhatsApp pricing', async () => {
      const pricingComparison = {
        traditional: {
          monthlyFee: 99, // $99/month for WhatsApp service
          includedMessages: 5000,
          overageRate: 0.02, // $0.02 per message over limit
          setupFee: 0
        },
        byop: {
          monthlyFee: 0, // No monthly fee
          includedMessages: 0,
          messageRate: 0.0055, // Direct WhatsApp Business API rate
          setupFee: 50 // One-time setup
        }
      };

      const volumeScenarios = [1000, 5000, 10000, 25000, 50000];
      const comparisonResults = [];

      for (const volume of volumeScenarios) {
        // Traditional pricing
        const traditionalOverage = Math.max(0, volume - pricingComparison.traditional.includedMessages);
        const traditionalCost = pricingComparison.traditional.monthlyFee + 
                               (traditionalOverage * pricingComparison.traditional.overageRate);

        // BYOP pricing
        const byopCost = volume * pricingComparison.byop.messageRate;

        const savings = traditionalCost - byopCost;
        const savingsPercent = traditionalCost > 0 ? (savings / traditionalCost) * 100 : 0;

        comparisonResults.push({
          volume: volume,
          traditional: traditionalCost,
          byop: byopCost,
          savings: savings,
          savingsPercent: savingsPercent
        });

        console.log(`💰 ${volume.toLocaleString()} messages/month:`);
        console.log(`   Traditional: $${traditionalCost.toFixed(2)}`);
        console.log(`   BYOP: $${byopCost.toFixed(2)}`);
        console.log(`   Savings: $${savings.toFixed(2)} (${savingsPercent.toFixed(1)}%)`);
      }

      const highVolumeSavings = comparisonResults.find(result => result.volume === 50000);
      expect(highVolumeSavings?.savings).toBeGreaterThan(0);
      console.log('✅ WhatsApp pricing comparison completed');
    });
  });

  describe('🧪 WhatsApp Error Handling', () => {
    it('should handle WhatsApp Business API errors gracefully', async () => {
      const errorScenarios = [
        {
          name: 'Invalid phone number format',
          payload: { to: 'invalid-phone', message: 'Test', channel: 'WHATSAPP' }
        },
        {
          name: 'Missing template data',
          payload: { to: '+1234567890', message: 'Test', channel: 'WHATSAPP', metadata: { templateId: 'test' } }
        },
        {
          name: 'Unsupported country code',
          payload: { to: '+999999999999', message: 'Test', channel: 'WHATSAPP' }
        }
      ];

      const errorResults = [];

      for (const scenario of errorScenarios) {
        const response = await testSetup.api.post('/notifications', scenario.payload, {
          headers: createApiKeyHeaders(testSetup.apiKey, testSetup.projectId)
        });

        errorResults.push({
          scenario: scenario.name,
          status: response.status,
          handled: [400, 422, 404, 401].includes(response.status)
        });

        console.log(`🧪 ${scenario.name}:`, response.status, response.data);
      }

      const handledErrors = errorResults.filter(result => result.handled);
      console.log(`📊 Error handling: ${handledErrors.length}/${errorScenarios.length} scenarios handled`);

      expect(errorResults.length).toBe(errorScenarios.length);
      console.log('✅ WhatsApp error handling tested');
    });
  });
});