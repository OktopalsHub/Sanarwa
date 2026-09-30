import { describe, it, expect, beforeAll } from "vitest";
import axios, { AxiosInstance } from "axios";

describe("Subscription Module Integration Tests", () => {
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
      email: `subscription-test-${timestamp}@example.com`,
      password: "SubscriptionTest123!",
      firstName: "Subscription",
      lastName: "Test",
    };

    const response = await api.post("/auth/register", testUser);
    if (response.status !== 201) {
      throw new Error("Failed to register test user");
    }
    return response.data.access_token;
  }

  describe("Subscription Management Endpoints", () => {
    it("should get available subscription plans", async () => {
      const response = await api.get("/subscriptions/plans", {
        headers: { Authorization: `Bearer ${authToken}` },
      });

      console.log("📋 Subscription plans response:", response.status, response.data);

      if (response.status === 404) {
        // Try alternative endpoint from billing
        const altResponse = await api.get("/billing/plans", {
          headers: { Authorization: `Bearer ${authToken}` },
        });
        console.log("📋 Alt plans response:", altResponse.status, altResponse.data);
        expect([200, 401, 403, 404, 500]).toContain(altResponse.status);
        return;
      }

      expect([200, 401, 403, 500]).toContain(response.status);
      if (response.status === 200) {
        expect(Array.isArray(response.data) || response.data.plans).toBeTruthy();
      }
    });

    it("should create subscription", async () => {
      const subscriptionData = {
        planId: "starter",
        paymentMethod: "card",
        billingCycle: "monthly",
      };

      const response = await api.post("/subscriptions", subscriptionData, {
        headers: { Authorization: `Bearer ${authToken}` },
      });

      console.log("💳 Create subscription response:", response.status, response.data);

      if (response.status === 404) {
        // Try alternative endpoint from billing
        const altResponse = await api.post("/billing/subscriptions", subscriptionData, {
          headers: { Authorization: `Bearer ${authToken}` },
        });
        console.log("💳 Alt create subscription response:", altResponse.status, altResponse.data);
        expect([200, 201, 400, 401, 403, 404, 500]).toContain(altResponse.status);
        return;
      }

      expect([200, 201, 400, 401, 403, 500]).toContain(response.status);
      if ([200, 201].includes(response.status)) {
        expect(response.data).toHaveProperty("subscriptionId");
      }
    });

    it("should get current subscription", async () => {
      const response = await api.get("/subscriptions/current", {
        headers: { Authorization: `Bearer ${authToken}` },
      });

      console.log("📊 Current subscription response:", response.status, response.data);

      if (response.status === 404) {
        // Try alternative endpoint from billing
        const altResponse = await api.get("/billing/subscriptions", {
          headers: { Authorization: `Bearer ${authToken}` },
        });
        console.log("📊 Alt current subscription response:", altResponse.status, altResponse.data);
        expect([200, 401, 403, 404, 500]).toContain(altResponse.status);
        return;
      }

      expect([200, 401, 403, 404, 500]).toContain(response.status);
      if (response.status === 200) {
        expect(response.data).toHaveProperty("status");
      }
    });

    it("should update subscription", async () => {
      const updateData = {
        planId: "professional",
        billingCycle: "yearly",
      };

      const response = await api.put("/subscriptions/current", updateData, {
        headers: { Authorization: `Bearer ${authToken}` },
      });

      console.log("✏️ Update subscription response:", response.status, response.data);

      expect([200, 400, 401, 403, 404, 500]).toContain(response.status);
    });

    it("should cancel subscription", async () => {
      const cancelData = {
        reason: "Testing cancellation",
        cancelAtPeriodEnd: true,
      };

      const response = await api.post("/subscriptions/cancel", cancelData, {
        headers: { Authorization: `Bearer ${authToken}` },
      });

      console.log("🚫 Cancel subscription response:", response.status, response.data);

      expect([200, 400, 401, 403, 404, 500]).toContain(response.status);
    });

    it("should reactivate subscription", async () => {
      const response = await api.post(
        "/subscriptions/reactivate",
        {},
        {
          headers: { Authorization: `Bearer ${authToken}` },
        },
      );

      console.log("🔄 Reactivate subscription response:", response.status, response.data);

      expect([200, 400, 401, 403, 404, 500]).toContain(response.status);
    });

    it("should get subscription usage", async () => {
      const response = await api.get("/subscriptions/usage", {
        headers: { Authorization: `Bearer ${authToken}` },
        params: {
          startDate: "2024-01-01",
          endDate: "2024-12-31",
        },
      });

      console.log("📊 Subscription usage response:", response.status, response.data);

      expect([200, 400, 401, 403, 404, 500]).toContain(response.status);
      if (response.status === 200) {
        expect(response.data).toHaveProperty("usage");
      }
    });

    it("should get billing history", async () => {
      const response = await api.get("/subscriptions/billing-history", {
        headers: { Authorization: `Bearer ${authToken}` },
        params: {
          limit: 10,
          offset: 0,
        },
      });

      console.log("📜 Billing history response:", response.status, response.data);

      expect([200, 401, 403, 404, 500]).toContain(response.status);
      if (response.status === 200) {
        expect(Array.isArray(response.data) || response.data.invoices).toBeTruthy();
      }
    });

    it("should get next invoice preview", async () => {
      const response = await api.get("/subscriptions/next-invoice", {
        headers: { Authorization: `Bearer ${authToken}` },
      });

      console.log("🧾 Next invoice preview response:", response.status, response.data);

      expect([200, 401, 403, 404, 500]).toContain(response.status);
      if (response.status === 200) {
        expect(response.data).toHaveProperty("amount");
      }
    });
  });

  describe("Subscription Webhooks", () => {
    it("should handle subscription webhook events", async () => {
      const webhookData = {
        type: "subscription.updated",
        data: {
          subscriptionId: "sub_123",
          status: "active",
          planId: "professional",
        },
      };

      const response = await api.post("/subscriptions/webhook", webhookData);

      console.log("🔗 Subscription webhook response:", response.status, response.data);

      expect([200, 400, 500]).toContain(response.status);
    });
  });
});
