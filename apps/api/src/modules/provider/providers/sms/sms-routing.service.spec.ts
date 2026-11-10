import { ConfigService } from "@nestjs/config";
import { describe, expect, it, vi } from "vitest";
import { ISMSProvider, SMSPayload, BulkSMSPayload } from "./sms-provider.interface";
import { SMSRoutingService } from "./sms-routing.service";

function provider(name: string, supported: string[], cost: number): ISMSProvider {
  return {
    sendSMS: vi.fn(async (_payload: SMSPayload) => ({ success: true, provider: name })),
    sendBulkSMS: vi.fn(async (_payload: BulkSMSPayload) => ({
      success: true,
      results: [],
      provider: name,
    })),
    validateConfig: vi.fn(async () => true),
    getProviderName: () => name,
    getSupportedCountries: () => supported,
    getCostPerMessage: () => cost,
  } as ISMSProvider;
}

function build(defaultProvider = "termii") {
  const service = new SMSRoutingService({
    get: vi.fn((key: string) => (key === "DEFAULT_SMS_PROVIDER" ? defaultProvider : undefined)),
  } as unknown as ConfigService);

  return service;
}

describe("SMSRoutingService.getPreferredProviders", () => {
  it("orders supported providers by cost, cheapest first", () => {
    const service = build("termii");
    service.registerProvider(provider("infobip", ["US", "*"], 0.035));
    service.registerProvider(provider("telnyx", ["US"], 0.008));
    service.registerProvider(provider("termii", ["US"], 0.015));

    const ordered = service.getPreferredProviders("+14155552671");

    expect(ordered.map((entry) => entry.getProviderName())).toEqual([
      "telnyx",
      "termii",
      "infobip",
    ]);
  });

  it("promotes the env-configured default ahead of other providers that don't support the country", () => {
    const service = build("termii");
    service.registerProvider(provider("infobip", ["NG"], 0.035));
    service.registerProvider(provider("telnyx", ["NG"], 0.008));
    service.registerProvider(provider("termii", ["GB"], 0.015));

    const ordered = service.getPreferredProviders("+14155552671");

    expect(ordered.map((entry) => entry.getProviderName())).toEqual([
      "termii",
      "infobip",
      "telnyx",
    ]);
  });

  it("falls back to the default provider first for an unparseable number", () => {
    const service = build("termii");
    service.registerProvider(provider("infobip", ["*"], 0.035));
    service.registerProvider(provider("termii", ["*"], 0.015));

    const ordered = service.getPreferredProviders("not-a-number");

    expect(ordered[0].getProviderName()).toBe("termii");
  });

  it("returns an empty list when no provider is registered", () => {
    const service = build("termii");

    expect(service.getPreferredProviders("+14155552671")).toEqual([]);
  });

  it("keeps getBestProvider as the head of the preferred list", () => {
    const service = build("termii");
    service.registerProvider(provider("telnyx", ["US"], 0.008));
    service.registerProvider(provider("termii", ["US"], 0.015));

    expect(service.getBestProvider("+14155552671")?.getProviderName()).toBe("telnyx");
  });
});
