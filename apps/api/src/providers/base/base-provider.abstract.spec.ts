import type { Mock } from "vitest";
import {
  Channel,
  DeliveryStatus,
  ProviderConfig,
  ProviderHealth,
  ProviderHealthStatus,
  ProviderResponse,
} from "../types";
import { BaseProvider } from "./base-provider.abstract";
import { BaseProviderPayload } from "./base-provider.interface";

// Mock implementation for testing
class MockProvider extends BaseProvider {
  private shouldFailHealthCheck = false;
  private shouldFailSend = false;

  constructor(id: string, name: string, channel: Channel) {
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

  // Test helpers
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
    provider = new MockProvider("test-provider", "Test Provider", Channel.EMAIL);

    validConfig = {
      id: "test-provider",
      name: "Test Provider",
      channel: Channel.EMAIL,
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
        { ...validConfig, channel: "invalid" as Channel },
        { ...validConfig, priority: -1 },
        { ...validConfig, channel: Channel.SMS }, // Wrong channel
      ];

      for (const config of invalidConfigs) {
        await expect(provider.initialize(config)).rejects.toThrow();
      }
    });
  });

  describe("health checking", () => {
    beforeEach(async () => {
      await provider.initialize(validConfig);
    });

    it("should return healthy status when provider is healthy", async () => {
      const healthStatus = await provider.checkHealth();

      expect(healthStatus.status).toBe(ProviderHealth.HEALTHY);
      expect(healthStatus.lastChecked).toBeInstanceOf(Date);
      expect(healthStatus.responseTime).toBeGreaterThanOrEqual(0);
    });

    it("should return unhealthy status when health check fails", async () => {
      provider.setFailHealthCheck(true);

      const healthStatus = await provider.checkHealth();

      expect(healthStatus.status).toBe(ProviderHealth.UNHEALTHY);
      expect(healthStatus.metadata?.error).toBe("Mock health check failure");
    });

    it("should return unhealthy status when provider is not initialized", async () => {
      await provider.destroy();

      const healthStatus = await provider.checkHealth();

      expect(healthStatus.status).toBe(ProviderHealth.UNHEALTHY);
      expect(healthStatus.metadata?.error).toBe("Provider not initialized");
    });
  });

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
