import { Test, TestingModule } from "@nestjs/testing";
import { ConfigService } from "@nestjs/config";
import { getRedisConnectionToken } from "@nestjs-modules/ioredis";
import Redis from "ioredis-mock";
import { SmartSMSRouterService } from "./smart-sms-router.service";
import type { Mock } from "vitest";

describe("SmartSMSRouterService", () => {
  let service: SmartSMSRouterService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SmartSMSRouterService,
        {
          provide: getRedisConnectionToken(),
          useValue: new Redis(),
        },
        {
          provide: ConfigService,
          useValue: {
            get: vi.fn((key: string, defaultValue?: unknown) => {
              const configured = {
                AFRICASTALKING_API_KEY: "test-key",
                TERMII_API_KEY: "test-key",
                TELNYX_API_KEY: "test-key",
                INFOBIP_API_KEY: "test-key",
                MESSAGEBIRD_API_KEY: "test-key",
                AWS_SNS_ACCESS_KEY_ID: "test-key",
                GOOGLE_PHONE_API_KEY: "test-key",
              } as Record<string, string>;
              return key in configured ? configured[key] : defaultValue;
            }),
          },
        },
      ],
    }).compile();

    service = module.get<SmartSMSRouterService>(SmartSMSRouterService);
  });

  it("should be defined", () => {
    expect(service).toBeDefined();
  });

  describe("selectProvider", () => {
    it("should select the default Africa provider for Nigerian numbers", async () => {
      const result = await service.selectProvider("+2348123456789");

      expect(result.providerId).toBe("africastalking");
      expect(result.region).toBe("AFRICA");
    });

    it("should select Telnyx for US numbers", async () => {
      const result = await service.selectProvider("+12345678901");

      expect(result.providerId).toBe("telnyx");
      expect(result.region).toBe("NORTH_AMERICA");
    });

    it("should select the default Europe provider for UK numbers", async () => {
      const result = await service.selectProvider("+447123456789");

      expect(result.providerId).toBe("telnyx");
      expect(result.region).toBe("EUROPE");
    });

    it("should use the Asia-Pacific default for unsupported providers", async () => {
      const result = await service.selectProvider("+8801234567890");

      expect(result.providerId).toBe("telnyx");
      expect(result.region).toBe("GLOBAL");
      expect(result.isOptimal).toBe(true);
    });

    it("should handle invalid phone numbers gracefully", async () => {
      const result = await service.selectProvider("invalid-phone");

      expect(result.providerId).toBe("telnyx");
      expect(result.isOptimal).toBe(false);
    });
  });

  describe("getCostEstimate", () => {
    it("should calculate cost for single SMS", async () => {
      const result = await service.getCostEstimate("+12345678901", 1);

      expect(result.costPerSMS).toBe(0.008);
      expect(result.totalCost).toBe(0.008);
      expect(result.provider).toBe("Telnyx");
      expect(result.region).toBe("NORTH_AMERICA");
    });

    it("should calculate cost for multiple SMS segments", async () => {
      const result = await service.getCostEstimate("+2348123456789", 3);

      expect(result.costPerSMS).toBe(0.02);
      expect(result.totalCost).toBeCloseTo(0.06, 10);
      expect(result.provider).toBe("AfricasTalking");
    });
  });

  describe("getRoutingStats", () => {
    it("should return routing statistics", async () => {
      const stats = await service.getRoutingStats();

      expect(stats.totalRegions).toBeGreaterThan(0);
      expect(stats.supportedCountries).toBeGreaterThan(0);
      expect(stats.costSavings.averageCost).toBeGreaterThan(0);
      expect(stats.costSavings.cheapestRegion).toBeDefined();
      expect(stats.costSavings.mostExpensiveRegion).toBeDefined();
    });
  });

  describe("cost optimization scenarios", () => {
    it("should demonstrate cost savings vs single provider", async () => {
      const destinations = [
        { phone: "+2348123456789", country: "Nigeria" },
        { phone: "+1234567890", country: "US" },
        { phone: "+447123456789", country: "UK" },
        { phone: "+5511987654321", country: "Brazil" },
      ];

      const results = await Promise.all(
        destinations.map((dest) => service.getCostEstimate(dest.phone)),
      );

      const smartRoutingCost = results.reduce((total, result) => total + result.totalCost, 0);

      const singleProviderCost = destinations.length * 0.05;

      const savings = ((singleProviderCost - smartRoutingCost) / singleProviderCost) * 100;

      expect(savings).toBeGreaterThan(0);
      expect(smartRoutingCost).toBeLessThan(singleProviderCost);

      console.log(`Smart routing saves ${savings.toFixed(1)}% vs single provider`);
      console.log(`Smart routing: $${smartRoutingCost.toFixed(4)}`);
      console.log(`Single provider: $${singleProviderCost.toFixed(4)}`);
    });
  });

  describe("real-world scenarios", () => {
    it("should handle African business expansion", async () => {
      const africanNumbers = ["+2348123456789", "+254712345678", "+233201234567", "+27821234567"];

      const results = await Promise.all(
        africanNumbers.map((phone) => service.selectProvider(phone)),
      );

      expect(results[0].providerId).toBe("africastalking");
      expect(results[0].region).toBe("AFRICA");

      for (let i = 1; i < results.length; i++) {
        expect(results[i].providerId).toBe("africastalking");
        expect(results[i].region).toBe("AFRICA");
      }
    });

    it("should handle global enterprise deployment", async () => {
      const globalNumbers = [
        "+1234567890",
        "+447123456789",
        "+33123456789",
        "+49123456789",
        "+5511987654321",
        "+919876543210",
      ];

      const results = await Promise.all(
        globalNumbers.map((phone) => service.selectProvider(phone)),
      );

      const providers = results.map((r) => r.providerId);

      for (const providerId of providers) {
        expect(["telnyx", "africastalking"]).toContain(providerId);
      }

      const totalCost = results.reduce((sum, r) => sum + r.costPerSMS, 0);
      const averageCost = totalCost / results.length;

      expect(averageCost).toBeLessThan(0.05);
    });
  });
});
