import { describe, expect, it, vi, beforeEach } from "vitest";
import { ConfigService } from "@nestjs/config";
import { Test, TestingModule } from "@nestjs/testing";
import { ProviderOrchestratorService } from "../provider-orchestrator.service";
import { BillingIntegrationService } from "../../billing/services/billing-integration.service";
import { BrandMessagingConfigService } from "../../brand/services/brand-messaging-config.service";
import { EmailMessage } from "../providers/email/email-provider.interface";
import { SMSRoutingService } from "../providers/sms/sms-routing.service";
import { ProviderConfigRepository } from "../provider-config.repository";
import { ProviderEncryptionService } from "../provider-encryption.service";
import { VoiceService } from "../services/voice.service";
import { CircuitBreakerService } from "../../../common/errors/services/circuit-breaker.service";
import { CircuitBreakerException } from "../../../common/errors/exceptions/base.exception";
import { DeviceRegistrationService } from "../services/device-registration.service";
import { InAppOrchestratorService } from "../providers/in-app/in-app-orchestrator.service";
import { BrandedPushService } from "../services/branded-push.service";
import { NotificationChannel } from "../../../common/enums/notification-channel.enum";
import { SMSPayload } from "../providers/sms/sms-provider.interface";

const TENANT = "tenant-1";

describe("ProviderOrchestratorService managed chain", () => {
  let service: ProviderOrchestratorService;
  let circuitBreaker: { execute: ReturnType<typeof vi.fn> };
  let getPreferredProviders: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    circuitBreaker = {
      execute: vi.fn(async (_name: string, fn: () => Promise<unknown>) => fn()),
    };
    getPreferredProviders = vi.fn();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProviderOrchestratorService,
        { provide: ConfigService, useValue: { get: vi.fn() } },
        { provide: DeviceRegistrationService, useValue: {} },
        { provide: InAppOrchestratorService, useValue: {} },
        {
          provide: SMSRoutingService,
          useValue: {
            registerProvider: vi.fn(),
            getBestProvider: vi.fn(),
            getDefaultProvider: vi.fn(),
            getPreferredProviders,
          },
        },
        {
          provide: ProviderConfigRepository,
          useValue: { findActiveByTenantAndChannel: vi.fn().mockResolvedValue([]) },
        },
        {
          provide: BrandMessagingConfigService,
          useValue: { getBrandConfigForEmail: vi.fn().mockRejectedValue(new Error("no brand")) },
        },
        {
          provide: BrandedPushService,
          useValue: { enhancePushWithBrand: vi.fn().mockRejectedValue(new Error("no brand")) },
        },
        {
          provide: BillingIntegrationService,
          useValue: { processNotificationTokenUsage: vi.fn().mockResolvedValue(undefined) },
        },
        { provide: VoiceService, useValue: {} },
        {
          provide: ProviderEncryptionService,
          useValue: { decrypt: vi.fn().mockResolvedValue({}) },
        },
        { provide: CircuitBreakerService, useValue: circuitBreaker },
      ],
    }).compile();

    service = module.get(ProviderOrchestratorService);
  });

  function registerEmailSpy(
    name: string,
    result: { success: boolean; messageId?: string; error?: string },
  ) {
    const sendEmail = vi.fn().mockResolvedValue(result);
    service.registerEmailProvider(name, {
      sendEmail,
      validateConfig: vi.fn().mockResolvedValue(true),
      initialize: vi.fn().mockResolvedValue(undefined),
      getProviderName: vi.fn().mockReturnValue(name),
    } as any);
    return sendEmail;
  }

  it("falls back to the next email provider when the first reports failure", async () => {
    const first = registerEmailSpy("zeptomail", { success: false, error: "zeptomail down" });
    const second = registerEmailSpy("mailgun", { success: true, messageId: "mg-1" });

    const outcome = await service.sendEmail({ to: "a@b.c" } as EmailMessage, TENANT);

    expect(first).toHaveBeenCalledOnce();
    expect(second).toHaveBeenCalledOnce();
    expect(outcome).toEqual({ status: "sent", externalId: "mg-1", providerId: "mailgun" });
    expect(circuitBreaker.execute).toHaveBeenCalledWith(
      "managed-email:zeptomail",
      expect.any(Function),
    );
    expect(circuitBreaker.execute).toHaveBeenCalledWith(
      "managed-email:mailgun",
      expect.any(Function),
    );
  });

  it("falls back when the first email provider throws", async () => {
    const first = registerEmailSpy("zeptomail", { success: false, error: "should not reach" });
    first.mockRejectedValueOnce(new Error("zeptomail 429"));
    const second = registerEmailSpy("mailgun", { success: true, messageId: "mg-2" });

    const outcome = await service.sendEmail({ to: "a@b.c" } as EmailMessage, TENANT);

    expect(second).toHaveBeenCalledOnce();
    expect(outcome).toEqual({ status: "sent", externalId: "mg-2", providerId: "mailgun" });
  });

  it("returns the last failure when every provider in the chain fails", async () => {
    registerEmailSpy("zeptomail", { success: false, error: "z1" });
    registerEmailSpy("mailgun", { success: false, error: "m1" });
    registerEmailSpy("sendgrid", { success: false, error: "s1" });

    await expect(service.sendEmail({ to: "a@b.c" } as EmailMessage, TENANT)).rejects.toThrow(
      "All managed email providers failed",
    );
  });

  it("charges at the managed rate after a successful chain send", async () => {
    const billing = service["billingIntegrationService"];
    registerEmailSpy("zeptomail", { success: true, messageId: "mg-3" });

    await service.sendEmail({ to: "a@b.c" } as EmailMessage, TENANT);

    expect(billing.processNotificationTokenUsage).toHaveBeenCalledWith(
      TENANT,
      "email",
      expect.any(String),
      "managed",
      undefined,
      1,
    );
  });
});

