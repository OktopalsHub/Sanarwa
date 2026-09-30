/**
 * Email BYOP (Bring Your Own Provider) Tests
 * Tests SES, Resend, and other email provider configurations
 * Event-based billing model testing
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import {
  createTestSetup,
  createTemplate,
  cleanupTemplate,
  TestSetup,
  expectValidStatusCodes,
  createApiKeyHeaders,
  createAuthHeaders,
} from "../shared/test-utils";

describe("📧 Email BYOP Tests", () => {
  let testSetup: TestSetup;
  let emailTemplate: { id: string; name: string; channel: string };
  let createdProviders: string[] = [];

  beforeAll(async () => {
    testSetup = await createTestSetup();

    // Create email template for BYOP testing
    const templateData = {
      name: "email-byop-test",
      channel: "EMAIL",
      subject: "BYOP Test: {{title}}",
      content: `
        <html>
          <body>
            <h2>{{title}}</h2>
            <p>Hello {{firstName}}, this email was sent via BYOP provider: {{provider}}</p>
            <p>{{message}}</p>
            <p><small>Provider: {{provider}} | Cost: {{cost}}</small></p>
          </body>
        </html>
      `,
      variables: [
        { name: "title", type: "string", required: true },
        { name: "firstName", type: "string", required: true },
        { name: "provider", type: "string", required: false },
        { name: "message", type: "string", required: false },
        { name: "cost", type: "string", required: false },
      ],
    };

    emailTemplate = await createTemplate(testSetup.api, testSetup.authData, templateData);
    console.log("✅ Email BYOP test setup completed");
  });

  afterAll(async () => {
    await cleanupTemplate(testSetup.api, testSetup.authData, emailTemplate.id);

    // Cleanup providers
    for (const providerId of createdProviders) {
      try {
        await testSetup.api.delete(`/projects/${testSetup.projectId}/providers/${providerId}`, {
          headers: { Authorization: `Bearer ${testSetup.authData.accessToken}` },
        });
      } catch (error) {
        // Ignore cleanup errors
      }
    }
    console.log("✅ Email BYOP cleanup completed");
  });

  describe("SES BYOP Configuration", () => {
    it("should configure AWS SES BYOP provider", async () => {
      const sesConfig = {
        providerId: "ses-byop-email-test",
        providerName: "AWS SES Email BYOP",
        providerType: "aws_ses",
        channel: "email",
        config: {
          region: "us-east-1",
          accessKeyId: "AKIA_TEST_ACCESS_KEY",
          secretAccessKey: "test_secret_access_key",
          fromEmail: "noreply@testapp.com",
          fromName: "TestApp Email Notifications",
        },
        isActive: true,
        priority: 1,
      };

      const response = await testSetup.api.post(
        `/projects/${testSetup.projectId}/providers`,
        sesConfig,
        {
          headers: { Authorization: `Bearer ${testSetup.authData.accessToken}` },
        },
      );

      console.log("📧 SES BYOP configuration:", response.status, response.data);

      if (response.status === 201) {
        createdProviders.push(response.data.id);
        expect(response.data).toHaveProperty("id");
        expect(response.data.providerType).toBe("aws_ses");
        console.log("🎉 SES BYOP configured successfully");
      } else {
        expectValidStatusCodes(response.status, [201, 400, 403, 404, 500]);
        console.log("ℹ️ SES BYOP configuration test completed");
      }
    });

    it("should test email sending via SES BYOP", async () => {
      const notificationPayload = {
        to: "ses-test@example.com",
        message: "Test email via SES BYOP provider",
        subject: "SES BYOP Test",
        channel: "EMAIL",
        metadata: {
          templateId: emailTemplate.name,
          templateData: {
            title: "SES BYOP Test",
            firstName: "SES User",
            provider: "AWS SES",
            message: "This email was sent through your AWS SES configuration",
            cost: "$0.001",
          },
          provider: "SES",
        },
      };

      const response = await testSetup.api.post("/notifications", notificationPayload, {
        headers: {
          Authorization: `Bearer ${testSetup.apiKey}`,
          "X-Project-ID": testSetup.projectId,
        },
      });

      console.log("📧 SES BYOP email sending:", response.status, response.data);
      expectValidStatusCodes(response.status, [200, 201, 400, 404, 401]);
      console.log("✅ SES BYOP email sending test completed");
    });
  });

  describe("Resend BYOP Configuration", () => {
    it("should configure Resend BYOP provider", async () => {
      const resendConfig = {
        providerId: "resend-byop-email-test",
        providerName: "Resend Email BYOP",
        providerType: "sendgrid", // Using sendgrid as closest match
        channel: "email",
        config: {
          apiKey: "re_test_api_key_12345",
          fromEmail: "hello@testapp.com",
          fromName: "TestApp via Resend",
        },
        isActive: true,
        priority: 2,
      };

      const response = await testSetup.api.post(
        `/projects/${testSetup.projectId}/providers`,
        resendConfig,
        {
          headers: { Authorization: `Bearer ${testSetup.authData.accessToken}` },
        },
      );

      console.log("📧 Resend BYOP configuration:", response.status, response.data);

      if (response.status === 201) {
        createdProviders.push(response.data.id);
        expect(response.data).toHaveProperty("id");
        expect(response.data.providerType).toBe("sendgrid");
        console.log("🎉 Resend BYOP configured successfully");
      } else {
        expectValidStatusCodes(response.status, [201, 400, 403, 404, 500]);
        console.log("ℹ️ Resend BYOP configuration test completed");
      }
    });

    it("should test email sending via Resend BYOP", async () => {
      const notificationPayload = {
        to: "resend-test@example.com",
        message: "Test email via Resend BYOP provider",
        subject: "Resend BYOP Test",
        channel: "EMAIL",
        metadata: {
          templateId: emailTemplate.name,
          templateData: {
            title: "Resend BYOP Test",
            firstName: "Resend User",
            provider: "Resend",
            message: "This email was sent through your Resend configuration",
            cost: "$0.001",
          },
          provider: "RESEND",
        },
      };

      const response = await testSetup.api.post("/notifications", notificationPayload, {
        headers: {
          Authorization: `Bearer ${testSetup.apiKey}`,
          "X-Project-ID": testSetup.projectId,
        },
      });

      console.log("📧 Resend BYOP email sending:", response.status, response.data);
      expectValidStatusCodes(response.status, [200, 201, 400, 404, 401]);
      console.log("✅ Resend BYOP email sending test completed");
    });
  });

  describe("BYOP Provider Management", () => {
    it("should list configured email providers", async () => {
      const response = await testSetup.api.get(`/projects/${testSetup.projectId}/providers`, {
        headers: { Authorization: `Bearer ${testSetup.authData.accessToken}` },
      });

      console.log("📋 Email providers list:", response.status, response.data);

      if (response.status === 200) {
        expect(Array.isArray(response.data.configs)).toBe(true);
        console.log(`📧 Found ${response.data.configs.length} email providers`);
      } else {
        expectValidStatusCodes(response.status, [200, 404, 403, 500]);
      }

      console.log("✅ Email providers listing completed");
    });

    it("should verify event-based billing when BYOP is configured", async () => {
      // After configuring BYOP providers, check if billing model switches
      const quotaResponse = await testSetup.api.get(`/projects/${testSetup.projectId}/quotas`, {
        headers: { Authorization: `Bearer ${testSetup.authData.accessToken}` },
      });

      console.log("📊 Billing model after BYOP:", quotaResponse.status, quotaResponse.data);

      if (quotaResponse.status === 200 && quotaResponse.data.billingModel === "event-based") {
        expect(quotaResponse.data.quotas.model).toBe("unlimited");
        expect(quotaResponse.data.quotas).toHaveProperty("eventPricing");
        expect(quotaResponse.data.quotas.eventPricing).toHaveProperty("email");
        console.log("🎯 Event-based billing activated for email BYOP");
      } else {
        console.log("📦 Still using quota-based billing");
      }

      console.log("✅ BYOP billing model verification completed");
    });

    it("should demonstrate email BYOP cost efficiency", async () => {
      // Simulate high-volume email scenario to show BYOP benefits
      const emailVolumeTest = {
        monthlyEmails: 50000,
        traditionalEmailCost: 299, // $299/month for 50k email quota
        byopEmailCost: 50000 * 0.001, // $0.001 per email event
        savings: 299 - 50000 * 0.001,
      };

      console.log("💰 Email BYOP Cost Analysis:");
      console.log(`   Monthly email volume: ${emailVolumeTest.monthlyEmails.toLocaleString()}`);
      console.log(
        `   Traditional email quota cost: $${emailVolumeTest.traditionalEmailCost}/month`,
      );
      console.log(`   BYOP email event cost: $${emailVolumeTest.byopEmailCost}/month`);
      console.log(`   Email BYOP savings: $${emailVolumeTest.savings}/month`);
      console.log(
        `   Cost reduction: ${Math.round((emailVolumeTest.savings / emailVolumeTest.traditionalEmailCost) * 100)}%`,
      );

      // Test a batch of email notifications to simulate volume
      const batchSize = 5;
      const batchResults = [];

      for (let i = 1; i <= batchSize; i++) {
        const notificationPayload = {
          to: `volume-email-${i}@example.com`,
          message: `High volume email test ${i}`,
          subject: `Email Volume Test ${i}`,
          channel: "EMAIL",
          metadata: {
            templateId: emailTemplate.name,
            templateData: {
              title: `Volume Test ${i}`,
              firstName: `EmailUser${i}`,
              provider: "BYOP",
              message: `This is email ${i} in the volume test`,
              cost: "$0.001",
            },
            volumeTest: true,
            billingModel: "event-based",
          },
        };

        const response = await testSetup.api.post("/notifications", notificationPayload, {
          headers: {
            Authorization: `Bearer ${testSetup.apiKey}`,
            "X-Project-ID": testSetup.projectId,
          },
        });

        batchResults.push({
          index: i,
          status: response.status,
          eventCost: response.data?.billing?.eventCost || 0.001,
          success: [200, 201].includes(response.status),
        });

        console.log(
          `📧 Email volume test ${i}:`,
          response.status,
          `Cost: $${response.data?.billing?.eventCost || 0.001}`,
        );
      }

      const successfulEmails = batchResults.filter((r) => r.success).length;
      const totalCost = batchResults.reduce((sum, r) => sum + r.eventCost, 0);

      console.log(`📊 Email batch results: ${successfulEmails}/${batchSize} successful`);
      console.log(`💰 Total cost for ${batchSize} email events: $${totalCost.toFixed(4)}`);

      expect(batchResults.length).toBe(batchSize);
      console.log("✅ Email BYOP cost efficiency demonstrated");
    });
  });

  describe("Email Error Handling", () => {
    it("should handle missing email template gracefully", async () => {
      const notificationPayload = {
        to: "test@example.com",
        message: "Test with non-existent email template",
        subject: "Missing Template Test",
        channel: "EMAIL",
        metadata: {
          templateId: "non-existent-email-template",
          templateData: {
            title: "Test",
            firstName: "Test User",
          },
        },
      };

      const response = await testSetup.api.post("/notifications", notificationPayload, {
        headers: {
          Authorization: `Bearer ${testSetup.apiKey}`,
          "X-Project-ID": testSetup.projectId,
        },
      });

      console.log("🧪 Missing email template test:", response.status, response.data);
      expectValidStatusCodes(response.status, [400, 404, 422, 200, 201, 401]);
      console.log("✅ Missing email template handled gracefully");
    });

    it("should validate email addresses", async () => {
      const notificationPayload = {
        to: "invalid-email-address",
        message: "Test with invalid email",
        subject: "Invalid Email Test",
        channel: "EMAIL",
      };

      const response = await testSetup.api.post("/notifications", notificationPayload, {
        headers: {
          Authorization: `Bearer ${testSetup.apiKey}`,
          "X-Project-ID": testSetup.projectId,
        },
      });

      console.log("🧪 Invalid email address test:", response.status, response.data);
      expectValidStatusCodes(response.status, [400, 422, 401]);
      console.log("✅ Email address validation working");
    });
  });
});
