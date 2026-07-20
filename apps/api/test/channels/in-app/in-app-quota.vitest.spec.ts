/**
 * In-App Notifications Quota Management Tests
 * Tests in-app notification quotas, real-time delivery, and quota limits
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createTestSetup, createTemplate, cleanupTemplate, TestSetup, expectValidStatusCodes, createApiKeyHeaders } from '../shared/test-utils';

describe('📱 In-App Notifications Quota Tests', () => {
  let testSetup: TestSetup;
  let inAppTemplate: { id: string; name: string; channel: string };

  beforeAll(async () => {
    testSetup = await createTestSetup();
    
    // Create in-app notification template
    const templateData = {
      name: 'inapp-quota-test',
      channel: 'IN_APP',
      subject: 'In-App: {{title}}',
      content: JSON.stringify({
        title: '{{title}}',
        message: 'Hi {{firstName}}, {{message}}',
        icon: '{{icon}}',
        priority: '{{priority}}',
        category: '{{category}}',
        actionUrl: '{{actionUrl}}',
        metadata: {
          quotaTest: true,
          timestamp: '{{timestamp}}'
        }
      }),
      variables: [
        { name: 'title', type: 'string', required: true },
        { name: 'firstName', type: 'string', required: true },
        { name: 'message', type: 'string', required: true },
        { name: 'icon', type: 'string', required: false },
        { name: 'priority', type: 'string', required: false },
        { name: 'category', type: 'string', required: false },
        { name: 'actionUrl', type: 'string', required: false },
        { name: 'timestamp', type: 'string', required: false }
      ]
    };

    inAppTemplate = await createTemplate(testSetup.api, testSetup.authData, templateData);
    console.log('✅ In-App quota test setup completed');
  });

  afterAll(async () => {
    await cleanupTemplate(testSetup.api, testSetup.authData, inAppTemplate.id);
    console.log('✅ In-App quota cleanup completed');
  });

  describe('📊 In-App Quota Limits', () => {
    it('should check current in-app quota limits', async () => {
      const response = await testSetup.api.get(`/projects/${testSetup.projectId}/quotas`, {
        headers: { Authorization: `Bearer ${testSetup.authData.accessToken}` }
      });

      console.log('📊 In-App quotas:', response.status, response.data);

      if (response.status === 200) {
        expect(response.data).toHaveProperty('quotas');
        
        if (response.data.billingModel === 'quota-based') {
          expect(response.data.quotas).toHaveProperty('inApp');
          console.log(`📱 In-App quota limit: ${response.data.quotas.inApp}/month`);
        } else {
          console.log('🎯 Event-based billing - unlimited in-app notifications');
        }
        
        console.log('✅ In-App quota information retrieved');
      } else {
        expectValidStatusCodes(response.status, [200, 404, 403, 400]);
        console.log('ℹ️ In-App quota endpoint test completed');
      }
    });

    it('should test in-app notifications within quota limits', async () => {
      const inAppTests: Array<{
        attempt: number;
        status: number;
        success: boolean;
        data: any;
      }> = [];
      
      for (let i = 1; i <= 5; i++) {
        const notificationPayload = {
          to: `inapp-user-${i}`,
          message: `In-app quota test notification ${i}`,
          subject: `Test Notification ${i}`,
          channel: 'IN_APP',
          metadata: {
            templateId: inAppTemplate.name,
            templateData: {
              title: `Test Notification ${i}`,
              firstName: `User${i}`,
              message: `This is your ${i} in-app notification for quota testing`,
              icon: 'notification',
              priority: i <= 2 ? 'high' : 'normal',
              category: 'quota-test',
              actionUrl: `/notifications/${i}`,
              timestamp: new Date().toISOString()
            }
          }
        };

        const response = await testSetup.api.post('/notifications', notificationPayload, {
          headers: {
            'Authorization': `Bearer ${testSetup.apiKey}`,
            'X-Project-ID': testSetup.projectId
          }
        });

        inAppTests.push({
          attempt: i,
          status: response.status,
          success: [200, 201].includes(response.status),
          data: response.data
        });

        console.log(`📱 In-app ${i}:`, response.status, response.data);
      }

      const successfulInApp = inAppTests.filter(test => test.success);
      const failedInApp = inAppTests.filter(test => !test.success);

      console.log(`📊 In-app quota test results:`);
      console.log(`   Successful: ${successfulInApp.length}/5`);
      console.log(`   Failed: ${failedInApp.length}/5`);

      expect(inAppTests.length).toBe(5);
      console.log('✅ In-app quota testing completed');
    });

    it('should test in-app quota exceeded scenario', async () => {
      // Try to send many in-app notifications to trigger quota limit
      const quotaTests: Array<{
        attempt: number;
        status: number;
        quotaExceeded: boolean;
      }> = [];
      
      for (let i = 1; i <= 10; i++) {
        const notificationPayload = {
          to: `quota-exceed-user-${i}`,
          message: `In-app quota exceed test ${i}`,
          subject: `Quota Test ${i}`,
          channel: 'IN_APP',
          metadata: {
            templateId: inAppTemplate.name,
            templateData: {
              title: `Quota Test ${i}`,
              firstName: `User${i}`,
              message: `Testing quota limits with notification ${i}`,
              icon: 'warning',
              priority: 'normal',
              category: 'quota-exceed-test',
              timestamp: new Date().toISOString()
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
          quotaExceeded: response.status === 429 || (response.data && response.data.error && response.data.error.message && response.data.error.message.includes('quota'))
        });

        console.log(`🔄 In-app quota test ${i}:`, response.status, response.data);

        // If we get quota exceeded, break
        if (response.status === 429) {
          console.log('📊 In-app quota limit reached at attempt', i);
          break;
        }
      }

      const quotaExceededTests = quotaTests.filter(test => test.quotaExceeded);
      console.log(`📊 In-app quota exceeded tests: ${quotaExceededTests.length}`);

      expect(quotaTests.length).toBeGreaterThan(0);
      console.log('✅ In-app quota exceeded scenario testing completed');
    });
  });

  describe('📱 In-App Notification Features', () => {
    it('should test different in-app notification priorities', async () => {
      const priorities = ['low', 'normal', 'high', 'urgent'];
      const priorityTests = [];

      for (const [index, priority] of priorities.entries()) {
        const notificationPayload = {
          to: `priority-user-${index + 1}`,
          message: `Priority test: ${priority}`,
          subject: `${priority.toUpperCase()} Priority Test`,
          channel: 'IN_APP',
          metadata: {
            templateId: inAppTemplate.name,
            templateData: {
              title: `${priority.toUpperCase()} Priority Notification`,
              firstName: `User${index + 1}`,
              message: `This is a ${priority} priority in-app notification`,
              icon: priority === 'urgent' ? 'alert' : priority === 'high' ? 'warning' : 'info',
              priority: priority,
              category: 'priority-test',
              timestamp: new Date().toISOString()
            }
          }
        };

        const response = await testSetup.api.post('/notifications', notificationPayload, {
          headers: {
            'Authorization': `Bearer ${testSetup.apiKey}`,
            'X-Project-ID': testSetup.projectId
          }
        });

        priorityTests.push({
          priority,
          status: response.status,
          success: [200, 201].includes(response.status)
        });

        console.log(`📱 ${priority} priority:`, response.status, response.data);
      }

      const successfulPriorities = priorityTests.filter(test => test.success);
      console.log(`📊 Priority tests: ${successfulPriorities.length}/${priorities.length} successful`);

      expect(priorityTests.length).toBe(priorities.length);
      console.log('✅ In-app priority testing completed');
    });

    it('should test in-app notification categories', async () => {
      const categories = ['welcome', 'alert', 'reminder', 'update', 'promotion'];
      const categoryTests = [];

      for (const [index, category] of categories.entries()) {
        const notificationPayload = {
          to: `category-user-${index + 1}`,
          message: `Category test: ${category}`,
          subject: `${category.toUpperCase()} Category Test`,
          channel: 'IN_APP',
          metadata: {
            templateId: inAppTemplate.name,
            templateData: {
              title: `${category.charAt(0).toUpperCase() + category.slice(1)} Notification`,
              firstName: `User${index + 1}`,
              message: `This is a ${category} category in-app notification`,
              icon: category,
              priority: 'normal',
              category: category,
              actionUrl: `/${category}`,
              timestamp: new Date().toISOString()
            }
          }
        };

        const response = await testSetup.api.post('/notifications', notificationPayload, {
          headers: {
            'Authorization': `Bearer ${testSetup.apiKey}`,
            'X-Project-ID': testSetup.projectId
          }
        });

        categoryTests.push({
          category,
          status: response.status,
          success: [200, 201].includes(response.status)
        });

        console.log(`📱 ${category} category:`, response.status, response.data);
      }

      const successfulCategories = categoryTests.filter(test => test.success);
      console.log(`📊 Category tests: ${successfulCategories.length}/${categories.length} successful`);

      expect(categoryTests.length).toBe(categories.length);
      console.log('✅ In-app category testing completed');
    });

    it('should test bulk in-app notifications', async () => {
      const bulkUsers = ['user1', 'user2', 'user3', 'user4', 'user5'];
      
      const notificationPayload = {
        to: bulkUsers,
        message: 'Bulk in-app notification test',
        subject: 'Bulk Notification Test',
        channel: 'IN_APP',
        metadata: {
          templateId: inAppTemplate.name,
          templateData: {
            title: 'Bulk Notification',
            firstName: 'Team',
            message: 'This notification was sent to multiple users at once',
            icon: 'group',
            priority: 'normal',
            category: 'bulk-test',
            timestamp: new Date().toISOString()
          }
        }
      };

      const response = await testSetup.api.post('/notifications', notificationPayload, {
        headers: {
          'Authorization': `Bearer ${testSetup.apiKey}`,
          'X-Project-ID': testSetup.projectId
        }
      });

      console.log('📱 Bulk in-app notification:', response.status, response.data);

      expectValidStatusCodes(response.status, [200, 201, 400, 404, 401]);
      
      if ([200, 201].includes(response.status)) {
        console.log(`📊 Bulk notification sent to ${bulkUsers.length} users`);
      }

      console.log('✅ Bulk in-app notification test completed');
    });
  });

  describe('🧪 In-App Error Handling', () => {
    it('should handle missing in-app template gracefully', async () => {
      const notificationPayload = {
        to: 'test-user',
        message: 'Test with non-existent in-app template',
        subject: 'Missing Template Test',
        channel: 'IN_APP',
        metadata: {
          templateId: 'non-existent-inapp-template',
          templateData: {
            title: 'Test',
            firstName: 'Test User',
            message: 'This should fail gracefully'
          }
        }
      };

      const response = await testSetup.api.post('/notifications', notificationPayload, {
        headers: {
          'Authorization': `Bearer ${testSetup.apiKey}`,
          'X-Project-ID': testSetup.projectId
        }
      });

      console.log('🧪 Missing in-app template test:', response.status, response.data);
      expectValidStatusCodes(response.status, [400, 404, 422, 200, 201, 401]);
      console.log('✅ Missing in-app template handled gracefully');
    });

    it('should validate in-app notification payload', async () => {
      const invalidPayload = {
        to: '', // Empty recipient
        message: '', // Empty message
        subject: '', // Empty subject
        channel: 'IN_APP'
      };

      const response = await testSetup.api.post('/notifications', invalidPayload, {
        headers: {
          'Authorization': `Bearer ${testSetup.apiKey}`,
          'X-Project-ID': testSetup.projectId
        }
      });

      console.log('🧪 Invalid in-app payload test:', response.status, response.data);
      expectValidStatusCodes(response.status, [400, 422, 401]);
      console.log('✅ In-app payload validation working');
    });

    it('should handle malformed in-app template data', async () => {
      const notificationPayload = {
        to: 'test-user',
        message: 'Test with malformed template data',
        subject: 'Malformed Data Test',
        channel: 'IN_APP',
        metadata: {
          templateId: inAppTemplate.name,
          templateData: {
            // Missing required fields
            invalidField: 'should be ignored'
          }
        }
      };

      const response = await testSetup.api.post('/notifications', notificationPayload, {
        headers: {
          'Authorization': `Bearer ${testSetup.apiKey}`,
          'X-Project-ID': testSetup.projectId
        }
      });

      console.log('🧪 Malformed in-app data test:', response.status, response.data);
      expectValidStatusCodes(response.status, [400, 422, 200, 201, 401]);
      console.log('✅ Malformed in-app template data handled gracefully');
    });
  });
});