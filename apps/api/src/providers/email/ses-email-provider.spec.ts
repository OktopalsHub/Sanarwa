import { Test, TestingModule } from "@nestjs/testing";
import { ProviderConfig, ProviderHealth } from "../types";
import { NotificationChannel } from "../../common/enums/notification-channel.enum";
import { EmailPayload } from "./email-provider.interface";
import { SESEmailProvider } from "./ses-email-provider";
import type { Mock } from "vitest";

const mockSend = vi.fn();
const mockDestroy = vi.fn();

vi.mock("@aws-sdk/client-ses", () => ({
  SESClient: class {
    send = mockSend;
    destroy = mockDestroy;
    config = { region: "us-east-1" };
  },
  SendEmailCommand: class {
    constructor(input: unknown) {
      Object.assign(this, input);
    }
  },
  GetSendQuotaCommand: class {
    constructor(input: unknown) {
      Object.assign(this, input);
    }
  },
  GetSendStatisticsCommand: class {
    constructor(input: unknown) {
      Object.assign(this, input);
    }
  },
}));

describe("SESEmailProvider", () => {
  let provider: SESEmailProvider;
  let mockSESClient: any;
  let validConfig: ProviderConfig;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [SESEmailProvider],
    }).compile();

    provider = module.get<SESEmailProvider>(SESEmailProvider);

    validConfig = {
      id: "ses-provider",
      name: "SES Email Provider",
      channel: NotificationChannel.EMAIL,
      priority: 1,
      isActive: true,
      credentials: {
        fromEmail: "test@example.com",
        region: "us-east-1",
        apiKey: "test-key",
        secretKey: "test-secret",
      },
    };

    mockSend.mockReset();
    mockDestroy.mockReset();

    const { SESClient } = require("@aws-sdk/client-ses");
    mockSESClient = { send: mockSend, destroy: mockDestroy };
  });

  afterEach(async () => {
    if (provider.isInitialized) {
      await provider.destroy();
    }
    vi.clearAllMocks();
  });

  describe("initialization", () => {
    it("should initialize successfully with valid config", async () => {
      await provider.initialize(validConfig);

      expect(provider.isInitialized).toBe(true);
      expect(provider.id).toBe("ses");
      expect(provider.name).toBe("AWS SES");
      expect(provider.channel).toBe(NotificationChannel.EMAIL);
    });

    it("should fail initialization with missing fromEmail", async () => {
      const invalidConfig = {
        ...validConfig,
        credentials: { ...validConfig.credentials, fromEmail: "" },
      };

      await expect(provider.initialize(invalidConfig)).rejects.toThrow(
        "Invalid configuration for provider AWS SES",
      );
    });

    it("should fail initialization with invalid email format", async () => {
      const invalidConfig = {
        ...validConfig,
        credentials: { ...validConfig.credentials, fromEmail: "invalid-email" },
      };

      await expect(provider.initialize(invalidConfig)).rejects.toThrow(
        "Invalid configuration for provider AWS SES",
      );
    });
  });

  describe("sending emails", () => {
    beforeEach(async () => {
      await provider.initialize(validConfig);
    });

    it("should send email successfully", async () => {
      const mockResult = { MessageId: "test-message-id" };
      mockSend.mockResolvedValue(mockResult);

      const payload: EmailPayload = {
        recipient: "recipient@example.com",
        subject: "Test Subject",
        htmlContent: "<p>Test HTML content</p>",
        textContent: "Test text content",
        data: {},
      };

      const response = await provider.send(payload);

      expect(response.status).toBe("sent");
      expect(response.providerMessageId).toBe("test-message-id");
      expect(mockSend).toHaveBeenCalledTimes(1);
    });

    it("should handle SES errors", async () => {
      mockSend.mockRejectedValue(new Error("SES API Error"));

      const payload: EmailPayload = {
        recipient: "recipient@example.com",
        subject: "Test Subject",
        htmlContent: "<p>Test content</p>",
        data: {},
      };

      const response = await provider.send(payload);

      expect(response.status).toBe("failed");
      expect(response.error).toContain("SES Error: SES API Error");
    });

    it("should use custom from address when provided", async () => {
      const mockResult = { MessageId: "test-message-id" };
      mockSend.mockResolvedValue(mockResult);

      const payload: EmailPayload = {
        recipient: "recipient@example.com",
        subject: "Test Subject",
        htmlContent: "<p>Test content</p>",
        from: "custom@example.com",
        data: {},
      };

      await provider.send(payload);

      const sendCall = mockSend.mock.calls[0][0];
      expect(sendCall.Source).toBe("custom@example.com");
    });

    it("should fail when provider not initialized", async () => {
      await provider.destroy();

      const payload: EmailPayload = {
        recipient: "recipient@example.com",
        subject: "Test Subject",
        htmlContent: "<p>Test content</p>",
        data: {},
      };

      const response = await provider.send(payload);

      expect(response.status).toBe("failed");
      expect(response.error).toBe("Provider not initialized");
    });
  });

  // Health checks moved to the circuit breaker (common/errors/services/circuit-breaker.service.ts); providers no longer own a checkHealth API.

  describe("SES-specific methods", () => {
    beforeEach(async () => {
      await provider.initialize(validConfig);
    });

    it("should get sending statistics", async () => {
      const mockStats = [{ DeliveryDelay: 0, Bounces: 0, Complaints: 0, Rejects: 0 }];
      mockSend.mockResolvedValue({ SendDataPoints: mockStats });

      const stats = await provider.getSendingStatistics();

      expect(stats).toEqual(mockStats);
    });

    it("should get send quota", async () => {
      const mockQuota = {
        Max24HourSend: 200,
        MaxSendRate: 1,
        SentLast24Hours: 0,
      };
      mockSend.mockResolvedValue(mockQuota);

      const quota = await provider.getSendQuota();

      expect(quota).toEqual({
        max24HourSend: 200,
        maxSendRate: 1,
        sentLast24Hours: 0,
      });
    });
  });

  describe("configuration validation", () => {
    it("should validate email addresses correctly", async () => {
      const validEmails = ["test@example.com", "user.name@domain.co.uk", "user+tag@example.org"];

      for (const email of validEmails) {
        const config = {
          ...validConfig,
          credentials: { ...validConfig.credentials, fromEmail: email },
        };

        const isValid = await provider.validateConfig(config);
        expect(isValid).toBe(true);
      }
    });

    it("should reject invalid email addresses", async () => {
      const invalidEmails = ["invalid-email", "@example.com", "test@", "test.example.com"];

      for (const email of invalidEmails) {
        const config = {
          ...validConfig,
          credentials: { ...validConfig.credentials, fromEmail: email },
        };

        const isValid = await provider.validateConfig(config);
        expect(isValid).toBe(false);
      }
    });
  });
});
