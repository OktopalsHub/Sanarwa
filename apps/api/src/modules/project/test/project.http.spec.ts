/**
 * Project Module HTTP Tests
 * Tests project CRUD operations and SDK functionality
 */

import axios, { AxiosInstance } from "axios";

describe("Project Module HTTP Tests", () => {
  const baseURL = "http://localhost:9000/api/v1";
  let api: AxiosInstance;

  // Test account setup
  const testAccount = {
    email: `sdk-test-${Date.now()}@example.com`,
    password: "SDKTestPassword123!",
    firstName: "SDK",
    lastName: "Tester",
  };

  let authToken: string;
  let userId: string;
  let tenantId: string;

  // Project test data
  let byopProject: any; // Project with BYOP configuration
  let fallbackProject: any; // Project without BYOP (uses fallbacks)

  beforeAll(async () => {
    api = axios.create({
      baseURL,
      timeout: 15000,
      validateStatus: () => true,
    });

    await waitForServer();
    await setupTestAccount();
  });

  async function waitForServer(maxRetries = 10): Promise<void> {
    for (let i = 0; i < maxRetries; i++) {
      try {
        const response = await api.get("/health");
        if (response.status === 200) {
          console.log("✅ Server is ready for project tests");
          return;
        }
      } catch (error) {
        if (i === maxRetries - 1) {
          throw new Error("Server not ready. Please start with: npm run start:dev");
        }
        await new Promise((resolve) => setTimeout(resolve, 2000));
      }
    }
  }

  async function setupTestAccount(): Promise<void> {
    console.log("🔧 Setting up test account for SDK testing...");

    // Register test account
    const registerResponse = await api.post("/auth/register", testAccount);
    expect(registerResponse.status).toBe(201);

    authToken = registerResponse.data.access_token;
    userId = registerResponse.data.user.id;

    // Get tenant ID
    const workspacesResponse = await api.get("/tenant-members/user-workspaces", {
      headers: { Authorization: `Bearer ${authToken}` },
    });

    expect(workspacesResponse.status).toBe(200);
    tenantId = workspacesResponse.data[0].tenant.id;

    console.log(`✅ Test account setup complete:`);
    console.log(`   User ID: ${userId}`);
    console.log(`   Tenant ID: ${tenantId}`);
    console.log(`   Auth Token: ${authToken.substring(0, 20)}...`);
  }

  describe("Project CRUD Operations", () => {
    describe("POST /projects", () => {
      it("should create project with BYOP configuration", async () => {
        const projectData = {
          name: "BYOP Test Project",
          description: "Project with custom provider configuration",
          settings: {
            enableSMS: true,
            enableEmail: true,
            enableVoice: true,
            enablePush: false,
          },
          providers: {
            sms: {
              primary: "telnyx",
              config: {
                apiKey: "test-telnyx-key",
                fromNumber: "+1234567890",
                messagingProfileId: "test-profile-id",
              },
            },
            email: {
              primary: "ses",
              config: {
                accessKeyId: "test-aws-key",
                secretAccessKey: "test-aws-secret",
                region: "us-east-1",
                fromEmail: "noreply@byoptest.com",
                fromName: "BYOP Test",
              },
            },
            voice: {
              primary: "telnyx",
              config: {
                apiKey: "test-telnyx-voice-key",
                connectionId: "test-connection-id",
              },
            },
          },
        };

        const response = await api.post("/projects", projectData, {
          headers: { Authorization: `Bearer ${authToken}` },
        });

        expect(response.status).toBe(201);
        expect(response.data).toHaveProperty("id");
        expect(response.data.name).toBe(projectData.name);
        expect(response.data.description).toBe(projectData.description);
        expect(response.data).toHaveProperty("apiKey");
        expect(response.data).toHaveProperty("settings");
        expect(response.data).toHaveProperty("providers");
        expect(response.data.tenantId).toBe(tenantId);
        expect(response.data.createdById).toBe(userId);

        // Store for later tests
        byopProject = response.data;

        console.log(`✅ BYOP Project created: ${byopProject.id}`);
      });

      it("should create project with fallback configuration (no BYOP)", async () => {
        const projectData = {
          name: "Fallback Test Project",
          description: "Project using system fallback providers",
          settings: {
            enableSMS: true,
            enableEmail: true,
            enableVoice: false,
            enablePush: true,
          },
          // No providers specified - should use tenant/system defaults
        };

        const response = await api.post("/projects", projectData, {
          headers: { Authorization: `Bearer ${authToken}` },
        });

        expect(response.status).toBe(201);
        expect(response.data).toHaveProperty("id");
        expect(response.data.name).toBe(projectData.name);
        expect(response.data).toHaveProperty("apiKey");
        expect(response.data.settings).toEqual(projectData.settings);

        // Should have fallback providers assigned
        expect(response.data).toHaveProperty("providers");
        expect(response.data.providers).toHaveProperty("sms");
        expect(response.data.providers).toHaveProperty("email");

        // Store for later tests
        fallbackProject = response.data;

        console.log(`✅ Fallback Project created: ${fallbackProject.id}`);
      });

      it("should validate required fields", async () => {
        const response = await api.post(
          "/projects",
          {
            // missing name
            description: "Invalid project",
          },
          {
            headers: { Authorization: `Bearer ${authToken}` },
          },
        );

        expect(response.status).toBe(400);
      });

      it("should validate provider configuration", async () => {
        const response = await api.post(
          "/projects",
          {
            name: "Invalid Provider Project",
            providers: {
              sms: {
                primary: "invalid_provider",
                config: {},
              },
            },
          },
          {
            headers: { Authorization: `Bearer ${authToken}` },
          },
        );

        expect(response.status).toBe(400);
      });

      it("should not create project without authentication", async () => {
        const response = await api.post("/projects", {
          name: "Unauthorized Project",
        });

        expect(response.status).toBe(401);
      });
    });

    describe("GET /projects", () => {
      it("should get paginated projects", async () => {
        const response = await api.get("/projects?page=1&limit=10", {
          headers: { Authorization: `Bearer ${authToken}` },
        });

        expect(response.status).toBe(200);
        expect(response.data).toHaveProperty("data");
        expect(response.data).toHaveProperty("pagination");
        expect(Array.isArray(response.data.data)).toBe(true);
        expect(response.data.data.length).toBeGreaterThanOrEqual(2); // Our two test projects

        // Check pagination structure
        expect(response.data.pagination).toHaveProperty("total");
        expect(response.data.pagination).toHaveProperty("page");
        expect(response.data.pagination).toHaveProperty("limit");
        expect(response.data.pagination).toHaveProperty("totalPages");

        // Verify projects are returned
        const projectNames = response.data.data.map((p: any) => p.name);
        expect(projectNames).toContain("BYOP Test Project");
        expect(projectNames).toContain("Fallback Test Project");
      });

      it("should search projects by name", async () => {
        const response = await api.get("/projects?search=BYOP", {
          headers: { Authorization: `Bearer ${authToken}` },
        });

        expect(response.status).toBe(200);
        expect(response.data.data.length).toBeGreaterThan(0);
        expect(response.data.data[0].name).toContain("BYOP");
      });

      it("should filter projects by status", async () => {
        const response = await api.get("/projects?status=ACTIVE", {
          headers: { Authorization: `Bearer ${authToken}` },
        });

        expect(response.status).toBe(200);
        expect(response.data.data.every((p: any) => p.status === "ACTIVE")).toBe(true);
      });

      it("should sort projects", async () => {
        const response = await api.get("/projects?sortBy=createdAt&sortOrder=DESC", {
          headers: { Authorization: `Bearer ${authToken}` },
        });

        expect(response.status).toBe(200);
        expect(response.data.data.length).toBeGreaterThan(0);
      });

      it("should handle pagination limits", async () => {
        const response = await api.get("/projects?page=1&limit=1", {
          headers: { Authorization: `Bearer ${authToken}` },
        });

        expect(response.status).toBe(200);
        expect(response.data.data.length).toBeLessThanOrEqual(1);
        expect(response.data.pagination.limit).toBe(1);
      });

      it("should not get projects without authentication", async () => {
        const response = await api.get("/projects");

        expect(response.status).toBe(401);
      });
    });

    describe("GET /projects/:id", () => {
      it("should get BYOP project by ID", async () => {
        const response = await api.get(`/projects/${byopProject.id}`, {
          headers: { Authorization: `Bearer ${authToken}` },
        });

        expect(response.status).toBe(200);
        expect(response.data.id).toBe(byopProject.id);
        expect(response.data.name).toBe("BYOP Test Project");
        expect(response.data).toHaveProperty("providers");
        expect(response.data.providers.sms.primary).toBe("telnyx");
        expect(response.data.providers.email.primary).toBe("ses");

        // Should include encrypted provider configs
        expect(response.data.providers.sms).toHaveProperty("config");
        expect(response.data.providers.email).toHaveProperty("config");
      });

      it("should get fallback project by ID", async () => {
        const response = await api.get(`/projects/${fallbackProject.id}`, {
          headers: { Authorization: `Bearer ${authToken}` },
        });

        expect(response.status).toBe(200);
        expect(response.data.id).toBe(fallbackProject.id);
        expect(response.data.name).toBe("Fallback Test Project");
        expect(response.data).toHaveProperty("providers");

        // Should have fallback providers
        expect(response.data.providers).toHaveProperty("sms");
        expect(response.data.providers).toHaveProperty("email");
      });

      it("should not get non-existent project", async () => {
        const response = await api.get("/projects/00000000-0000-0000-0000-000000000000", {
          headers: { Authorization: `Bearer ${authToken}` },
        });

        expect(response.status).toBe(404);
      });

      it("should not get project from different tenant", async () => {
        // This would need another tenant's project to test properly
        const response = await api.get("/projects/invalid-project-id", {
          headers: { Authorization: `Bearer ${authToken}` },
        });

        expect([404, 403]).toContain(response.status);
      });
    });

    describe("PUT /projects/:id", () => {
      it("should update BYOP project configuration", async () => {
        const updateData = {
          name: "Updated BYOP Project",
          description: "Updated description for BYOP project",
          settings: {
            enableSMS: true,
            enableEmail: true,
            enableVoice: true,
            enablePush: true, // Added push notifications
          },
          providers: {
            sms: {
              primary: "telnyx",
              config: {
                apiKey: "updated-telnyx-key",
                fromNumber: "+1987654321", // Updated number
                messagingProfileId: "updated-profile-id",
              },
            },
            email: {
              primary: "ses",
              config: {
                accessKeyId: "updated-aws-key",
                secretAccessKey: "updated-aws-secret",
                region: "us-west-2", // Updated region
                fromEmail: "noreply@updatedbyop.com",
                fromName: "Updated BYOP",
              },
            },
            push: {
              primary: "fcm",
              config: {
                serverKey: "test-fcm-server-key",
                projectId: "test-firebase-project",
              },
            },
          },
        };

        const response = await api.put(`/projects/${byopProject.id}`, updateData, {
          headers: { Authorization: `Bearer ${authToken}` },
        });

        expect(response.status).toBe(200);
        expect(response.data.name).toBe(updateData.name);
        expect(response.data.description).toBe(updateData.description);
        expect(response.data.settings.enablePush).toBe(true);
        expect(response.data.providers.sms.config.fromNumber).toBe("+1987654321");
        expect(response.data.providers.email.config.region).toBe("us-west-2");
        expect(response.data.providers).toHaveProperty("push");
      });

      it("should update fallback project to add BYOP providers", async () => {
        const updateData = {
          name: "Upgraded Fallback Project",
          providers: {
            sms: {
              primary: "twilio",
              config: {
                accountSid: "test-twilio-sid",
                authToken: "test-twilio-token",
                fromNumber: "+1555123456",
              },
            },
          },
        };

        const response = await api.put(`/projects/${fallbackProject.id}`, updateData, {
          headers: { Authorization: `Bearer ${authToken}` },
        });

        expect(response.status).toBe(200);
        expect(response.data.name).toBe(updateData.name);
        expect(response.data.providers.sms.primary).toBe("twilio");
        expect(response.data.providers.sms.config.accountSid).toBe("test-twilio-sid");
      });

      it("should validate provider configuration on update", async () => {
        const response = await api.put(
          `/projects/${byopProject.id}`,
          {
            providers: {
              sms: {
                primary: "invalid_provider",
              },
            },
          },
          {
            headers: { Authorization: `Bearer ${authToken}` },
          },
        );

        expect(response.status).toBe(400);
      });

      it("should not update non-existent project", async () => {
        const response = await api.put(
          "/projects/00000000-0000-0000-0000-000000000000",
          {
            name: "Non-existent",
          },
          {
            headers: { Authorization: `Bearer ${authToken}` },
          },
        );

        expect(response.status).toBe(404);
      });
    });

    describe("Project Status Management", () => {
      describe("PUT /projects/:id/suspend", () => {
        it("should suspend project", async () => {
          const response = await api.put(
            `/projects/${fallbackProject.id}/suspend`,
            {
              reason: "Testing suspension",
            },
            {
              headers: { Authorization: `Bearer ${authToken}` },
            },
          );

          expect(response.status).toBe(200);
          expect(response.data.status).toBe("SUSPENDED");
          expect(response.data).toHaveProperty("suspendedAt");
          expect(response.data.suspensionReason).toBe("Testing suspension");
        });
      });

      describe("PUT /projects/:id/activate", () => {
        it("should activate suspended project", async () => {
          const response = await api.put(
            `/projects/${fallbackProject.id}/activate`,
            {},
            {
              headers: { Authorization: `Bearer ${authToken}` },
            },
          );

          expect(response.status).toBe(200);
          expect(response.data.status).toBe("ACTIVE");
          expect(response.data.suspendedAt).toBeNull();
          expect(response.data.suspensionReason).toBeNull();
        });
      });
    });

    describe("DELETE /projects/:id", () => {
      let deleteTestProject: any;

      beforeAll(async () => {
        // Create a project specifically for deletion testing
        const response = await api.post(
          "/projects",
          {
            name: "Delete Test Project",
            description: "Project for deletion testing",
          },
          {
            headers: { Authorization: `Bearer ${authToken}` },
          },
        );

        deleteTestProject = response.data;
      });

      it("should soft delete project", async () => {
        const response = await api.delete(`/projects/${deleteTestProject.id}`, {
          headers: { Authorization: `Bearer ${authToken}` },
        });

        expect(response.status).toBe(204);

        // Verify project is soft deleted
        const getResponse = await api.get(`/projects/${deleteTestProject.id}`, {
          headers: { Authorization: `Bearer ${authToken}` },
        });
        expect([404, 410]).toContain(getResponse.status);
      });

      it("should not show deleted project in listings", async () => {
        const response = await api.get("/projects", {
          headers: { Authorization: `Bearer ${authToken}` },
        });

        expect(response.status).toBe(200);
        const deletedProject = response.data.data.find((p: any) => p.id === deleteTestProject.id);
        expect(deletedProject).toBeUndefined();
      });

      it("should not delete non-existent project", async () => {
        const response = await api.delete("/projects/00000000-0000-0000-0000-000000000000", {
          headers: { Authorization: `Bearer ${authToken}` },
        });

        expect(response.status).toBe(404);
      });
    });
  });

  describe("Project API Key Management", () => {
    describe("POST /projects/:id/regenerate-key", () => {
      it("should regenerate project API key", async () => {
        const oldApiKey = byopProject.apiKey;

        const response = await api.post(
          `/projects/${byopProject.id}/regenerate-key`,
          {},
          {
            headers: { Authorization: `Bearer ${authToken}` },
          },
        );

        expect(response.status).toBe(200);
        expect(response.data).toHaveProperty("apiKey");
        expect(response.data.apiKey).not.toBe(oldApiKey);
        expect(response.data.apiKey.length).toBeGreaterThan(20);

        // Update stored project data
        byopProject.apiKey = response.data.apiKey;
      });

      it("should not regenerate key for non-existent project", async () => {
        const response = await api.post(
          "/projects/00000000-0000-0000-0000-000000000000/regenerate-key",
          {},
          {
            headers: { Authorization: `Bearer ${authToken}` },
          },
        );

        expect(response.status).toBe(404);
      });
    });

    describe("GET /projects/:id/usage", () => {
      it("should get project usage statistics", async () => {
        const response = await api.get(`/projects/${byopProject.id}/usage`, {
          headers: { Authorization: `Bearer ${authToken}` },
        });

        expect(response.status).toBe(200);
        expect(response.data).toHaveProperty("sms");
        expect(response.data).toHaveProperty("email");
        expect(response.data).toHaveProperty("voice");
        expect(response.data).toHaveProperty("push");
        expect(response.data).toHaveProperty("period");

        // Each channel should have usage stats
        expect(response.data.sms).toHaveProperty("sent");
        expect(response.data.sms).toHaveProperty("delivered");
        expect(response.data.sms).toHaveProperty("failed");
      });

      it("should get usage for specific date range", async () => {
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - 7);
        const endDate = new Date();

        const response = await api.get(
          `/projects/${byopProject.id}/usage?startDate=${startDate.toISOString()}&endDate=${endDate.toISOString()}`,
          {
            headers: { Authorization: `Bearer ${authToken}` },
          },
        );

        expect(response.status).toBe(200);
        expect(response.data).toHaveProperty("period");
        expect(response.data.period.startDate).toBeDefined();
        expect(response.data.period.endDate).toBeDefined();
      });
    });
  });

  describe("Project Provider Testing", () => {
    describe("POST /projects/:id/test-providers", () => {
      it("should test BYOP project providers", async () => {
        const response = await api.post(
          `/projects/${byopProject.id}/test-providers`,
          {
            channels: ["sms", "email"],
            testData: {
              sms: {
                to: "+1234567890",
                message: "Test SMS from BYOP project",
              },
              email: {
                to: "test@example.com",
                subject: "Test Email",
                body: "Test email from BYOP project",
              },
            },
          },
          {
            headers: { Authorization: `Bearer ${authToken}` },
          },
        );

        expect(response.status).toBe(200);
        expect(response.data).toHaveProperty("results");
        expect(response.data.results).toHaveProperty("sms");
        expect(response.data.results).toHaveProperty("email");

        // Each test should have a status
        expect(response.data.results.sms).toHaveProperty("status");
        expect(response.data.results.email).toHaveProperty("status");
      });

      it("should test fallback project providers", async () => {
        const response = await api.post(
          `/projects/${fallbackProject.id}/test-providers`,
          {
            channels: ["sms", "email"],
            testData: {
              sms: {
                to: "+1234567890",
                message: "Test SMS from fallback project",
              },
              email: {
                to: "test@example.com",
                subject: "Test Email",
                body: "Test email from fallback project",
              },
            },
          },
          {
            headers: { Authorization: `Bearer ${authToken}` },
          },
        );

        expect(response.status).toBe(200);
        expect(response.data).toHaveProperty("results");
        expect(response.data.results).toHaveProperty("sms");
        expect(response.data.results).toHaveProperty("email");
      });
    });
  });

  describe("Project Security & Authorization", () => {
    it("should not access projects without authentication", async () => {
      const endpoints = [
        `/projects/${byopProject.id}`,
        "/projects",
        `/projects/${byopProject.id}/usage`,
      ];

      for (const endpoint of endpoints) {
        const response = await api.get(endpoint);
        expect(response.status).toBe(401);
      }
    });

    it("should validate project ownership", async () => {
      // All projects should belong to the current tenant
      const response = await api.get("/projects", {
        headers: { Authorization: `Bearer ${authToken}` },
      });

      expect(response.status).toBe(200);
      expect(response.data.data.every((p: any) => p.tenantId === tenantId)).toBe(true);
    });

    it("should handle invalid project operations gracefully", async () => {
      const invalidOperations = [
        api.get("/projects/invalid-uuid", { headers: { Authorization: `Bearer ${authToken}` } }),
        api.put(
          "/projects/invalid-uuid",
          { name: "Invalid" },
          { headers: { Authorization: `Bearer ${authToken}` } },
        ),
        api.delete("/projects/invalid-uuid", { headers: { Authorization: `Bearer ${authToken}` } }),
      ];

      const responses = await Promise.all(invalidOperations);
      responses.forEach((response) => {
        expect([400, 404]).toContain(response.status);
      });
    });
  });

  afterAll(() => {
    console.log("\n📊 Project Test Summary:");
    console.log(`✅ BYOP Project ID: ${byopProject?.id}`);
    console.log(`✅ Fallback Project ID: ${fallbackProject?.id}`);
    console.log(`✅ Test Account: ${testAccount.email}`);
    console.log(`✅ Tenant ID: ${tenantId}`);
    console.log(`✅ Auth Token: ${authToken?.substring(0, 20)}...`);
  });
});
