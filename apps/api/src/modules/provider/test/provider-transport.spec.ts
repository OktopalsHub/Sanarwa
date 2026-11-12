import { describe, expect, it, vi } from "vitest";
import {
  chatTransport,
  emailTransport,
  inAppTransport,
  pushTransport,
  smsTransport,
  voiceTransport,
} from "../provider-transport";

describe("provider transports", () => {
  it("normalises an email failure and keeps its reason", async () => {
    const provider = { sendEmail: vi.fn().mockResolvedValue({ status: "failed", error: "bad" }) };

    const outcome = await emailTransport(provider as never).send({} as never);

    expect(outcome).toEqual({ status: "failed", reason: "bad" });
  });

  it("maps an SMS success to its external id", async () => {
    const provider = { sendSMS: vi.fn().mockResolvedValue({ success: true, messageId: "m1" }) };

    const outcome = await smsTransport(provider as never).send({} as never);

    expect(outcome).toEqual({ status: "sent", externalId: "m1" });
  });

  it("routes bulk SMS through sendBulkSMS", async () => {
    const provider = { sendBulkSMS: vi.fn().mockResolvedValue({ success: true }) };

    await smsTransport(provider as never).sendBulk({ recipients: ["+1"], message: "x" });

    expect(provider.sendBulkSMS).toHaveBeenCalledOnce();
  });

  it("passes push failed tokens through for pruning", async () => {
    const provider = {
      sendPushNotification: vi.fn().mockResolvedValue({ success: true, failedTokens: ["dead"] }),
    };

    const outcome = await pushTransport(provider as never).send({} as never);

    expect(outcome).toMatchObject({ status: "sent", failedTokens: ["dead"] });
  });

  it("treats a chat provider returning nothing as failed", async () => {
    const provider = { sendMessage: vi.fn().mockResolvedValue(undefined) };

    const outcome = await chatTransport(provider as never).send({} as never);

    expect(outcome.status).toBe("failed");
  });

  it("maps a created voice call to its call control id and passes the tenant", async () => {
    const voiceService = {
      createOutboundCall: vi.fn().mockResolvedValue({ success: true, callControlId: "cc-1" }),
    };

    const outcome = await voiceTransport(voiceService as never).send({
      tenantId: "t1",
      phoneNumber: "+15551234567",
      message: "hi",
    });

    expect(outcome).toEqual({ status: "sent", externalId: "cc-1" });
    expect(voiceService.createOutboundCall).toHaveBeenCalledWith(
      { phoneNumber: "+15551234567", message: "hi" },
      "t1",
    );
  });

  it("reports a voice failure with the provider's reason", async () => {
    const voiceService = {
      createOutboundCall: vi.fn().mockResolvedValue({ success: false, error: "no route" }),
    };

    const outcome = await voiceTransport(voiceService as never).send({
      tenantId: "t1",
      phoneNumber: "+1",
      message: "hi",
    });

    expect(outcome).toEqual({ status: "failed", reason: "no route" });
  });

  it("normalises an in-app delivery result", async () => {
    const inApp = {
      sendInAppNotification: vi.fn().mockResolvedValue({ success: true, messageId: "n1" }),
    };

    const outcome = await inAppTransport(inApp as never).send({ tenantId: "t1" } as never);

    expect(outcome).toEqual({ status: "sent", externalId: "n1" });
  });
});
