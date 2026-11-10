import type { Mock } from "vitest";
import {
  DeliveryStatus,
  ProviderConfig,
  ProviderHealth,
  ProviderHealthStatus,
  ProviderResponse,
} from "../types";
import { NotificationChannel } from "../../common/enums/notification-channel.enum";
import { BaseProvider } from "./base-provider.abstract";
import { BaseProviderPayload } from "./base-provider.interface";

class MockProvider extends BaseProvider {
  private shouldFailHealthCheck = false;
  private shouldFailSend = false;

  constructor(id: string, name: string, channel: NotificationChannel) {
    super(id, name, channel);
  }

  async send(payload: BaseProviderPayload): Promise<ProviderResponse> {
    if (this.shouldFailSend) {
      return this.createErrorResponse("Mock send failure");
    }

    return this.createSuccessResponse(`mock-message-${Date.now()}`, "provider-msg-123", {
      recipient: payload.recipient,
    });
  }

  async validateConfig(config: ProviderConfig): Promise<boolean> {
    return this.validateCommonConfig(config) && !!config.credentials?.apiKey;
  }

  protected async performHealthCheck(): Promise<ProviderHealthStatus> {
    if (this.shouldFailHealthCheck) {
      throw new Error("Mock health check failure");
    }

    return {
      status: ProviderHealth.HEALTHY,
      lastChecked: new Date(),
      responseTime: 100,
      uptime: 99.9,
    };
  }

  setFailHealthCheck(fail: boolean): void {
    this.shouldFailHealthCheck = fail;
  }

  setFailSend(fail: boolean): void {
    this.shouldFailSend = fail;
  }
}

describe("BaseProvider", () => {
  let provider: MockProvider;
  let validConfig: ProviderConfig;

  beforeEach(async () => {
    provider = new MockProvider("test-provider", "Test Provider", NotificationChannel.EMAIL);

    validConfig = {
      id: "test-provider",
      name: "Test Provider",
      channel: NotificationChannel.EMAIL,
      priority: 1,
      isActive: true,
      credentials: {
        apiKey: "test-api-key",
      },
    };
  });

  afterEach(async () => {
    if (provider.isInitialized) {
      await provider.destroy();
    }
  });

  describe("initialization", () => {
    it("should initialize successfully with valid config", async () => {
      expect(provider.isInitialized).toBe(false);

      await provider.initialize(validConfig);

      expect(provider.isInitialized).toBe(true);
      expect(provider.config).toEqual(validConfig);
    });

    it("should fail initialization with invalid config", async () => {
      const invalidConfig = { ...validConfig, credentials: {} };

      await expect(provider.initialize(invalidConfig)).rejects.toThrow(
        "Invalid configuration for provider Test Provider",
      );

      expect(provider.isInitialized).toBe(false);
    });

    it("should validate common config fields", async () => {
      const invalidConfigs = [
        { ...validConfig, id: "" },
        { ...validConfig, name: "" },
        { ...validConfig, channel: "invalid" as NotificationChannel },
        { ...validConfig, priority: -1 },
        { ...validConfig, channel: NotificationChannel.SMS },
      ];

      for (const config of invalidConfigs) {
        await expect(provider.initialize(config)).rejects.toThrow();
      }
    });
  });

  // Health checks moved to the circuit breaker (common/errors/services/circuit-breaker.service.ts); providers no longer own a checkHealth API.

  describe("sending messages", () => {
    beforeEach(async () => {
      await provider.initialize(validConfig);
    });

    it("should send message successfully", async () => {
      const payload: BaseProviderPayload = {
        recipient: "test@example.com",
        data: { subject: "Test", body: "Test message" },
      };

      const response = await provider.send(payload);

      expect(response.status).toBe(DeliveryStatus.SENT);
      expect(response.messageId).toMatch(/^mock-message-/);
      expect(response.providerMessageId).toBe("provider-msg-123");
      expect(response.timestamp).toBeInstanceOf(Date);
    });

    it("should handle send failures", async () => {
      provider.setFailSend(true);

      const payload: BaseProviderPayload = {
        recipient: "test@example.com",
        data: { subject: "Test", body: "Test message" },
      };

      const response = await provider.send(payload);

      expect(response.status).toBe(DeliveryStatus.FAILED);
      expect(response.error).toBe("Mock send failure");
    });
  });

  describe("lifecycle management", () => {
    it("should destroy provider properly", async () => {
      await provider.initialize(validConfig);
      expect(provider.isInitialized).toBe(true);

      await provider.destroy();
      expect(provider.isInitialized).toBe(false);
    });
  });

  describe("response helpers", () => {
    it("should create success response correctly", () => {
      const response = provider["createSuccessResponse"]("msg-123", "provider-456", {
        test: "data",
      });

      expect(response.messageId).toBe("msg-123");
      expect(response.providerMessageId).toBe("provider-456");
      expect(response.status).toBe(DeliveryStatus.SENT);
      expect(response.metadata).toEqual({ test: "data" });
      expect(response.timestamp).toBeInstanceOf(Date);
    });

    it("should create error response correctly", () => {
      const response = provider["createErrorResponse"]("Test error", "msg-123");

      expect(response.messageId).toBe("msg-123");
      expect(response.status).toBe(DeliveryStatus.FAILED);
      expect(response.error).toBe("Test error");
      expect(response.timestamp).toBeInstanceOf(Date);
    });

    it("should create error response with generated message ID", () => {
      const response = provider["createErrorResponse"]("Test error");

      expect(response.messageId).toMatch(/^error-/);
      expect(response.status).toBe(DeliveryStatus.FAILED);
      expect(response.error).toBe("Test error");
    });
  });
});
