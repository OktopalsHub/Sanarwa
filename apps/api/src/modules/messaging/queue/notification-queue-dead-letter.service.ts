import { InjectQueue } from "@nestjs/bull";
import { Injectable, Logger } from "@nestjs/common";
import { Queue } from "bull";
import { MessagePriority as Priority } from "../message.entity";
import { NOTIFICATION_QUEUE } from "./notification-queue.constants";
import { NotificationQueueJobsService } from "./notification-queue-jobs.service";
import { getAlertPriority } from "./notification-queue-priority";
import {
  AlertJobData,
  DeadLetterJobData,
  NotificationJobData,
} from "./notification-queue.types";

@Injectable()
export class NotificationQueueDeadLetterService {
  private readonly logger = new Logger(NotificationQueueDeadLetterService.name);

  constructor(
    private readonly jobs: NotificationQueueJobsService,
    @InjectQueue(NOTIFICATION_QUEUE)
    private readonly notificationQueue: Queue<
      NotificationJobData | DeadLetterJobData | AlertJobData
    >,
  ) {}

  async addToDeadLetterQueue(data: {
    type: "notification" | "delivery";
    id: string;
    tenantId: string;
    originalJobData: any;
    failureReason: string;
    failedAt: Date;
    retryCount: number;
    queueName: string;
    priority: number;
    messageData?: any;
    deliveryData?: any;
  }): Promise<void> {
    const jobData: DeadLetterJobData = {
      type: "dead_letter",
      originalType: data.type,
      originalId: data.id,
      tenantId: data.tenantId,
      failureReason: data.failureReason,
      failedAt: data.failedAt,
      retryCount: data.retryCount,
      originalJobData: data.originalJobData,
      messageData: data.messageData,
      deliveryData: data.deliveryData,
    };

    await this.notificationQueue.add("handle-dead-letter", jobData, {
      priority: data.priority,
      attempts: 1,
      removeOnComplete: false,
      removeOnFail: false,
    });

    this.logger.log(`Added ${data.type} ${data.id} to dead letter queue`);
  }

  async addAlertJob(alert: {
    type: string;
    severity: "low" | "medium" | "high" | "critical";
    title: string;
    message: string;
    tenantId: string;
    metadata?: any;
    recipients: string[];
  }): Promise<void> {
    const jobData: AlertJobData = {
      type: "system_alert",
      alert,
      createdAt: new Date(),
    };

    await this.notificationQueue.add("process-alert", jobData, {
      priority: getAlertPriority(alert.severity),
      attempts: 3,
      backoff: {
        type: "exponential",
        delay: 5000,
      },
      removeOnComplete: 10,
      removeOnFail: 10,
    });

    this.logger.log(`Added ${alert.severity} alert: ${alert.title}`);
  }

  async getDeadLetterItems(limit: number = 50): Promise<any[]> {
    const jobs = await this.notificationQueue.getJobs(["completed", "failed"], 0, limit - 1);

    return jobs
      .filter((job) => (job.data as any).type === "dead_letter")
      .map((job) => {
        const data = job.data as DeadLetterJobData;
        return {
          id: job.id,
          originalType: data.originalType,
          originalId: data.originalId,
          tenantId: data.tenantId,
          failureReason: data.failureReason,
          failedAt: data.failedAt,
          retryCount: data.retryCount,
          originalJobData: data.originalJobData,
          messageData: data.messageData,
          deliveryData: data.deliveryData,
          processedOn: job.processedOn,
          finishedOn: job.finishedOn,
        };
      });
  }

  async reprocessDeadLetterItem(deadLetterJobId: string): Promise<void> {
    const job = await this.notificationQueue.getJob(deadLetterJobId);

    if (!job || (job.data as any).type !== "dead_letter") {
      throw new Error("Dead letter job not found");
    }

    const data = job.data as DeadLetterJobData;
    const { originalType, originalJobData } = data;

    if (originalType === "notification") {
      await this.jobs.addNotificationJob(
        originalJobData.notificationId,
        originalJobData.tenantId,
        originalJobData.priority,
        originalJobData.scheduledAt,
        originalJobData.retryCount || 0,
      );
    } else if (originalType === "delivery") {
      await this.jobs.addDeliveryJob(
        originalJobData.notificationId,
        originalJobData.deliveryId,
        originalJobData.tenantId,
        originalJobData.channel,
        originalJobData.providerId,
        originalJobData.recipient,
        originalJobData.templateData,
        Priority.NORMAL,
        originalJobData.retryCount || 0,
      );
    }

    await job.remove();

    this.logger.log(`Reprocessed dead letter item ${deadLetterJobId}`);
  }
}
