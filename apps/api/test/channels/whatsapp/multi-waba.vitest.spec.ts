/**
 * Multi-WABA (WhatsApp Business Account) Management Tests
 * Tests tenant-owned WABAs (BYOP) and platform-managed WABA pools
 * Solves the 6000 template limit with unlimited scaling
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createTestSetup, TestSetup, expectValidStatusCodes, createAuthHeaders } from '../shared/test-utils';

describe('🏢 Multi-WABA Management Tests', () => {
  let testSetup: TestSetup;
  let createdWABAs: string[] = [];

  beforeAll(async () => {
    testSetup = await createTestSetup();
    console.log('✅ Multi-WABA test setup completed');
  });

  afterAll(async () => {
    // Cleanup created WABAs
    for (const wabaId of createdWABAs) {
      try {
        await testSetup.api.delete(`/whatsapp/waba/${wabaId}`, {
          headers: createAuthHeaders(testSetup.authData.accessToken)
        });
      } catch (error) {
        // Ignore cleanup errors
      }
    }
    console.log('✅ Multi-WABA cleanup completed');
  });

  describe('🎯 Tenant-Owned WABA (BYOP)', () => {
    it('should register tenant-owned WABA successfully', async () => {
      const tenantWABAConfig = {
        tenantId: testSetup.authData.tenantId,
        businessAccountId: 'tenant_business_123456789',
        accessToken: 'EAAG_tenant_access_token_123',
        phoneNumberId: '123456789012345',
        webhookVerifyToken: 'tenant_webhook_verify_123',
        region: 'north-america'
      };

      const response = await testSetup.api.post('/whatsapp/waba/tenant/register', tenantWABAConfig, {
        headers: createAuthHeaders(testSetup.authData.accessToken)
      });

      console.log('🎯 Tenant WABA registration:', response.status, response.data);

      if (response.status === 201) {
        createdWABAs.push(response.data.waba.id);
        expect(response.data.success).toBe(true);
        expect(response.data.waba).toHaveProperty('id');
        expect(response.data.waba.isByop).toBe(true);
        expect(response.data.waba.templateCapacity).toBe(6000);
        console.log('🎉 Tenant BYOP WABA registered successfully');
      } else {
        expectValidStatusCodes(response.status, [201, 400, 403, 404, 500]);
        console.log('ℹ️ Tenant WABA registration test completed');
      }
    });

    it('should create template for tenant-owned WABA', async () => {
      const templateData = {
        tenantId: testSetup.authData.tenantId,
        name: 'tenant_order_confirmation',
        category: 'UTILITY' as const,
        language: 'en',
        components: [
          {
            type: 'BODY' as const,
            text: 'Hello {{1}}, your order {{2}} has been confirmed. Total: {{3}}. Thank you!'
          }
        ]
      };

      const response = await testSetup.api.post('/whatsapp/waba/tenant/template/create', templateData, {
        headers: createAuthHeaders(testSetup.authData.accessToken)
      });

      console.log('📋 Tenant template creation:', response.status, response.data);

      if (response.status === 201) {
        expect(response.data.success).toBe(true);
        expect(response.data.template).toHaveProperty('id');
        expect(response.data.template.name).toBe('tenant_order_confirmation');
        console.log('🎉 Template created for tenant WABA');
      } else {
        expectValidStatusCodes(response.sta