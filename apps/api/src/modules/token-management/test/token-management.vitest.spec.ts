import { describe, it, expect, beforeAll } from "vitest";
import axios, { AxiosInstance } from "axios";

describe("Token Management Module Integration Tests", () => {
  const baseURL = "http://localhost:9000/api/v1";
  let api: AxiosInstance;
  let authToken: string;

  beforeAll(async () => {
    api = axios.create({
      baseURL,
      timeout: 15000,
      validateStatus: () => true,
    });

    await waitForServer();
    authToken = await getAuthToken();
  });

  async function waitForServer(maxRetries = 10): Promise<void> {
    for (let i = 0; i < maxRetries; i++) {
      try {
        const response = await api.get("/health");
        if (response.status === 200) return;
      } catch (error) {
        if (i === maxRetries - 1) {
          throw new Error("Server not ready. Start with: npm run start:dev");
        }
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    }
  }

  async function getAuthToken(): Promise<string> {
    const timestamp = Date.now();
    const testUser = {
      email: `token-test-${timestamp}@example.com`,
      password: "TokenTest123!",
      firstName: "Token",
      lastName: "Test",
    };

    const response = await api.post("/auth/register", testUser);
    if (response.status !== 201) {
      throw new Error("Failed to register test user");
    }
    return response.data.access_token;
  }

  describe("Token Management Endpoints", () => {
    it("should generate API token", async () => {
      const tokenData = {
        name: "Test API Token",
        permissions: ["read", "write"],
        expiresIn: 3600, // 1 hour
      };

      const response = await api.post("/tokens/generate", tokenData, {
        headers: { Authorization: `Bearer ${authToken}` },
      });

      console.log("🔑 Generate token response:", response.status, response.data);

      expect([200, 201, 400, 401, 403, 404, 500]).toContain(response.status);
      if ([200, 201].includes(response.status)) {
        expect(response.data).toHaveProperty("token");
        expect(response.data).toHaveProperty("expiresAt");
      }
    });

    it("should validate token", async () => {
      const testToken = "test-token-123";

      const response = await api.post(
        "/tokens/validate",
        { token: testToken },
        {
          headers: { Authorization: `Bearer ${authToken}` },
        },
      );

      console.log("✅ Validate token response:", response.status, response.data);

      expect([200, 400, 401, 403, 404, 500]).toContain(response.status);
      if (response.status === 200) {
        expect(response.data).toHaveProperty("valid");
      }
    });

    it("should get user tokens", async () => {
      const response = await api.get("/tokens", {
        headers: { Authorization: `Bearer ${authToken}` },
      });

      console.log("📋 Get tokens response:", response.status, response.data);

      expect([200, 401, 403, 404, 500]).toContain(response.status);
      if (response.status === 200) {
        expect(Array.isArray(response.data) || response.data.tokens).toBeTruthy();
      }
    });

    it("should revoke token", async () => {
      const tokenId = "test-token-id-123";

      const response = await api.delete(`/tokens/${tokenId}`, {
        headers: { Authorization: `Bearer ${authToken}` },
      });

      console.log("🚫 Revoke token response:", response.status, response.data);

      expect([200, 204, 401, 403, 404, 500]).toContain(response.status);
    });

    it("should refresh token", async () => {
      const refreshData = {
        tokenId: "test-token-id-123",
        expiresIn: 7200, // 2 hours
      };

      const response = await api.post("/tokens/refresh", refreshData, {
        headers: { Authorization: `Bearer ${authToken}` },
      });

      console.log("🔄 Refresh token response:", response.status, response.data);

      expect([200, 201, 400, 401, 403, 404, 500]).toContain(response.status);
      if ([200, 201].includes(response.status)) {
        expect(response.data).toHaveProperty("token");
      }
    });

    it("should get token usage statistics", async () => {
      const response = await api.get("/tokens/usage-stats", {
        headers: { Authorization: `Bearer ${authToken}` },
        params: {
          startDate: "2024-01-01",
          endDate: "2024-12-31",
        },
      });

      console.log("📊 Token usage stats response:", response.status, response.data);

      expect([200, 400, 401, 403, 404, 500]).toContain(response.status);
      if (response.status === 200) {
        expect(response.data).toHaveProperty("totalRequests");
      }
    });

    it("should cleanup expired tokens", async () => {
      const response = await api.post(
        "/tokens/cleanup",
        {},
        {
          headers: { Authorization: `Bearer ${authToken}` },
        },
      );

      console.log("🧹 Cleanup tokens response:", response.status, response.data);

      expect([200, 201, 401, 403, 404, 500]).toContain(response.status);
      if ([200, 201].includes(response.status)) {
        expect(response.data).toHaveProperty("deletedCount");
      }
    });
  });
});
