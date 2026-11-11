import { ConfigService } from "@nestjs/config";
import { Test, TestingModule } from "@nestjs/testing";
import { NotificationChannel } from "../../../common/enums/notification-channel.enum";
import { BillingIntegrationService } from "../../billing/services/billing-integration.service";
import { BrandMessagingConfigService } from "../../brand/services/brand-messaging-config.service";
import { ChatPayload } from "../providers/chat/chat-provider.interface";
import { EmailMessage } from "../providers/email/email-provider.interface";
import { InAppOrchestratorService } from "../providers/in-app/in-app-orchestrator.service";
import { PushPayload } from "../providers/push/push-provider.interface";
import { SMSRoutingService } from "../providers/sms/sms-routing.service";
import { SMSPayload } from "../providers/sms/sms-provider.interface";
import { BrandedPushService } from "../services/branded-push.service";
import { VoiceService } from "../services/voice.service";
import { ProviderConfig } from "../provider-config.entity";
import { ProviderConfigRepository } from "../provider-config.repository";
import { ProviderEncryptionService } from "../provider-encryption.service";
import { ProviderOrchestratorService } from "../provider-orchestrator.service";
import { DeviceRegistrationService } from "../services/device-registration.service";
import { CircuitBreakerService } from "../../../common/errors/services/circuit-breaker.service";
import { getRedisConnectionToken } from "@nestjs-modules/ioredis";

const TENANT_ID = "tenant-1";

function providerConfig(providerId: string): ProviderConfig {
  return { providerId, config: {}, isActive: true, priority: 1 } as ProviderConfig;
}

