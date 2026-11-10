import { Job } from "bullmq";
import { NOTIFICATION_ADMIN_QUEUE } from "./notification-queue.constants";
import { DeadLetterProcessor } from "./dead-letter.processor";
import { DeliveryProcessor } from "./delivery.processor";
import { NotificationProcessor } from "./notification.processor";

// The queue name a producer adds a job to, and the worker that consumes it, are coupled
// only by these routing tables. A name that reached a worker without a handler used to be
// logged and acknowledged, which deleted the job.
const fakeJob = (name: string, data: Record<string, unknown> = {}): Job =>
  ({ name, data, id: "job-1" }) as unknown as Job;

const failedJob = (
  name: string,
  attemptsMade: number,
  attempts: number,
  data: Record<string, unknown> = {},
) => ({ name, data, id: "job-1", attemptsMade, opts: { attempts } }) as unknown as Job;

describe("notification queue routing", () => {
  const buildNotificationProcessor = () => {
    const fakes = {
      notificationQueue: { add: vi.fn() },
      deliveryQueue: { add: vi.fn(), addBulk: vi.fn() },
      adminQueue: { add: vi.fn() },
      consentService: { checkConsent: vi.fn().mockResolvedValue({ allowed: true }) },
      projectQuota: { checkQuota: vi.fn().mockResolvedValue({ allowed: true, quota: null }) },
      deliveryEventService: {
        record: vi.fn().mockResolvedValue({ id: "evt", created: true }),
      },
    };

    const processor = new NotificationProcessor(
      { update: vi.fn(), findOne: vi.fn(), save: vi.fn() } as any,
      { update: vi.fn(), findOne: vi.fn(), save: vi.fn(), find: vi.fn() } as any,
      { render: vi.fn() } as any,
      { deliver: vi.fn() } as any,
      fakes.consentService as any,
      fakes.deliveryEventService as any,
      fakes.projectQuota as any,
      { updateDeliveryOutcome: async () => undefined } as any,
      fakes.notificationQueue as any,
      fakes.deliveryQueue as any,
      fakes.adminQueue as any,
    );

    for (const method of [
      "processNotification",
      "handleFailedNotification",
      "retryNotification",
    ] as const) {
      vi.spyOn(processor, method).mockResolvedValue(undefined);
    }

    return { processor, ...fakes };
  };

  it("routes every job name added to the notification queue", async () => {
    const { processor } = buildNotificationProcessor();

    await processor.process(fakeJob("process-notification"));
    await processor.process(fakeJob("handle-failed-notification"));
    await processor.process(fakeJob("retry-notification"));

    expect(processor.processNotification).toHaveBeenCalled();
    expect(processor.handleFailedNotification).toHaveBeenCalled();
    expect(processor.retryNotification).toHaveBeenCalled();
  });

  it("fails an unroutable job instead of acknowledging it", async () => {
    const { processor } = buildNotificationProcessor();

    await expect(processor.process(fakeJob("process-delivery"))).rejects.toThrow(
      /No handler for job "process-delivery"/,
    );
  });

  it("sends a terminally failed notification to failure handling", async () => {
    const { processor, notificationQueue } = buildNotificationProcessor();

    await processor.onNotificationFailed(
      failedJob("process-notification", 3, 3, { notificationId: "msg-1", tenantId: "tenant-1" }),
    );

    expect(notificationQueue.add).toHaveBeenCalledWith(
      "handle-failed-notification",
      { notificationId: "msg-1", tenantId: "tenant-1", retryCount: 3 },
      expect.objectContaining({ attempts: 3 }),
    );
  });

  it("leaves a retryable attempt to BullMQ", async () => {
    const { processor, notificationQueue } = buildNotificationProcessor();

    await processor.onNotificationFailed(failedJob("process-notification", 1, 3));

    expect(notificationQueue.add).not.toHaveBeenCalled();
  });

  it("does not recurse when failure handling itself fails", async () => {
    const { processor, notificationQueue } = buildNotificationProcessor();

    await processor.onNotificationFailed(failedJob("handle-failed-notification", 3, 3));

    expect(notificationQueue.add).not.toHaveBeenCalled();
  });

  it("runs the delivery queue handlers that the notification processor exposes", async () => {
    const { processor: notificationProcessor } = buildNotificationProcessor();
    for (const method of ["processDelivery", "handleFailedDelivery", "retryDelivery"] as const) {
      vi.spyOn(notificationProcessor, method).mockResolvedValue(undefined);
    }

    const processor = new DeliveryProcessor(notificationProcessor, { add: vi.fn() } as any);

    await processor.process(fakeJob("process-delivery"));
    await processor.process(fakeJob("handle-failed-delivery"));
    await processor.process(fakeJob("retry-delivery"));

    expect(notificationProcessor.processDelivery).toHaveBeenCalled();
    expect(notificationProcessor.handleFailedDelivery).toHaveBeenCalled();
    expect(notificationProcessor.retryDelivery).toHaveBeenCalled();
  });

  it("fails an unroutable job on the delivery queue too", async () => {
    const { processor: notificationProcessor } = buildNotificationProcessor();
    const processor = new DeliveryProcessor(notificationProcessor, { add: vi.fn() } as any);

    await expect(processor.process(fakeJob("process-notification"))).rejects.toThrow(
      /No handler for job "process-notification"/,
    );
  });

  it("sends a terminally failed delivery to failure handling", async () => {
    const { processor: notificationProcessor } = buildNotificationProcessor();
    const deliveryQueue = { add: vi.fn() };
    const processor = new DeliveryProcessor(notificationProcessor, deliveryQueue as any);

    await processor.onDeliveryFailed(
      failedJob("process-delivery", 5, 5, { deliveryId: "delivery-1", notificationId: "msg-1" }),
    );

    expect(deliveryQueue.add).toHaveBeenCalledWith(
      "handle-failed-delivery",
      { deliveryId: "delivery-1", notificationId: "msg-1", retryCount: 5 },
      expect.objectContaining({ attempts: 3 }),
    );
  });

  it("routes the admin queue's own job names", async () => {
    const processor = new DeadLetterProcessor(
      { create: vi.fn() } as any,
      { create: vi.fn(), save: vi.fn() } as any,
      { sendEmail: vi.fn() } as any,
    );
    vi.spyOn(processor, "handleDeadLetter").mockResolvedValue(undefined);
    vi.spyOn(processor, "processAlert").mockResolvedValue(undefined);

    await processor.process(fakeJob("handle-dead-letter"));
    await processor.process(fakeJob("process-alert"));

    expect(processor.handleDeadLetter).toHaveBeenCalled();
    expect(processor.processAlert).toHaveBeenCalled();
    await expect(processor.process(fakeJob("process-notification"))).rejects.toThrow(
      new Error(`No handler for job "process-notification" on ${NOTIFICATION_ADMIN_QUEUE}`),
    );
  });
});
