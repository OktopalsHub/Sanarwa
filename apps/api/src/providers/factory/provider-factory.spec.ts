import { Test, TestingModule } from "@nestjs/testing";
import { BaseProvider } from "../base/base-provider.abstract";
import { BaseProviderPayload } from "../base/base-provider.interface";
import { ProviderConfig, ProviderHealth, ProviderHealthStatus, ProviderResponse } from "../types";
import { NotificationChannel } from "../../common/enums/notification-channel.enum";
import type { Mock } from "vitest";
import { ProviderFactory } from "./provider-factory";

class MockEmailProvider extends BaseProvider {
  constructor(id: string, name: string, channel: NotificationChannel) {
    super(id, name, channel);
  }

  async send(payload: BaseProviderPayload): Promise<ProviderResponse> {
    return this.createSuccessResponse("mock-message-id");
  }

  async validateConfig(config: ProviderConfig): Promise<boolean> {
    return this.validateCommonConfig(config);
  }

  protected async performHealthCheck(): Promise<ProviderHealthStatus> {
    return {
      status: ProviderHealth.HEALTHY,
      lastChecked: new Date(),
    };
  }
}

class MockSMSProvider extends BaseProvider {
  constructor(id: string, name: string, channel: NotificationChannel) {
    super(id, name, channel);
  }

  async send(payload: BaseProviderPayload): Promise<ProviderResponse> {
    return this.createSuccessResponse("mock-sms-id");
  }

  async validateConfig(config: ProviderConfig): Promise<boolean> {
    return this.validateCommonConfig(config);
  }

  protected async performHealthCheck(): Promise<ProviderHealthStatus> {
    return {
      status: ProviderHealth.HEALTHY,
      lastChecked: new Date(),
    };
  }
}

describe("ProviderFactory", () => {
  let factory: ProviderFactory;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [ProviderFactory],
    }).compile();

    factory = module.get<ProviderFactory>(ProviderFactory);
  });

  afterEach(() => {
    factory.clearProviders();
  });

  describe("provider registration", () => {
    it("should register a provider successfully", () => {
      factory.registerProvider("mock-email", NotificationChannel.EMAIL, MockEmailProvider);

      expect(factory.isProviderRegistered("mock-email", NotificationChannel.EMAIL)).toBe(true);
      expect(factory.getAvailableProviders(NotificationChannel.EMAIL)).toContain("mock-email");
    });

    it("should register multiple providers for different channels", () => {
      factory.registerProvider("mock-email", NotificationChannel.EMAIL, MockEmailProvider);
      factory.registerProvider("mock-sms", NotificationChannel.SMS, MockSMSProvider);

      expect(factory.isProviderRegistered("mock-email", NotificationChannel.EMAIL)).toBe(true);
      expect(factory.isProviderRegistered("mock-sms", NotificationChannel.SMS)).toBe(true);

      expect(factory.getAvailableProviders(NotificationChannel.EMAIL)).toEqual(["mock-email"]);
      expect(factory.getAvailableProviders(NotificationChannel.SMS)).toEqual(["mock-sms"]);
    });

    it("should allow overwriting existing provider registration", () => {
      factory.registerProvider("mock-email", NotificationChannel.EMAIL, MockEmailProvider);
      factory.registerProvider("mock-email", NotificationChannel.EMAIL, MockEmailProvider);

      expect(factory.isProviderRegistered("mock-email", NotificationChannel.EMAIL)).toBe(true);
      expect(factory.getAvailableProviders(NotificationChannel.EMAIL)).toEqual(["mock-email"]);
    });
  });

  describe("provider creation", () => {
    beforeEach(() => {
      factory.registerProvider("mock-email", NotificationChannel.EMAIL, MockEmailProvider);
    });

    it("should create a provider instance successfully", async () => {
      const config: ProviderConfig = {
        id: "test-provider",
        name: "Test Provider",
        channel: NotificationChannel.EMAIL,
        priority: 1,
        isActive: true,
        credentials: {},
      };

      const provider = await factory.createProvider(
        "mock-email",
        NotificationChannel.EMAIL,
        config,
      );

      expect(provider).toBeInstanceOf(MockEmailProvider);
      expect(provider.id).toBe("test-provider");
      expect(provider.name).toBe("Test Provider");
      expect(provider.channel).toBe(NotificationChannel.EMAIL);
      expect(provider.isInitialized).toBe(true);

      await provider.destroy();
    });

    it("should throw error for unregistered provider", async () => {
      const config: ProviderConfig = {
        id: "test-provider",
        name: "Test Provider",
        channel: NotificationChannel.EMAIL,
        priority: 1,
        isActive: true,
        credentials: {},
      };

      await expect(
        factory.createProvider("unregistered", NotificationChannel.EMAIL, config),
      ).rejects.toThrow("Provider unregistered for channel email is not registered");
    });

    it("should throw error for invalid configuration", async () => {
      const invalidConfig: ProviderConfig = {
        id: "",
        name: "Test Provider",
        channel: NotificationChannel.EMAIL,
        priority: 1,
        isActive: true,
        credentials: {},
      };

      await expect(
        factory.createProvider("mock-email", NotificationChannel.EMAIL, invalidConfig),
      ).rejects.toThrow("Failed to create provider mock-email");
    });
  });

  describe("provider management", () => {
    beforeEach(() => {
      factory.registerProvider("mock-email", NotificationChannel.EMAIL, MockEmailProvider);
      factory.registerProvider("mock-sms", NotificationChannel.SMS, MockSMSProvider);
    });

    it("should get all registered providers", () => {
      const providers = factory.getAllRegisteredProviders();

      expect(providers).toHaveLength(2);
      expect(providers).toContainEqual({
        providerId: "mock-email",
        channel: NotificationChannel.EMAIL,
      });
      expect(providers).toContainEqual({
        providerId: "mock-sms",
        channel: NotificationChannel.SMS,
      });
    });

    it("should unregister a provider", () => {
      expect(factory.unregisterProvider("mock-email", NotificationChannel.EMAIL)).toBe(true);
      expect(factory.isProviderRegistered("mock-email", NotificationChannel.EMAIL)).toBe(false);
      expect(factory.getAvailableProviders(NotificationChannel.EMAIL)).toEqual([]);
    });

    it("should return false when unregistering non-existent provider", () => {
      expect(factory.unregisterProvider("non-existent", NotificationChannel.EMAIL)).toBe(false);
    });

    it("should clear all providers", () => {
      factory.clearProviders();

      expect(factory.getAllRegisteredProviders()).toHaveLength(0);
      expect(factory.getAvailableProviders(NotificationChannel.EMAIL)).toEqual([]);
      expect(factory.getAvailableProviders(NotificationChannel.SMS)).toEqual([]);
    });
  });

  describe("channel filtering", () => {
    beforeEach(() => {
      factory.registerProvider("email-1", NotificationChannel.EMAIL, MockEmailProvider);
      factory.registerProvider("email-2", NotificationChannel.EMAIL, MockEmailProvider);
      factory.registerProvider("sms-1", NotificationChannel.SMS, MockSMSProvider);
    });

    it("should return providers for specific channel only", () => {
      expect(factory.getAvailableProviders(NotificationChannel.EMAIL)).toEqual([
        "email-1",
        "email-2",
      ]);
      expect(factory.getAvailableProviders(NotificationChannel.SMS)).toEqual(["sms-1"]);
      expect(factory.getAvailableProviders(NotificationChannel.PUSH)).toEqual([]);
    });
  });
});
