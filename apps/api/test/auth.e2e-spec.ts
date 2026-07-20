import axios from 'axios';

describe('Auth & Tenant HTTP Tests', () => {
  const baseURL = 'http://localhost:9000/api/v1';
  const api = axios.create({ baseURL });

  // Test data
  const testUser = {
    email: `test@example.com`,
    password: 'TestPassword123!',
    firstName: 'Test',
    lastName: 'User',
  };
  // const testUser = {
  //   email: `test-${Date.now()}@example.com`,
  //   password: 'TestPassword123!',
  //   firstName: 'Test',
  //   lastName: 'User',
  // };
  const testUser3 = {
    email: `test-${Date.now()}@example.com`,
    password: 'TestPassword123!',
  };

  const testUser2 = {
    email: `test2-${Date.now()}@example.com`,
    password: 'TestPassword123!',
    firstName: 'Test2',
    lastName: 'User2',
  };

  let authTokens: any = {};

  beforeAll(async () => {
    // Wait for server to be ready
    await waitForServer();
  });

  async function waitForServer(maxRetries = 10) {
    for (let i = 0; i < maxRetries; i++) {
      try {
        await api.get('/health');
        console.log('✅ Server is ready');
        return;
      } catch (error) {
        if (i === maxRetries - 1) {
          console.log('❌ Server not ready. Please start the server with: npm run start:dev');
          console.log('   Then run: npm run test:auth');
          throw new Error('Server not ready. Please start the server first.');
        }
        console.log(`⏳ Waiting for server... (${i + 1}/${maxRetries})`);
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }
  }

  describe('Authentication Flow', () => {
    describe('POST /auth/signup', () => {
      it('should register a new user successfully', async () => {
        try {
          const response = await api.post('/auth/signup', testUser);
          
          expect(response.status).toBe(201);
          expect(response.data).toHaveProperty('access_token');
          expect(response.data).toHaveProperty('refresh_token');
          expect(response.data).toHaveProperty('user');
          expect(response.data.user.email).toBe(testUser.email);
          expect(response.data.user.firstName).toBe(testUser.firstName);
          expect(response.data.user.lastName).toBe(testUser.lastName);

          // Store tokens for later tests
          authTokens.user1 = {
            accessToken: response.data.access_token,
            refreshToken: response.data.refresh_token,
            userId: response.data.user.id,
          };

          console.log('✅ User registration successful');
        } catch (error) {
          console.error('❌ Registration failed:', error.response?.data || error.message);
          throw error;
        }
      });

      it('should not register user with existing email', async () => {
        try {
          await api.post('/auth/signup', testUser);
          fail('Should have thrown an error for duplicate email');
        } catch (error) {
          expect(error.response.status).toBe(400);
          console.log("error response", error.response)
          expect(error.response.data.message).toContain('Email already exists');
          console.log('✅ Duplicate email validation working');
        }
      });

      it('should validate required fields', async () => {
        try {
          await api.post('/auth/signup', {
            email: 'invalid-email',
            password: '123', // too short
          });
          fail('Should have thrown validation error');
        } catch (error) {
          expect(error.response.status).toBe(400);
          console.log('✅ Field validation working');
        }
      });
    });

    describe('POST /auth/login', () => {
      it('should login with valid credentials', async () => {
        try {
          const response = await api.post('/auth/login', {
            email: testUser.email,
            password: testUser.password,
          });

          expect(response.status).toBe(200);
          expect(response.data).toHaveProperty('access_token');
          expect(response.data).toHaveProperty('refresh_token');
          expect(response.data).toHaveProperty('user');
          expect(response.data.user.email).toBe(testUser.email);

          console.log('✅ User login successful');
        } catch (error) {
          console.error('❌ Login failed:', error.response?.data || error.message);
          throw error;
        }
      });

      it('should not login with invalid credentials', async () => {
        try {
          await api.post('/auth/login', {
            email: testUser.email,
            password: 'wrongpassword',
          });
          fail('Should have thrown an error for invalid credentials');
        } catch (error) {
          expect(error.response.status).toBe(400);
          expect(error.response.data.message).toContain('Email or password not correct');
          console.log('✅ Invalid credentials validation working');
        }
      });

      it('should not login with non-existent email', async () => {
        try {
          await api.post('/auth/login', {
            email: 'nonexistent@example.com',
            password: testUser.password,
          });
          fail('Should have thrown an error for non-existent email');
        } catch (error) {
          expect(error.response.status).toBe(400);
          console.log('✅ Non-existent email validation working');
        }
      });
    });

    describe('POST /auth/refresh', () => {
      it('should refresh token with valid refresh token', async () => {
        try {
          const response = await api.post('/auth/refresh', {
            refreshToken: authTokens.user1.refreshToken,
          });

          expect(response.status).toBe(200);
          expect(response.data).toHaveProperty('access_token');
          expect(response.data).toHaveProperty('refresh_token');
          expect(response.data).toHaveProperty('user');

          // Update stored tokens
          authTokens.user1.accessToken = response.data.access_token;
          authTokens.user1.refreshToken = response.data.refresh_token;

          console.log('✅ Token refresh successful');
        } catch (error) {
          console.error('❌ Token refresh failed:', error.response?.data || error.message);
          throw error;
        }
      });

      it('should not refresh with invalid token', async () => {
        try {
          await api.post('/auth/refresh', {
            refreshToken: 'invalid-token',
          });
          fail('Should have thrown an error for invalid refresh token');
        } catch (error) {
          expect(error.response.status).toBe(400);
          expect(error.response.data.message).toContain('Invalid refresh token');
          console.log('✅ Invalid refresh token validation working');
        }
      });
    });

    describe('GET /auth/profile', () => {
      it('should get user profile with valid token', async () => {
        try {
          const response = await api.get('/auth/profile', {
            headers: {
              Authorization: `Bearer ${authTokens.user1.accessToken}`,
            },
          });

          expect(response.status).toBe(200);
          expect(response.data.email).toBe(testUser.email);
          expect(response.data.firstName).toBe(testUser.firstName);
          expect(response.data.lastName).toBe(testUser.lastName);
          expect(response.data).toHaveProperty('id');
          expect(response.data).toHaveProperty('isActive');

          console.log('✅ Profile retrieval successful');
        } catch (error) {
          console.error('❌ Profile retrieval failed:', error.response?.data || error.message);
          throw error;
        }
      });

      it('should not get profile without token', async () => {
        try {
          await api.get('/auth/profile');
          fail('Should have thrown an error for missing token');
        } catch (error) {
          expect(error.response.status).toBe(401);
          console.log('✅ Missing token validation working');
        }
      });

      it('should not get profile with invalid token', async () => {
        try {
          await api.get('/auth/profile', {
            headers: {
              Authorization: 'Bearer invalid-token',
            },
          });
          fail('Should have thrown an error for invalid token');
        } catch (error) {
          expect(error.response.status).toBe(401);
          console.log('✅ Invalid token validation working');
        }
      });
    });

    describe('PUT /auth/change-password', () => {
      const newPassword = 'NewPassword123!';

      it('should change password with valid current password', async () => {
        try {
          const response = await api.put('/auth/change-password', {
            currentPassword: testUser.password,
            newPassword: newPassword,
          }, {
            headers: {
              Authorization: `Bearer ${authTokens.user1.accessToken}`,
            },
          });

          expect(response.status).toBe(204);

          // Verify login with new password works
          const loginResponse = await api.post('/auth/login', {
            email: testUser.email,
            password: newPassword,
          });
          expect(loginResponse.status).toBe(200);

          // Update test data for subsequent tests
          testUser.password = newPassword;

          console.log('✅ Password change successful');
        } catch (error) {
          console.error('❌ Password change failed:', error.response?.data || error.message);
          throw error;
        }
      });

      it('should not change password with invalid current password', async () => {
        try {
          await api.put('/auth/change-password', {
            currentPassword: 'wrongpassword',
            newPassword: 'AnotherPassword123!',
          }, {
            headers: {
              Authorization: `Bearer ${authTokens.user1.accessToken}`,
            },
          });
          fail('Should have thrown an error for invalid current password');
        } catch (error) {
          expect(error.response.status).toBe(400);
          expect(error.response.data.message).toContain('Current password is incorrect');
          console.log('✅ Invalid current password validation working');
        }
      });

      it('should not change password without authentication', async () => {
        try {
          await api.put('/auth/change-password', {
            currentPassword: testUser.password,
            newPassword: 'AnotherPassword123!',
          });
          fail('Should have thrown an error for missing authentication');
        } catch (error) {
          expect(error.response.status).toBe(401);
          console.log('✅ Missing authentication validation working');
        }
      });
    });

    describe('Password Reset Flow', () => {
      describe('POST /auth/forgot-password', () => {
        it('should accept forgot password request for existing email', async () => {
          try {
            const response = await api.post('/auth/forgot-password', {
              email: testUser.email,
            });

            expect(response.status).toBe(204);
            console.log('✅ Forgot password request successful');
          } catch (error) {
            console.error('❌ Forgot password failed:', error.response?.data || error.message);
            throw error;
          }
        });

        it('should accept forgot password request for non-existing email (security)', async () => {
          try {
            // Should not reveal if email exists
            const response = await api.post('/auth/forgot-password', {
              email: 'nonexistent@example.com',
            });

            expect(response.status).toBe(204);
            console.log('✅ Forgot password security working (no email enumeration)');
          } catch (error) {
            console.error('❌ Forgot password security failed:', error.response?.data || error.message);
            throw error;
          }
        });
      });
    });
  });

  describe('Tenant Management', () => {
    beforeAll(async () => {
      // Register second user for tenant member tests
      try {
        const response = await api.post('/auth/signup', testUser2);
        
        authTokens.user2 = {
          accessToken: response.data.access_token,
          refreshToken: response.data.refresh_token,
          userId: response.data.user.id,
        };

        console.log('✅ Second user registered for tenant tests');
      } catch (error) {
        console.error('❌ Second user registration failed:', error.response?.data || error.message);
        throw error;
      }
    });

    describe('GET /tenant-members/user-workspaces', () => {
      it('should get user workspaces', async () => {
        try {
          const response = await api.get('/tenant-members/user-workspaces', {
            headers: {
              Authorization: `Bearer ${authTokens.user1.accessToken}`,
            },
          });

          expect(response.status).toBe(200);
          expect(Array.isArray(response.data)).toBe(true);
          expect(response.data.length).toBeGreaterThan(0);
          expect(response.data[0]).toHaveProperty('tenant');
          expect(response.data[0].tenant.name).toContain(testUser.firstName);
          expect(response.data[0].role).toBe('OWNER');

          console.log('✅ User workspaces retrieval successful');
        } catch (error) {
          console.error('❌ User workspaces retrieval failed:', error.response?.data || error.message);
          throw error;
        }
      });

      it('should get paginated user workspaces', async () => {
        try {
          const response = await api.get('/tenant-members/user-workspaces/paginated?page=1&limit=10', {
            headers: {
              Authorization: `Bearer ${authTokens.user1.accessToken}`,
            },
          });

          expect(response.status).toBe(200);
          expect(response.data).toHaveProperty('data');
          expect(response.data).toHaveProperty('pagination');
          expect(Array.isArray(response.data.data)).toBe(true);
          expect(response.data.pagination.total).toBeGreaterThan(0);

          console.log('✅ Paginated user workspaces retrieval successful');
        } catch (error) {
          console.error('❌ Paginated user workspaces retrieval failed:', error.response?.data || error.message);
          throw error;
        }
      });
    });

    describe('GET /tenants', () => {
      it('should get paginated tenants', async () => {
        try {
          const response = await api.get('/tenants?page=1&limit=10', {
            headers: {
              Authorization: `Bearer ${authTokens.user1.accessToken}`,
            },
          });

          expect(response.status).toBe(200);
          expect(response.data).toHaveProperty('data');
          expect(response.data).toHaveProperty('pagination');
          expect(Array.isArray(response.data.data)).toBe(true);
          expect(response.data.data.length).toBeGreaterThan(0);

          console.log('✅ Paginated tenants retrieval successful');
        } catch (error) {
          console.error('❌ Paginated tenants retrieval failed:', error.response?.data || error.message);
          throw error;
        }
      });

      it('should search tenants by name', async () => {
        try {
          const response = await api.get(`/tenants?search=${testUser.firstName}`, {
            headers: {
              Authorization: `Bearer ${authTokens.user1.accessToken}`,
            },
          });

          expect(response.status).toBe(200);
          expect(response.data).toHaveProperty('data');
          expect(Array.isArray(response.data.data)).toBe(true);
          expect(response.data.data.length).toBeGreaterThan(0);
          expect(response.data.data[0].name).toContain(testUser.firstName);

          console.log('✅ Tenant search successful');
        } catch (error) {
          console.error('❌ Tenant search failed:', error.response?.data || error.message);
          throw error;
        }
      });
    });
  });

  describe('OAuth Authentication', () => {
    describe('GET /auth/google', () => {
      it('should return Google authorization URL', async () => {
        try {
          const response = await api.get('/auth/google');

          expect(response.status).toBe(200);
          expect(response.data).toHaveProperty('url');
          expect(response.data.url).toContain('accounts.google.com');
          expect(response.data.url).toContain('oauth2');
          expect(response.data.url).toContain('client_id');

          console.log('✅ Google OAuth URL generation successful');
        } catch (error) {
          console.error('❌ Google OAuth URL generation failed:', error.response?.data || error.message);
          throw error;
        }
      });

      it('should include required OAuth scopes', async () => {
        try {
          const response = await api.get('/auth/google');

          expect(response.data.url).toContain('scope');
          expect(response.data.url).toContain('email');
          expect(response.data.url).toContain('profile');

          console.log('✅ Google OAuth scopes validation successful');
        } catch (error) {
          console.error('❌ Google OAuth scopes validation failed:', error.response?.data || error.message);
          throw error;
        }
      });
    });

    describe('GET /auth/github', () => {
      it('should return GitHub authorization URL', async () => {
        try {
          const response = await api.get('/auth/github');

          expect(response.status).toBe(200);
          expect(response.data).toHaveProperty('url');
          expect(response.data.url).toContain('github.com');
          expect(response.data.url).toContain('oauth');
          expect(response.data.url).toContain('client_id');

          console.log('✅ GitHub OAuth URL generation successful');
        } catch (error) {
          console.error('❌ GitHub OAuth URL generation failed:', error.response?.data || error.message);
          throw error;
        }
      });

      it('should include required OAuth scopes', async () => {
        try {
          const response = await api.get('/auth/github');

          expect(response.data.url).toContain('scope');
          expect(response.data.url).toContain('user:email');

          console.log('✅ GitHub OAuth scopes validation successful');
        } catch (error) {
          console.error('❌ GitHub OAuth scopes validation failed:', error.response?.data || error.message);
          throw error;
        }
      });
    });
  });

  describe('Authorization & Security', () => {
    it('should not access protected routes without authentication', async () => {
      const protectedRoutes = [
        '/auth/profile',
        '/tenant-members/user-workspaces',
        '/tenants',
      ];

      for (const route of protectedRoutes) {
        try {
          await api.get(route);
          fail(`Should have thrown an error for unauthenticated access to ${route}`);
        } catch (error) {
          expect(error.response.status).toBe(401);
        }
      }

      console.log('✅ Protected routes security working');
    });
  });
});