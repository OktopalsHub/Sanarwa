import { Test, TestingModule } from "@nestjs/testing";
import { Channel } from "../../providers/types";
import { ProviderConfigValidator } from "./provider-config-validator";
import { ProviderConfig, ProviderType } from "./provider-config.entity";
import type { Mock } from "vitest";

describe("ProviderConfigValidator", () => {
  let validator: ProviderConfigValidator;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [ProviderConfigValidator],
    }).compile();

    validator = module.get<ProviderConfigValidator>(ProviderConfigValidator);
  });

  describe("validate", () => {
    const baseConfig: ProviderConfig = {
      id: "config-1",
      tenantId: "tenant-1",
      providerId: "aws_ses",
      providerName: "AWS SES",
      providerType: ProviderType.AWS_SES,
      channel: Channel.EMAIL,
      config: {
        accessKeyId: "AKIAIOSFODNN7EXAMPLE",
        secretAccessKey: "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY",
        region: "us-east-1",
      },
      priority: 1,
      isActive: true,
      isDefault: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    it("should validate valid AWS SES configuration", async () => {
      const result = await validator.validateDetailed(baseConfig);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it("should reject configuration with missing required fields", async () => {
      const invalidConfig = {
        ...baseConfig,
        config: {
          accessKeyId: "AKIAIOSFODNN7EXAMPLE",
          // Missing secretAccessKey and region
        },
      };

      const result = await validator.validateDetailed(invalidConfig);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain("Required field 'secretAccessKey' is missing");
      expect(result.errors).toContain("Required field 'region' is missing");
    });

    it("should reject configuration with invalid field values", async () => {
      const invalidConfig = {
        ...baseConfig,
        config: {
          accessKeyId: "", // Empty string
          secretAccessKey: "valid-secret",
          region: "invalid-region-format!", // Invalid format
        },
      };

      const result = await validator.validateDetailed(invalidConfig);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain("Invalid value for field 'accessKeyId'");
      expect(result.errors).toContain("Invalid value for field 'region'");
    });

    it("should validate Termii SMS configuration", async () => {
      const termiiConfig: ProviderConfig = {
        ...baseConfig,
        providerId: "termii",
        providerType: ProviderType.TERMII,
        channel: Channel.SMS,
        config: {
          apiKey: "TL123456789",
          senderId: "MyApp",
          channel: "generic",
          type: "plain",
        },
      };

      const result = await validator.validateDetailed(termiiConfig);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it("should validate WhatsApp Business configuration", async () => {
      const whatsappConfig: ProviderConfig = {
        ...baseConfig,
        providerId: "whatsapp_business",
        providerType: ProviderType.WHATSAPP_BUSINESS,
        channel: Channel.WHATSAPP,
        config: {
          accessToken: "EAABwzLixnjYBOZCZCZC...",
          phoneNumberId: "1234567890123456",
          businessAccountId: "9876543210987654",
          apiVersion: "v17.0",
        },
      };

      const result = await validator.validateDetailed(whatsappConfig);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it("should warn about unknown configuration fields", async () => {
      const configWithUnknownFields = {
        ...baseConfig,
        config: {
          ...baseConfig.config,
          unknownField: "some value",
          anotherUnknownField: 123,
        },
      };

      const result = await validator.validateDetailed(configWithUnknownFields);

      expect(result.isValid).toBe(true);
      expect(result.warnings).toContain("Unknown field 'unknownField' in configuration");
      expect(result.warnings).toContain("Unknown field 'anotherUnknownField' in configuration");
    });
  });

  describe("basic structure validation", () => {
    it("should reject configuration without provider ID", async () => {
      const config = {
        id: "config-1",
        tenantId: "tenant-1",
        providerId: "", // Empty provider ID
        providerName: "Test Provider",
        providerType: ProviderType.AWS_SES,
        channel: Channel.EMAIL,
        config: {},
        priority: 1,
        isActive: true,
        isDefault: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const result = await validator.validateDetailed(config);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain("Provider ID is required");
    });

    it("should reject configuration without provider name", async () => {
      const config = {
        id: "config-1",
        tenantId: "tenant-1",
        providerId: "aws_ses",
        providerName: "", // Empty provider name
        providerType: ProviderType.AWS_SES,
        channel: Channel.EMAIL,
        config: {},
        priority: 1,
        isActive: true,
        isDefault: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const result = await validator.validateDetailed(config);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain("Provider name is required");
    });

    it("should reject configuration with invalid priority", async () => {
      const config = {
        id: "config-1",
        tenantId: "tenant-1",
        providerId: "aws_ses",
        providerName: "AWS SES",
        providerType: ProviderType.AWS_SES,
        channel: Channel.EMAIL,
        config: {},
        priority: 0, // Invalid priority
        isActive: true,
        isDefault: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const result = await validator.validateDetailed(config);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain("Priority must be greater than 0");
    });

    it("should reject configuration without config object", async () => {
      const config = {
        id: "config-1",
        tenantId: "tenant-1",
        providerId: "aws_ses",
        providerName: "AWS SES",
        providerType: ProviderType.AWS_SES,
        channel: Channel.EMAIL,
        config: null, // Missing config
        priority: 1,
        isActive: true,
        isDefault: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const result = await validator.validateDetailed(config);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain("Provider configuration object is required");
    });
  });

  describe("rate limits validation", () => {
    const baseConfig: ProviderConfig = {
      id: "config-1",
      tenantId: "tenant-1",
      providerId: "aws_ses",
      providerName: "AWS SES",
      providerType: ProviderType.AWS_SES,
      channel: Channel.EMAIL,
      config: {
        accessKeyId: "test",
        secretAccessKey: "test",
        region: "us-east-1",
      },
      priority: 1,
      isActive: true,
      isDefault: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    it("should validate valid rate limits", async () => {
      const configWithRateLimits = {
        ...baseConfig,
        rateLimits: {
          requestsPerSecond: 10,
          requestsPerMinute: 600,
          requestsPerHour: 36000,
          requestsPerDay: 864000,
        },
      };

      const result = await validator.validateDetailed(configWithRateLimits);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it("should reject invalid rate limit values", async () => {
      const configWithInvalidRateLimits = {
        ...baseConfig,
        rateLimits: {
          requestsPerSecond: -1, // Negative value
          requestsPerMinute: 0, // Zero value
          requestsPerHour: "invalid", // Non-numeric value
        },
      };

      const result = await validator.validateDetailed(configWithInvalidRateLimits);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain("Rate limit 'requestsPerSecond' must be a positive number");
      expect(result.errors).toContain("Rate limit 'requestsPerMinute' must be a positive number");
      expect(result.errors).toContain("Rate limit 'requestsPerHour' must be a positive number");
    });

    it("should warn about illogical rate limits", async () => {
      const configWithIllogicalRateLimits = {
        ...baseConfig,
        rateLimits: {
          requestsPerSecond: 100, // 100 * 60 = 6000 per minute
          requestsPerMinute: 1000, // But limit is only 1000 per minute
        },
      };

      const result = await validator.validateDetailed(configWithIllogicalRateLimits);

      expect(result.isValid).toBe(true);
      expect(result.warnings).toContain(
        "Requests per second * 60 exceeds requests per minute limit",
      );
    });

    it("should warn about unknown rate limit fields", async () => {
      const configWithUnknownRateLimit = {
        ...baseConfig,
        rateLimits: {
          requestsPerSecond: 10,
          requestsPerYear: 1000000, // Unknown field
        },
      };

      const result = await validator.validateDetailed(configWithUnknownRateLimit);

      expect(result.isValid).toBe(true);
      expect(result.warnings).toContain("Unknown rate limit field: requestsPerYear");
    });
  });

  describe("health check validation", () => {
    const baseConfig: ProviderConfig = {
      id: "config-1",
      tenantId: "tenant-1",
      providerId: "aws_ses",
      providerName: "AWS SES",
      providerType: ProviderType.AWS_SES,
      channel: Channel.EMAIL,
      config: {
        accessKeyId: "test",
        secretAccessKey: "test",
        region: "us-east-1",
      },
      priority: 1,
      isActive: true,
      isDefault: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    it("should validate valid health check configuration", async () => {
      const configWithHealthCheck = {
        ...baseConfig,
        healthCheck: {
          url: "https://api.example.com/health",
          interval: 60000,
          timeout: 5000,
          retries: 3,
        },
      };

      const result = await validator.validateDetailed(configWithHealthCheck);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it("should reject invalid health check values", async () => {
      const configWithInvalidHealthCheck = {
        ...baseConfig,
        healthCheck: {
          url: 123, // Non-string URL
          interval: -1000, // Negative interval
          timeout: 0, // Zero timeout
          retries: -1, // Negative retries
        },
      };

      const result = await validator.validateDetailed(configWithInvalidHealthCheck);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain("Health check URL must be a string");
      expect(result.errors).toContain("Health check interval must be a positive number");
      expect(result.errors).toContain("Health check timeout must be a positive number");
      expect(result.errors).toContain("Health check retries must be a non-negative number");
    });

    it("should warn about illogical health check configuration", async () => {
      const configWithIllogicalHealthCheck = {
        ...baseConfig,
        healthCheck: {
          interval: 5000, // 5 seconds
          timeout: 10000, // 10 seconds (longer than interval)
        },
      };

      const result = await validator.validateDetailed(configWithIllogicalHealthCheck);

      expect(result.isValid).toBe(true);
      expect(result.warnings).toContain("Health check timeout should be less than interval");
    });
  });

  describe("supported countries validation", () => {
    const baseConfig: ProviderConfig = {
      id: "config-1",
      tenantId: "tenant-1",
      providerId: "termii",
      providerName: "Termii SMS",
      providerType: ProviderType.TERMII,
      channel: Channel.SMS,
      config: { apiKey: "test", senderId: "test" },
      priority: 1,
      isActive: true,
      isDefault: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    it("should validate valid country codes", async () => {
      const configWithCountries = {
        ...baseConfig,
        supportedCountries: ["US", "CA", "GB", "NG", "KE"],
      };

      const result = await validator.validateDetailed(configWithCountries);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it("should reject non-array supported countries", async () => {
      const configWithInvalidCountries = {
        ...baseConfig,
        supportedCountries: "US,CA,GB", // String instead of array
      };

      const result = await validator.validateDetailed(configWithInvalidCountries);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain("Supported countries must be an array");
    });

    it("should reject non-string country codes", async () => {
      const configWithInvalidCountryCodes = {
        ...baseConfig,
        supportedCountries: ["US", 123, "GB"], // Number in array
      };

      const result = await validator.validateDetailed(configWithInvalidCountryCodes);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain("Country codes must be strings");
    });

    it("should warn about invalid country code format", async () => {
      const configWithInvalidFormat = {
        ...baseConfig,
        supportedCountries: ["USA", "CAN", "GB"], // 3-letter codes instead of 2-letter
      };

      const result = await validator.validateDetailed(configWithInvalidFormat);

      expect(result.isValid).toBe(true);
      expect(result.warnings).toContain(
        "Country code 'USA' should be 2 characters (ISO 3166-1 alpha-2)",
      );
      expect(result.warnings).toContain(
        "Country code 'CAN' should be 2 characters (ISO 3166-1 alpha-2)",
      );
    });

    it("should warn about unknown country codes", async () => {
      const configWithUnknownCountries = {
        ...baseConfig,
        supportedCountries: ["US", "XX", "YY"], // XX and YY are not valid ISO codes
      };

      const result = await validator.validateDetailed(configWithUnknownCountries);

      expect(result.isValid).toBe(true);
      expect(result.warnings).toContain("Unknown country code: XX");
      expect(result.warnings).toContain("Unknown country code: YY");
    });
  });

  describe("email validation", () => {
    it("should validate correct email format", async () => {
      const validator = new ProviderConfigValidator();
      const isValidEmail = (validator as any).isValidEmail;

      expect(isValidEmail("test@example.com")).toBe(true);
      expect(isValidEmail("user.name+tag@domain.co.uk")).toBe(true);
      expect(isValidEmail("user123@test-domain.org")).toBe(true);
    });

    it("should reject invalid email format", async () => {
      const validator = new ProviderConfigValidator();
      const isValidEmail = (validator as any).isValidEmail;

      expect(isValidEmail("invalid-email")).toBe(false);
      expect(isValidEmail("test@")).toBe(false);
      expect(isValidEmail("@domain.com")).toBe(false);
      expect(isValidEmail("test..test@domain.com")).toBe(false);
    });
  });

  describe("error handling", () => {
    it("should handle validation errors gracefully", async () => {
      const invalidConfig = {
        // Missing required fields
      } as any;

      const result = await validator.validateDetailed(invalidConfig);

      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it("should handle exceptions during validation", async () => {
      // Mock a method to throw an error
      const originalValidateChannelConfig = (validator as any).validateChannelConfig;
      (validator as any).validateChannelConfig = vi.fn().mockRejectedValue(new Error("Test error"));

      const config = {
        id: "config-1",
        tenantId: "tenant-1",
        providerId: "aws_ses",
        providerName: "AWS SES",
        providerType: ProviderType.AWS_SES,
        channel: Channel.EMAIL,
        config: {},
        priority: 1,
        isActive: true,
        isDefault: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const result = await validator.validateDetailed(config);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain("Validation failed: Test error");

      // Restore original method
      (validator as any).validateChannelConfig = originalValidateChannelConfig;
    });
  });
});
