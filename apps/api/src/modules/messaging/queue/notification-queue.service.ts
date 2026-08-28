import { InjectQueue } from "@nestjs/bull";
import { Injectable, Logger } from "@nestjs/common";
import { Queue } from "bull";
import { MessagePriority as Priority } from "../message.entity";
import { NOTIFICATION_DELIVERY_QUEUE, NOTIFICATION_QUEUE } from "./notification-queue.constants";
import { NotificationQueueDeadLetterService } from "./notification-queue-dead-letter.service";
import { NotificationQueueJobsService } from "./notification-queue-jobs.service";
import {
  AlertJobData,
  DeadLetterJobData,
  DeliveryJobData,
  NotificationJobData,
} from "./notification-queue.types";

export type {
  AlertJobData,
  DeadLetterJobData,
  DeliveryJobData,
  NotificationJobData,
} from "./notification-queue.types";

@Injectable()
export class NotificationQueueService {
  private readonly logger = new Logger(NotificationQueueService.name);

  constructor(
    private readonly jobs: NotificationQueueJobsService,
    private readonly deadLetter: NotificationQueueDeadLetterService,
    @InjectQueue(NOTIFICATION_QUEUE)
    private readonly notificationQueue: Queue<
      NotificationJobData | DeadLetterJobData | AlertJobData
    >,
    @InjectQueue(NOTIFICATION_DELIVERY_QUEUE)
    private readonly deliveryQueue: Queue<DeliveryJobData>,
  ) {}

  addNotificationJob(
    notificationId: string,
    tenantId: string,
    priority?: Priority,
    scheduledAt?: Date,
    retryCount?: number,
  ): Promise<void> {
    return this.jobs.addNotificationJob(notificationId, tenantId, priority, scheduledAt, retryCount);
  }

  addDeliveryJob(
    notificationId: string,
    deliveryId: string,
    tenantId: string,
    channel: string,
    providerId: string,
    recipient: string,
    templateData: Record<string, any>,
    priority?: Priority,
    retryCount?: number,
  ): Promise<void> {
    return this.jobs.addDeliveryJob(
      notificationId,
      deliveryId,
      tenantId,
      channel,
      providerId,
      recipient,
      templateData,
      priority,
      retryCount,
    );
  }

  addBulkDeliveryJobs(
    deliveryJobs: Omit<DeliveryJobData, "retryCount">[],
  ): Promise<void> {
    return this.jobs.addBulkDeliveryJobs(deliveryJobs);
  }

  retryNotification(
    notificationId: string,
    tenantId: string,
    priority?: Priority,
    retryCount?: number,
  ): Promise<void> {
    return this.jobs.retryNotification(notificationId, tenantId, priority, retryCount);
  }

  retryDelivery(
    notificationId: string,
    deliveryId: string,
    tenantId: string,
    channel: string,
    providerId: string,
    recipient: string,
    templateData: Record<string, any>,
    priority?: Priority,
    retryCount?: number,
  ): Promise<void> {
    return this.jobs.retryDelivery(
      notificationId,
      deliveryId,
      tenantId,
      channel,
      providerId,
      recipient,
      templateData,
      priority,
      retryCount,
    );
  }

  async getQueueStats(): Promise<{
    notification: {
      waiting: number;
      active: number;
      completed: number;
      failed: number;
      delayed: number;
    };
    delivery: {
      waiting: number;
      active: number;
      completed: number;
      failed: number;
      delayed: number;
    };
  }> {
    const [notificationCounts, deliveryCounts] = await Promise.all([
      this.notificationQueue.getJobCounts(),
      this.deliveryQueue.getJobCounts(),
    ]);

    return {
      notification: notificationCounts,
      delivery: deliveryCounts,
    };
  }

  async pauseQueues(): Promise<void> {
    await Promise.all([this.notificationQueue.pause(), this.deliveryQueue.pause()]);
    this.logger.log("Queues paused");
  }

  async resumeQueues(): Promise<void> {
    await Promise.all([this.notificationQueue.resume(), this.deliveryQueue.resume()]);
    this.logger.log("Queues resumed");
  }

  async cleanQueues(): Promise<void> {
    const cleanOptions = {
      grace: 1000,
      limit: 100,
    };

    await Promise.all([
      this.notificationQueue.clean(24 * 60 * 60 * 1000, "completed", cleanOptions.limit),
      this.notificationQueue.clean(7 * 24 * 60 * 60 * 1000, "failed", cleanOptions.limit),
      this.deliveryQueue.clean(24 * 60 * 60 * 1000, "completed", cleanOptions.limit),
      this.deliveryQueue.clean(7 * 24 * 60 * 60 * 1000, "failed", cleanOptions.limit),
    ]);

    this.logger.log("Queues cleaned");
  }

  async getFailedJobs(limit: number = 50): Promise<{
    notifications: any[];
    deliveries: any[];
  }> {
    const [failedNotifications, failedDeliveries] = await Promise.all([
      this.notificationQueue.getFailed(0, limit - 1),
      this.deliveryQueue.getFailed(0, limit - 1),
    ]);

    return {
      notifications: failedNotifications.map((job) => ({
        id: job.id,
        data: job.data,
        failedReason: job.failedReason,
        processedOn: job.processedOn,
        finishedOn: job.finishedOn,
        attemptsMade: job.attemptsMade,
      })),
      deliveries: failedDeliveries.map((job) => ({
        id: job.id,
        data: job.data,
        failedReason: job.failedReason,
        processedOn: job.processedOn,
        finishedOn: job.finishedOn,
        attemptsMade: job.attemptsMade,
      })),
    };
  }

  addToDeadLetterQueue(
    data: Parameters<NotificationQueueDeadLetterService["addToDeadLetterQueue"]>[0],
  ): Promise<void> {
    return this.deadLetter.addToDeadLetterQueue(data);
  }

  addAlertJob(
    alert: Parameters<NotificationQueueDeadLetterService["addAlertJob"]>[0],
  ): Promise<void> {
    return this.deadLetter.addAlertJob(alert);
  }

  getDeadLetterItems(limit?: number): Promise<any[]> {
    return this.deadLetter.getDeadLetterItems(limit);
  }

  reprocessDeadLetterItem(deadLetterJobId: string): Promise<void> {
    return this.deadLetter.reprocessDeadLetterItem(deadLetterJobId);
  }
}
