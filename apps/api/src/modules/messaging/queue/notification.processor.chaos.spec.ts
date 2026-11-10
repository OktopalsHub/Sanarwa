import { Job } from "bullmq";
import { describe, expect, it, vi } from "vitest";
import { NotificationChannel } from "../../../common/enums/notification-channel.enum";
import { MessageStatus } from "../message.entity";
import { DeliveryJobData } from "./notification-queue.service";
import { MessageDeliveryStatus } from "../message-delivery.entity";
import { NotificationProcessor } from "./notification.processor";

const TENANT = "tenant-1";
const MESSAGE_ID = "message-1";

const MESSAGE = {
  id: MESSAGE_ID,
  tenantId: TENANT,
  channels: [NotificationChannel.PUSH, NotificationChannel.EMAIL],
  recipients: [{ id: "user-1", deviceToken: "token-1", email: "u@example.com" }],
  data: {},

  data: "hello",
  subject: "subject",
  templateId: undefined,
  priority: "normal",
  metadata: {},
};

function delivery(
  id: string,
  channel: NotificationChannel,
  recipient: string,
  status: MessageDeliveryStatus = MessageDeliveryStatus.PENDING,
  metadata: Record<string, unknown> = {},
) {
  return {
    id,
    messageId: MESSAGE_ID,
    tenantId: TENANT,
    channel,
    providerId: "pending",
    recipient,
    status,
    metadata: { subscriberId: "user-1", ...metadata },
    retryCount: 0,
  };
}

function job(
  deliveryId: string,
  channel: NotificationChannel,
  recipient: string,
  attemptsMade = 1,
): Job<DeliveryJobData> {
  return {
    id: `job-${deliveryId}`,
    name: "process-delivery",
    attemptsMade,
    opts: { attempts: 5 },
    data: {
      notificationId: MESSAGE_ID,
      deliveryId,
      tenantId: TENANT,
      channel,
      providerId: "auto-select",
      recipient,
      templateData: { subject: "subject", data: "hello", data: {} },
      retryCount: 0,
    },
  } as unknown as Job<DeliveryJobData>;
}

function build(options: {
  deliveries: Record<string, ReturnType<typeof delivery>>;
  aggregate: Array<unknown[]>;
  deliverOutcome?: (deliveryChannel: NotificationChannel) => Record<string, unknown>;
  consentVerdict?: Record<string, unknown>;
}) {
  const deliveryRepository = {
    findOne: vi.fn(async ({ where }: { where: { id: string } }) => options.deliveries[where.id]),
    find: vi
      .fn()
      .mockResolvedValueOnce(options.aggregate[0] ?? [])
      .mockResolvedValueOnce(options.aggregate[1] ?? [])
      .mockResolvedValue(options.aggregate[options.aggregate.length - 1] ?? []),
    update: vi.fn().mockResolvedValue(undefined),
    create: vi.fn((value) => value),
    save: vi.fn((value) =>
      Promise.resolve(
        Array.isArray(value)
          ? value.map((v, i) => ({ ...v, id: `new-${i}` }))
          : { ...value, id: `saved-${value.id ?? "unknown"}` },
      ),
    ),
  };
  const messageRepository = {
    findOne: vi.fn().mockResolvedValue(MESSAGE),
    update: vi.fn().mockResolvedValue(undefined),
  };
  const templateService = { render: vi.fn() };
  const deliveryExecutor = {
    deliver: vi.fn(async (input: { channel: NotificationChannel }) =>
      options.deliverOutcome
        ? options.deliverOutcome(input.channel)
        : { status: "sent", providerId: "mock", externalId: "ext-1" },
    ),
  };
  const consentService = {
    checkConsent: vi.fn().mockResolvedValue(options.consentVerdict ?? { allowed: true }),
  };
  const deliveryEventService = { record: vi.fn().mockResolvedValue(undefined) };
  const projectQuota = { checkQuota: vi.fn().mockResolvedValue({ allowed: true, quota: null }) };
  const deliveryQueue = { add: vi.fn().mockResolvedValue(undefined), addBulk: vi.fn() };

  const service = new NotificationProcessor(
    messageRepository as never,
    deliveryRepository as never,
    templateService as never,
    deliveryExecutor as never,
    consentService as never,
    deliveryEventService as never,
    projectQuota as never,
    { updateDeliveryOutcome: vi.fn().mockResolvedValue(undefined) } as never,
    { add: vi.fn() } as never,
    deliveryQueue as never,
    { add: vi.fn() } as never,
  );

  return {
    service,
    deliveryRepository,
    messageRepository,
    deliveryQueue,
    deliveryExecutor,
    consentService,
  };
}

