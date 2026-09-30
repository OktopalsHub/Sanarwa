import { Test, TestingModule } from "@nestjs/testing";
import { Channel, ProviderConfig, ProviderHealth } from "../types";
import { SMSPayload } from "./sms-provider.interface";
import { TermiiSMSProvider } from "./termii-sms-provider";
import type { Mock } from "vitest";

// Mock fetch globally
global.fetch = vi.fn();

describe("TermiiSMSProvider", () => {
  let provider: TermiiSMSProvider;
  let validConfig: ProviderConfig;
  let mockFetch: Mock;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [TermiiSMSProvider],
    }).compile();

    provider = module.get<TermiiSMSProvider>(TermiiSMSProvider);
    mockFetch = fetch as Mock;

    validConfig = {
      id: "termii-provider",
      name: "Termii SMS Provider",
      channel: Channel.SMS,
      priority: 1,
      isActive: true,
      credentials: {
        apiKey: "test-api-key",
        senderId: "TestSMS",
      },
    };
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
      expect(provider.id).toBe("termii");
      expect(provider.name).toBe("Termii SMS");
      expect(provider.channel).toBe(Channel.SMS);
    });

    it("should fail initialization with missing apiKey", async () => {
      const invalidConfig = {
        ...validConfig,
        credentials: { ...validConfig.credentials, apiKey: "" },
      };

      await expect(provider.initialize(invalidConfig)).rejects.toThrow(
        "Invalid configuration for provider Termii SMS",
      );
    });

    it("should fail initialization with invalid senderId length", async () => {
      const invalidConfig = {
        ...validConfig,
        credentials: {
          ...validConfig.credentials,
          senderId: "ThisSenderIdIsTooLong", // More than 11 characters
        },
      };

      await expect(provider.initialize(invalidConfig)).rejects.toThrow(
        "Invalid configuration for provider Termii SMS",
      );
    });
  });

  describe("country support", () => {
    beforeEach(async () => {
      await provider.initialize(validConfig);
    });

    it("should support African countries", () => {
      const africanCountries = ["NG", "GH", "KE", "ZA", "EG"];

      africanCountries.forEach((country) => {
        expect(provider.isCountrySupported(country)).toBe(true);
      });
    });

    it("should not support non-African countries", () => {
      const nonAfricanCountries = ["US", "GB", "CN", "JP", "AU"];

      nonAfricanCountries.forEach((country) => {
        expect(provider.isCountrySupported(country)).toBe(false);
      });
    });

    it("should return list of supported countries", () => {
      const supportedCountries = provider.getSupportedCountries();

      expect(supportedCountries).toContain("NG");
      expect(supportedCountries).toContain("GH");
      expect(supportedCountries).toContain("KE");
      expect(supportedCountries.length).toBeGreaterThan(40);
    });
  });

  describe("phone number formatting", () => {
    beforeEach(async () => {
      await provider.initialize(validConfig);
    });

    it("should format Nigerian numbers correctly", () => {
      const testCases = [
        { input: "08012345678", country: "NG", expected: "+2348012345678" },
        { input: "8012345678", country: "NG", expected: "+2348012345678" },
        { input: "+2348012345678", country: "NG", expected: "+2348012345678" },
      ];

      testCases.forEach(({ input, country, expected }) => {
        const result = provider.formatPhoneNumber(input, country);
        expect(result).toBe(expected);
      });
    });

    it("should format Ghanaian numbers correctly", () => {
      const result = provider.formatPhoneNumber("0241234567", "GH");
      expect(result).toBe("+233241234567");
    });

    it("should default to Nigeria when no country code provided", () => {
      const result = provider.formatPhoneNumber("08012345678");
      expect(result).toBe("+2348012345678");
    });

    it("should handle already formatted international numbers", () => {
      const result = provider.formatPhoneNumber("+2348012345678");
      expect(result).toBe("+2348012345678");
    });
  });

  describe("sending SMS", () => {
    beforeEach(async () => {
      await provider.initialize(validConfig);
    });

    it("should send SMS successfully", async () => {
      const mockResponse = {
        message_id: "termii-123456",
        message: "Successfully Sent",
        balance: 100,
        user: "test-user",
      };

      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      } as Response);

      const payload: SMSPayload = {
        recipient: "+2348012345678",
        message: "Test SMS message",
        countryCode: "NG",
        data: {},
      };

      const response = await provider.send(payload);

      expect(response.status).toBe("sent");
      expect(response.providerMessageId).toBe("termii-123456");
      expect(mockFetch).toHaveBeenCalledWith(
        "https://api.ng.termii.com/api/sms/send",
        expect.objectContaining({
          method: "POST",
          headers: { "Content-Type": "application/json" },
        }),
      );
    });

    it("should handle unsupported country", async () => {
      const payload: SMSPayload = {
        recipient: "+1234567890",
        message: "Test SMS message",
        countryCode: "US",
        data: {},
      };

      const response = await provider.send(payload);

      expect(response.status).toBe("failed");
      expect(response.error).toContain("Country not supported");
    });

    it("should handle API errors", async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 400,
        statusText: "Bad Request",
        json: () => Promise.resolve({ message: "Invalid API key" }),
      } as Response);

      const payload: SMSPayload = {
        recipient: "+2348012345678",
        message: "Test SMS message",
        countryCode: "NG",
        data: {},
      };

      const response = await provider.send(payload);

      expect(response.status).toBe("failed");
      expect(response.error).toContain("Termii Error");
    });

    it("should fail when provider not initialized", async () => {
      await provider.destroy();

      const payload: SMSPayload = {
        recipient: "+2348012345678",
        message: "Test SMS message",
        data: {},
      };

      const response = await provider.send(payload);

      expect(response.status).toBe("failed");
      expect(response.error).toBe("Provider not initialized");
    });
  });

  describe("health checks", () => {
    beforeEach(async () => {
      await provider.initialize(validConfig);
    });

    it("should return healthy status when API is accessible", async () => {
      const mockBalanceResponse = {
        balance: 100,
        currency: "NGN",
      };

      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockBalanceResponse),
      } as Response);

      const healthStatus = await provider.checkHealth();

      expect(healthStatus.status).toBe(ProviderHealth.HEALTHY);
      expect(healthStatus.metadata?.service).toBe("Termii SMS");
      expect(healthStatus.metadata?.balance).toBe(100);
    });

    it("should return unhealthy status when API is not accessible", async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 401,
        statusText: "Unauthorized",
      } as Response);

      const healthStatus = await provider.checkHealth();

      expect(healthStatus.status).toBe(ProviderHealth.UNHEALTHY);
      expect(healthStatus.metadata?.error).toContain("Termii health check failed");
    });
  });

  describe("Termii-specific methods", () => {
    beforeEach(async () => {
      await provider.initialize(validConfig);
    });

    it("should get account balance", async () => {
      const mockBalance = {
        balance: 150,
        currency: "NGN",
      };

      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockBalance),
      } as Response);

      const balance = await provider.getBalance();

      expect(balance).toEqual(mockBalance);
      expect(mockFetch).toHaveBeenCalledWith(expect.stringContaining("get-balance"));
    });

    it("should handle balance API errors", async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 500,
        statusText: "Internal Server Error",
      } as Response);

      await expect(provider.getBalance()).rejects.toThrow();
    });
  });

  describe("configuration validation", () => {
    it("should validate correct configuration", async () => {
      const isValid = await provider.validateConfig(validConfig);
      expect(isValid).toBe(true);
    });

    it("should reject configuration without apiKey", async () => {
      const invalidConfig = {
        ...validConfig,
        credentials: { senderId: "TestSMS" },
      };

      const isValid = await provider.validateConfig(invalidConfig);
      expect(isValid).toBe(false);
    });

    it("should reject configuration with invalid senderId", async () => {
      const invalidConfig = {
        ...validConfig,
        credentials: {
          ...validConfig.credentials,
          senderId: "ThisSenderIdIsTooLongForTermii",
        },
      };

      const isValid = await provider.validateConfig(invalidConfig);
      expect(isValid).toBe(false);
    });
  });
});
