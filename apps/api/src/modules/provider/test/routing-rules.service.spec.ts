import { describe, expect, it, vi } from "vitest";
import { BadRequestException, NotFoundException } from "@nestjs/common";
import { RoutingRulesService } from "../routing-rules/routing-rules.service";

function setup(store: Record<string, string> = {}) {
  const redis = {
    set: vi.fn(async (key: string, value: string) => {
      store[key] = value;
      return "OK";
    }),
    del: vi.fn(async (key: string) => (store[key] === undefined ? 0 : (delete store[key], 1))),
    scan: vi.fn(async () => ["0", Object.keys(store)]),
    mget: vi.fn(async (keys: string[]) => keys.map((key) => store[key] ?? null)),
  };
  const orchestrator = {
    managedProviderNames: vi.fn((channel: string) =>
      channel === "email"
        ? ["zeptomail", "mailgun"]
        : channel === "sms"
          ? ["twilio", "termii"]
          : [],
    ),
  };
  return { service: new RoutingRulesService(redis as never, orchestrator as never), redis, store };
}

describe("RoutingRulesService", () => {
  it("stores the shape the orchestrator reads, under the global key", async () => {
    const { service, redis } = setup();

    await service.set("email", { primary: "mailgun", fallback: ["zeptomail"] });

    expect(redis.set).toHaveBeenCalledWith(
      "optimizer:rule:email:global",
      JSON.stringify({ providers: { primary: "mailgun", fallback: ["zeptomail"] } }),
    );
  });

  it("scopes an SMS rule to a region", async () => {
    const { service, redis } = setup();

    await service.set("sms", { region: "NG", primary: "termii", fallback: ["twilio"] });

    expect(redis.set).toHaveBeenCalledWith("optimizer:rule:sms:NG", expect.any(String));
  });

  it("rejects a region on a non-SMS channel", async () => {
    const { service } = setup();

    await expect(
      service.set("email", { region: "NG", primary: "mailgun", fallback: [] }),
    ).rejects.toThrow(BadRequestException);
  });

  it("rejects a provider that is not registered for the channel", async () => {
    const { service, redis } = setup();

    await expect(service.set("email", { primary: "mailgun", fallback: ["ses"] })).rejects.toThrow(
      /Unknown email provider\(s\): ses/,
    );

    expect(redis.set).not.toHaveBeenCalled();
  });

  it("rejects a provider listed twice", async () => {
    const { service } = setup();

    await expect(
      service.set("email", { primary: "mailgun", fallback: ["mailgun"] }),
    ).rejects.toThrow(BadRequestException);
  });

  it("lists rules and skips malformed entries", async () => {
    const { service } = setup({
      "optimizer:rule:sms:NG": JSON.stringify({ providers: { primary: "termii", fallback: [] } }),
      "optimizer:rule:email:global": "not json",
    });

    const rules = await service.list();

    expect(rules).toEqual([{ channel: "sms", region: "NG", primary: "termii", fallback: [] }]);
  });

  it("removes a rule and reports a missing one", async () => {
    const { service } = setup({
      "optimizer:rule:email:global": JSON.stringify({
        providers: { primary: "mailgun", fallback: [] },
      }),
    });

    await service.remove("email");

    await expect(service.remove("email")).rejects.toThrow(NotFoundException);
  });
});
