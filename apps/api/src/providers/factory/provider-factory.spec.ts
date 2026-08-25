import { Test, TestingModule } from "@nestjs/testing";
import { BaseProvider } from "../base/base-provider.abstract";
import { BaseProviderPayload } from "../base/base-provider.interface";
import type { Mock } from "vitest";
import {
  Channel,
  ProviderConfig,
  ProviderHealth,
  ProviderHealthStatus,
  ProviderResponse,
} from "../types";
import { ProviderFactory } from "./provider-factory";

// Mock provider for testing
class MockEmailProvider extends BaseProvider {
  constructor(id: string, name: string, channel: Channel) {
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
  constructor(id: string, name: string, channel: Channel) {
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
      factory.registerProvider("mock-email", Channel.EMAIL, MockEmailProvider);

      expect(factory.isProviderRegistered("mock-email", Channel.EMAIL)).toBe(true);
      expect(factory.getAvailableProviders(Channel.EMAIL)).toContain("mock-email");
    });

    it("should register multiple providers for different channels", () => {
      factory.registerProvider("mock-email", Channel.EMAIL, MockEmailProvider);
      factory.registerProvider("mock-sms", Channel.SMS, MockSMSProvider);

      expect(factory.isProviderRegistered("mock-email", Channel.EMAIL)).toBe(true);
      expect(factory.isProviderRegistered("mock-sms", Channel.SMS)).toBe(true);

      expect(factory.getAvailableProviders(Channel.EMAIL)).toEqual(["mock-email"]);
      expect(factory.getAvailableProviders(Channel.SMS)).toEqual(["mock-sms"]);
    });

    it("should allow overwriting existing provider registration", () => {
      factory.registerProvider("mock-email", Channel.EMAIL, MockEmailProvider);
      factory.registerProvider("mock-email", Channel.EMAIL, MockEmailProvider);

      expect(factory.isProviderRegistered("mock-email", Channel.EMAIL)).toBe(true);
      expect(factory.getAvailableProviders(Channel.EMAIL)).toEqual(["mock-email"]);
    });
  });

  describe("provider creation", () => {
    beforeEach(() => {
      factory.registerProvider("mock-email", Channel.EMAIL, MockEmailProvider);
    });

    it("should create a provider instance successfully", async () => {
      const config: ProviderConfig = {
        id: "test-provider",
        name: "Test Provider",
        channel: Channel.EMAIL,
        priority: 1,
        isActive: true,
        credentials: {},
      };

      const provider = await factory.createProvider("mock-email", Channel.EMAIL, config);

      expect(provider).toBeInstanceOf(MockEmailProvider);
      expect(provider.id).toBe("test-provider");
      expect(provider.name).toBe("Test Provider");
      expect(provider.channel).toBe(Channel.EMAIL);
      expect(provider.isInitialized).toBe(true);

      await provider.destroy();
    });

    it("should throw error for unregistered provider", async () => {
      const config: ProviderConfig = {
        id: "test-provider",
        name: "Test Provider",
        channel: Channel.EMAIL,
        priority: 1,
        isActive: true,
        credentials: {},
      };

      await expect(factory.createProvider("unregistered", Channel.EMAIL, config)).rejects.toThrow(
        "Provider unregistered for channel email is not registered",
      );
    });

    it("should throw error for invalid configuration", async () => {
      const invalidConfig: ProviderConfig = {
        id: "",
        name: "Test Provider",
        channel: Channel.EMAIL,
        priority: 1,
        isActive: true,
        credentials: {},
      };

      await expect(
        factory.createProvider("mock-email", Channel.EMAIL, invalidConfig),
      ).rejects.toThrow("Failed to create provider mock-email");
    });
  });

  describe("provider management", () => {
    beforeEach(() => {
      factory.registerProvider("mock-email", Channel.EMAIL, MockEmailProvider);
      factory.registerProvider("mock-sms", Channel.SMS, MockSMSProvider);
    });

    it("should get all registered providers", () => {
      const providers = factory.getAllRegisteredProviders();

      expect(providers).toHaveLength(2);
      expect(providers).toContainEqual({
        providerId: "mock-email",
        channel: Channel.EMAIL,
      });
      expect(providers).toContainEqual({
        providerId: "mock-sms",
        channel: Channel.SMS,
      });
    });

    it("should unregister a provider", () => {
      expect(factory.unregisterProvider("mock-email", Channel.EMAIL)).toBe(true);
      expect(factory.isProviderRegistered("mock-email", Channel.EMAIL)).toBe(false);
      expect(factory.getAvailableProviders(Channel.EMAIL)).toEqual([]);
    });

    it("should return false when unregistering non-existent provider", () => {
      expect(factory.unregisterProvider("non-existent", Channel.EMAIL)).toBe(false);
    });

    it("should clear all providers", () => {
      factory.clearProviders();

      expect(factory.getAllRegisteredProviders()).toHaveLength(0);
      expect(factory.getAvailableProviders(Channel.EMAIL)).toEqual([]);
      expect(factory.getAvailableProviders(Channel.SMS)).toEqual([]);
    });
  });

  describe("channel filtering", () => {
    beforeEach(() => {
      factory.registerProvider("email-1", Channel.EMAIL, MockEmailProvider);
      factory.registerProvider("email-2", Channel.EMAIL, MockEmailProvider);
      factory.registerProvider("sms-1", Channel.SMS, MockSMSProvider);
    });

    it("should return providers for specific channel only", () => {
      expect(factory.getAvailableProviders(Channel.EMAIL)).toEqual(["email-1", "email-2"]);
      expect(factory.getAvailableProviders(Channel.SMS)).toEqual(["sms-1"]);
      expect(factory.getAvailableProviders(Channel.PUSH)).toEqual([]);
    });
  });
});
