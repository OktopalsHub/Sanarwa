import { Test, TestingModule } from "@nestjs/testing";
import { ConfigService } from "@nestjs/config";
import { AfricasTalkingProvider } from "../africastalking.provider";
import { SMSPayload, BulkSMSPayload } from "../../sms-provider.interface";
import type { Mock } from "vitest";

const { mockSMS, africasTalkingFactory } = vi.hoisted(() => {
  const sms = { send: vi.fn() };
  const instance = { SMS: sms };
  return { mockSMS: sms, africasTalkingFactory: vi.fn(() => instance) };
});

vi.mock("africastalking", () => {
  return { default: africasTalkingFactory };
});

describe("AfricasTalkingProvider", () => {
  let provider: AfricasTalkingProvider;
  let configService: ConfigService;

  beforeEach(async () => {
    vi.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AfricasTalkingProvider,
        {
          provide: ConfigService,
          useValue: {
            get: vi.fn((key: string) => {
              switch (key) {
                case "AFRICASTALKING_API_KEY":
                  return "test-api-key";
                case "AFRICASTALKING_USERNAME":
                  return "test-username";
                case "AFRICASTALKING_SHORT_CODE":
                  return "TEST";
                default:
                  return undefined;
              }
            }),
          },
        },
      ],
    }).compile();

    provider = module.get<AfricasTalkingProvider>(AfricasTalkingProvider);
    configService = module.get<ConfigService>(ConfigService);
  });

  it("should be defined", () => {
    expect(provider).toBeDefined();
  });

  it("should return correct provider name", () => {
    expect(provider.getProviderName()).toBe("africastalking");
  });

  it("should validate config correctly", async () => {
    const isValid = await provider.validateConfig();
    expect(isValid).toBe(true);
  });

  it("should return supported countries", () => {
    const countries = provider.getSupportedCountries();
    expect(countries).toContain("KE");
    expect(countries).toContain("NG");
    expect(countries).toContain("GH");
    expect(countries).toContain("ZA");
    expect(countries.length).toBeGreaterThan(20);
  });

  it("should return cost per message for supported countries", () => {
    expect(provider.getCostPerMessage("KE")).toBe(0.008);
    expect(provider.getCostPerMessage("NG")).toBe(0.02);
    expect(provider.getCostPerMessage("UNKNOWN")).toBe(0.04);
  });

  describe("sendSMS", () => {
    const mockPayload: SMSPayload = {
      to: "+254700000000",
      message: "Test message",
      from: "TEST",
    };

    it("should send SMS successfully with custom sender", async () => {
      const mockResponse = {
        SMSMessageData: {
          Recipients: [
            {
              status: "Success",
              messageId: "ATXid_test123",
              cost: "KES 1.00",
              number: "+254700000000",
            },
          ],
        },
      };

      mockSMS.send.mockResolvedValue(mockResponse);

      const result = await provider.sendSMS(mockPayload);

      expect(result.success).toBe(true);
      expect(result.messageId).toBe("ATXid_test123");
      expect(result.provider).toBe("africastalking");
      expect(result.cost).toBeGreaterThan(0);

      expect(mockSMS.send).toHaveBeenCalledWith({
        to: ["+254700000000"],
        message: "Test message",
        from: "TEST",
      });
    });

    it("should use default sender when no custom sender provided", async () => {
      const mockResponse = {
        SMSMessageData: {
          Recipients: [
            {
              status: "Success",
              messageId: "ATXid_test456",
              cost: "KES 1.00",
              number: "+254700000000",
            },
          ],
        },
      };

      mockSMS.send.mockResolvedValue(mockResponse);

      const payloadWithoutSender = {
        to: "+254700000000",
        message: "Test message without custom sender",
      };

      const result = await provider.sendSMS(payloadWithoutSender);

      expect(result.success).toBe(true);

      expect(mockSMS.send).toHaveBeenCalledWith({
        to: ["+254700000000"],
        message: "Test message without custom sender",
        from: "TEST",
      });
    });

    it("should handle SDK errors", async () => {
      mockSMS.send.mockRejectedValue(new Error("Invalid API key"));

      const result = await provider.sendSMS(mockPayload);

      expect(result.success).toBe(false);
      expect(result.error).toContain("Invalid API key");
      expect(result.provider).toBe("africastalking");
    });

    it("should handle missing recipient data", async () => {
      const mockResponse = {
        SMSMessageData: {
          Recipients: [],
        },
      };

      mockSMS.send.mockResolvedValue(mockResponse);

      const result = await provider.sendSMS(mockPayload);

      expect(result.success).toBe(false);
      expect(result.error).toContain("No recipient data returned");
      expect(result.provider).toBe("africastalking");
    });

    it("should handle failed message status", async () => {
      const mockResponse = {
        SMSMessageData: {
          Recipients: [
            {
              status: "Failed",
              statusCode: "101",
              messageId: "ATXid_test123",
              number: "+254700000000",
            },
          ],
        },
      };

      mockSMS.send.mockResolvedValue(mockResponse);

      const result = await provider.sendSMS(mockPayload);

      expect(result.success).toBe(false);
      expect(result.error).toContain("Message failed: Failed - 101");
      expect(result.provider).toBe("africastalking");
    });
  });

  describe("sendBulkSMS", () => {
    const mockBulkPayload: BulkSMSPayload = {
      recipients: ["+254700000000", "+234800000000", "+233200000000"],
      message: "Bulk test message",
      from: "BULK",
    };

    it("should send bulk SMS successfully", async () => {
      const mockResponse = {
        SMSMessageData: {
          Recipients: [
            {
              status: "Success",
              messageId: "ATXid_bulk1",
              cost: "KES 1.00",
              number: "+254700000000",
            },
            {
              status: "Success",
              messageId: "ATXid_bulk2",
              cost: "NGN 15.00",
              number: "+234800000000",
            },
            {
              status: "Failed",
              statusCode: "101",
              number: "+233200000000",
            },
          ],
        },
      };

      mockSMS.send.mockResolvedValue(mockResponse);

      const result = await provider.sendBulkSMS(mockBulkPayload);

      expect(result.success).toBe(true);
      expect(result.successCount).toBe(2);
      expect(result.failureCount).toBe(1);
      expect(result.provider).toBe("africastalking");
      expect(result.results).toHaveLength(3);

      expect(result.results[0].success).toBe(true);
      expect(result.results[0].messageId).toBe("ATXid_bulk1");
      expect(result.results[1].success).toBe(true);
      expect(result.results[1].messageId).toBe("ATXid_bulk2");

      expect(result.results[2].success).toBe(false);
      expect(result.results[2].error).toContain("Failed - 101");

      expect(mockSMS.send).toHaveBeenCalledWith({
        to: ["+254700000000", "+234800000000", "+233200000000"],
        message: "Bulk test message",
        from: "BULK",
      });
    });

    it("should handle bulk SMS SDK errors", async () => {
      mockSMS.send.mockRejectedValue(new Error("Bulk sending failed"));

      const result = await provider.sendBulkSMS(mockBulkPayload);

      expect(result.success).toBe(false);
      expect(result.successCount).toBe(0);
      expect(result.failureCount).toBe(3);
      expect(result.results).toHaveLength(3);

      result.results.forEach((r) => {
        expect(r.success).toBe(false);
        expect(r.error).toContain("Bulk sending failed");
      });
    });
  });

  describe("config validation", () => {
    it("should fail validation with missing API key", async () => {
      const moduleWithoutApiKey: TestingModule = await Test.createTestingModule({
        providers: [
          AfricasTalkingProvider,
          {
            provide: ConfigService,
            useValue: {
              get: vi.fn((key: string) => {
                switch (key) {
                  case "AFRICASTALKING_USERNAME":
                    return "test-username";
                  default:
                    return undefined;
                }
              }),
            },
          },
        ],
      }).compile();

      const providerWithoutApiKey =
        moduleWithoutApiKey.get<AfricasTalkingProvider>(AfricasTalkingProvider);
      const isValid = await providerWithoutApiKey.validateConfig();
      expect(isValid).toBe(false);
    });

    it("should fail validation with missing username", async () => {
      const moduleWithoutUsername: TestingModule = await Test.createTestingModule({
        providers: [
          AfricasTalkingProvider,
          {
            provide: ConfigService,
            useValue: {
              get: vi.fn((key: string) => {
                switch (key) {
                  case "AFRICASTALKING_API_KEY":
                    return "test-api-key";
                  default:
                    return undefined;
                }
              }),
            },
          },
        ],
      }).compile();

      const providerWithoutUsername =
        moduleWithoutUsername.get<AfricasTalkingProvider>(AfricasTalkingProvider);
      const isValid = await providerWithoutUsername.validateConfig();
      expect(isValid).toBe(false);
    });
  });

  describe("cost parsing", () => {
    it("should parse different currency costs correctly", () => {
      const testCases = [
        { phone: "+254700000000", expectedCountry: "KE" },
        { phone: "+234800000000", expectedCountry: "NG" },
        { phone: "+233200000000", expectedCountry: "GH" },
        { phone: "+27600000000", expectedCountry: "ZA" },
      ];

      testCases.forEach(({ phone, expectedCountry }) => {
        const cost = provider.getCostPerMessage(expectedCountry);
        expect(cost).toBeGreaterThan(0);
      });
    });
  });
});
