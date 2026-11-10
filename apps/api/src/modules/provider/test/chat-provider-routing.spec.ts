import { ConfigService } from "@nestjs/config";
import { Test, TestingModule } from "@nestjs/testing";
import { NotificationChannel } from "../../../common/enums/notification-channel.enum";
import { BillingIntegrationService } from "../../billing/services/billing-integration.service";
import { BrandMessagingConfigService } from "../../brand/services/brand-messaging-config.service";
import { InAppOrchestratorService } from "../providers/in-app/in-app-orchestrator.service";
import {
  ChatPayload,
  ChatResponse,
  IChatProvider,
} from "../providers/chat/chat-provider.interface";
import { SMSRoutingService } from "../providers/sms/sms-routing.service";
import { BrandedPushService } from "../services/branded-push.service";
import { VoiceService } from "../services/voice.service";
import { ProviderConfig } from "../provider-config.entity";
import { ProviderConfigRepository } from "../provider-config.repository";
import { ProviderEncryptionService } from "../provider-encryption.service";
import { ProviderOrchestratorService } from "../provider-orchestrator.service";
import { DeviceRegistrationService } from "../services/device-registration.service";
import { CircuitBreakerService } from "../../../common/errors/services/circuit-breaker.service";

const TENANT_ID = "tenant-1";

function providerConfig(providerId: string, config: Record<string, unknown> = {}): ProviderConfig {
  return { providerId, config, isActive: true, priority: 1 } as ProviderConfig;
}

function chatProvider(name: string, overrides: Partial<IChatProvider> = {}): IChatProvider {
  return {
    sendMessage: vi.fn().mockResolvedValue({
      success: true,
      messageId: `${name}-1`,
      provider: name,
    } satisfies ChatResponse),
    validateConfig: vi.fn().mockResolvedValue(true),
    getProviderName: vi.fn().mockReturnValue(name),
    ...overrides,
  };
}

describe("ProviderOrchestratorService chat routing", () => {
  let service: ProviderOrchestratorService;
  let findActiveByTenantAndChannel: ReturnType<typeof vi.fn>;
  let processNotificationTokenUsage: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    findActiveByTenantAndChannel = vi.fn().mockResolvedValue([]);
    processNotificationTokenUsage = vi.fn().mockResolvedValue(undefined);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProviderOrchestratorService,
        { provide: ConfigService, useValue: { get: vi.fn() } },
        {
          provide: SMSRoutingService,
          useValue: {
            registerProvider: vi.fn(),
            getBestProvider: vi.fn(),
            getDefaultProvider: vi.fn(),
          },
        },
        { provide: ProviderConfigRepository, useValue: { findActiveByTenantAndChannel } },
        { provide: InAppOrchestratorService, useValue: {} },
        {
          provide: BrandMessagingConfigService,
          useValue: { getBrandConfigForEmail: vi.fn().mockResolvedValue({}) },
        },
        {
          provide: BrandedPushService,
          useValue: { enhancePushWithBrand: vi.fn().mockResolvedValue({}) },
        },
        { provide: BillingIntegrationService, useValue: { processNotificationTokenUsage } },
        { provide: VoiceService, useValue: {} },
        {
          provide: ProviderEncryptionService,
          useValue: { decrypt: vi.fn().mockImplementation(async (config) => config) },
        },
        {
          provide: CircuitBreakerService,
          useValue: {
            execute: vi.fn(async (_key: string, fn: () => Promise<unknown>) => fn()),
          },
        },
        {
          provide: DeviceRegistrationService,
          useValue: { pruneInvalidTokens: vi.fn().mockResolvedValue(undefined) },
        },
      ],
    }).compile();

    service = module.get(ProviderOrchestratorService);
  });

  it("refuses to send through the platform when the tenant has no Slack connection", async () => {
    const slack = chatProvider("slack");
    service.registerChatProvider("slack", slack);

    await expect(
      service.sendChatMessage({ channel: "C123", message: "hi" }, "slack", TENANT_ID),
    ).rejects.toThrow("No slack connection is configured for this tenant");

    expect(slack.sendMessage).not.toHaveBeenCalled();
    expect(processNotificationTokenUsage).not.toHaveBeenCalled();
  });

  it("looks for WhatsApp connections on the WhatsApp channel, not chat", async () => {
    const whatsapp = chatProvider("whatsapp");
    service.registerChatProvider("whatsapp", whatsapp);

    await expect(
      service.sendChatMessage({ channel: "+2348000000000", message: "hi" }, "whatsapp", TENANT_ID),
    ).rejects.toThrow("No whatsapp connection is configured for this tenant");

    expect(findActiveByTenantAndChannel).toHaveBeenCalledWith(
      TENANT_ID,
      NotificationChannel.WHATSAPP,
    );
    expect(whatsapp.sendMessage).not.toHaveBeenCalled();
  });

  it("builds a BYOP chat provider from the tenant config", async () => {
    const base = chatProvider("slack");
    const byopSend = vi
      .fn()
      .mockResolvedValue({ success: true, messageId: "byop-1", provider: "slack" });
    const byop = chatProvider("slack", { sendMessage: byopSend });
    const factory = vi.fn().mockReturnValue(byop);

    service.registerChatProvider("slack", base, factory);
    findActiveByTenantAndChannel.mockResolvedValue([
      providerConfig("slack", { botToken: "xoxb-tenant" }),
    ]);

    const outcome = await service.sendChatMessage(
      { channel: "C123", message: "hi" },
      "slack",
      TENANT_ID,
    );

    expect(factory).toHaveBeenCalledWith({ botToken: "xoxb-tenant" });
    expect(byopSend).toHaveBeenCalledOnce();
    expect(base.sendMessage).not.toHaveBeenCalled();
    expect(outcome).toEqual({ status: "sent", externalId: "byop-1", providerId: "slack" });
    expect(processNotificationTokenUsage).toHaveBeenCalledWith(
      TENANT_ID,
      "chat",
      expect.any(String),
      "byo",
      undefined,
      1,
    );
  });

  it("resolves the whatsapp_business provider id to the WhatsApp transport", async () => {
    const base = chatProvider("whatsapp");
    const factory = vi.fn().mockReturnValue(chatProvider("whatsapp"));
    service.registerChatProvider("whatsapp", base, factory);
    findActiveByTenantAndChannel.mockResolvedValue([
      providerConfig("whatsapp_business", { accessToken: "token", phoneNumberId: "123" }),
    ]);

    await service.sendChatMessage(
      { channel: "+2348000000000", message: "hi" },
      "whatsapp",
      TENANT_ID,
    );

    expect(factory).toHaveBeenCalledWith({ accessToken: "token", phoneNumberId: "123" });
  });

  it("fails when a requested chat provider is not registered", async () => {
    await expect(
      service.sendChatMessage({ channel: "C123", message: "hi" }, "telegram", TENANT_ID),
    ).rejects.toThrow("Chat provider 'telegram' not found");
  });
});
