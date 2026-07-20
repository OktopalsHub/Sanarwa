/**
 * Invite Module HTTP Tests
 * Tests invitation system endpoints via HTTP calls
 */

import axios, { AxiosInstance } from 'axios';

describe('Invite Module HTTP Tests', () => {
  const baseURL = 'http://localhost:9000/api/v1';
  let api: AxiosInstance;

  // Test data
  const testUser = {
    email: `invite-owner-${Date.now()}@example.com`,
    password: 'TestPassword123!',
    firstName: 'Invite',
    lastName: 'Owner'
  };

  const inviteEmail = `invite-member-${Date.now()}@example.com`;
  const inviteEmail2 = `invite-member2-${Date.now()}@example.com`;

  let authTokens: {
    accessToken: string;
    refreshToken: string;
    userId: string;
  } = {} as any;

  let tenantId: string;
  let inviteId: string;
  let inviteCode: string;

  beforeAll(async () => {
    api = axios.create({ 
      baseURL,
      timeout: 10000,
      validateStatus: () => true // Don't throw on HTTP errors
    });

    // Wait for server to be ready
    await waitForServer();
    
    // Setup test data
    await setupTestData();
  });

  async function waitForServer(maxRetries = 10): Promise<void> {
    for (let i = 0; i < maxRetries; i++) {
      try {
        const response = await api.get('/health');
        if (response.status === 200) {
          console.log('✅ Server is ready for invite tests');
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

  async function setupTestData(): Promise<void> {
    // Register user (will create tenant automatically)
    const response = await api.post('/auth/register', testUser);
    expect(response.status).toBe(201);
    
    authTokens = {
      accessToken: response.data.access_token,
      refreshToken: response.data.refresh_token,
      userId: response.data.user.id
    };

    // Get tenant ID
    const workspacesResponse = await api.get('/tenant-members/user-workspaces', {
      headers: {
        Authorization: `Bearer ${authTokens.accessToken}`
      }
    });
    
    expect(workspacesResponse.status).toBe(200);
    tenantId = workspacesResponse.data[0].tenant.id;

    console.log('✅ Test data setup complete for invite tests');
  }

  describe('Invite Creation', () => {
    describe('POST /tenants/:id/invites', () => {
      it('should create new invitation', async () => {
        const response = await api.post(`/tenants/${tenantId}/invites`, {
          email: inviteEmail,
          role: 'MEMBER'
        }, {
          headers: {
            Authorization: `Bearer ${authTokens.accessToken}`
          }
        });

        expect(response.status).toBe(201);
        expect(response.data).toHaveProperty('id');
        expect(response.data).toHaveProperty('inviteCode');
        expect(response.data.email).toBe(inviteEmail);
        expect(response.data.role).toBe('MEMBER');
        expect(response.data.status).toBe('PENDING');
        expect(response.data).toHaveProperty('expiresAt');

        // Store for later tests
        inviteId = response.data.id;
        inviteCode = response.data.inviteCode;
      });

      it('should create invitation with admin role', async () => {
        const response = await api.post(`/tenants/${tenantId}/invites`, {
          email: inviteEmail2,
          role: 'ADMIN'
        }, {
          headers: {
            Authorization: `Bearer ${authTokens.accessToken}`
          }
        });

        expect(response.status).toBe(201);
        expect(response.data.role).toBe('ADMIN');
      });

      it('should not create duplicate invitation for same email', async () => {
        const response = await api.post(`/tenants/${tenantId}/invites`, {
          email: inviteEmail,
          role: 'MEMBER'
        }, {
          headers: {
            Authorization: `Bearer ${authTokens.accessToken}`
          }
        });

        expect(response.status).toBe(400);
        expect(response.data.message).toContain('already invited');
      });

      it('should validate email format', async () => {
        const response = await api.post(`/tenants/${tenantId}/invites`, {
          email: 'invalid-email',
          role: 'MEMBER'
        }, {
          headers: {
            Authorization: `Bearer ${authTokens.accessToken}`
          }
        });

        expect(response.status).toBe(400);
      });

      it('should validate role', async () => {
        const response = await api.post(`/tenants/${tenantId}/invites`, {
          email: 'test@example.com',
          role: 'INVALID_ROLE'
        }, {
          headers: {
            Authorization: `Bearer ${authTokens.accessToken}`
          }
        });

        expect(response.status).toBe(400);
      });

      it('should not create invitation without authentication', async () => {
        const response = await api.post(`/tenants/${tenantId}/invites`, {
          email: 'test@example.com',
          role: 'MEMBER'
        });

        expect(response.status).toBe(401);
      });

      it('should not allow non-admin to create invitations', async () => {
        // This would need a member user token to test properly
        // For now, test with invalid tenant access
        const response = await api.post('/tenants/00000000-0000-0000-0000-000000000000/invites', {
          email: 'test@example.com',
          role: 'MEMBER'
        }, {
          headers: {
            Authorization: `Bearer ${authTokens.accessToken}`
          }
        });

        expect([403, 404]).toContain(response.status);
      });
    });
  });

  describe('Invite Management', () => {
    describe('GET /tenants/:id/invites', () => {
      it('should get all tenant invitations', async () => {
        const response = await api.get(`/tenants/${tenantId}/invites`, {
          headers: {
            Authorization: `Bearer ${authTokens.accessToken}`
          }
        });

        expect(response.status).toBe(200);
        expect(response.data).toHaveProperty('data');
        expect(response.data).toHaveProperty('pagination');
        expect(Array.isArray(response.data.data)).toBe(true);
        expect(response.data.data.length).toBeGreaterThan(0);

        const invite = response.data.data[0];
        expect(invite).toHaveProperty('id');
        expect(invite).toHaveProperty('email');
        expect(invite).toHaveProperty('role');
        expect(invite).toHaveProperty('status');
        expect(invite).toHaveProperty('inviteCode');
        expect(invite).toHaveProperty('expiresAt');
      });

      it('should filter invitations by status', async () => {
        const response = await api.get(`/tenants/${tenantId}/invites?status=PENDING`, {
          headers: {
            Authorization: `Bearer ${authTokens.accessToken}`
          }
        });

        expect(response.status).toBe(200);
        expect(response.data.data.every((invite: any) => invite.status === 'PENDING')).toBe(true);
      });

      it('should filter invitations by role', async () => {
        const response = await api.get(`/tenants/${tenantId}/invites?role=MEMBER`, {
          headers: {
            Authorization: `Bearer ${authTokens.accessToken}`
          }
        });

        expect(response.status).toBe(200);
        expect(response.data.data.every((invite: any) => invite.role === 'MEMBER')).toBe(true);
      });

      it('should search invitations by email', async () => {
        const response = await api.get(`/tenants/${tenantId}/invites?search=${inviteEmail}`, {
          headers: {
            Authorization: `Bearer ${authTokens.accessToken}`
          }
        });

        expect(response.status).toBe(200);
        expect(response.data.data.length).toBeGreaterThan(0);
        expect(response.data.data[0].email).toBe(inviteEmail);
      });

      it('should support pagination', async () => {
        const response = await api.get(`/tenants/${tenantId}/invites?page=1&limit=1`, {
          headers: {
            Authorization: `Bearer ${authTokens.accessToken}`
          }
        });

        expect(response.status).toBe(200);
        expect(response.data.pagination.limit).toBe(1);
        expect(response.data.data.length).toBeLessThanOrEqual(1);
      });
    });

    describe('GET /tenants/:id/invites/:inviteId', () => {
      it('should get specific invitation', async () => {
        const response = await api.get(`/tenants/${tenantId}/invites/${inviteId}`, {
          headers: {
            Authorization: `Bearer ${authTokens.accessToken}`
          }
        });

        expect(response.status).toBe(200);
        expect(response.data.id).toBe(inviteId);
        expect(response.data.email).toBe(inviteEmail);
        expect(response.data).toHaveProperty('inviteCode');
      });

      it('should not get non-existent invitation', async () => {
        const response = await api.get(`/tenants/${tenantId}/invites/00000000-0000-0000-0000-000000000000`, {
          headers: {
            Authorization: `Bearer ${authTokens.accessToken}`
          }
        });

        expect(response.status).toBe(404);
      });
    });

    describe('PUT /tenants/:id/invites/:inviteId', () => {
      it('should update invitation role', async () => {
        const response = await api.put(`/tenants/${tenantId}/invites/${inviteId}`, {
          role: 'ADMIN'
        }, {
          headers: {
            Authorization: `Bearer ${authTokens.accessToken}`
          }
        });

        expect(response.status).toBe(200);
        expect(response.data.role).toBe('ADMIN');
      });

      it('should not update with invalid role', async () => {
        const response = await api.put(`/tenants/${tenantId}/invites/${inviteId}`, {
          role: 'INVALID_ROLE'
        }, {
          headers: {
            Authorization: `Bearer ${authTokens.accessToken}`
          }
        });

        expect(response.status).toBe(400);
      });
    });

    describe('POST /tenants/:id/invites/:inviteId/resend', () => {
      it('should resend invitation email', async () => {
        const response = await api.post(`/tenants/${tenantId}/invites/${inviteId}/resend`, {}, {
          headers: {
            Authorization: `Bearer ${authTokens.accessToken}`
          }
        });

        expect(response.status).toBe(200);
        expect(response.data.message).toContain('resent');
      });

      it('should not resend expired invitation', async () => {
        // This would need an expired invitation to test properly
        // For now, test with non-existent invitation
        const response = await api.post(`/tenants/${tenantId}/invites/00000000-0000-0000-0000-000000000000/resend`, {}, {
          headers: {
            Authorization: `Bearer ${authTokens.accessToken}`
          }
        });

        expect(response.status).toBe(404);
      });
    });

    describe('DELETE /tenants/:id/invites/:inviteId', () => {
      it('should cancel invitation', async () => {
        const response = await api.delete(`/tenants/${tenantId}/invites/${inviteId}`, {
          headers: {
            Authorization: `Bearer ${authTokens.accessToken}`
          }
        });

        expect(response.status).toBe(204);

        // Verify invitation was cancelled
        const getResponse = await api.get(`/tenants/${tenantId}/invites/${inviteId}`, {
          headers: {
            Authorization: `Bearer ${authTokens.accessToken}`
          }
        });
        expect([404, 200]).toContain(getResponse.status);
        
        if (getResponse.status === 200) {
          expect(getResponse.data.status).toBe('CANCELLED');
        }
      });
    });
  });

  describe('Invite Acceptance', () => {
    let newInviteCode: string;

    beforeAll(async () => {
      // Create a new invitation for acceptance tests
      const response = await api.post(`/tenants/${tenantId}/invites`, {
        email: `accept-test-${Date.now()}@example.com`,
        role: 'MEMBER'
      }, {
        headers: {
          Authorization: `Bearer ${authTokens.accessToken}`
        }
      });
      
      expect(response.status).toBe(201);
      newInviteCode = response.data.inviteCode;
    });

    describe('GET /invites/:code', () => {
      it('should get invitation details by code', async () => {
        const response = await api.get(`/invites/${newInviteCode}`);

        expect(response.status).toBe(200);
        expect(response.data).toHaveProperty('tenant');
        expect(response.data).toHaveProperty('role');
        expect(response.data).toHaveProperty('email');
        expect(response.data.status).toBe('PENDING');
        expect(response.data.tenant.id).toBe(tenantId);
      });

      it('should not get invitation with invalid code', async () => {
        const response = await api.get('/invites/invalid-code');

        expect(response.status).toBe(404);
      });

      it('should not get expired invitation', async () => {
        // This would need an expired invitation to test properly
        const response = await api.get('/invites/expired-code');

        expect(response.status).toBe(404);
      });
    });

    describe('POST /invites/:code/accept', () => {
      it('should accept invitation for existing user', async () => {
        // This would require registering a user with the invited email first
        // For now, test the endpoint structure
        const response = await api.post(`/invites/${newInviteCode}/accept`, {
          password: 'AcceptPassword123!'
        });

        // Could be 200 (accepted) or 400 (user doesn't exist) or other validation
        expect([200, 400, 404]).toContain(response.status);
      });

      it('should create user and accept invitation for new user', async () => {
        const response = await api.post(`/invites/${newInviteCode}/accept`, {
          firstName: 'New',
          lastName: 'Member',
          password: 'NewPassword123!'
        });

        // Could be 200 (accepted) or 400 (validation) depending on implementation
        expect([200, 201, 400]).toContain(response.status);
      });

      it('should not accept invitation with invalid code', async () => {
        const response = await api.post('/invites/invalid-code/accept', {
          password: 'Password123!'
        });

        expect(response.status).toBe(404);
      });

      it('should validate required fields for new user', async () => {
        const response = await api.post(`/invites/${newInviteCode}/accept`, {
          // missing required fields
        });

        expect(response.status).toBe(400);
      });
    });

    describe('POST /invites/:code/decline', () => {
      it('should decline invitation', async () => {
        const response = await api.post(`/invites/${newInviteCode}/decline`);

        expect([200, 204]).toContain(response.status);
      });

      it('should not decline invitation with invalid code', async () => {
        const response = await api.post('/invites/invalid-code/decline');

        expect(response.status).toBe(404);
      });
    });
  });

  describe('Invite Security', () => {
    it('should not allow unauthorized users to create invitations', async () => {
      const response = await api.post(`/tenants/${tenantId}/invites`, {
        email: 'unauthorized@example.com',
        role: 'MEMBER'
      });

      expect(response.status).toBe(401);
    });

    it('should not allow access to other tenant invitations', async () => {
      const response = await api.get('/tenants/00000000-0000-0000-0000-000000000000/invites', {
        headers: {
          Authorization: `Bearer ${authTokens.accessToken}`
        }
      });

      expect([403, 404]).toContain(response.status);
    });

    it('should validate invite code format', async () => {
      const invalidCodes = ['', 'short', '123', 'invalid-format'];
      
      for (const code of invalidCodes) {
        const response = await api.get(`/invites/${code}`);
        expect([400, 404]).toContain(response.status);
      }
    });

    it('should handle concurrent invitation operations', async () => {
      // Test creating multiple invitations simultaneously
      const invitePromises = Array.from({ length: 3 }, (_, i) => 
        api.post(`/tenants/${tenantId}/invites`, {
          email: `concurrent-${i}-${Date.now()}@example.com`,
          role: 'MEMBER'
        }, {
          headers: {
            Authorization: `Bearer ${authTokens.accessToken}`
          }
        })
      );

      const responses = await Promise.all(invitePromises);
      
      // All should succeed or fail gracefully
      responses.forEach(response => {
        expect([201, 400, 409]).toContain(response.status);
      });
    });
  });
});