describe("ProviderOrchestratorService managed SMS chain", () => {
  let service: ProviderOrchestratorService;
  let circuitBreaker: { execute: ReturnType<typeof vi.fn> };
  let getPreferredProviders: ReturnType<typeof vi.fn>;

  const termiiSend = vi.fn();
  const telnyxSend = vi.fn();
  let termii: unknown;
  let telnyx: unknown;

  beforeEach(async () => {
    vi.clearAllMocks();

    circuitBreaker = {
      execute: vi.fn(async (_name: string, fn: () => Promise<unknown>) => fn()),
    };
    getPreferredProviders = vi.fn();

    termiiSend.mockResolvedValue({ success: false, error: "termii 429 rate limited" });
    telnyxSend.mockResolvedValue({ success: true, messageId: "telnyx-1" });

    termii = {
      sendSMS: termiiSend,
      validateConfig: vi.fn().mockResolvedValue(true),
      getProviderName: vi.fn().mockReturnValue("termii"),
    };
    telnyx = {
      sendSMS: telnyxSend,
      validateConfig: vi.fn().mockResolvedValue(true),
      getProviderName: vi.fn().mockReturnValue("telnyx"),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProviderOrchestratorService,
        { provide: ConfigService, useValue: { get: vi.fn() } },
        { provide: DeviceRegistrationService, useValue: {} },
        { provide: InAppOrchestratorService, useValue: {} },
        {
          provide: SMSRoutingService,
          useValue: {
            registerProvider: vi.fn(),
            getBestProvider: vi.fn(),
            getDefaultProvider: vi.fn(),
            getPreferredProviders,
          },
        },
        {
          provide: ProviderConfigRepository,
          useValue: { findActiveByTenantAndChannel: vi.fn().mockResolvedValue([]) },
        },
        {
          provide: BrandMessagingConfigService,
          useValue: { getBrandConfigForEmail: vi.fn().mockRejectedValue(new Error("no brand")) },
        },
        {
          provide: BrandedPushService,
          useValue: { enhancePushWithBrand: vi.fn().mockRejectedValue(new Error("no brand")) },
        },
        {
          provide: BillingIntegrationService,
          useValue: { processNotificationTokenUsage: vi.fn().mockResolvedValue(undefined) },
        },
        { provide: VoiceService, useValue: {} },
        {
          provide: ProviderEncryptionService,
          useValue: { decrypt: vi.fn().mockResolvedValue({}) },
        },
        { provide: CircuitBreakerService, useValue: circuitBreaker },
      ],
    }).compile();

    service = module.get(ProviderOrchestratorService);
    service.registerSMSProvider("termii", termii as never);
    service.registerSMSProvider("telnyx", telnyx as never);

    getPreferredProviders.mockReturnValue([termii, telnyx]);
  });

  it("moves to the next provider on a 429-style failure", async () => {
    const outcome = await service.sendSMS(
      { to: "+2348000000000", message: "hi" } as SMSPayload,
      TENANT,
    );

    expect(termiiSend).toHaveBeenCalledOnce();
    expect(telnyxSend).toHaveBeenCalledOnce();
    expect(outcome).toEqual({ status: "sent", externalId: "telnyx-1", providerId: "telnyx" });
    expect(circuitBreaker.execute).toHaveBeenCalledWith("managed-sms:termii", expect.any(Function));
    expect(circuitBreaker.execute).toHaveBeenCalledWith("managed-sms:telnyx", expect.any(Function));
  });

  it("skips a provider whose circuit is open", async () => {
    circuitBreaker.execute.mockImplementation(async (name: string, fn: () => Promise<unknown>) => {
      if (name === "managed-sms:termii") {
        throw new CircuitBreakerException(name, {
          correlationId: "test",
          timestamp: new Date(),
          metadata: {},
        });
      }
      return fn();
    });

    const outcome = await service.sendSMS(
      { to: "+2348000000000", message: "hi" } as SMSPayload,
      TENANT,
    );

    expect(termiiSend).not.toHaveBeenCalled();
    expect(telnyxSend).toHaveBeenCalledOnce();
    expect(outcome).toEqual({ status: "sent", externalId: "telnyx-1", providerId: "telnyx" });
  });

  it("rejects a send without a tenant and writes nothing", async () => {
    await expect(
      service.sendSMS({ to: "+2348000000000", message: "hi" } as SMSPayload),
    ).rejects.toThrow();

    expect(termiiSend).not.toHaveBeenCalled();
    expect(telnyxSend).not.toHaveBeenCalled();
    expect(getPreferredProviders).not.toHaveBeenCalled();
  });
});

