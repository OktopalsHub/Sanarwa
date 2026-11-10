import { Job } from "bullmq";
import { describe, expect, it, vi } from "vitest";
import { NotificationChannel } from "../../../common/enums/notification-channel.enum";
import { DeliveryJobData } from "./notification-queue.service";
import { MessageDeliveryStatus } from "../message-delivery.entity";
import { NotificationProcessor } from "./notification.processor";

const TENANT = "tenant-1";
const MESSAGE_ID = "message-1";
const DELIVERY_ID = "delivery-1";

const MESSAGE = {
  id: MESSAGE_ID,
  tenantId: TENANT,
  channels: [NotificationChannel.PUSH, NotificationChannel.EMAIL],
  recipients: [
    { id: "user-1", deviceToken: "token-1", email: "u@example.com", phone: "+15551234567" },
  ],
  data: {},

  data: "hello",
  subject: "subject",
  templateId: undefined,
  priority: "normal",
  metadata: {},
};

function buildDelivery(metadata: Record<string, unknown> = { subscriberId: "user-1" }) {
  return {
    id: DELIVERY_ID,
    messageId: MESSAGE_ID,
    tenantId: TENANT,
    channel: NotificationChannel.PUSH,
    providerId: "pending",
    recipient: "token-1",
    status: MessageDeliveryStatus.PENDING,
    metadata: { subscriberId: "user-1", ...metadata },
    retryCount: 0,
  };
}

function build(outcome: { status: string; error?: string; retryable?: boolean }) {
  const delivery = buildDelivery({ subscriberId: "user-1", fallbackChain: ["email", "sms"] });

  const messageRepository = {
    findOne: vi.fn().mockResolvedValue(MESSAGE),
    find: vi.fn().mockResolvedValue([]),
    update: vi.fn().mockResolvedValue(undefined),
    save: vi.fn((value) => Promise.resolve(value)),
  };
  const deliveryRepository = {
    findOne: vi.fn().mockResolvedValue(delivery),
    find: vi.fn().mockResolvedValue([{ ...delivery, status: MessageDeliveryStatus.FAILED }]),
    update: vi.fn().mockResolvedValue(undefined),
    create: vi.fn((value) => value),
    save: vi.fn((value) =>
      Promise.resolve(
        Array.isArray(value)
          ? value.map((v, i) => ({ ...v, id: `new-${i}` }))
          : { ...value, id: "new-0" },
      ),
    ),
  };
  const templateService = { render: vi.fn() };
  const deliveryExecutor = { deliver: vi.fn().mockResolvedValue(outcome) };
  const consentService = { checkConsent: vi.fn().mockResolvedValue({ allowed: true }) };
  const deliveryEventService = { record: vi.fn().mockResolvedValue(undefined) };
  const projectQuota = { checkQuota: vi.fn().mockResolvedValue({ allowed: true, quota: null }) };
  const notificationQueue = { add: vi.fn() };
  const deliveryQueue = { add: vi.fn().mockResolvedValue(undefined), addBulk: vi.fn() };
  const adminQueue = { add: vi.fn() };

  const service = new NotificationProcessor(
    messageRepository as never,
    deliveryRepository as never,
    templateService as never,
    deliveryExecutor as never,
    consentService as never,
    deliveryEventService as never,
    projectQuota as never,
    { updateDeliveryOutcome: vi.fn().mockResolvedValue(undefined) } as never,
    notificationQueue as never,
    deliveryQueue as never,
    adminQueue as never,
  );

  return { service, deliveryRepository, deliveryQueue, deliveryExecutor, messageRepository };
}

function job(attemptsMade: number, attempts = 5): Job<DeliveryJobData> {
  return {
    id: "job-1",
    name: "process-delivery",
    attemptsMade,
    opts: { attempts },
    data: {
      notificationId: MESSAGE_ID,
      deliveryId: DELIVERY_ID,
      tenantId: TENANT,
      channel: NotificationChannel.PUSH,
      providerId: "fcm",
      recipient: "token-1",
      templateData: { subject: "subject", data: "hello", data: {} },
      retryCount: 0,
    },
  } as unknown as Job<DeliveryJobData>;
}