describe("ProviderOrchestratorService BYOP resolution", () => {
  let service: ProviderOrchestratorService;
  let findActiveByTenantAndChannel: ReturnType<typeof vi.fn>;
  let processNotificationTokenUsage: ReturnType<typeof vi.fn>;
  let getBestProvider: ReturnType<typeof vi.fn>;
  let getPreferredProviders: ReturnType<typeof vi.fn>;
  let getDefaultProvider: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    findActiveByTenantAndChannel = vi.fn().mockResolvedValue([]);
    processNotificationTokenUsage = vi.fn().mockResolvedValue(undefined);
    getBestProvider = vi.fn();
    getPreferredProviders = vi.fn();
    getDefaultProvider = vi.fn();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProviderOrchestratorService,
        { provide: ConfigService, useValue: { get: vi.fn() } },
        { provide: getRedisConnectionToken(), useValue: { get: vi.fn().mockResolvedValue(null) } },
        {
          provide: SMSRoutingService,
          useValue: {
            registerProvider: vi.fn(),
            getBestProvider,
            getPreferredProviders,
            getDefaultProvider,
          },
        },
        {
          provide: ProviderConfigRepository,
          useValue: { findActiveByTenantAndChannel },
        },
        { provide: InAppOrchestratorService, useValue: {} },
        {
          provide: BrandMessagingConfigService,
          useValue: { getBrandConfigForEmail: vi.fn().mockResolvedValue({}) },
        },
        {
          provide: BrandedPushService,
          useValue: { enhancePushWithBrand: vi.fn().mockResolvedValue({}) },
        },
        {
          provide: BillingIntegrationService,
          useValue: { processNotificationTokenUsage },
        },
        { provide: VoiceService, useValue: {} },
        {
          provide: ProviderEncryptionService,
          useValue: { decrypt: vi.fn().mockResolvedValue({}) },
        },
        {
          provide: DeviceRegistrationService,
          useValue: { pruneInvalidTokens: vi.fn().mockResolvedValue(undefined) },
        },
        {
          provide: CircuitBreakerService,
          useValue: {
            execute: vi.fn(async (_key: string, fn: () => Promise<unknown>) => fn()),
          },
        },
      ],
    }).compile();

    service = module.get(ProviderOrchestratorService);
  });

  const cases = [
    {
      name: "sms",
      channel: NotificationChannel.SMS,
      providerId: "twilio",
      register: (provider: unknown) => service.registerSMSProvider("twilio", provider as never),
      send: () => service.sendSMS({ to: "+2348000000000", message: "hi" } as SMSPayload, TENANT_ID),
      deliver: "sendSMS",
    },
    {
      name: "email",
      channel: NotificationChannel.EMAIL,
      providerId: "ses",
      register: (provider: unknown) => service.registerEmailProvider("ses", provider as never),
      send: () => service.sendEmail({ to: "a@b.cd", subject: "s" } as EmailMessage, TENANT_ID),
      deliver: "sendEmail",
    },
    {
      name: "push",
      channel: NotificationChannel.PUSH,
      providerId: "fcm",
      register: (provider: unknown) => service.registerPushProvider("fcm", provider as never),
      send: () => service.sendPushNotification({ to: "token" } as PushPayload, TENANT_ID),
      deliver: "sendPushNotification",
    },
  ] as const;

  it.each(cases)("queries the $name channel with the value the column stores", async (testCase) => {
    const tenantProvider = {
      [testCase.deliver]: vi.fn().mockResolvedValue({ success: true, messageId: "ok" }),
      validateConfig: vi.fn().mockResolvedValue(true),
      initialize: vi.fn().mockResolvedValue(undefined),
      getProviderName: vi.fn().mockReturnValue("twilio"),
    };
    testCase.register(tenantProvider);
    findActiveByTenantAndChannel.mockResolvedValue([providerConfig(testCase.providerId)]);

    await testCase.send();

    expect(findActiveByTenantAndChannel).toHaveBeenCalledWith(TENANT_ID, testCase.channel);
    expect(findActiveByTenantAndChannel.mock.lastCall[1]).not.toBeInstanceOf(String);
  });

  it("sends through the tenant's own provider and charges at the BYO rate", async () => {
    const tenantProvider = {
      sendSMS: vi.fn().mockResolvedValue({ success: true, messageId: "tw-1" }),
      validateConfig: vi.fn().mockResolvedValue(true),
      getProviderName: vi.fn().mockReturnValue("twilio"),
    };
    service.registerSMSProvider("twilio", tenantProvider as never);
    findActiveByTenantAndChannel.mockResolvedValue([providerConfig("twilio")]);

    await service.sendSMS({ to: "+2348000000000", message: "hi" } as SMSPayload, TENANT_ID);

    expect(tenantProvider.sendSMS).toHaveBeenCalledOnce();
    expect(processNotificationTokenUsage).toHaveBeenCalledWith(
      TENANT_ID,
      "sms",
      expect.any(String),
      "byo",
      undefined,
      1,
    );
  });

  it("falls back to the platform provider and the managed rate when the tenant has no config", async () => {
    const platformProvider = {
      sendSMS: vi.fn().mockResolvedValue({ success: true, messageId: "plat-1" }),
      validateConfig: vi.fn().mockResolvedValue(true),
      getProviderName: vi.fn().mockReturnValue("termii"),
    };
    getPreferredProviders.mockReturnValue([platformProvider]);
    service.registerSMSProvider("termii", platformProvider as never);

    await service.sendSMS({ to: "+2348000000000", message: "hi" } as SMSPayload, TENANT_ID);

    expect(platformProvider.sendSMS).toHaveBeenCalledOnce();
    expect(processNotificationTokenUsage).toHaveBeenCalledWith(
      TENANT_ID,
      "sms",
      expect.any(String),
      "managed",
      undefined,
      1,
    );
  });

  it("rejects a request without a tenant and writes nothing", async () => {
    await expect(
      service.sendSMS({ to: "+2348000000000", message: "hi" } as SMSPayload),
    ).rejects.toThrow();

    expect(findActiveByTenantAndChannel).not.toHaveBeenCalled();
    expect(processNotificationTokenUsage).not.toHaveBeenCalled();
    expect(getPreferredProviders).not.toHaveBeenCalled();
  });
});
