import { describe, expect, it, vi } from "vitest";
import { NotificationChannel } from "../../common/enums/notification-channel.enum";
import { UnifiedSendService } from "./unified-send.service";

function build() {
  const messageRepository = {
    create: vi.fn((value) => value),
    save: vi.fn(async (value) => ({ ...value, id: "message-1" })),
  };
  const logRepository = {
    create: vi.fn((value) => value),
    save: vi.fn(async (value) => value),
  };
  const deliveryRepository = {
    create: vi.fn((value) => value),
    save: vi.fn(async (value) =>
      value.map((entry, index) => ({ ...entry, id: `delivery-${index}` })),
    ),
  };
  const queueService = { addNotificationJob: vi.fn() };
  const storageService = {
    getStoragePolicy: vi.fn().mockResolvedValue("full"),
    shouldPersistBody: vi.fn().mockReturnValue(true),
    shouldPersistMetadata: vi.fn().mockReturnValue(true),
  };
  const idempotency = {
    claim: vi.fn().mockResolvedValue({ kind: "claimed" as const }),
    complete: vi.fn().mockResolvedValue(undefined),
    abandon: vi.fn().mockResolvedValue(undefined),
  };

  return {
    service: new UnifiedSendService(
      messageRepository as never,
      deliveryRepository as never,
      queueService as never,
      storageService as never,
      logRepository as never,
      idempotency as never,
    ),
    messageRepository,
    deliveryRepository,
    queueService,
    idempotency,
    logRepository,
  };
}

describe("UnifiedSendService chat recipients", () => {
  it("resolves a Telegram chat id and carries the provider into the job", async () => {
    const { service, deliveryRepository, queueService } = build();

    await service.send(
      {
        channel: NotificationChannel.CHAT,
        recipients: [{ id: "recipient-1", telegramChatId: "-100123" }],
        data: {},
        chatProvider: "telegram",
      },
      "tenant-1",
    );

    const [deliveries] = deliveryRepository.save.mock.calls[0];
    expect(deliveries).toEqual([
      expect.objectContaining({
        channel: NotificationChannel.CHAT,
        recipient: "-100123",
        metadata: expect.objectContaining({ chatProvider: "telegram" }),
      }),
    ]);

    expect(queueService.addNotificationJob).toHaveBeenCalledWith(
      "message-1",
      "tenant-1",
      expect.any(String),
      undefined,
      0,
      expect.objectContaining({ chatProvider: "telegram" }),
    );
  });

  it("defaults chat destinations to Slack fields", async () => {
    const { service, deliveryRepository } = build();

    await service.send(
      {
        channel: NotificationChannel.CHAT,
        recipients: [
          { id: "recipient-1", slackWebhookUrl: "https://hooks.slack.com/services/T/B/X" },
        ],
        data: {},
      },
      "tenant-1",
    );

    const [deliveries] = deliveryRepository.save.mock.calls[0];
    expect(deliveries[0].recipient).toBe("https://hooks.slack.com/services/T/B/X");
  });

  it("fails when a recipient has no address for the channel", async () => {
    const { service, deliveryRepository } = build();

    const result = await service.send(
      {
        channel: NotificationChannel.CHAT,
        recipients: [{ id: "recipient-1" }],
        data: {},
        chatProvider: "discord",
      },
      "tenant-1",
    );

    expect(result.status).toBe("failed");
    expect(deliveryRepository.save).not.toHaveBeenCalled();
  });
});

