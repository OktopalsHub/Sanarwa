import { describe, it, expect, beforeAll } from "vitest";
import axios, { AxiosInstance } from "axios";

describe("Auth & Tenant E2E Tests", () => {
  const baseURL = "http://localhost:9000/api/v1";
  let api: AxiosInstance;

  const timestamp = Date.now();
  const testUser = {
    email: `e2e-test-${timestamp}@example.com`,
    password: "TestPassword123!",
    firstName: "E2E",
    lastName: "User",
  };

  const testUser2 = {
    email: `e2e-test2-${timestamp}@example.com`,
    password: "TestPassword123!",
    firstName: "E2E2",
    lastName: "User2",
  };

  let authTokens: {
    user1?: {
      accessToken: string;
      refreshToken: string;
      userId: string;
    };
    user2?: {
      accessToken: string;
      refreshToken: string;
      userId: string;
    };
  } = {};

  beforeAll(async () => {
    api = axios.create({
      baseURL,
      timeout: 15000,
      validateStatus: () => true,
    });

    await waitForServer();
  });

  async function waitForServer(maxRetries = 15): Promise<void> {
    for (let i = 0; i < maxRetries; i++) {
      try {
        const response = await api.get("/health");
        if (response.status === 200) {
          console.log("✅ Server is ready for E2E tests");
          return;
        }
      } catch (error) {
        if (i === maxRetries - 1) {
          console.log("❌ Server not ready. Please start the server with: pnpm dev");
          throw new Error("Server not ready. Please start the server first.");
        }
        console.log(`⏳ Waiting for server... (${i + 1}/${maxRetries})`);
        await new Promise((resolve) => setTimeout(resolve, 2000));
      }
    }
  }

  describe("Authentication Flow", () => {
    describe("POST /auth/signup", () => {
      it("should signup a new user successfully", async () => {
        const response = await api.post("/auth/signup", testUser);

        expect(response.status).toBe(201);
        expect(response.data).toHaveProperty("access_token");
        expect(response.data).toHaveProperty("refresh_token");
        expect(response.data).toHaveProperty("user");
        expect(response.data.user.email).toBe(testUser.email);
        expect(response.data.user.firstName).toBe(testUser.firstName);
        expect(response.data.user.lastName).toBe(testUser.lastName);

        authTokens.user1 = {
          accessToken: response.data.access_token,
          refreshToken: response.data.refresh_token,
          userId: response.data.user.id,
        };

        console.log("✅ User registration successful");
      });

      it("should register second user for JWT context testing", async () => {
        const response = await api.post("/auth/signup", testUser2);

        expect(response.status).toBe(201);

        authTokens.user2 = {
          accessToken: response.data.access_token,
          refreshToken: response.data.refresh_token,
          userId: response.data.user.id,
        };

        console.log("✅ Second user registered for JWT context tests");
      });
    });

    describe("JWT Context Validation", () => {
      it("should maintain JWT context isolation between users", async () => {
        const user1Response = await api.get("/auth/profile", {
          headers: { Authorization: `Bearer ${authTokens.user1!.accessToken}` },
        });

        const user2Response = await api.get("/auth/profile", {
          headers: { Authorization: `Bearer ${authTokens.user2!.accessToken}` },
        });

        expect(user1Response.status).toBe(200);
        expect(user2Response.status).toBe(200);

        expect(user1Response.data.id).toBe(authTokens.user1!.userId);
        expect(user1Response.data.email).toBe(testUser.email);

        expect(user2Response.data.id).toBe(authTokens.user2!.userId);
        expect(user2Response.data.email).toBe(testUser2.email);

        expect(user1Response.data.id).not.toBe(user2Response.data.id);
        expect(user1Response.data.email).not.toBe(user2Response.data.email);

        console.log("✅ JWT context isolation working correctly");
      });
    });
  });
});
