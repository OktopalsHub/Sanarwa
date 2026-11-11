import { describe, expect, it, vi, beforeEach } from "vitest";
import { ConfigService } from "@nestjs/config";
import { Test, TestingModule } from "@nestjs/testing";
import { ProviderOrchestratorService } from "../provider-orchestrator.service";
import { BillingIntegrationService } from "../../billing/services/billing-integration.service";
import { BrandMessagingConfigService } from "../../brand/services/brand-messaging-config.service";
import { BrandedPushService } from "../services/branded-push.service";
import { SMSRoutingService } from "../providers/sms/sms-routing.service";
import { ProviderConfigRepository } from "../provider-config.repository";
import { ProviderEncryptionService } from "../provider-encryption.service";
import { VoiceService } from "../services/voice.service";
import { CircuitBreakerService } from "../../../common/errors/services/circuit-breaker.service";
import { DeviceRegistrationService } from "../services/device-registration.service";
import { InAppOrchestratorService } from "../providers/in-app/in-app-orchestrator.service";
import { SMSPayload } from "../providers/sms/sms-provider.interface";
import { PushPayload } from "../providers/push/push-provider.interface";
import { getRedisConnectionToken } from "@nestjs-modules/ioredis";

const TENANT = "tenant-1";

describe("ProviderOrchestratorService BYOP factories", () => {
  let service: ProviderOrchestratorService;
  let findActiveByTenantAndChannel: ReturnType<typeof vi.fn>;
  let decrypt: ReturnType<typeof vi.fn>;
  let processNotificationTokenUsage: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    findActiveByTenantAndChannel = vi.fn().mockResolvedValue([]);
    decrypt = vi.fn().mockResolvedValue({});
    processNotificationTokenUsage = vi.fn().mockResolvedValue(undefined);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProviderOrchestratorService,
        { provide: ConfigService, useValue: { get: vi.fn().mockReturnValue("tests") } },
        { provide: getRedisConnectionToken(), useValue: { get: vi.fn().mockResolvedValue(null) } },
        { provide: DeviceRegistrationService, useValue: { pruneInvalidTokens: vi.fn() } },
        { provide: InAppOrchestratorService, useValue: {} },
        {
          provide: SMSRoutingService,
          useValue: {
            registerProvider: vi.fn(),
            getBestProvider: vi.fn(),
            getDefaultProvider: vi.fn(),
            getPreferredProviders: vi.fn().mockReturnValue([]),
          },
        },
        { provide: ProviderConfigRepository, useValue: { findActiveByTenantAndChannel } },
        { provide: BrandMessagingConfigService, useValue: {} },
        { provide: BrandedPushService, useValue: { enhancePushWithBrand: vi.fn() } },
        {
          provide: BillingIntegrationService,
          useValue: { processNotificationTokenUsage },
        },
        { provide: VoiceService, useValue: {} },
        { provide: ProviderEncryptionService, useValue: { decrypt } },
        {
          provide: CircuitBreakerService,
          useValue: {
            execute: vi.fn(async (_name: string, fn: () => Promise<unknown>) => fn()),
          },
        },
      ],
    }).compile();

    service = module.get(ProviderOrchestratorService);
  });

  it("instantiates the tenant's push provider from the stored config instead of the platform singleton", async () => {
    const tenantSend = vi.fn().mockResolvedValue({ success: true, messageId: "fcm-tenant-1" });
    const platformSend = vi.fn();
    const factory = vi.fn().mockReturnValue({
      sendPushNotification: tenantSend,
      validateConfig: vi.fn().mockResolvedValue(true),
      getProviderName: vi.fn().mockReturnValue("fcm"),
    });

    service.registerPushProvider(
      "fcm",
      {
        sendPushNotification: platformSend,
        validateConfig: vi.fn().mockResolvedValue(true),
        getProviderName: vi.fn().mockReturnValue("fcm"),
      } as never,
      factory,
    );

    const storedConfig = { serverKey: "tenant-fcm-key", projectId: "tenant-project" };
    findActiveByTenantAndChannel.mockResolvedValue([
      { providerId: "fcm", config: { encrypted: true } },
    ]);
    decrypt.mockResolvedValue(storedConfig);

    const outcome = await service.sendPushNotification(
      { deviceTokens: ["token-1"], title: "t", body: "b" } as PushPayload,
      TENANT,
    );

    expect(factory).toHaveBeenCalledWith(storedConfig);
    expect(tenantSend).toHaveBeenCalledWith(expect.objectContaining({ deviceTokens: ["token-1"] }));
    expect(platformSend).not.toHaveBeenCalled();
    expect(outcome.status).toBe("sent");
    expect(processNotificationTokenUsage).toHaveBeenCalledWith(
      TENANT,
      "push",
      expect.any(String),
      "byo",
      undefined,
      1,
    );
  });

  it("instantiates the tenant's SMS provider from the stored config instead of the platform singleton", async () => {
    const tenantSend = vi.fn().mockResolvedValue({ success: true, messageId: "termii-tenant-1" });
    const platformSend = vi.fn();
    const factory = vi.fn().mockReturnValue({
      sendSMS: tenantSend,
      sendBulkSMS: vi.fn(),
      validateConfig: vi.fn().mockResolvedValue(true),
      getProviderName: vi.fn().mockReturnValue("termii"),
      getSupportedCountries: vi.fn().mockReturnValue(["*"]),
      getCostPerMessage: vi.fn().mockReturnValue(0.015),
    });

    service.registerSMSProvider(
      "termii",
      {
        sendSMS: platformSend,
        sendBulkSMS: vi.fn(),
        validateConfig: vi.fn().mockResolvedValue(true),
        getProviderName: vi.fn().mockReturnValue("termii"),
        getSupportedCountries: vi.fn().mockReturnValue(["*"]),
        getCostPerMessage: vi.fn().mockReturnValue(0.015),
      } as never,
      factory,
    );

    const storedConfig = { apiKey: "tenant-termii-key", senderId: "TENANT" };
    findActiveByTenantAndChannel.mockResolvedValue([
      { providerId: "termii", config: { encrypted: true } },
    ]);
    decrypt.mockResolvedValue(storedConfig);

    const outcome = await service.sendSMS(
      { to: "+2348000000000", message: "hi" } as SMSPayload,
      TENANT,
    );

    expect(factory).toHaveBeenCalledWith(storedConfig);
    expect(tenantSend).toHaveBeenCalled();
    expect(platformSend).not.toHaveBeenCalled();
    expect(outcome.status).toBe("sent");
  });

  it("falls back to the registered singleton when a provider registers without a factory", async () => {
    const platformSend = vi.fn().mockResolvedValue({ success: true, messageId: "plat-1" });

    service.registerPushProvider("expo-push", {
      sendPushNotification: platformSend,
      validateConfig: vi.fn().mockResolvedValue(true),
      getProviderName: vi.fn().mockReturnValue("expo-push"),
    } as never);

    findActiveByTenantAndChannel.mockResolvedValue([
      { providerId: "expo-push", config: { encrypted: true } },
    ]);
    decrypt.mockResolvedValue({ accessToken: "tenant-token" });

    const outcome = await service.sendPushNotification(
      { deviceTokens: ["token-1"], title: "t", body: "b" } as PushPayload,
      TENANT,
    );

    expect(platformSend).toHaveBeenCalled();
    expect(outcome.status).toBe("sent");
  });
});
