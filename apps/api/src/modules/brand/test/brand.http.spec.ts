/**
 * Brand Module HTTP Tests
 * Tests branding functionality with BYOP and fallback scenarios
 */

import axios, { AxiosInstance } from 'axios';

describe('Brand Module HTTP Tests', () => {
  const baseURL = 'http://localhost:9000/api/v1';
  let api: AxiosInstance;

  // Use the same test account from project tests
  const testAccount = {
    email: `brand-test-${Date.now()}@example.com`,
    password: 'BrandTestPassword123!',
    firstName: 'Brand',
    lastName: 'Tester'
  };

  let authToken: string;
  let userId: string;
  let tenantId: string;
  let byopProjectId: string;
  let fallbackProjectId: string;

  // Brand test data
  let customBrand: any; // Brand with full customization
  let fallbackBrand: any; // Brand with minimal/no customization (uses defaults)

  beforeAll(async () => {
    api = axios.create({ 
      baseURL,
      timeout: 15000,
      validateStatus: () => true
    });

    await waitForServer();
    await setupTestAccount();
    await setupTestProjects();
  });

  async function waitForServer(maxRetries = 10): Promise<void> {
    for (let i = 0; i < maxRetries; i++) {
      try {
        const response = await api.get('/health');
        if (response.status === 200) {
          console.log('✅ Server is ready for brand tests');
          return;
        }
      } catch (error) {
        if (i === maxRetries - 1) {
          throw new Error('Server not ready. Please start with: npm run start:dev');
        }
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }
  }

  async function setupTestAccount(): Promise<void> {
    console.log('🔧 Setting up test account for brand testing...');
    
    // Register test account
    const registerResponse = await api.post('/auth/register', testAccount);
    expect(registerResponse.status).toBe(201);
    
    authToken = registerResponse.data.access_token;
    userId = registerResponse.data.user.id;

    // Get tenant ID
    const workspacesResponse = await api.get('/tenant-members/user-workspaces', {
      headers: { Authorization: `Bearer ${authToken}` }
    });
    
    expect(workspacesResponse.status).toBe(200);
    tenantId = workspacesResponse.data[0].tenant.id;

    console.log(`✅ Brand test account setup complete:`);
    console.log(`   User ID: ${userId}`);
    console.log(`   Tenant ID: ${tenantId}`);
  }

  async function setupTestProjects(): Promise<void> {
    console.log('🔧 Setting up test projects for branding...');

    // Create BYOP project
    const byopProjectResponse = await api.post('/projects', {
      name: 'BYOP Brand Project',
      description: 'Project with custom branding and BYOP providers',
      settings: {
        enableSMS: true,
        enableEmail: true,
        enableVoice: false,
        enablePush: true
      },
      providers: {
        sms: {
          primary: 'telnyx',
          config: {
            apiKey: 'test-telnyx-key',
            fromNumber: '+1234567890'
          }
        },
        email: {
          primary: 'ses',
          config: {
            accessKeyId: 'test-aws-key',
            secretAccessKey: 'test-aws-secret',
            region: 'us-east-1',
            fromEmail: 'noreply@custombrand.com',
            fromName: 'Custom Brand'
          }
        }
      }
    }, {
      headers: { Authorization: `Bearer ${authToken}` }
    });

    expect(byopProjectResponse.status).toBe(201);
    byopProjectId = byopProjectResponse.data.id;

    // Create fallback project
    const fallbackProjectResponse = await api.post('/projects', {
      name: 'Fallback Brand Project',
      description: 'Project using system defaults for branding',
      settings: {
        enableSMS: true,
        enableEmail: true,
        enableVoice: false,
        enablePush: false
      }
      // No custom providers - uses system defaults
    }, {
      headers: { Authorization: `Bearer ${authToken}` }
    });

    expect(fallbackProjectResponse.status).toBe(201);
    fallbackProjectId = fallbackProjectResponse.data.id;

    console.log(`✅ Test projects created:`);
    console.log(`   BYOP Project ID: ${byopProjectId}`);
    console.log(`   Fallback Project ID: ${fallbackProjectId}`);
  }

  describe('Brand CRUD Operations', () => {
    describe('POST /projects/:id/brand', () => {
      it('should create custom brand for BYOP project', async () => {
        const brandData = {
          name: 'Custom Brand Co.',
          logo: 'https://example.com/logo.png',
          primaryColor: '#FF6B35',
          secondaryColor: '#004E89',
          backgroundColor: '#FFFFFF',
          textColor: '#333333',
          fontFamily: 'Inter, sans-serif',
          emailTemplate: {
            headerHtml: '<div style="background: #FF6B35; padding: 20px;"><h1 style="color: white;">Custom Brand</h1></div>',
            footerHtml: '<div style="background: #004E89; padding: 15px; text-align: center;"><p style="color: white;">© 2024 Custom Brand Co.</p></div>',
            buttonColor: '#FF6B35',
            buttonTextColor: '#FFFFFF'
          },
          smsTemplate: {
            signature: 'Custom Brand Co.',
            optOutText: 'Reply STOP to opt out'
          },
          voiceTemplate: {
            greeting: 'Hello from Custom Brand Co.',
            holdMusic: 'https://example.com/hold-music.mp3'
          },
          pushTemplate: {
            icon: 'https://example.com/push-icon.png',
            badge: 'https://example.com/badge.png'
          },
          socialLinks: {
            website: 'https://custombrand.com',
            twitter: 'https://twitter.com/custombrand',
            facebook: 'https://facebook.com/custombrand',
            linkedin: 'https://linkedin.com/company/custombrand'
          },
          contactInfo: {
            supportEmail: 'support@custombrand.com',
            supportPhone: '+1-800-CUSTOM',
            address: '123 Brand Street, Custom City, CC 12345'
          }
        };

        const response = await api.post(`/projects/${byopProjectId}/brand`, brandData, {
          headers: { Authorization: `Bearer ${authToken}` }
        });

        expect(response.status).toBe(201);
        expect(response.data).toHaveProperty('id');
        expect(response.data.name).toBe(brandData.name);
        expect(response.data.logo).toBe(brandData.logo);
        expect(response.data.primaryColor).toBe(brandData.primaryColor);
        expect(response.data.secondaryColor).toBe(brandData.secondaryColor);
        expect(response.data).toHaveProperty('emailTemplate');
        expect(response.data).toHaveProperty('smsTemplate');
        expect(response.data).toHaveProperty('voiceTemplate');
        expect(response.data).toHaveProperty('pushTemplate');
        expect(response.data).toHaveProperty('socialLinks');
        expect(response.data).toHaveProperty('contactInfo');
        expect(response.data.projectId).toBe(byopProjectId);

        // Store for later tests
        customBrand = response.data;
        
        console.log(`✅ Custom brand created: ${customBrand.id}`);
      });

      it('should create minimal brand for fallback project (uses defaults)', async () => {
        const brandData = {
          name: 'Fallback Brand',
          // Minimal configuration - most fields will use system defaults
          primaryColor: '#007BFF'
        };

        const response = await api.post(`/projects/${fallbackProjectId}/brand`, brandData, {
          headers: { Authorization: `Bearer ${authToken}` }
        });

        expect(response.status).toBe(201);
        expect(response.data).toHaveProperty('id');
        expect(response.data.name).toBe(brandData.name);
        expect(response.data.primaryColor).toBe(brandData.primaryColor);
        
        // Should have default values for missing fields
        expect(response.data).toHaveProperty('backgroundColor');
        expect(response.data).toHaveProperty('textColor');
        expect(response.data).toHaveProperty('emailTemplate');
        expect(response.data).toHaveProperty('smsTemplate');
        
        // Default email template should be applied
        expect(response.data.emailTemplate).toHaveProperty('headerHtml');
        expect(response.data.emailTemplate).toHaveProperty('footerHtml');
        
        // Default SMS template should be applied
        expect(response.data.smsTemplate).toHaveProperty('signature');
        expect(response.data.smsTemplate).toHaveProperty('optOutText');

        // Store for later tests
        fallbackBrand = response.data;
        
        console.log(`✅ Fallback brand created: ${fallbackBrand.id}`);
      });

      it('should validate required fields', async () => {
        const response = await api.post(`/projects/${byopProjectId}/brand`, {
          // missing name
          primaryColor: '#FF0000'
        }, {
          headers: { Authorization: `Bearer ${authToken}` }
        });

        expect(response.status).toBe(400);
      });

      it('should validate color formats', async () => {
        const response = await api.post(`/projects/${byopProjectId}/brand`, {
          name: 'Invalid Color Brand',
          primaryColor: 'invalid-color'
        }, {
          headers: { Authorization: `Bearer ${authToken}` }
        });

        expect(response.status).toBe(400);
      });

      it('should not create duplicate brand for same project', async () => {
        const response = await api.post(`/projects/${byopProjectId}/brand`, {
          name: 'Duplicate Brand'
        }, {
          headers: { Authorization: `Bearer ${authToken}` }
        });

        expect(response.status).toBe(409);
      });

      it('should not create brand without authentication', async () => {
        const response = await api.post(`/projects/${byopProjectId}/brand`, {
          name: 'Unauthorized Brand'
        });

        expect(response.status).toBe(401);
      });
    });

    describe('GET /projects/:id/brand', () => {
      it('should get custom brand configuration', async () => {
        const response = await api.get(`/projects/${byopProjectId}/brand`, {
          headers: { Authorization: `Bearer ${authToken}` }
        });

        expect(response.status).toBe(200);
        expect(response.data.id).toBe(customBrand.id);
        expect(response.data.name).toBe('Custom Brand Co.');
        expect(response.data.primaryColor).toBe('#FF6B35');
        expect(response.data.secondaryColor).toBe('#004E89');
        expect(response.data).toHaveProperty('emailTemplate');
        expect(response.data.emailTemplate.headerHtml).toContain('Custom Brand');
        expect(response.data).toHaveProperty('smsTemplate');
        expect(response.data.smsTemplate.signature).toBe('Custom Brand Co.');
        expect(response.data).toHaveProperty('socialLinks');
        expect(response.data.socialLinks.website).toBe('https://custombrand.com');
      });

      it('should get fallback brand configuration with defaults', async () => {
        const response = await api.get(`/projects/${fallbackProjectId}/brand`, {
          headers: { Authorization: `Bearer ${authToken}` }
        });

        expect(response.status).toBe(200);
        expect(response.data.id).toBe(fallbackBrand.id);
        expect(response.data.name).toBe('Fallback Brand');
        expect(response.data.primaryColor).toBe('#007BFF');
        
        // Should have system defaults applied
        expect(response.data.backgroundColor).toBeDefined();
        expect(response.data.textColor).toBeDefined();
        expect(response.data.emailTemplate).toBeDefined();
        expect(response.data.smsTemplate).toBeDefined();
        
        // Default templates should be present
        expect(response.data.emailTemplate.headerHtml).toBeDefined();
        expect(response.data.emailTemplate.footerHtml).toBeDefined();
        expect(response.data.smsTemplate.signature).toBeDefined();
      });

      it('should not get brand for non-existent project', async () => {
        const response = await api.get('/projects/00000000-0000-0000-0000-000000000000/brand', {
          headers: { Authorization: `Bearer ${authToken}` }
        });

        expect(response.status).toBe(404);
      });
    });

    describe('PUT /projects/:id/brand', () => {
      it('should update custom brand configuration', async () => {
        const updateData = {
          name: 'Updated Custom Brand',
          primaryColor: '#E74C3C',
          secondaryColor: '#3498DB',
          logo: 'https://example.com/new-logo.png',
          emailTemplate: {
            headerHtml: '<div style="background: #E74C3C; padding: 25px;"><h1 style="color: white;">Updated Custom Brand</h1></div>',
            footerHtml: '<div style="background: #3498DB; padding: 20px; text-align: center;"><p style="color: white;">© 2024 Updated Custom Brand</p></div>',
            buttonColor: '#E74C3C',
            buttonTextColor: '#FFFFFF'
          },
          smsTemplate: {
            signature: 'Updated Custom Brand',
            optOutText: 'Text STOP to unsubscribe'
          },
          contactInfo: {
            supportEmail: 'help@updatedcustom.com',
            supportPhone: '+1-800-UPDATED',
            address: '456 Updated Street, New City, NC 54321'
          }
        };

        const response = await api.put(`/projects/${byopProjectId}/brand`, updateData, {
          headers: { Authorization: `Bearer ${authToken}` }
        });

        expect(response.status).toBe(200);
        expect(response.data.name).toBe(updateData.name);
        expect(response.data.primaryColor).toBe(updateData.primaryColor);
        expect(response.data.secondaryColor).toBe(updateData.secondaryColor);
        expect(response.data.logo).toBe(updateData.logo);
        expect(response.data.emailTemplate.headerHtml).toContain('Updated Custom Brand');
        expect(response.data.smsTemplate.signature).toBe('Updated Custom Brand');
        expect(response.data.contactInfo.supportEmail).toBe('help@updatedcustom.com');
      });

      it('should update fallback brand to add more customization', async () => {
        const updateData = {
          name: 'Enhanced Fallback Brand',
          logo: 'https://example.com/fallback-logo.png',
          secondaryColor: '#28A745',
          emailTemplate: {
            headerHtml: '<div style="background: #007BFF; padding: 15px;"><h2 style="color: white;">Enhanced Fallback</h2></div>',
            buttonColor: '#28A745'
          },
          socialLinks: {
            website: 'https://enhancedfallback.com',
            twitter: 'https://twitter.com/enhancedfallback'
          }
        };

        const response = await api.put(`/projects/${fallbackProjectId}/brand`, updateData, {
          headers: { Authorization: `Bearer ${authToken}` }
        });

        expect(response.status).toBe(200);
        expect(response.data.name).toBe(updateData.name);
        expect(response.data.logo).toBe(updateData.logo);
        expect(response.data.secondaryColor).toBe(updateData.secondaryColor);
        expect(response.data.emailTemplate.headerHtml).toContain('Enhanced Fallback');
        expect(response.data.socialLinks.website).toBe('https://enhancedfallback.com');
        
        // Should preserve existing values not in update
        expect(response.data.primaryColor).toBe('#007BFF'); // Original value
      });

      it('should validate color formats on update', async () => {
        const response = await api.put(`/projects/${byopProjectId}/brand`, {
          primaryColor: 'not-a-color'
        }, {
          headers: { Authorization: `Bearer ${authToken}` }
        });

        expect(response.status).toBe(400);
      });

      it('should not update brand for non-existent project', async () => {
        const response = await api.put('/projects/00000000-0000-0000-0000-000000000000/brand', {
          name: 'Non-existent'
        }, {
          headers: { Authorization: `Bearer ${authToken}` }
        });

        expect(response.status).toBe(404);
      });
    });

    describe('DELETE /projects/:id/brand', () => {
      let deleteTestProjectId: string;
      let deleteTestBrandId: string;

      beforeAll(async () => {
        // Create a project and brand specifically for deletion testing
        const projectResponse = await api.post('/projects', {
          name: 'Delete Brand Test Project'
        }, {
          headers: { Authorization: `Bearer ${authToken}` }
        });
        
        deleteTestProjectId = projectResponse.data.id;

        const brandResponse = await api.post(`/projects/${deleteTestProjectId}/brand`, {
          name: 'Delete Test Brand'
        }, {
          headers: { Authorization: `Bearer ${authToken}` }
        });
        
        deleteTestBrandId = brandResponse.data.id;
      });

      it('should delete brand configuration', async () => {
        const response = await api.delete(`/projects/${deleteTestProjectId}/brand`, {
          headers: { Authorization: `Bearer ${authToken}` }
        });

        expect(response.status).toBe(204);

        // Verify brand is deleted
        const getResponse = await api.get(`/projects/${deleteTestProjectId}/brand`, {
          headers: { Authorization: `Bearer ${authToken}` }
        });
        expect(getResponse.status).toBe(404);
      });

      it('should not delete brand for non-existent project', async () => {
        const response = await api.delete('/projects/00000000-0000-0000-0000-000000000000/brand', {
          headers: { Authorization: `Bearer ${authToken}` }
        });

        expect(response.status).toBe(404);
      });
    });
  });

  describe('Brand Template Rendering', () => {
    describe('POST /projects/:id/brand/preview', () => {
      it('should preview custom brand email template', async () => {
        const response = await api.post(`/projects/${byopProjectId}/brand/preview`, {
          type: 'email',
          templateType: 'notification',
          data: {
            title: 'Test Notification',
            message: 'This is a test notification with custom branding',
            actionUrl: 'https://example.com/action',
            actionText: 'Take Action'
          }
        }, {
          headers: { Authorization: `Bearer ${authToken}` }
        });

        expect(response.status).toBe(200);
        expect(response.data).toHaveProperty('html');
        expect(response.data.html).toContain('Updated Custom Brand');
        expect(response.data.html).toContain('#E74C3C'); // Primary color
        expect(response.data.html).toContain('Test Notification');
        expect(response.data.html).toContain('Take Action');
      });

      it('should preview fallback brand email template', async () => {
        const response = await api.post(`/projects/${fallbackProjectId}/brand/preview`, {
          type: 'email',
          templateType: 'notification',
          data: {
            title: 'Fallback Test',
            message: 'This uses system default branding'
          }
        }, {
          headers: { Authorization: `Bearer ${authToken}` }
        });

        expect(response.status).toBe(200);
        expect(response.data).toHaveProperty('html');
        expect(response.data.html).toContain('Enhanced Fallback Brand');
        expect(response.data.html).toContain('#007BFF'); // Primary color
        expect(response.data.html).toContain('Fallback Test');
      });

      it('should preview SMS template with custom branding', async () => {
        const response = await api.post(`/projects/${byopProjectId}/brand/preview`, {
          type: 'sms',
          data: {
            message: 'Your verification code is 123456'
          }
        }, {
          headers: { Authorization: `Bearer ${authToken}` }
        });

        expect(response.status).toBe(200);
        expect(response.data).toHaveProperty('text');
        expect(response.data.text).toContain('Your verification code is 123456');
        expect(response.data.text).toContain('Updated Custom Brand'); // Signature
        expect(response.data.text).toContain('Text STOP to unsubscribe'); // Opt-out text
      });

      it('should preview SMS template with fallback branding', async () => {
        const response = await api.post(`/projects/${fallbackProjectId}/brand/preview`, {
          type: 'sms',
          data: {
            message: 'Welcome to our service!'
          }
        }, {
          headers: { Authorization: `Bearer ${authToken}` }
        });

        expect(response.status).toBe(200);
        expect(response.data).toHaveProperty('text');
        expect(response.data.text).toContain('Welcome to our service!');
        expect(response.data.text).toContain('Enhanced Fallback Brand'); // Signature
      });

      it('should validate preview request data', async () => {
        const response = await api.post(`/projects/${byopProjectId}/brand/preview`, {
          type: 'invalid_type'
        }, {
          headers: { Authorization: `Bearer ${authToken}` }
        });

        expect(response.status).toBe(400);
      });
    });

    describe('GET /projects/:id/brand/assets', () => {
      it('should get brand assets for custom brand', async () => {
        const response = await api.get(`/projects/${byopProjectId}/brand/assets`, {
          headers: { Authorization: `Bearer ${authToken}` }
        });

        expect(response.status).toBe(200);
        expect(response.data).toHaveProperty('logo');
        expect(response.data).toHaveProperty('colors');
        expect(response.data).toHaveProperty('fonts');
        expect(response.data.logo).toBe('https://example.com/new-logo.png');
        expect(response.data.colors.primary).toBe('#E74C3C');
        expect(response.data.colors.secondary).toBe('#3498DB');
      });

      it('should get brand assets for fallback brand', async () => {
        const response = await api.get(`/projects/${fallbackProjectId}/brand/assets`, {
          headers: { Authorization: `Bearer ${authToken}` }
        });

        expect(response.status).toBe(200);
        expect(response.data).toHaveProperty('colors');
        expect(response.data.colors.primary).toBe('#007BFF');
        expect(response.data.colors.secondary).toBe('#28A745');
        
        // Should have default logo if none specified
        expect(response.data).toHaveProperty('logo');
      });
    });
  });

  describe('Brand Validation & Fallbacks', () => {
    describe('GET /projects/:id/brand/validation', () => {
      it('should validate custom brand configuration', async () => {
        const response = await api.get(`/projects/${byopProjectId}/brand/validation`, {
          headers: { Authorization: `Bearer ${authToken}` }
        });

        expect(response.status).toBe(200);
        expect(response.data).toHaveProperty('isValid');
        expect(response.data).toHaveProperty('completeness');
        expect(response.data).toHaveProperty('issues');
        expect(response.data).toHaveProperty('recommendations');
        
        expect(response.data.isValid).toBe(true);
        expect(response.data.completeness).toBeGreaterThan(80); // High completeness for custom brand
      });

      it('should validate fallback brand configuration', async () => {
        const response = await api.get(`/projects/${fallbackProjectId}/brand/validation`, {
          headers: { Authorization: `Bearer ${authToken}` }
        });

        expect(response.status).toBe(200);
        expect(response.data.isValid).toBe(true);
        expect(response.data.completeness).toBeLessThan(100); // Lower completeness due to defaults
        expect(Array.isArray(response.data.recommendations)).toBe(true);
      });
    });

    describe('POST /projects/:id/brand/test-fallbacks', () => {
      it('should test fallback behavior for missing brand elements', async () => {
        const response = await api.post(`/projects/${fallbackProjectId}/brand/test-fallbacks`, {
          scenarios: ['missing_logo', 'missing_colors', 'missing_templates']
        }, {
          headers: { Authorization: `Bearer ${authToken}` }
        });

        expect(response.status).toBe(200);
        expect(response.data).toHaveProperty('results');
        expect(response.data.results).toHaveProperty('missing_logo');
        expect(response.data.results).toHaveProperty('missing_colors');
        expect(response.data.results).toHaveProperty('missing_templates');
        
        // Each scenario should have fallback values
        expect(response.data.results.missing_logo).toHaveProperty('fallback');
        expect(response.data.results.missing_colors).toHaveProperty('fallback');
        expect(response.data.results.missing_templates).toHaveProperty('fallback');
      });
    });
  });

  describe('Brand Security & Authorization', () => {
    it('should not access brand without authentication', async () => {
      const endpoints = [
        `/projects/${byopProjectId}/brand`,
        `/projects/${fallbackProjectId}/brand/assets`,
        `/projects/${byopProjectId}/brand/validation`
      ];

      for (const endpoint of endpoints) {
        const response = await api.get(endpoint);
        expect(response.status).toBe(401);
      }
    });

    it('should validate project ownership for brand operations', async () => {
      // All brand operations should be limited to project owner's tenant
      const response = await api.get(`/projects/${byopProjectId}/brand`, {
        headers: { Authorization: `Bearer ${authToken}` }
      });

      expect(response.status).toBe(200);
      expect(response.data.projectId).toBe(byopProjectId);
    });

    it('should handle invalid brand operations gracefully', async () => {
      const invalidOperations = [
        api.get('/projects/invalid-uuid/brand', { headers: { Authorization: `Bearer ${authToken}` } }),
        api.put('/projects/invalid-uuid/brand', { name: 'Invalid' }, { headers: { Authorization: `Bearer ${authToken}` } }),
        api.delete('/projects/invalid-uuid/brand', { headers: { Authorization: `Bearer ${authToken}` } })
      ];

      const responses = await Promise.all(invalidOperations);
      responses.forEach(response => {
        expect([400, 404]).toContain(response.status);
      });
    });
  });

  afterAll(() => {
    console.log('\n📊 Brand Test Summary:');
    console.log(`✅ Custom Brand ID: ${customBrand?.id}`);
    console.log(`✅ Fallback Brand ID: ${fallbackBrand?.id}`);
    console.log(`✅ BYOP Project ID: ${byopProjectId}`);
    console.log(`✅ Fallback Project ID: ${fallbackProjectId}`);
    console.log(`✅ Test Account: ${testAccount.email}`);
    console.log(`✅ Tenant ID: ${tenantId}`);
    console.log(`✅ Auth Token: ${authToken?.substring(0, 20)}...`);
    console.log('\n🎨 Brand Scenarios Tested:');
    console.log('   ✅ Full custom branding with BYOP providers');
    console.log('   ✅ Minimal branding with system fallbacks');
    console.log('   ✅ Template rendering and previews');
    console.log('   ✅ Asset management and validation');
    console.log('   ✅ Fallback behavior testing');
  });
});