describe("UnifiedSendService fallback", () => {
  it("attempts the first reachable channel and parks the rest on the delivery's fallbackChain", async () => {
    const { service, deliveryRepository, messageRepository } = build();

    const result = await service.send(
      {
        channels: [NotificationChannel.PUSH, NotificationChannel.EMAIL],
        recipients: [{ id: "user-1", deviceToken: "token-1", email: "u@example.com" }],
        data: {},
        fallback: true,
      },
      "tenant-1",
    );

    const [deliveries] = deliveryRepository.save.mock.calls[0];
    expect(deliveries).toEqual([
      expect.objectContaining({
        channel: NotificationChannel.PUSH,
        recipient: "token-1",
        metadata: expect.objectContaining({
          fallbackChain: [NotificationChannel.EMAIL],
        }),
      }),
    ]);
    expect(result).toEqual({
      messageId: "message-1",
      trackingId: expect.any(String),
      status: "queued",
      deliveries: [{ channel: NotificationChannel.PUSH, status: "queued" }],
    });
    expect(messageRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({
        channels: [NotificationChannel.PUSH, NotificationChannel.EMAIL],
      }),
    );
  });

  it("appends an explicit fallback array after the requested channels", async () => {
    const { service, deliveryRepository } = build();

    await service.send(
      {
        channels: [NotificationChannel.PUSH],
        recipients: [
          { id: "user-1", deviceToken: "token-1", email: "u@example.com", phone: "+15551234567" },
        ],
        data: {},
        fallback: [NotificationChannel.EMAIL, NotificationChannel.SMS],
      },
      "tenant-1",
    );

    const [deliveries] = deliveryRepository.save.mock.calls[0];
    expect(deliveries[0]).toEqual(
      expect.objectContaining({
        channel: NotificationChannel.PUSH,
        metadata: expect.objectContaining({
          fallbackChain: [NotificationChannel.EMAIL, NotificationChannel.SMS],
        }),
      }),
    );
  });

  it("starts at the first channel with an address when a requested channel is unreachable", async () => {
    const { service, deliveryRepository } = build();

    await service.send(
      {
        channels: [NotificationChannel.EMAIL, NotificationChannel.SMS],
        recipients: [{ id: "user-1", phone: "+15551234567" }],
        data: {},
        fallback: true,
      },
      "tenant-1",
    );

    const [deliveries] = deliveryRepository.save.mock.calls[0];
    expect(deliveries[0].channel).toBe(NotificationChannel.SMS);
    expect(deliveries[0].metadata.fallbackChain).toBeUndefined();
  });

  it("fails the send when no channel in the chain can be addressed", async () => {
    const { service, deliveryRepository } = build();

    const result = await service.send(
      {
        channel: NotificationChannel.EMAIL,
        recipients: [{ id: "user-1" }],
        data: {},
        fallback: [NotificationChannel.SMS],
      },
      "tenant-1",
    );

    expect(result.status).toBe("failed");
    expect(result.deliveries).toEqual([
      expect.objectContaining({ channel: NotificationChannel.EMAIL, status: "failed" }),
    ]);
    expect(deliveryRepository.save).not.toHaveBeenCalled();
  });

  it("fans out in parallel when fallback is not set", async () => {
    const { service, deliveryRepository } = build();

    await service.send(
      {
        channels: [NotificationChannel.PUSH, NotificationChannel.EMAIL],
        recipients: [{ id: "user-1", deviceToken: "token-1", email: "u@example.com" }],
        data: {},
      },
      "tenant-1",
    );

    const [deliveries] = deliveryRepository.save.mock.calls[0];
    expect(deliveries).toHaveLength(2);
    expect(deliveries.map((entry: { channel: string }) => entry.channel).sort()).toEqual(
      [NotificationChannel.EMAIL, NotificationChannel.PUSH].sort(),
    );
  });
});

describe("UnifiedSendService idempotency", () => {
  const duplicateResponse = {
    messageId: "message-1",
    status: "queued" as const,
    deliveries: [{ channel: NotificationChannel.EMAIL, status: "queued" as const }],
  };

  it("returns the stored response for a duplicate key without writing a second message", async () => {
    const { service, messageRepository, deliveryRepository, idempotency } = build();
    vi.mocked(idempotency.claim).mockResolvedValue({
      kind: "done",
      row: { response: duplicateResponse },
    } as never);

    const result = await service.send(
      {
        channel: NotificationChannel.EMAIL,
        recipients: [{ id: "user-1", email: "u@example.com" }],
        data: {},
      },
      "tenant-1",
      undefined,
      "order-123-shipped",
    );

    expect(result).toEqual(duplicateResponse);
    expect(messageRepository.save).not.toHaveBeenCalled();
    expect(deliveryRepository.save).not.toHaveBeenCalled();
  });

  it("rejects when the same key is already being processed", async () => {
    const { service, messageRepository, idempotency } = build();
    vi.mocked(idempotency.claim).mockResolvedValue({ kind: "inflight" } as never);

    await expect(
      service.send(
        {
          channel: NotificationChannel.EMAIL,
          recipients: [{ id: "user-1", email: "u@example.com" }],
          data: {},
        },
        "tenant-1",
        undefined,
        "order-123-shipped",
      ),
    ).rejects.toThrow();
    expect(messageRepository.save).not.toHaveBeenCalled();
  });

  it("stores the response against the key after a successful send", async () => {
    const { service, idempotency } = build();

    await service.send(
      {
        channel: NotificationChannel.EMAIL,
        recipients: [{ id: "user-1", email: "u@example.com" }],
        data: {},
      },
      "tenant-1",
      undefined,
      "order-123-shipped",
    );

    expect(idempotency.complete).toHaveBeenCalledWith(
      "tenant-1",
      "order-123-shipped",
      "message-1",
      expect.objectContaining({ messageId: "message-1" }),
    );
  });
});
