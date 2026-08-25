import { Test, TestingModule } from "@nestjs/testing";
import { SmartSMSRouterService } from "./smart-sms-router.service";
import type { Mock } from "vitest";

describe("SmartSMSRouterService", () => {
  let service: SmartSMSRouterService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [SmartSMSRouterService],
    }).compile();

    service = module.get<SmartSMSRouterService>(SmartSMSRouterService);

    // Mock the private getProviderHealth method to always return healthy providers
    vi.spyOn(service as any, "getProviderHealth").mockResolvedValue({
      isHealthy: true,
      lastCheck: new Date(),
    });
  });

  it("should be defined", () => {
    expect(service).toBeDefined();
  });

  describe("selectProvider", () => {
    it("should select Termii for Nigerian numbers", async () => {
      const result = await service.selectProvider("+2348123456789");

      expect(result.providerId).toBe("termii");
      expect(result.region).toBe("Nigeria");
      expect(result.costPerSMS).toBe(0.015);
    });

    it("should select Telnyx for US numbers", async () => {
      const result = await service.selectProvider("+12345678901");

      expect(result.providerId).toBe("telnyx");
      expect(result.region).toBe("North America");
      expect(result.costPerSMS).toBe(0.008);
    });

    it("should select Infobip for UK numbers", async () => {
      const result = await service.selectProvider("+447123456789");

      expect(result.providerId).toBe("infobip");
      expect(result.region).toBe("Europe");
      expect(result.costPerSMS).toBe(0.035);
    });

    it("should use global fallback for unsupported countries", async () => {
      const result = await service.selectProvider("+8801234567890"); // Bangladesh

      expect(result.providerId).toBe("messagebird");
      expect(result.region).toContain("Global");
      expect(result.costPerSMS).toBe(0.05);
      expect(result.isOptimal).toBe(false);
    });

    it("should handle invalid phone numbers gracefully", async () => {
      const result = await service.selectProvider("invalid-phone");

      expect(result.providerId).toBe("messagebird");
      expect(result.region).toContain("Global");
      expect(result.isOptimal).toBe(false);
    });
  });

  describe("getCostEstimate", () => {
    it("should calculate cost for single SMS", async () => {
      const result = await service.getCostEstimate("+12345678901", 1);

      expect(result.costPerSMS).toBe(0.008);
      expect(result.totalCost).toBe(0.008);
      expect(result.provider).toBe("Telnyx");
      expect(result.region).toBe("North America");
    });

    it("should calculate cost for multiple SMS segments", async () => {
      const result = await service.getCostEstimate("+2348123456789", 3);

      expect(result.costPerSMS).toBe(0.015);
      expect(result.totalCost).toBe(0.045);
      expect(result.provider).toBe("Termii");
    });
  });

  describe("getRoutingStats", () => {
    it("should return routing statistics", async () => {
      const stats = await service.getRoutingStats();

      expect(stats.totalRules).toBeGreaterThan(0);
      expect(stats.supportedCountries).toBeGreaterThan(0);
      expect(stats.providerHealth).toBeDefined();
      expect(stats.costSavings.averageCost).toBeGreaterThan(0);
      expect(stats.costSavings.cheapestRegion).toBeDefined();
      expect(stats.costSavings.mostExpensiveRegion).toBeDefined();
    });
  });

  describe("cost optimization scenarios", () => {
    it("should demonstrate cost savings vs single provider", async () => {
      // Test multiple destinations
      const destinations = [
        { phone: "+2348123456789", country: "Nigeria" },
        { phone: "+1234567890", country: "US" },
        { phone: "+447123456789", country: "UK" },
        { phone: "+5511987654321", country: "Brazil" },
      ];

      const results = await Promise.all(
        destinations.map((dest) => service.getCostEstimate(dest.phone)),
      );

      // Calculate total cost with smart routing
      const smartRoutingCost = results.reduce((total, result) => total + result.totalCost, 0);

      // Compare with single provider (e.g., if using only MessageBird)
      const singleProviderCost = destinations.length * 0.05; // MessageBird global rate

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
      const africanNumbers = [
        "+2348123456789", // Nigeria
        "+254712345678", // Kenya
        "+233201234567", // Ghana
        "+27821234567", // South Africa
      ];

      const results = await Promise.all(
        africanNumbers.map((phone) => service.selectProvider(phone)),
      );

      // Nigeria should use Termii
      expect(results[0].providerId).toBe("termii");
      expect(results[0].region).toBe("Nigeria");
      expect(results[0].costPerSMS).toBe(0.015);

      // Other African countries should use Telnyx
      for (let i = 1; i < results.length; i++) {
        expect(results[i].providerId).toBe("telnyx");
        expect(results[i].region).toBe("Africa (Other)");
        expect(results[i].costPerSMS).toBe(0.025);
      }
    });

    it("should handle global enterprise deployment", async () => {
      const globalNumbers = [
        "+1234567890", // US
        "+447123456789", // UK
        "+33123456789", // France
        "+49123456789", // Germany
        "+5511987654321", // Brazil
        "+919876543210", // India
      ];

      const results = await Promise.all(
        globalNumbers.map((phone) => service.selectProvider(phone)),
      );

      // Should use different providers optimized for each region
      const providers = results.map((r) => r.providerId);
      const uniqueProviders = new Set(providers);

      // Should use at least 2 different providers for cost optimization
      expect(uniqueProviders.size).toBeGreaterThanOrEqual(2);

      // Total cost should be optimized
      const totalCost = results.reduce((sum, r) => sum + r.costPerSMS, 0);
      const averageCost = totalCost / results.length;

      // Average should be less than global fallback rate
      expect(averageCost).toBeLessThan(0.05);
    });
  });
});
