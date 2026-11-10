import { InjectQueue, OnWorkerEvent, Processor, WorkerHost } from "@nestjs/bullmq";
import { Injectable, Logger } from "@nestjs/common";
import { Job, Queue } from "bullmq";
import { NOTIFICATION_DELIVERY_QUEUE } from "./notification-queue.constants";
import { DeliveryJobData } from "./notification-queue.service";
import { isFinalAttempt } from "./job-attempts";
import { NotificationProcessor } from "./notification.processor";

@Processor(NOTIFICATION_DELIVERY_QUEUE)
@Injectable()
export class DeliveryProcessor extends WorkerHost {
  private readonly logger = new Logger(DeliveryProcessor.name);

  constructor(
    private readonly notificationProcessor: NotificationProcessor,
    @InjectQueue(NOTIFICATION_DELIVERY_QUEUE)
    private readonly deliveryQueue: Queue<DeliveryJobData>,
  ) {
    super();
  }

  async process(job: Job<DeliveryJobData>): Promise<void> {
    switch (job.name) {
      case "process-delivery":
        return this.notificationProcessor.processDelivery(job);
      case "handle-failed-delivery":
        return this.notificationProcessor.handleFailedDelivery(job);
      case "retry-delivery":
        return this.notificationProcessor.retryDelivery(
          job as Job<DeliveryJobData & { originalError: string }>,
        );
      default:
        throw new Error(`No handler for job "${job.name}" on ${NOTIFICATION_DELIVERY_QUEUE}`);
    }
  }

  @OnWorkerEvent("failed")
  async onDeliveryFailed(job: Job<DeliveryJobData>): Promise<void> {
    if (job.name !== "process-delivery" || !isFinalAttempt(job)) {
      return;
    }

    try {
      await this.deliveryQueue.add(
        "handle-failed-delivery",
        { ...job.data, retryCount: job.attemptsMade },
        {
          priority: 10,
          attempts: 3,
          backoff: { type: "exponential", delay: 2000 },
        },
      );

      this.logger.error(
        `Delivery ${job.data.deliveryId} exhausted its attempts, queued failure handling`,
      );
    } catch (error) {
      this.logger.error(
        `Delivery ${job.data.deliveryId} failed terminally and could not be queued for handling: ${error.message}`,
      );
    }
  }
}
