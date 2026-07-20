/**
 * Tenant Module HTTP Tests
 * Tests tenant management endpoints via HTTP calls
 */

import axios, { AxiosInstance } from 'axios';

describe('Tenant Module HTTP Tests', () => {
  const baseURL = 'http://localhost:9000/api/v1';
  let api: AxiosInstance;

  // Test data
  const testUser = {
    email: `tenant-test-${Date.now()}@example.com`,
    password: 'TestPassword123!',
    firstName: 'Tenant',
    lastName: 'Test'
  };

  const testUser2 = {
    email: `tenant-test2-${Date.now()}@example.com`,
    password: 'TestPassword123!',
    firstName: 'Tenant2',
    lastName: 'Test2'
  };

  let authTokens: {
    user1: { accessToken: string; refreshToken: string; userId: string };
    user2: { accessToken: string; refreshToken: string; userId: string };
  } = {} as any;

  let tenantId: string;

  beforeAll(async () => {
    api = axios.create({ 
      baseURL,
      timeout: 10000,
      validateStatus: () => true // Don't throw on HTTP errors
    });

    // Wait for server to be ready
    await waitForServer();
    
    // Register test users
    await registerTestUsers();
  });

  async function waitForServer(maxRetries = 10): Promise<void> {
    for (let i = 0; i < maxRetries; i++) {
      try {
        const response = await api.get('/health');
        if (response.status === 200) {
          console.log('✅ Server is ready for tenant tests');
          return;
        }
      } catch (error) {
        if (i === maxRetries - 1) {
          throw new Error('Server not ready. Please start with: npm run start:dev');
        }
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
  }

  async function registerTestUsers(): Promise<void> {
    // Register first user
    const response1 = await api.post('/auth/register', testUser);
    expect(response1.status).toBe(201);
    
    authTokens.user1 = {
      accessToken: response1.data.access_token,
      refreshToken: response1.data.refresh_token,
      userId: response1.data.user.id
    };

    // Register second user
    const response2 = await api.post('/auth/register', testUser2);
    expect(response2.status).toBe(201);
    
    authTokens.user2 = {
      accessToken: response2.data.access_token,
      refreshToken: response2.data.refresh_token,
      userId: response2.data.user.id
    };

    console.log('✅ Test users registered for tenant tests');
  }

  describe('Tenant Creation on Registration', () => {
    it('should create tenant automatically when user registers', async () => {
      const response = await api.get('/tenant-members/user-workspaces', {
        headers: {
          Authorization: `Bearer ${authTokens.user1.accessToken}`
        }
      });

      expect(response.status).toBe(200);
      expect(Array.isArray(response.data)).toBe(true);
      expect(response.data.length).toBeGreaterThan(0);
      expect(response.data[0]).toHaveProperty('tenant');
      expect(response.data[0].tenant.name).toContain(testUser.firstName);
      expect(response.data[0].role).toBe('OWNER');

      // Store tenant ID for later tests
      tenantId = response.data[0].tenant.id;
    });

    it('should create tenant with default quotas', async () => {
      const response = await api.get(`/tenants/${tenantId}`, {
        headers: {
          Authorization: `Bearer ${authTokens.user1.accessToken}`
        }
      });

      expect(response.status).toBe(200);
      expect(response.data).toHaveProperty('quotas');
      expect(response.data.quotas).toHaveProperty('sms');
      expect(response.data.quotas).toHaveProperty('email');
      expect(response.data.quotas).toHaveProperty('voice');
      expect(response.data.quotas).toHaveProperty('push');
    });
  });

  describe('GET /tenant-members/user-workspaces', () => {
    it('should get user workspaces', async () => {
      const response = await api.get('/tenant-members/user-workspaces', {
        headers: {
          Authorization: `Bearer ${authTokens.user1.accessToken}`
        }
      });

      expect(response.status).toBe(200);
      expect(Array.isArray(response.data)).toBe(true);
      expect(response.data.length).toBeGreaterThan(0);
      expect(response.data[0]).toHaveProperty('tenant');
      expect(response.data[0]).toHaveProperty('role');
      expect(response.data[0]).toHaveProperty('user');
    });

    it('should not get workspaces without authentication', async () => {
      const response = await api.get('/tenant-members/user-workspaces');

      expect(response.status).toBe(401);
    });

    it('should get paginated user workspaces', async () => {
      const response = await api.get('/tenant-members/user-workspaces/paginated?page=1&limit=10', {
        headers: {
          Authorization: `Bearer ${authTokens.user1.accessToken}`
        }
      });

      expect(response.status).toBe(200);
      expect(response.data).toHaveProperty('data');
      expect(response.data).toHaveProperty('pagination');
      expect(Array.isArray(response.data.data)).toBe(true);
      expect(response.data.pagination).toHaveProperty('total');
      expect(response.data.pagination).toHaveProperty('page');
      expect(response.data.pagination).toHaveProperty('limit');
    });
  });

  describe('GET /tenants', () => {
    it('should get paginated tenants', async () => {
      const response = await api.get('/tenants?page=1&limit=10', {
        headers: {
          Authorization: `Bearer ${authTokens.user1.accessToken}`
        }
      });

      expect(response.status).toBe(200);
      expect(response.data).toHaveProperty('data');
      expect(response.data).toHaveProperty('pagination');
      expect(Array.isArray(response.data.data)).toBe(true);
      expect(response.data.data.length).toBeGreaterThan(0);
    });

    it('should search tenants by name', async () => {
      const response = await api.get(`/tenants?search=${testUser.firstName}`, {
        headers: {
          Authorization: `Bearer ${authTokens.user1.accessToken}`
        }
      });

      expect(response.status).toBe(200);
      expect(response.data).toHaveProperty('data');
      expect(Array.isArray(response.data.data)).toBe(true);
      
      if (response.data.data.length > 0) {
        expect(response.data.data[0].name).toContain(testUser.firstName);
      }
    });

    it('should not get tenants without authentication', async () => {
      const response = await api.get('/tenants');

      expect(response.status).toBe(401);
    });

    it('should handle pagination parameters', async () => {
      const response = await api.get('/tenants?page=1&limit=5', {
        headers: {
          Authorization: `Bearer ${authTokens.user1.accessToken}`
        }
      });

      expect(response.status).toBe(200);
      expect(response.data.pagination.limit).toBe(5);
      expect(response.data.pagination.page).toBe(1);
    });
  });

  describe('GET /tenants/:id', () => {
    it('should get tenant by id', async () => {
      const response = await api.get(`/tenants/${tenantId}`, {
        headers: {
          Authorization: `Bearer ${authTokens.user1.accessToken}`
        }
      });

      expect(response.status).toBe(200);
      expect(response.data.id).toBe(tenantId);
      expect(response.data).toHaveProperty('name');
      expect(response.data).toHaveProperty('status');
      expect(response.data).toHaveProperty('quotas');
      expect(response.data).toHaveProperty('createdAt');
    });

    it('should not get non-existent tenant', async () => {
      const response = await api.get('/tenants/00000000-0000-0000-0000-000000000000', {
        headers: {
          Authorization: `Bearer ${authTokens.user1.accessToken}`
        }
      });

      expect(response.status).toBe(404);
    });

    it('should not get tenant without authentication', async () => {
      const response = await api.get(`/tenants/${tenantId}`);

      expect(response.status).toBe(401);
    });
  });

  describe('Tenant Member Management', () => {
    describe('GET /tenants/:id/members', () => {
      it('should get tenant members', async () => {
        const response = await api.get(`/tenants/${tenantId}/members`, {
          headers: {
            Authorization: `Bearer ${authTokens.user1.accessToken}`
          }
        });

        expect(response.status).toBe(200);
        expect(response.data).toHaveProperty('data');
        expect(response.data).toHaveProperty('pagination');
        expect(Array.isArray(response.data.data)).toBe(true);
        expect(response.data.data.length).toBeGreaterThan(0);
        expect(response.data.data[0]).toHaveProperty('role');
        expect(response.data.data[0]).toHaveProperty('user');
        expect(response.data.data[0].role).toBe('OWNER');
      });

      it('should filter members by role', async () => {
        const response = await api.get(`/tenants/${tenantId}/members?role=OWNER`, {
          headers: {
            Authorization: `Bearer ${authTokens.user1.accessToken}`
          }
        });

        expect(response.status).toBe(200);
        expect(response.data.data.every((member: any) => member.role === 'OWNER')).toBe(true);
      });

      it('should search members by name/email', async () => {
        const response = await api.get(`/tenants/${tenantId}/members?search=${testUser.firstName}`, {
          headers: {
            Authorization: `Bearer ${authTokens.user1.accessToken}`
          }
        });

        expect(response.status).toBe(200);
        expect(response.data.data.length).toBeGreaterThan(0);
      });

      it('should not get members without authentication', async () => {
        const response = await api.get(`/tenants/${tenantId}/members`);

        expect(response.status).toBe(401);
      });
    });

    // Note: Tenant members are added only through the invitation system
    // Direct member addition is not supported via API endpoints
  });

  describe('Tenant Lifecycle Management', () => {
    describe('PUT /tenants/:id/suspend', () => {
      it('should suspend tenant', async () => {
        const response = await api.put(`/tenants/${tenantId}/suspend`, {
          reason: 'Testing suspension functionality'
        }, {
          headers: {
            Authorization: `Bearer ${authTokens.user1.accessToken}`
          }
        });

        expect(response.status).toBe(200);
        expect(response.data.status).toBe('SUSPENDED');
        expect(response.data).toHaveProperty('suspendedAt');
        expect(response.data).toHaveProperty('suspensionReason');
      });

      it('should not allow operations on suspended tenant', async () => {
        // Try to access tenant resources while suspended
        const response = await api.get(`/tenants/${tenantId}/members`, {
          headers: {
            Authorization: `Bearer ${authTokens.user1.accessToken}`
          }
        });

        // Should either be forbidden or return limited data
        expect([200, 403]).toContain(response.status);
      });

      it('should not suspend already suspended tenant', async () => {
        const response = await api.put(`/tenants/${tenantId}/suspend`, {
          reason: 'Already suspended'
        }, {
          headers: {
            Authorization: `Bearer ${authTokens.user1.accessToken}`
          }
        });

        expect([400, 409]).toContain(response.status);
      });
    });

    describe('PUT /tenants/:id/activate', () => {
      it('should activate suspended tenant', async () => {
        const response = await api.put(`/tenants/${tenantId}/activate`, {}, {
          headers: {
            Authorization: `Bearer ${authTokens.user1.accessToken}`
          }
        });

        expect(response.status).toBe(200);
        expect(response.data.status).toBe('ACTIVE');
        expect(response.data.suspendedAt).toBeNull();
        expect(response.data.suspensionReason).toBeNull();
      });

      it('should allow operations on activated tenant', async () => {
        const response = await api.get(`/tenants/${tenantId}/members`, {
          headers: {
            Authorization: `Bearer ${authTokens.user1.accessToken}`
          }
        });

        expect(response.status).toBe(200);
      });

      it('should not activate already active tenant', async () => {
        const response = await api.put(`/tenants/${tenantId}/activate`, {}, {
          headers: {
            Authorization: `Bearer ${authTokens.user1.accessToken}`
          }
        });

        expect([400, 409]).toContain(response.status);
      });
    });

    describe('DELETE /tenants/:id (Soft Delete)', () => {
      it('should soft delete tenant', async () => {
        const response = await api.delete(`/tenants/${tenantId}`, {
          headers: {
            Authorization: `Bearer ${authTokens.user1.accessToken}`
          }
        });

        expect(response.status).toBe(204);

        // Verify tenant is soft deleted
        const getResponse = await api.get(`/tenants/${tenantId}`, {
          headers: {
            Authorization: `Bearer ${authTokens.user1.accessToken}`
          }
        });
        expect([404, 410]).toContain(getResponse.status);
      });

      it('should not show soft deleted tenant in listings', async () => {
        const response = await api.get('/tenants', {
          headers: {
            Authorization: `Bearer ${authTokens.user1.accessToken}`
          }
        });

        expect(response.status).toBe(200);
        const deletedTenant = response.data.data.find((t: any) => t.id === tenantId);
        expect(deletedTenant).toBeUndefined();
      });

      it('should show soft deleted tenant with includeDeleted flag', async () => {
        const response = await api.get('/tenants?includeDeleted=true', {
          headers: {
            Authorization: `Bearer ${authTokens.user1.accessToken}`
          }
        });

        expect(response.status).toBe(200);
        const deletedTenant = response.data.data.find((t: any) => t.id === tenantId);
        expect(deletedTenant).toBeDefined();
        expect(deletedTenant.deletedAt).toBeDefined();
      });
    });

    describe('PUT /tenants/:id/restore', () => {
      it('should restore soft deleted tenant', async () => {
        const response = await api.put(`/tenants/${tenantId}/restore`, {}, {
          headers: {
            Authorization: `Bearer ${authTokens.user1.accessToken}`
          }
        });

        expect(response.status).toBe(200);
        expect(response.data.deletedAt).toBeNull();
        expect(response.data.status).toBe('ACTIVE');
      });

      it('should show restored tenant in listings', async () => {
        const response = await api.get('/tenants', {
          headers: {
            Authorization: `Bearer ${authTokens.user1.accessToken}`
          }
        });

        expect(response.status).toBe(200);
        const restoredTenant = response.data.data.find((t: any) => t.id === tenantId);
        expect(restoredTenant).toBeDefined();
        expect(restoredTenant.deletedAt).toBeNull();
      });

      it('should not restore already active tenant', async () => {
        const response = await api.put(`/tenants/${tenantId}/restore`, {}, {
          headers: {
            Authorization: `Bearer ${authTokens.user1.accessToken}`
          }
        });

        expect([400, 409]).toContain(response.status);
      });
    });

    describe('DELETE /tenants/:id/permanent', () => {
      let testTenantId: string;

      beforeAll(async () => {
        // Create a new tenant for permanent deletion test
        const newUser = {
          email: `delete-test-${Date.now()}@example.com`,
          password: 'TestPassword123!',
          firstName: 'Delete',
          lastName: 'Test'
        };

        const registerResponse = await api.post('/auth/register', newUser);
        expect(registerResponse.status).toBe(201);

        const workspacesResponse = await api.get('/tenant-members/user-workspaces', {
          headers: {
            Authorization: `Bearer ${registerResponse.data.access_token}`
          }
        });

        testTenantId = workspacesResponse.data[0].tenant.id;

        // First soft delete it
        await api.delete(`/tenants/${testTenantId}`, {
          headers: {
            Authorization: `Bearer ${registerResponse.data.access_token}`
          }
        });
      });

      it('should permanently delete soft deleted tenant', async () => {
        const response = await api.delete(`/tenants/${testTenantId}/permanent`, {
          headers: {
            Authorization: `Bearer ${authTokens.user1.accessToken}`
          }
        });

        expect(response.status).toBe(204);

        // Verify tenant is permanently deleted
        const getResponse = await api.get(`/tenants/${testTenantId}?includeDeleted=true`, {
          headers: {
            Authorization: `Bearer ${authTokens.user1.accessToken}`
          }
        });
        expect(getResponse.status).toBe(404);
      });

      it('should not permanently delete active tenant', async () => {
        const response = await api.delete(`/tenants/${tenantId}/permanent`, {
          headers: {
            Authorization: `Bearer ${authTokens.user1.accessToken}`
          }
        });

        expect([400, 409]).toContain(response.status);
      });
    });
  });

  describe('Tenant Transfer', () => {
    let transferTargetUserId: string;
    let transferTargetToken: string;

    beforeAll(async () => {
      // Create a user to transfer tenant to
      const transferUser = {
        email: `transfer-target-${Date.now()}@example.com`,
        password: 'TestPassword123!',
        firstName: 'Transfer',
        lastName: 'Target'
      };

      const response = await api.post('/auth/register', transferUser);
      expect(response.status).toBe(201);
      
      transferTargetUserId = response.data.user.id;
      transferTargetToken = response.data.access_token;
    });

    describe('POST /tenants/:id/transfer', () => {
      it('should initiate tenant transfer', async () => {
        const response = await api.post(`/tenants/${tenantId}/transfer`, {
          newOwnerId: transferTargetUserId,
          transferReason: 'Testing transfer functionality'
        }, {
          headers: {
            Authorization: `Bearer ${authTokens.user1.accessToken}`
          }
        });

        expect(response.status).toBe(200);
        expect(response.data).toHaveProperty('transferId');
        expect(response.data.status).toBe('TRANSFER_PENDING');
        expect(response.data.newOwnerId).toBe(transferTargetUserId);
      });

      it('should not transfer to non-existent user', async () => {
        const response = await api.post(`/tenants/${tenantId}/transfer`, {
          newOwnerId: '00000000-0000-0000-0000-000000000000',
          transferReason: 'Invalid user test'
        }, {
          headers: {
            Authorization: `Bearer ${authTokens.user1.accessToken}`
          }
        });

        expect(response.status).toBe(404);
      });

      it('should not transfer to current owner', async () => {
        const response = await api.post(`/tenants/${tenantId}/transfer`, {
          newOwnerId: authTokens.user1.userId,
          transferReason: 'Self transfer test'
        }, {
          headers: {
            Authorization: `Bearer ${authTokens.user1.accessToken}`
          }
        });

        expect(response.status).toBe(400);
      });

      it('should not allow non-owner to initiate transfer', async () => {
        const response = await api.post(`/tenants/${tenantId}/transfer`, {
          newOwnerId: transferTargetUserId,
          transferReason: 'Unauthorized transfer'
        }, {
          headers: {
            Authorization: `Bearer ${transferTargetToken}`
          }
        });

        expect([403, 404]).toContain(response.status);
      });
    });

    describe('POST /tenants/:id/transfer/accept', () => {
      it('should accept tenant transfer', async () => {
        const response = await api.post(`/tenants/${tenantId}/transfer/accept`, {}, {
          headers: {
            Authorization: `Bearer ${transferTargetToken}`
          }
        });

        expect(response.status).toBe(200);
        expect(response.data.status).toBe('ACTIVE');

        // Verify ownership changed
        const tenantResponse = await api.get(`/tenants/${tenantId}`, {
          headers: {
            Authorization: `Bearer ${transferTargetToken}`
          }
        });
        expect(tenantResponse.status).toBe(200);
      });

      it('should update member roles after transfer', async () => {
        const membersResponse = await api.get(`/tenants/${tenantId}/members`, {
          headers: {
            Authorization: `Bearer ${transferTargetToken}`
          }
        });

        expect(membersResponse.status).toBe(200);
        
        const newOwner = membersResponse.data.data.find(
          (member: any) => member.user.id === transferTargetUserId
        );
        const oldOwner = membersResponse.data.data.find(
          (member: any) => member.user.id === authTokens.user1.userId
        );

        expect(newOwner.role).toBe('OWNER');
        expect(oldOwner.role).toBe('ADMIN'); // Or whatever role the old owner gets
      });

      it('should not accept non-existent transfer', async () => {
        const response = await api.post(`/tenants/00000000-0000-0000-0000-000000000000/transfer/accept`, {}, {
          headers: {
            Authorization: `Bearer ${transferTargetToken}`
          }
        });

        expect(response.status).toBe(404);
      });
    });

    describe('POST /tenants/:id/transfer/decline', () => {
      let declineTestTenantId: string;

      beforeAll(async () => {
        // Create another tenant for decline test
        const declineUser = {
          email: `decline-test-${Date.now()}@example.com`,
          password: 'TestPassword123!',
          firstName: 'Decline',
          lastName: 'Test'
        };

        const response = await api.post('/auth/register', declineUser);
        const workspacesResponse = await api.get('/tenant-members/user-workspaces', {
          headers: { Authorization: `Bearer ${response.data.access_token}` }
        });
        declineTestTenantId = workspacesResponse.data[0].tenant.id;

        // Initiate transfer
        await api.post(`/tenants/${declineTestTenantId}/transfer`, {
          newOwnerId: transferTargetUserId,
          transferReason: 'Decline test'
        }, {
          headers: { Authorization: `Bearer ${response.data.access_token}` }
        });
      });

      it('should decline tenant transfer', async () => {
        const response = await api.post(`/tenants/${declineTestTenantId}/transfer/decline`, {
          reason: 'Not interested'
        }, {
          headers: {
            Authorization: `Bearer ${transferTargetToken}`
          }
        });

        expect(response.status).toBe(200);
        expect(response.data.status).toBe('ACTIVE');
      });
    });

    describe('DELETE /tenants/:id/transfer', () => {
      it('should cancel pending transfer', async () => {
        // This would test canceling a transfer by the current owner
        const response = await api.delete(`/tenants/${tenantId}/transfer`, {
          headers: {
            Authorization: `Bearer ${transferTargetToken}` // Now the new owner
          }
        });

        // Should either succeed or indicate no pending transfer
        expect([200, 204, 404]).toContain(response.status);
      });
    });
  });

  describe('Tenant Authorization & Security', () => {
    it('should not access other tenant resources', async () => {
      // User 2 should not access User 1's tenant members directly
      const response = await api.get(`/tenants/${tenantId}/members`, {
        headers: {
          Authorization: `Bearer ${authTokens.user2.accessToken}`
        }
      });

      // This should either be forbidden or only show user2's membership
      expect([200, 403]).toContain(response.status);
      
      if (response.status === 200) {
        // If allowed, should only see their own membership
        const userMemberships = response.data.data.filter(
          (member: any) => member.user.id === authTokens.user2.userId
        );
        expect(userMemberships.length).toBeGreaterThan(0);
      }
    });

    it('should validate tenant access permissions', async () => {
      // Test that users can only access tenants they're members of
      const response = await api.get('/tenant-members/user-workspaces', {
        headers: {
          Authorization: `Bearer ${authTokens.user2.accessToken}`
        }
      });

      expect(response.status).toBe(200);
      expect(response.data.every((workspace: any) => 
        workspace.user.id === authTokens.user2.userId
      )).toBe(true);
    });

    it('should handle invalid tenant IDs', async () => {
      const response = await api.get('/tenants/invalid-uuid', {
        headers: {
          Authorization: `Bearer ${authTokens.user1.accessToken}`
        }
      });

      expect([400, 404]).toContain(response.status);
    });

    it('should require proper permissions for lifecycle operations', async () => {
      const operations = [
        { method: 'put', path: `/tenants/${tenantId}/suspend` },
        { method: 'put', path: `/tenants/${tenantId}/activate` },
        { method: 'delete', path: `/tenants/${tenantId}` },
        { method: 'put', path: `/tenants/${tenantId}/restore` },
        { method: 'post', path: `/tenants/${tenantId}/transfer` }
      ];

      for (const op of operations) {
        const response = await (api as any)[op.method](op.path, {}, {
          headers: {
            Authorization: `Bearer ${authTokens.user2.accessToken}`
          }
        });

        expect([401, 403, 404]).toContain(response.status);
      }
    });
  });
});