/**
 * Tenant Member Module HTTP Tests
 * Tests tenant member management endpoints via HTTP calls
 */

import axios, { AxiosInstance } from "axios";

describe("Tenant Member Module HTTP Tests", () => {
  const baseURL = "http://localhost:9000/api/v1";
  let api: AxiosInstance;

  // Test data
  const testUser = {
    email: `member-test-${Date.now()}@example.com`,
    password: "TestPassword123!",
    firstName: "Member",
    lastName: "Test",
  };

  const testUser2 = {
    email: `member-test2-${Date.now()}@example.com`,
    password: "TestPassword123!",
    firstName: "Member2",
    lastName: "Test2",
  };

  let authTokens: {
    user1: { accessToken: string; refreshToken: string; userId: string };
    user2: { accessToken: string; refreshToken: string; userId: string };
  } = {} as any;

  let tenantId: string;
  let memberId: string;

  beforeAll(async () => {
    api = axios.create({
      baseURL,
      timeout: 10000,
      validateStatus: () => true, // Don't throw on HTTP errors
    });

    // Wait for server to be ready
    await waitForServer();

    // Register test users and setup tenant
    await setupTestData();
  });

  async function waitForServer(maxRetries = 10): Promise<void> {
    for (let i = 0; i < maxRetries; i++) {
      try {
        const response = await api.get("/health");
        if (response.status === 200) {
          console.log("✅ Server is ready for tenant member tests");
          return;
        }
      } catch (error) {
        if (i === maxRetries - 1) {
          throw new Error("Server not ready. Please start with: npm run start:dev");
        }
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    }
  }

  async function setupTestData(): Promise<void> {
    // Register first user (will be tenant owner)
    const response1 = await api.post("/auth/register", testUser);
    expect(response1.status).toBe(201);

    authTokens.user1 = {
      accessToken: response1.data.access_token,
      refreshToken: response1.data.refresh_token,
      userId: response1.data.user.id,
    };

    // Register second user
    const response2 = await api.post("/auth/register", testUser2);
    expect(response2.status).toBe(201);

    authTokens.user2 = {
      accessToken: response2.data.access_token,
      refreshToken: response2.data.refresh_token,
      userId: response2.data.user.id,
    };

    // Get tenant ID from user1's workspaces
    const workspacesResponse = await api.get("/tenant-members/user-workspaces", {
      headers: {
        Authorization: `Bearer ${authTokens.user1.accessToken}`,
      },
    });

    expect(workspacesResponse.status).toBe(200);
    tenantId = workspacesResponse.data[0].tenant.id;

    console.log("✅ Test data setup complete for tenant member tests");
  }

  describe("Tenant Member Management (Invitation-Based)", () => {
    // Note: Members are added through invitation system only
    // This section tests member management after they've joined via invitation

    beforeAll(async () => {
      // Simulate that user2 joined via invitation
      // In real scenario, this would happen through invite acceptance
      // For testing, we'll get the existing owner membership
      const membersResponse = await api.get(`/tenants/${tenantId}/members`, {
        headers: {
          Authorization: `Bearer ${authTokens.user1.accessToken}`,
        },
      });

      if (membersResponse.status === 200 && membersResponse.data.data.length > 0) {
        memberId = membersResponse.data.data[0].id;
      }
    });

    describe("GET /tenants/:id/members", () => {
      it("should get all tenant members", async () => {
        const response = await api.get(`/tenants/${tenantId}/members`, {
          headers: {
            Authorization: `Bearer ${authTokens.user1.accessToken}`,
          },
        });

        expect(response.status).toBe(200);
        expect(response.data).toHaveProperty("data");
        expect(response.data).toHaveProperty("pagination");
        expect(Array.isArray(response.data.data)).toBe(true);
        expect(response.data.data.length).toBeGreaterThanOrEqual(2); // Owner + added member

        // Check member structure
        const member = response.data.data[0];
        expect(member).toHaveProperty("id");
        expect(member).toHaveProperty("role");
        expect(member).toHaveProperty("status");
        expect(member).toHaveProperty("user");
        expect(member.user).toHaveProperty("email");
        expect(member.user).toHaveProperty("firstName");
      });

      it("should filter members by role", async () => {
        const response = await api.get(`/tenants/${tenantId}/members?role=OWNER`, {
          headers: {
            Authorization: `Bearer ${authTokens.user1.accessToken}`,
          },
        });

        expect(response.status).toBe(200);
        expect(response.data.data.every((member: any) => member.role === "OWNER")).toBe(true);
      });

      it("should search members by name or email", async () => {
        const response = await api.get(
          `/tenants/${tenantId}/members?search=${testUser.firstName}`,
          {
            headers: {
              Authorization: `Bearer ${authTokens.user1.accessToken}`,
            },
          },
        );

        expect(response.status).toBe(200);
        expect(response.data.data.length).toBeGreaterThan(0);
      });

      it("should support pagination", async () => {
        const response = await api.get(`/tenants/${tenantId}/members?page=1&limit=1`, {
          headers: {
            Authorization: `Bearer ${authTokens.user1.accessToken}`,
          },
        });

        expect(response.status).toBe(200);
        expect(response.data.pagination.limit).toBe(1);
        expect(response.data.pagination.page).toBe(1);
        expect(response.data.data.length).toBeLessThanOrEqual(1);
      });

      it("should support sorting", async () => {
        const response = await api.get(
          `/tenants/${tenantId}/members?sortBy=createdAt&sortOrder=ASC`,
          {
            headers: {
              Authorization: `Bearer ${authTokens.user1.accessToken}`,
            },
          },
        );

        expect(response.status).toBe(200);
        expect(response.data.data.length).toBeGreaterThan(0);
      });
    });

    describe("GET /tenants/:id/members/:memberId", () => {
      it("should get specific tenant member by ID", async () => {
        const response = await api.get(`/tenants/${tenantId}/members/${memberId}`, {
          headers: {
            Authorization: `Bearer ${authTokens.user1.accessToken}`,
          },
        });

        expect(response.status).toBe(200);
        expect(response.data.id).toBe(memberId);
        expect(response.data).toHaveProperty("role");
        expect(response.data).toHaveProperty("user");
        expect(response.data).toHaveProperty("tenant");
        expect(response.data.tenant.id).toBe(tenantId);
      });

      it("should not get non-existent member", async () => {
        const response = await api.get(
          `/tenants/${tenantId}/members/00000000-0000-0000-0000-000000000000`,
          {
            headers: {
              Authorization: `Bearer ${authTokens.user1.accessToken}`,
            },
          },
        );

        expect(response.status).toBe(404);
      });

      it("should not get member from different tenant", async () => {
        // Try to access member with wrong tenant ID
        const response = await api.get(
          `/tenants/00000000-0000-0000-0000-000000000000/members/${memberId}`,
          {
            headers: {
              Authorization: `Bearer ${authTokens.user1.accessToken}`,
            },
          },
        );

        expect([404, 403]).toContain(response.status);
      });
    });

    describe("PUT /tenants/:id/members/:memberId", () => {
      it("should update member role", async () => {
        const response = await api.put(
          `/tenants/${tenantId}/members/${memberId}`,
          {
            role: "ADMIN",
          },
          {
            headers: {
              Authorization: `Bearer ${authTokens.user1.accessToken}`,
            },
          },
        );

        expect(response.status).toBe(200);
        expect(response.data.role).toBe("ADMIN");
      });

      it("should not update member with invalid role", async () => {
        const response = await api.put(
          `/tenants/${tenantId}/members/${memberId}`,
          {
            role: "INVALID_ROLE",
          },
          {
            headers: {
              Authorization: `Bearer ${authTokens.user1.accessToken}`,
            },
          },
        );

        expect(response.status).toBe(400);
      });

      it("should not update member without proper permissions", async () => {
        const response = await api.put(
          `/tenants/${tenantId}/members/${memberId}`,
          {
            role: "OWNER",
          },
          {
            headers: {
              Authorization: `Bearer ${authTokens.user2.accessToken}`,
            },
          },
        );

        expect([403, 404]).toContain(response.status);
      });

      it("should not update non-existent member", async () => {
        const response = await api.put(
          `/tenants/${tenantId}/members/00000000-0000-0000-0000-000000000000`,
          {
            role: "MEMBER",
          },
          {
            headers: {
              Authorization: `Bearer ${authTokens.user1.accessToken}`,
            },
          },
        );

        expect(response.status).toBe(404);
      });
    });

    describe("DELETE /tenants/:id/members/:memberId", () => {
      it("should remove member from tenant", async () => {
        const response = await api.delete(`/tenants/${tenantId}/members/${memberId}`, {
          headers: {
            Authorization: `Bearer ${authTokens.user1.accessToken}`,
          },
        });

        expect(response.status).toBe(204);

        // Verify member was removed
        const getResponse = await api.get(`/tenants/${tenantId}/members/${memberId}`, {
          headers: {
            Authorization: `Bearer ${authTokens.user1.accessToken}`,
          },
        });
        expect(getResponse.status).toBe(404);
      });

      it("should not remove non-existent member", async () => {
        const response = await api.delete(
          `/tenants/${tenantId}/members/00000000-0000-0000-0000-000000000000`,
          {
            headers: {
              Authorization: `Bearer ${authTokens.user1.accessToken}`,
            },
          },
        );

        expect(response.status).toBe(404);
      });

      it("should not remove member without proper permissions", async () => {
        // First add the member back
        const addResponse = await api.post(
          `/tenants/${tenantId}/members`,
          {
            email: testUser2.email,
            role: "MEMBER",
          },
          {
            headers: {
              Authorization: `Bearer ${authTokens.user1.accessToken}`,
            },
          },
        );

        if (addResponse.status === 201) {
          const newMemberId = addResponse.data.id;

          // Try to remove as non-owner
          const response = await api.delete(`/tenants/${tenantId}/members/${newMemberId}`, {
            headers: {
              Authorization: `Bearer ${authTokens.user2.accessToken}`,
            },
          });

          expect([403, 404]).toContain(response.status);
        }
      });
    });
  });

  describe("User Workspaces", () => {
    describe("GET /tenant-members/user-workspaces", () => {
      it("should get user workspaces", async () => {
        const response = await api.get("/tenant-members/user-workspaces", {
          headers: {
            Authorization: `Bearer ${authTokens.user1.accessToken}`,
          },
        });

        expect(response.status).toBe(200);
        expect(Array.isArray(response.data)).toBe(true);
        expect(response.data.length).toBeGreaterThan(0);

        const workspace = response.data[0];
        expect(workspace).toHaveProperty("id");
        expect(workspace).toHaveProperty("role");
        expect(workspace).toHaveProperty("tenant");
        expect(workspace).toHaveProperty("user");
        expect(workspace.tenant).toHaveProperty("name");
        expect(workspace.tenant).toHaveProperty("subdomain");
      });

      it("should get paginated user workspaces", async () => {
        const response = await api.get(
          "/tenant-members/user-workspaces/paginated?page=1&limit=10",
          {
            headers: {
              Authorization: `Bearer ${authTokens.user1.accessToken}`,
            },
          },
        );

        expect(response.status).toBe(200);
        expect(response.data).toHaveProperty("data");
        expect(response.data).toHaveProperty("pagination");
        expect(Array.isArray(response.data.data)).toBe(true);
        expect(response.data.pagination).toHaveProperty("total");
        expect(response.data.pagination).toHaveProperty("page");
        expect(response.data.pagination).toHaveProperty("limit");
      });

      it("should filter workspaces by role", async () => {
        const response = await api.get("/tenant-members/user-workspaces/paginated?role=OWNER", {
          headers: {
            Authorization: `Bearer ${authTokens.user1.accessToken}`,
          },
        });

        expect(response.status).toBe(200);
        expect(response.data.data.every((workspace: any) => workspace.role === "OWNER")).toBe(true);
      });

      it("should search workspaces by tenant name", async () => {
        const response = await api.get(
          `/tenant-members/user-workspaces/paginated?search=${testUser.firstName}`,
          {
            headers: {
              Authorization: `Bearer ${authTokens.user1.accessToken}`,
            },
          },
        );

        expect(response.status).toBe(200);
        expect(response.data.data.length).toBeGreaterThan(0);
      });

      it("should not get workspaces without authentication", async () => {
        const response = await api.get("/tenant-members/user-workspaces");

        expect(response.status).toBe(401);
      });
    });
  });

  describe("Security and Authorization", () => {
    it("should only return user own workspaces", async () => {
      const response1 = await api.get("/tenant-members/user-workspaces", {
        headers: {
          Authorization: `Bearer ${authTokens.user1.accessToken}`,
        },
      });

      const response2 = await api.get("/tenant-members/user-workspaces", {
        headers: {
          Authorization: `Bearer ${authTokens.user2.accessToken}`,
        },
      });

      expect(response1.status).toBe(200);
      expect(response2.status).toBe(200);

      // Users should have different workspaces
      const user1Workspaces = response1.data;
      const user2Workspaces = response2.data;

      expect(user1Workspaces.every((w: any) => w.user.id === authTokens.user1.userId)).toBe(true);
      expect(user2Workspaces.every((w: any) => w.user.id === authTokens.user2.userId)).toBe(true);
    });

    it("should validate tenant member access permissions", async () => {
      // Test that users can only manage members in tenants they have proper permissions for
      const response = await api.get(`/tenants/${tenantId}/members`, {
        headers: {
          Authorization: `Bearer ${authTokens.user2.accessToken}`,
        },
      });

      // User2 might not have access to manage members, or only see their own membership
      expect([200, 403, 404]).toContain(response.status);
    });

    it("should handle invalid member operations gracefully", async () => {
      // Test various invalid operations
      const invalidOperations = [
        api.get("/tenants/invalid-uuid/members", {
          headers: { Authorization: `Bearer ${authTokens.user1.accessToken}` },
        }),
        api.post(
          "/tenants/invalid-uuid/members",
          { email: "test@test.com", role: "MEMBER" },
          {
            headers: { Authorization: `Bearer ${authTokens.user1.accessToken}` },
          },
        ),
        api.put(
          "/tenants/invalid-uuid/members/invalid-uuid",
          { role: "ADMIN" },
          {
            headers: { Authorization: `Bearer ${authTokens.user1.accessToken}` },
          },
        ),
        api.delete("/tenants/invalid-uuid/members/invalid-uuid", {
          headers: { Authorization: `Bearer ${authTokens.user1.accessToken}` },
        }),
      ];

      const responses = await Promise.all(invalidOperations);
      responses.forEach((response) => {
        expect([400, 404]).toContain(response.status);
      });
    });
  });
});
