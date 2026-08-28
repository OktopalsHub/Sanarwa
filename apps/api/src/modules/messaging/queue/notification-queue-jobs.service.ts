import { InjectQueue } from "@nestjs/bull";
import { Injectable, Logger } from "@nestjs/common";
import { JobOptions, Queue } from "bull";
import { MessagePriority as Priority } from "../message.entity";
import { NOTIFICATION_DELIVERY_QUEUE, NOTIFICATION_QUEUE } from "./notification-queue.constants";
import { getPriorityValue } from "./notification-queue-priority";
import { DeliveryJobData, NotificationJobData } from "./notification-queue.types";

@Injectable()
export class NotificationQueueJobsService {
  private readonly logger = new Logger(NotificationQueueJobsService.name);

  constructor(
    @InjectQueue(NOTIFICATION_QUEUE)
    private readonly notificationQueue: Queue<NotificationJobData>,
    @InjectQueue(NOTIFICATION_DELIVERY_QUEUE)
    private readonly deliveryQueue: Queue<DeliveryJobData>,
  ) {}

  async addNotificationJob(
    notificationId: string,
    tenantId: string,
    priority: Priority = Priority.NORMAL,
    scheduledAt?: Date,
    retryCount: number = 0,
  ): Promise<void> {
    const jobData: NotificationJobData = {
      notificationId,
      tenantId,
      priority,
      scheduledAt,
      retryCount,
    };

    const jobOptions: JobOptions = {
      priority: getPriorityValue(priority),
      delay: scheduledAt ? Math.max(0, scheduledAt.getTime() - Date.now()) : 0,
      attempts: 3,
      backoff: {
        type: "exponential",
        delay: 2000,
      },
    };

    await this.notificationQueue.add("process-notification", jobData, jobOptions);

    this.logger.log(
      `Added notification ${notificationId} to queue with priority ${priority}${
        scheduledAt ? ` scheduled for ${scheduledAt.toISOString()}` : ""
      }`,
    );
  }

  async addDeliveryJob(
    notificationId: string,
    deliveryId: string,
    tenantId: string,
    channel: string,
    providerId: string,
    recipient: string,
    templateData: Record<string, any>,
    priority: Priority = Priority.NORMAL,
    retryCount: number = 0,
  ): Promise<void> {
    const jobData: DeliveryJobData = {
      notificationId,
      deliveryId,
      tenantId,
      channel,
      providerId,
      recipient,
      templateData,
      retryCount,
    };

    const jobOptions: JobOptions = {
      priority: getPriorityValue(priority),
      attempts: 5,
      backoff: {
        type: "exponential",
        delay: 1000,
      },
    };

    await this.deliveryQueue.add("process-delivery", jobData, jobOptions);

    this.logger.log(
      `Added delivery ${deliveryId} for notification ${notificationId} to queue (${channel} via ${providerId})`,
    );
  }

  async addBulkDeliveryJobs(deliveryJobs: Omit<DeliveryJobData, "retryCount">[]): Promise<void> {
    const jobs = deliveryJobs.map((jobData, index) => ({
      name: "process-delivery",
      data: { ...jobData, retryCount: 0 },
      opts: {
        priority: getPriorityValue(Priority.NORMAL),
        attempts: 5,
        backoff: {
          type: "exponential",
          delay: 1000,
        },
        delay: index * 100,
      } as JobOptions,
    }));

    await this.deliveryQueue.addBulk(jobs);

    this.logger.log(`Added ${jobs.length} delivery jobs to queue`);
  }

  async retryNotification(
    notificationId: string,
    tenantId: string,
    priority: Priority = Priority.NORMAL,
    retryCount: number = 0,
  ): Promise<void> {
    await this.addNotificationJob(notificationId, tenantId, priority, undefined, retryCount + 1);
  }

  async retryDelivery(
    notificationId: string,
    deliveryId: string,
    tenantId: string,
    channel: string,
    providerId: string,
    recipient: string,
    templateData: Record<string, any>,
    priority: Priority = Priority.NORMAL,
    retryCount: number = 0,
  ): Promise<void> {
    await this.addDeliveryJob(
      notificationId,
      deliveryId,
      tenantId,
      channel,
      providerId,
      recipient,
      templateData,
      priority,
      retryCount + 1,
    );
  }
}
