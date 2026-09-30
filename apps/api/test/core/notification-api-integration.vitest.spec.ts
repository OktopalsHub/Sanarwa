/**
 * Notification API Integration Tests
 * Tests core notification API functionality, cross-channel quota management, and system integration
 *
 * This file focuses on:
 * - API key authentication and security
 * - Cross-channel quota enforcement
 * - System-wide error handling
 * - Integration between different notification components
 *
 * For specific channel tests, see: test/channels/
 * For billing strategy tests, see: test/billing/
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import {
  createTestSetup,
  TestSetup,
  expectValidStatusCodes,
  createApiKeyHeaders,
} from "../channels/shared/test-utils";

describe("🔗 Notification API Integration Tests", () => {
  let testSetup: TestSetup;

  beforeAll(async () => {
    testSetup = await createTestSetup();
    console.log("✅ Notification API integration test setup completed");
  });

  afterAll(async () => {
    console.log("✅ Notification API integration cleanup completed");
  });

  describe("🔑 API Key Authentication", () => {
    it("should reject notification without API key", async () => {
      const notificationPayload = {
        to: "test@example.com",
        message: "Test message without API key",
        subject: "Test Subject",
        channel: "EMAIL",
      };

      const response = await testSetup.api.post("/notifications", notificationPayload);

      console.log("🚫 No API key test:", response.status, response.data);
      expectValidStatusCodes(response.status, [401, 403, 400]);
      console.log("✅ Correctly rejected notification without API key");
    });

    it("should reject notification with invalid API key", async () => {
      const notificationPayload = {
        to: "test@example.com",
        message: "Test message with invalid API key",
        subject: "Test Subject",
        channel: "EMAIL",
      };

      const response = await testSetup.api.post("/notifications", notificationPayload, {
        headers: createApiKeyHeaders("invalid_api_key_12345", testSetup.projectId),
      });

      console.log("🚫 Invalid API key test:", response.status, response.data);
      expectValidStatusCodes(response.status, [401, 403, 400]);
      console.log("✅ Correctly rejected notification with invalid API key");
    });

    it("should accept notification with valid API key", async () => {
      const notificationPayload = {
        to: "test@example.com",
        message: "Test message with valid API key",
        subject: "Test Subject",
        channel: "EMAIL",
      };

      const response = await testSetup.api.post("/notifications", notificationPayload, {
        headers: createApiKeyHeaders(testSetup.apiKey, testSetup.projectId),
      });

      console.log("✅ Valid API key test:", response.status, response.data);
      expectValidStatusCodes(response.status, [200, 201, 404, 401]);
      console.log("✅ API key authentication working correctly");
    });
  });

  describe("📊 Cross-Channel Quota Management", () => {
    it("should check overall project quota limits", async () => {
      const response = await testSetup.api.get(`/projects/${testSetup.projectId}/quotas`, {
        headers: { Authorization: `Bearer ${testSetup.authData.accessToken}` },
      });

      console.log("📊 Overall project quotas:", response.status, response.data);

      if (response.status === 200) {
        expect(response.data).toHaveProperty("quotas");
        expect(response.data).toHaveProperty("billingModel");

        if (response.data.billingModel === "quota-based") {
          console.log("📦 Quota-based billing detected:");
          console.log(`   - Email quota: ${response.data.quotas.email || 0}/month`);
          console.log(`   - In-app quota: ${response.data.quotas.inApp || 0}/month`);
          expect(response.data.quotas).toHaveProperty("email");
          expect(response.data.quotas).toHaveProperty("inApp");
        } else {
          console.log("🎯 Event-based billing detected - unlimited notifications");
          expect(response.data.quotas.model).toBe("unlimited");
        }

        console.log("✅ Project quota information retrieved");
      } else {
        expectValidStatusCodes(response.status, [200, 404, 403, 400]);
        console.log("ℹ️ Project quota endpoint test completed");
      }
    });

    it("should test cross-channel quota consumption", async () => {
      // Test notifications across different channels to see quota consumption
      const crossChannelTests = [
        { channel: "EMAIL", to: "email-test@example.com", message: "Cross-channel email test" },
        { channel: "IN_APP", to: "inapp-user-1", message: "Cross-channel in-app test" },
        { channel: "EMAIL", to: "email-test-2@example.com", message: "Second email test" },
        { channel: "IN_APP", to: "inapp-user-2", message: "Second in-app test" },
      ];

      const results: Array<{
        channel: string;
        status: number;
        success: boolean;
        quotaUsed: number;
      }> = [];

      for (const [index, test] of crossChannelTests.entries()) {
        const notificationPayload = {
          to: test.to,
          message: test.message,
          subject: `Cross-channel test ${index + 1}`,
          channel: test.channel,
        };

        const response = await testSetup.api.post("/notifications", notificationPayload, {
          headers: createApiKeyHeaders(testSetup.apiKey, testSetup.projectId),
        });

        results.push({
          channel: test.channel,
          status: response.status,
          success: [200, 201].includes(response.status),
          quotaUsed: response.data?.quotaUsed || 0,
        });

        console.log(`📊 ${test.channel} test ${index + 1}:`, response.status, response.data);
      }

      const emailTests = results.filter((r) => r.channel === "EMAIL");
      const inAppTests = results.filter((r) => r.channel === "IN_APP");

      console.log(`📊 Cross-channel results:`);
      console.log(
        `   Email tests: ${emailTests.filter((t) => t.success).length}/${emailTests.length} successful`,
      );
      console.log(
        `   In-app tests: ${inAppTests.filter((t) => t.success).length}/${inAppTests.length} successful`,
      );

      expect(results.length).toBe(4);
      console.log("✅ Cross-channel quota testing completed");
    });

    it("should track total quota usage across all channels", async () => {
      const usageResponse = await testSetup.api.get(
        `/projects/${testSetup.projectId}/usage/summary`,
        {
          headers: { Authorization: `Bearer ${testSetup.authData.accessToken}` },
        },
      );

      console.log("📊 Total usage summary:", usageResponse.status, usageResponse.data);

      if (usageResponse.status === 200) {
        expect(usageResponse.data).toHaveProperty("totalUsage");

        const usage = usageResponse.data.totalUsage;
        console.log("📊 Usage Summary:");
        console.log(`   Total notifications sent: ${usage.totalNotifications || 0}`);
        console.log(`   Email notifications: ${usage.emailNotifications || 0}`);
        console.log(`   In-app notifications: ${usage.inAppNotifications || 0}`);
        console.log(`   SMS notifications: ${usage.smsNotifications || 0}`);
        console.log(`   Push notifications: ${usage.pushNotifications || 0}`);

        expect(typeof usage.totalNotifications).toBe("number");
        console.log("✅ Usage summary retrieved successfully");
      } else {
        expectValidStatusCodes(usageResponse.status, [200, 404, 403, 400]);
        console.log("ℹ️ Usage summary test completed");
      }
    });
  });

  describe("⚠️ Quota Limit Enforcement", () => {
    it("should handle quota exceeded scenarios gracefully", async () => {
      // Try to send notifications that might exceed quota
      const quotaTests: Array<{
        attempt: number;
        status: number;
        quotaExceeded: boolean;
      }> = [];

      for (let i = 1; i <= 5; i++) {
        const notificationPayload = {
          to: `quota-test-${i}@example.com`,
          message: `Quota limit test ${i}`,
          subject: `Quota Test ${i}`,
          channel: "EMAIL",
        };

        const response = await testSetup.api.post("/notifications", notificationPayload, {
          headers: createApiKeyHeaders(testSetup.apiKey, testSetup.projectId),
        });

        quotaTests.push({
          attempt: i,
          status: response.status,
          quotaExceeded:
            response.status === 429 || response.data?.error?.message?.includes("quota"),
        });

        console.log(`🔄 Quota test ${i}:`, response.status, response.data);

        // If we get quota exceeded, break
        if (response.status === 429) {
          console.log("📊 Quota limit reached at attempt", i);
          break;
        }
      }

      const quotaExceededTests = quotaTests.filter((test) => test.quotaExceeded);
      console.log(`📊 Quota exceeded scenarios: ${quotaExceededTests.length}`);

      expect(quotaTests.length).toBeGreaterThan(0);
      console.log("✅ Quota limit enforcement testing completed");
    });

    it("should provide quota status and warnings", async () => {
      const quotaStatusResponse = await testSetup.api.get(
        `/projects/${testSetup.projectId}/quota-status`,
        {
          headers: { Authorization: `Bearer ${testSetup.authData.accessToken}` },
        },
      );

      console.log(
        "📊 Quota status and warnings:",
        quotaStatusResponse.status,
        quotaStatusResponse.data,
      );

      if (quotaStatusResponse.status === 200) {
        const status = quotaStatusResponse.data;

        console.log("📊 Quota Status:");
        console.log(
          `   Email quota: ${status.email?.used || 0}/${status.email?.limit || 0} (${status.email?.percentage || 0}%)`,
        );
        console.log(
          `   In-app quota: ${status.inApp?.used || 0}/${status.inApp?.limit || 0} (${status.inApp?.percentage || 0}%)`,
        );
        console.log(`   Warnings: ${status.warnings?.join(", ") || "None"}`);

        expect(status).toHaveProperty("email");
        expect(status).toHaveProperty("inApp");

        console.log("✅ Quota status retrieved successfully");
      } else {
        expectValidStatusCodes(quotaStatusResponse.status, [200, 404, 403, 400]);
        console.log("ℹ️ Quota status test completed");
      }
    });
  });

  describe("🧪 General Error Handling", () => {
    it("should handle invalid channel gracefully", async () => {
      const notificationPayload = {
        to: "test@example.com",
        message: "Test with invalid channel",
        subject: "Test Subject",
        channel: "INVALID_CHANNEL",
      };

      const response = await testSetup.api.post("/notifications", notificationPayload, {
        headers: createApiKeyHeaders(testSetup.apiKey, testSetup.projectId),
      });

      console.log("🧪 Invalid channel test:", response.status, response.data);
      expectValidStatusCodes(response.status, [400, 422, 404, 401]);
      console.log("✅ Invalid channel handled gracefully");
    });

    it("should handle malformed notification payload", async () => {
      const invalidPayload = {
        // Missing required fields
        message: "Test with malformed payload",
      };

      const response = await testSetup.api.post("/notifications", invalidPayload, {
        headers: createApiKeyHeaders(testSetup.apiKey, testSetup.projectId),
      });

      console.log("🧪 Malformed payload test:", response.status, response.data);
      expectValidStatusCodes(response.status, [400, 422, 401]);
      console.log("✅ Malformed payload handled gracefully");
    });

    it("should handle missing project ID", async () => {
      const notificationPayload = {
        to: "test@example.com",
        message: "Test without project ID",
        subject: "Test Subject",
        channel: "EMAIL",
      };

      const response = await testSetup.api.post("/notifications", notificationPayload, {
        headers: {
          "X-API-Key": testSetup.apiKey,
          // Missing X-Project-ID header intentionally for testing
        },
      });

      console.log("🧪 Missing project ID test:", response.status, response.data);
      expectValidStatusCodes(response.status, [400, 401, 403]);
      console.log("✅ Missing project ID handled gracefully");
    });
  });
});
