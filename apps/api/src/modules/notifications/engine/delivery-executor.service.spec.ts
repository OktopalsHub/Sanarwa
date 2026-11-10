import { describe, expect, it, vi } from "vitest";
import { NotificationChannel } from "../../../common/enums/notification-channel.enum";
import { DeliveryExecutorService } from "./delivery-executor.service";

function build(orchestratorOverrides: Record<string, unknown> = {}) {
  const sendChatMessage = vi.fn().mockResolvedValue({ status: "sent", externalId: "provider-1" });
  const orchestrator = { sendChatMessage, ...orchestratorOverrides };
  return {
    executor: new DeliveryExecutorService(orchestrator as never),
    sendChatMessage,
  };
}

describe("DeliveryExecutorService chat delivery", () => {
  it("routes chat to the provider named in the delivery metadata", async () => {
    const { executor, sendChatMessage } = build();

    const outcome = await executor.deliver({
      tenantId: "tenant-1",
      channel: NotificationChannel.CHAT,
      to: "-100123",
      subject: "Deploy",

      data: "All green",
      variables: { blocks: [{ type: "section" }], embeds: [{ title: "run" }] },
      metadata: { chatProvider: "telegram" },
    });

    expect(sendChatMessage).toHaveBeenCalledWith(
      {
        channel: "-100123",
        message: "All green",
        subject: "Deploy",
        blocks: [{ type: "section" }],
        embeds: [{ title: "run" }],
        metadata: {
          blocks: [{ type: "section" }],
          embeds: [{ title: "run" }],
          chatProvider: "telegram",
        },
      },
      "telegram",
      "tenant-1",
    );
    expect(outcome).toEqual({ status: "sent", externalId: "provider-1", providerId: "telegram" });
  });

  it("defaults chat to Slack", async () => {
    const { executor, sendChatMessage } = build();

    await executor.deliver({
      tenantId: "tenant-1",
      channel: NotificationChannel.CHAT,
      to: "C123",

      data: "hello",
    });

    expect(sendChatMessage).toHaveBeenCalledWith(
      expect.objectContaining({ channel: "C123", message: "hello" }),
      "slack",
      "tenant-1",
    );
  });

  it("passes WhatsApp templates through metadata and data", async () => {
    const { executor, sendChatMessage } = build();

    await executor.deliver({
      tenantId: "tenant-1",
      channel: NotificationChannel.WHATSAPP,
      to: "+2348000000000",

      data: "Paid",
      variables: { whatsappTemplate: { name: "receipt", language: "en_US" } },
      metadata: { campaign: "billing" },
    });

    expect(sendChatMessage).toHaveBeenCalledWith(
      {
        channel: "+2348000000000",
        message: "Paid",
        subject: undefined,
        metadata: {
          whatsappTemplate: { name: "receipt", language: "en_US" },
          campaign: "billing",
        },
      },
      "whatsapp",
      "tenant-1",
    );
  });

  it("propagates the provider's retry classification", async () => {
    const { executor } = build({
      sendChatMessage: vi
        .fn()
        .mockResolvedValue({ status: "failed", reason: "channel_not_found", retryable: false }),
    });

    const outcome = await executor.deliver({
      tenantId: "tenant-1",
      channel: NotificationChannel.CHAT,
      to: "C404",

      data: "hello",
    });

    expect(outcome).toEqual({
      status: "failed",
      error: "channel_not_found",
      providerId: "slack",
      retryable: false,
    });
  });

  it("routes voice through the managed voice call path", async () => {
    const sendVoiceCall = vi
      .fn()
      .mockResolvedValue({ status: "sent", externalId: "call-1", providerId: "telnyx" });
    const { executor } = build({ sendVoiceCall });

    const outcome = await executor.deliver({
      tenantId: "tenant-1",
      channel: NotificationChannel.VOICE,
      to: "+2348000000000",

      data: "hello",
    });

    expect(sendVoiceCall).toHaveBeenCalledWith(
      expect.objectContaining({ to: ["+2348000000000"], message: "hello" }),
      "tenant-1",
    );
    expect(outcome.status).toBe("sent");
    expect(outcome.providerId).toBe("telnyx");
  });
});

describe("DeliveryExecutorService in-app delivery", () => {
  it("threads messageId and deliveryId into the in-app payload", async () => {
    const sendInAppNotification = vi
      .fn()
      .mockResolvedValue({ status: "sent", externalId: "row-1" });
    const orchestrator = { sendInAppNotification };
    const executor = new DeliveryExecutorService(orchestrator as never);

    const outcome = await executor.deliver({
      tenantId: "tenant-1",
      channel: NotificationChannel.IN_APP,
      to: "subscriber-1",
      subject: "Welcome",

      data: "Your order shipped",
      messageId: "message-1",
      deliveryId: "delivery-1",
    });

    expect(sendInAppNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: ["subscriber-1"],
        title: "Welcome",
        message: "Your order shipped",
        messageId: "message-1",
        deliveryId: "delivery-1",
      }),
      "tenant-1",
    );
    expect(outcome).toEqual({ status: "sent", externalId: "row-1", providerId: "in_app" });
  });
});