describe("ProviderOrchestratorService BYOP circuit outcomes", () => {
  let service: ProviderOrchestratorService;
  let circuitBreaker: { execute: ReturnType<typeof vi.fn> };
  let findActiveByTenantAndChannel: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    circuitBreaker = {
      execute: vi.fn(async (_name: string, fn: () => Promise<unknown>) => fn()),
    };
    findActiveByTenantAndChannel = vi.fn();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProviderOrchestratorService,
        { provide: ConfigService, useValue: { get: vi.fn() } },
        { provide: DeviceRegistrationService, useValue: {} },
        { provide: InAppOrchestratorService, useValue: {} },
        {
          provide: SMSRoutingService,
          useValue: {
            registerProvider: vi.fn(),
            getBestProvider: vi.fn(),
            getDefaultProvider: vi.fn(),
            getPreferredProviders: vi.fn(),
          },
        },
        {
          provide: ProviderConfigRepository,
          useValue: { findActiveByTenantAndChannel },
        },
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
          useValue: { processNotificationTokenUsage: vi.fn().mockResolvedValue(undefined) },
        },
        { provide: VoiceService, useValue: {} },
        {
          provide: ProviderEncryptionService,
          useValue: { decrypt: vi.fn().mockResolvedValue({}) },
        },
        { provide: CircuitBreakerService, useValue: circuitBreaker },
      ],
    }).compile();

    service = module.get(ProviderOrchestratorService);
  });

  function byopSms(sendSMS: ReturnType<typeof vi.fn>) {
    findActiveByTenantAndChannel.mockResolvedValue([
      { providerId: "twilio", config: {}, isActive: true },
    ]);
    const provider = {
      sendSMS,
      validateConfig: vi.fn().mockResolvedValue(true),
      getProviderName: vi.fn().mockReturnValue("twilio"),
    };
    service.registerSMSProvider("twilio", provider as never);
    return provider;
  }

  it("trips the circuit on a provider-reported failure and skips billing", async () => {
    const sendSMS = vi.fn().mockResolvedValue({ success: false, error: "twilio 5xx" });
    byopSms(sendSMS);

    await expect(
      service.sendSMS({ to: "+2348000000000", message: "hi" } as SMSPayload, TENANT),
    ).resolves.toEqual({ status: "failed", reason: "twilio 5xx", providerId: "twilio" });

    expect(circuitBreaker.execute).toHaveBeenCalledWith(
      `byo-sms:${TENANT}:twilio`,
      expect.any(Function),
    );
    expect(
      service["billingIntegrationService"].processNotificationTokenUsage,
    ).not.toHaveBeenCalled();

    // The operation passed to the breaker must throw so the breaker records it.
    const operation = circuitBreaker.execute.mock.calls[0][1] as () => Promise<unknown>;
    sendSMS.mockResolvedValueOnce({ success: false, error: "twilio 5xx again" });
    await expect(operation()).rejects.toThrow("twilio 5xx again");
  });

  it("returns a failed outcome without calling the provider when the circuit is open", async () => {
    const sendSMS = vi.fn();
    byopSms(sendSMS);
    circuitBreaker.execute.mockImplementation(async (name: string) => {
      throw new CircuitBreakerException(name, {
        correlationId: "test",
        timestamp: new Date(),
        metadata: {},
      });
    });

    await expect(
      service.sendSMS({ to: "+2348000000000", message: "hi" } as SMSPayload, TENANT),
    ).resolves.toMatchObject({ status: "failed", reason: expect.stringContaining("circuit open") });

    expect(sendSMS).not.toHaveBeenCalled();
    expect(
      service["billingIntegrationService"].processNotificationTokenUsage,
    ).not.toHaveBeenCalled();
  });

  it("does not trip the circuit on a permanent (retryable: false) failure", async () => {
    const sendSMS = vi.fn().mockResolvedValue({
      success: false,
      error: "bad number",
      retryable: false,
    });
    byopSms(sendSMS);

    await expect(
      service.sendSMS({ to: "+2348000000000", message: "hi" } as SMSPayload, TENANT),
    ).resolves.toEqual({
      status: "failed",
      reason: "bad number",
      providerId: "twilio",
      retryable: false,
    });

    const operation = circuitBreaker.execute.mock.calls[0][1] as () => Promise<unknown>;
    sendSMS.mockResolvedValueOnce({ success: false, error: "bad number", retryable: false });
    await expect(operation()).resolves.toEqual({
      status: "failed",
      reason: "bad number",
      providerId: "twilio",
      retryable: false,
    });
  });
});