describe("NotificationProcessor channel fallback", () => {
  it("rolls over immediately to the next channel when the failure is permanent", async () => {
    const { service, deliveryRepository, deliveryQueue, deliveryExecutor } = build({
      status: "failed",
      error: "invalid token",
      retryable: false,
    });

    await expect(service.processDelivery(job(1))).rejects.toThrow("invalid token");

    expect(deliveryExecutor.deliver).toHaveBeenCalledOnce();
    expect(deliveryRepository.update).toHaveBeenCalledWith(
      DELIVERY_ID,
      expect.objectContaining({ status: MessageDeliveryStatus.FAILED }),
    );

    const savedFallback = vi.mocked(deliveryRepository.save).mock.calls[0][0] as Record<
      string,
      unknown
    >;
    expect(savedFallback).toEqual(
      expect.objectContaining({
        channel: NotificationChannel.EMAIL,
        recipient: "u@example.com",
        status: MessageDeliveryStatus.PENDING,
        metadata: expect.objectContaining({ fallbackChain: ["sms"] }),
      }),
    );
    expect(deliveryQueue.add).toHaveBeenCalledWith(
      "process-delivery",
      expect.objectContaining({ channel: NotificationChannel.EMAIL, recipient: "u@example.com" }),
      expect.objectContaining({ attempts: 5 }),
    );
  });

  it("rolls over only once retries are exhausted for retryable failures", async () => {
    const { service, deliveryRepository, deliveryQueue } = build({
      status: "failed",
      error: "provider 500",
    });

    await expect(service.processDelivery(job(5, 5))).rejects.toThrow("provider 500");

    expect(deliveryRepository.save).toHaveBeenCalled();
    expect(deliveryQueue.add).toHaveBeenCalledWith(
      "process-delivery",
      expect.objectContaining({ channel: NotificationChannel.EMAIL }),
      expect.any(Object),
    );
  });

  it("keeps the delivery retryable without rolling over before the final attempt", async () => {
    const { service, deliveryRepository, deliveryQueue } = build({
      status: "failed",
      error: "provider 500",
    });

    await expect(service.processDelivery(job(1, 5))).rejects.toThrow("provider 500");

    expect(deliveryRepository.save).not.toHaveBeenCalled();
    expect(deliveryQueue.add).not.toHaveBeenCalled();
  });

  it("does not fall back when the delivery carries no fallback chain", async () => {
    const { service, deliveryRepository, deliveryQueue } = build({
      status: "failed",
      error: "invalid token",
      retryable: false,
    });
    vi.mocked(deliveryRepository.findOne).mockResolvedValue(
      buildDelivery({ subscriberId: "user-1" }),
    );

    await expect(service.processDelivery(job(1))).rejects.toThrow("invalid token");

    expect(deliveryRepository.save).not.toHaveBeenCalled();
    expect(deliveryQueue.add).not.toHaveBeenCalled();
  });

  it("does not fall back when the recipient cannot be reached on any chain channel", async () => {
    const { service, deliveryRepository, deliveryQueue, messageRepository } = build({
      status: "failed",
      error: "invalid token",
      retryable: false,
    });
    vi.mocked(deliveryRepository.findOne).mockResolvedValue(
      buildDelivery({ subscriberId: "user-1", fallbackChain: ["email"] }),
    );
    vi.mocked(messageRepository.findOne).mockResolvedValue({
      ...MESSAGE,
      recipients: [{ id: "user-1", deviceToken: "token-1" }],
    } as never);

    await expect(service.processDelivery(job(1))).rejects.toThrow("invalid token");

    expect(deliveryRepository.save).not.toHaveBeenCalled();
    expect(deliveryQueue.add).not.toHaveBeenCalled();
  });

  it("skips a chain channel the recipient cannot be reached on and rolls over to the next", async () => {
    const { service, deliveryRepository, deliveryQueue, messageRepository } = build({
      status: "failed",
      error: "invalid token",
      retryable: false,
    });
    vi.mocked(deliveryRepository.findOne).mockResolvedValue(
      buildDelivery({ subscriberId: "user-1", fallbackChain: ["email", "sms"] }),
    );
    vi.mocked(messageRepository.findOne).mockResolvedValue({
      ...MESSAGE,
      recipients: [{ id: "user-1", deviceToken: "token-1", phone: "+15551234567" }],
    } as never);

    await expect(service.processDelivery(job(1))).rejects.toThrow("invalid token");

    const savedFallback = vi.mocked(deliveryRepository.save).mock.calls[0][0] as Record<
      string,
      unknown
    >;
    expect(savedFallback).toEqual(
      expect.objectContaining({
        channel: NotificationChannel.SMS,
        recipient: "+15551234567",
        status: MessageDeliveryStatus.PENDING,
      }),
    );
    expect((savedFallback.metadata as Record<string, unknown>).fallbackChain).toBeUndefined();
    expect(deliveryQueue.add).toHaveBeenCalledWith(
      "process-delivery",
      expect.objectContaining({ channel: NotificationChannel.SMS }),
      expect.any(Object),
    );
  });
});
