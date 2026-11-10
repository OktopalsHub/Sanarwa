import { InjectQueue } from "@nestjs/bullmq";
import { Injectable, Logger } from "@nestjs/common";
import { JobsOptions, Queue } from "bullmq";
import { ChatProvider } from "../../../common/enums/chat-provider.enum";
import { MessagePriority as Priority } from "../message.entity";
import {
  NOTIFICATION_ADMIN_QUEUE,
  NOTIFICATION_DELIVERY_QUEUE,
  NOTIFICATION_QUEUE,
} from "./notification-queue.constants";

export interface NotificationJobPayload {
  subject?: string;
  data?: string;
  templateId?: string;
  variables?: Record<string, any>;
  brandId?: string;
  storagePolicy?: string;
  chatProvider?: ChatProvider;
}

export interface NotificationJobData {
  notificationId: string;
  tenantId: string;
  priority: Priority;
  scheduledAt?: Date;
  retryCount?: number;
  payload?: NotificationJobPayload;
}

export interface DeliveryJobData {
  notificationId: string;
  deliveryId: string;
  tenantId: string;
  channel: string;
  providerId: string;
  recipient: string;
  templateData: Record<string, any>;
  retryCount?: number;
}

export interface DeadLetterJobData {
  type: string;
  originalType: "notification" | "delivery";
  originalId: string;
  tenantId: string;
  failureReason: string;
  failedAt: Date;
  retryCount: number;
  originalJobData: any;
  messageData?: any;
  deliveryData?: any;
}

export interface AlertJobData {
  type: string;
  alert: {
    type: string;
    severity: "low" | "medium" | "high" | "critical";
    title: string;
    message: string;
    tenantId: string;
    metadata?: any;
    recipients: string[];
  };
  createdAt: Date;
}

@Injectable()
export class NotificationQueueService {
  private readonly logger = new Logger(NotificationQueueService.name);

  constructor(
    @InjectQueue(NOTIFICATION_QUEUE)
    private readonly notificationQueue: Queue<
      NotificationJobData | DeadLetterJobData | AlertJobData
    >,
    @InjectQueue(NOTIFICATION_DELIVERY_QUEUE)
    private readonly deliveryQueue: Queue<DeliveryJobData>,
    @InjectQueue(NOTIFICATION_ADMIN_QUEUE)
    private readonly adminQueue: Queue<DeadLetterJobData | AlertJobData>,
  ) {}

  async addNotificationJob(
    notificationId: string,
    tenantId: string,
    priority: Priority = Priority.NORMAL,
    scheduledAt?: Date,
    retryCount: number = 0,
    payload?: NotificationJobPayload,
  ): Promise<void> {
    const jobData: NotificationJobData = {
      notificationId,
      tenantId,
      priority,
      scheduledAt,
      retryCount,
      payload,
    };

    const jobOptions: JobsOptions = {
      priority: this.getPriorityValue(priority),
      delay: scheduledAt ? Math.max(0, scheduledAt.getTime() - Date.now()) : 0,
      attempts: 3,
      backoff: {
        type: "exponential",
        delay: 2000,
      },
      jobId: `msg-${notificationId}-${retryCount}`,
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

    const jobOptions: JobsOptions = {
      priority: this.getPriorityValue(priority),
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

  /**
   * Moves a pending scheduled job: weakens the original delayed job and
   * re-adds it at the new time so the message send time actually moves.
   * Safe to call when no job exists (no-op).
   */
  async rescheduleNotificationJob(notificationId: string, scheduledAt: Date): Promise<void> {
    const jobs = await this.notificationQueue.getJobs(["waiting", "delayed", "prioritized"]);
    const pending = jobs.filter((job) => {
      const data = job.data as NotificationJobData | undefined;
      return data?.notificationId === notificationId;
    });

    const first = pending[0]?.data;
    for (const job of pending) {
      await job.remove();
    }

    const tenantId = (first as NotificationJobData | undefined)?.tenantId ?? "";
    const priority = (first as NotificationJobData | undefined)?.priority;

    if (scheduledAt.getTime() > Date.now()) {
      await this.addNotificationJob(notificationId, tenantId, priority, scheduledAt, 0);
    } else {
      // Due now — re-enqueue for immediate processing.
      await this.addNotificationJob(notificationId, tenantId, priority, undefined, 0);
    }
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
      notification: {
        waiting: notificationCounts.waiting,
        active: notificationCounts.active,
        completed: notificationCounts.completed,
        failed: notificationCounts.failed,
        delayed: notificationCounts.delayed,
      },
      delivery: {
        waiting: deliveryCounts.waiting,
        active: deliveryCounts.active,
        completed: deliveryCounts.completed,
        failed: deliveryCounts.failed,
        delayed: deliveryCounts.delayed,
      },
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
      this.notificationQueue.clean(24 * 60 * 60 * 1000, cleanOptions.limit, "completed"),
      this.notificationQueue.clean(7 * 24 * 60 * 60 * 1000, cleanOptions.limit, "failed"),
      this.deliveryQueue.clean(24 * 60 * 60 * 1000, cleanOptions.limit, "completed"),
      this.deliveryQueue.clean(7 * 24 * 60 * 60 * 1000, cleanOptions.limit, "failed"),
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

  async getDeadLetterItems(limit: number = 50): Promise<any[]> {
    const jobs = await this.adminQueue.getJobs(["completed", "failed"], 0, limit - 1);

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
    const job = await this.adminQueue.getJob(deadLetterJobId);

    if (!job || (job.data as any).type !== "dead_letter") {
      throw new Error("Dead letter job not found");
    }

    const data = job.data as DeadLetterJobData;
    const { originalType, originalJobData } = data;

    if (originalType === "notification") {
      await this.addNotificationJob(
        originalJobData.notificationId,
        originalJobData.tenantId,
        originalJobData.priority,
        originalJobData.scheduledAt,
        originalJobData.retryCount || 0,
        originalJobData.payload,
      );
    } else if (originalType === "delivery") {
      await this.addDeliveryJob(
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

  private getAlertPriority(severity: string): number {
    switch (severity) {
      case "critical":
        return 1;
      case "high":
        return 2;
      case "medium":
        return 3;
      case "low":
        return 4;
      default:
        return 3;
    }
  }

  private getPriorityValue(priority: Priority): number {
    switch (priority) {
      case Priority.URGENT:
        return 1;
      case Priority.HIGH:
        return 2;
      case Priority.NORMAL:
        return 3;
      case Priority.LOW:
        return 4;
      default:
        return 3;
    }
  }
}