describe("NotificationProcessor chaos cases", () => {
  it("acknowledges a delivery that is already DELIVERED without re-sending (at-least-once re-run)", async () => {
    const { service, deliveryExecutor, deliveryRepository } = build({
      deliveries: {
        "delivery-a": delivery(
          "delivery-a",
          NotificationChannel.EMAIL,
          "u@example.com",
          MessageDeliveryStatus.DELIVERED,
        ),
      },
      aggregate: [[]],
    });

    await service.processDelivery(job("delivery-a", NotificationChannel.EMAIL, "u@example.com"));

    expect(deliveryExecutor.deliver).not.toHaveBeenCalled();
    expect(deliveryRepository.update).not.toHaveBeenCalled();
  });

  it("folds one failed and one delivered delivery into SENT, not FAILED", async () => {
    const failed = delivery("delivery-a", NotificationChannel.PUSH, "token-1");
    const delivered = delivery("delivery-b", NotificationChannel.EMAIL, "u@example.com");

    const { service, messageRepository } = build({
      deliveries: { "delivery-a": failed, "delivery-b": delivered },
      aggregate: [
        [{ ...failed, status: MessageDeliveryStatus.FAILED }],
        [
          { ...failed, status: MessageDeliveryStatus.FAILED },
          { ...delivered, status: MessageDeliveryStatus.DELIVERED },
        ],
      ],
      deliverOutcome: (channel) =>
        channel === NotificationChannel.PUSH
          ? { status: "failed", error: "provider 500", retryable: true }
          : { status: "sent", providerId: "zeptomail", externalId: "ext-9" },
    });

    await expect(
      service.processDelivery(job("delivery-a", NotificationChannel.PUSH, "token-1")),
    ).rejects.toThrow("provider 500");
    await service.processDelivery(job("delivery-b", NotificationChannel.EMAIL, "u@example.com"));

    const statuses = vi
      .mocked(messageRepository.update)
      .mock.calls.map(([, patch]) => (patch as { status?: string }).status);
    expect(statuses).toContain(MessageStatus.FAILED);
    expect(statuses).toContain(MessageStatus.SENT);
    expect(statuses[statuses.length - 1]).toBe(MessageStatus.SENT);
  });

  it("marks the delivery FAILED and propagates when the provider succeeds but the record write crashes", async () => {
    const target = delivery("delivery-a", NotificationChannel.EMAIL, "u@example.com");
    const { service, deliveryRepository } = build({
      deliveries: { "delivery-a": target },
      aggregate: [[{ ...target, status: MessageDeliveryStatus.FAILED }]],
    });
    vi.mocked(deliveryRepository.save).mockRejectedValueOnce(new Error("connection reset"));

    await expect(
      service.processDelivery(job("delivery-a", NotificationChannel.EMAIL, "u@example.com")),
    ).rejects.toThrow("connection reset");

    expect(deliveryRepository.update).toHaveBeenCalledWith(
      "delivery-a",
      expect.objectContaining({ status: MessageDeliveryStatus.FAILED }),
    );
  });

  it("defers a quiet-hours delivery without consuming a retry attempt or calling the provider", async () => {
    const { service, deliveryExecutor, deliveryQueue } = build({
      deliveries: {
        "delivery-a": delivery("delivery-a", NotificationChannel.EMAIL, "u@example.com"),
      },
      aggregate: [[]],
      consentVerdict: {
        allowed: false,
        reason: "quiet_hours",
        deferred: true,
        delayMs: 3_600_000,
        resumeAt: new Date(),
      },
    });

    await service.processDelivery(job("delivery-a", NotificationChannel.EMAIL, "u@example.com"));

    expect(deliveryExecutor.deliver).not.toHaveBeenCalled();
    expect(deliveryQueue.add).toHaveBeenCalledWith(
      "process-delivery",
      expect.objectContaining({ deliveryId: "delivery-a" }),
      expect.objectContaining({ delay: 3_600_000 }),
    );
  });

  it("skips a suppressed delivery without calling the provider or falling back", async () => {
    const { service, deliveryExecutor, deliveryQueue, deliveryRepository } = build({
      deliveries: {
        "delivery-a": delivery("delivery-a", NotificationChannel.EMAIL, "u@example.com"),
      },
      aggregate: [[]],
      consentVerdict: { allowed: false, reason: "suppressed" },
    });

    await service.processDelivery(job("delivery-a", NotificationChannel.EMAIL, "u@example.com"));

    expect(deliveryExecutor.deliver).not.toHaveBeenCalled();
    expect(deliveryQueue.add).not.toHaveBeenCalled();
    expect(deliveryRepository.update).toHaveBeenCalledWith(
      "delivery-a",
      expect.objectContaining({ status: MessageDeliveryStatus.SKIPPED }),
    );
  });
});
