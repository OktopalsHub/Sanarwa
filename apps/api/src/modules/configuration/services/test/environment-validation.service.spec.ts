import { ConfigService } from "@nestjs/config";
import { Test, TestingModule } from "@nestjs/testing";
import { EnvironmentValidationService } from "../environment-validation.service";
import type { Mock, Mocked } from "vitest";

describe("EnvironmentValidationService", () => {
  let service: EnvironmentValidationService;
  let configService: Mocked<ConfigService>;

  beforeEach(async () => {
    const mockConfigService = {
      get: vi.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EnvironmentValidationService,
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
      ],
    }).compile();

    service = module.get<EnvironmentValidationService>(EnvironmentValidationService);
    configService = module.get(ConfigService);
  });

  it("should be defined", () => {
    expect(service).toBeDefined();
  });

  describe("validateEnvironment", () => {
    it("should return no errors for valid configuration", () => {
      // Mock valid configuration
      configService.get.mockImplementation((key: string) => {
        const config = {
          DATABASE_URL: "postgres://user:pass@localhost:5432/db",
          JWT_AUTH_SECRET: "a-very-secure-jwt-secret-that-is-long-enough",
          JWT_REFRESH_SECRET: "a-very-secure-refresh-secret-long-enough",
          PROVIDER_ENCRYPTION_KEY: "a-very-secure-encryption-key-32-chars",
          SESSION_SECRET: "a-very-secure-session-secret-32-chars",
          REDIS_URL: "redis://localhost:6379",
          NODE_ENV: "development",
        };
        return config[key];
      });

      const errors = service.validateEnvironment();
      const criticalErrors = errors.filter((error) => error.severity === "error");

      expect(criticalErrors).toHaveLength(0);
    });

    it("should return errors for missing required variables", () => {
      // Mock missing required variables
      configService.get.mockImplementation((key: string) => {
        const config = {
          NODE_ENV: "development",
        };
        return config[key];
      });

      const errors = service.validateEnvironment();
      const criticalErrors = errors.filter((error) => error.severity === "error");

      expect(criticalErrors.length).toBeGreaterThan(0);
      expect(criticalErrors.some((error) => error.variable === "DATABASE_URL")).toBe(true);
      expect(criticalErrors.some((error) => error.variable === "JWT_AUTH_SECRET")).toBe(true);
      expect(criticalErrors.some((error) => error.variable === "JWT_REFRESH_SECRET")).toBe(true);
      expect(criticalErrors.some((error) => error.variable === "PROVIDER_ENCRYPTION_KEY")).toBe(
        true,
      );
      expect(criticalErrors.some((error) => error.variable === "SESSION_SECRET")).toBe(true);
    });

    it("should return errors for default security values", () => {
      configService.get.mockImplementation((key: string) => {
        const config = {
          DATABASE_URL: "postgres://user:pass@localhost:5432/db",
          JWT_AUTH_SECRET: "default-secret-change-in-production",
          JWT_REFRESH_SECRET: "default-secret-change-in-production",
          PROVIDER_ENCRYPTION_KEY: "your-32-character-encryption-key-change-in-production",
          SESSION_SECRET: "your-session-secret-change-in-production",
          REDIS_URL: "redis://localhost:6379",
          NODE_ENV: "production",
        };
        return config[key];
      });

      const errors = service.validateEnvironment();
      const criticalErrors = errors.filter((error) => error.severity === "error");

      expect(
        criticalErrors.some(
          (error) =>
            error.variable === "JWT_AUTH_SECRET" && error.message.includes("default value"),
        ),
      ).toBe(true);
      expect(
        criticalErrors.some(
          (error) =>
            error.variable === "PROVIDER_ENCRYPTION_KEY" && error.message.includes("default value"),
        ),
      ).toBe(true);
      expect(
        criticalErrors.some(
          (error) => error.variable === "SESSION_SECRET" && error.message.includes("default value"),
        ),
      ).toBe(true);
    });

    it("should validate OAuth configuration consistency", () => {
      configService.get.mockImplementation((key: string) => {
        const config = {
          DATABASE_URL: "postgres://user:pass@localhost:5432/db",
          JWT_AUTH_SECRET: "a-very-secure-jwt-secret-that-is-long-enough",
          JWT_REFRESH_SECRET: "a-very-secure-refresh-secret-long-enough",
          PROVIDER_ENCRYPTION_KEY: "a-very-secure-encryption-key-32-chars",
          SESSION_SECRET: "a-very-secure-session-secret-32-chars",
          REDIS_URL: "redis://localhost:6379",
          GOOGLE_CLIENT_ID: "google-client-id",
          // Missing GOOGLE_CLIENT_SECRET
          NODE_ENV: "development",
        };
        return config[key];
      });

      const errors = service.validateEnvironment();
      const criticalErrors = errors.filter((error) => error.severity === "error");

      expect(criticalErrors.some((error) => error.variable === "GOOGLE_CLIENT_SECRET")).toBe(true);
    });

    it("should validate Twilio configuration when using Twilio provider", () => {
      configService.get.mockImplementation((key: string) => {
        const config = {
          DATABASE_URL: "postgres://user:pass@localhost:5432/db",
          JWT_AUTH_SECRET: "a-very-secure-jwt-secret-that-is-long-enough",
          JWT_REFRESH_SECRET: "a-very-secure-refresh-secret-long-enough",
          PROVIDER_ENCRYPTION_KEY: "a-very-secure-encryption-key-32-chars",
          SESSION_SECRET: "a-very-secure-session-secret-32-chars",
          REDIS_URL: "redis://localhost:6379",
          VOICE_PROVIDER: "twilio",
          // Missing Twilio configuration
          NODE_ENV: "development",
        };
        return config[key];
      });

      const errors = service.validateEnvironment();
      const criticalErrors = errors.filter((error) => error.severity === "error");

      expect(criticalErrors.some((error) => error.variable === "TWILIO_ACCOUNT_SID")).toBe(true);
      expect(criticalErrors.some((error) => error.variable === "TWILIO_AUTH_TOKEN")).toBe(true);
      expect(criticalErrors.some((error) => error.variable === "TWILIO_PHONE_NUMBER")).toBe(true);
    });
  });

  describe("validateOrThrow", () => {
    it("should not throw for valid configuration", () => {
      configService.get.mockImplementation((key: string) => {
        const config = {
          DATABASE_URL: "postgres://user:pass@localhost:5432/db",
          JWT_AUTH_SECRET: "a-very-secure-jwt-secret-that-is-long-enough",
          JWT_REFRESH_SECRET: "a-very-secure-refresh-secret-long-enough",
          PROVIDER_ENCRYPTION_KEY: "a-very-secure-encryption-key-32-chars",
          SESSION_SECRET: "a-very-secure-session-secret-32-chars",
          REDIS_URL: "redis://localhost:6379",
          NODE_ENV: "development",
        };
        return config[key];
      });

      expect(() => service.validateOrThrow()).not.toThrow();
    });

    it("should throw for invalid configuration", () => {
      configService.get.mockImplementation((key: string) => {
        const config = {
          NODE_ENV: "development",
          // Missing required variables
        };
        return config[key];
      });

      expect(() => service.validateOrThrow()).toThrow("Environment validation failed");
    });
  });
});
