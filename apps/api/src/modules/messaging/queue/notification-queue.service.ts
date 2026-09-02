import { InjectQueue } from "@nestjs/bull";
import { Injectable, Logger } from "@nestjs/common";
import { JobOptions, Queue } from "bull";
import { MessagePriority as Priority } from "../message.entity";
import { NOTIFICATION_DELIVERY_QUEUE, NOTIFICATION_QUEUE } from "./notification-queue.constants";

export interface NotificationJobData {
  notificationId: string;
  tenantId: string;
  priority: Priority;
  scheduledAt?: Date;
  retryCount?: number;
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
  ) {}

  /**
   * Add notification to processing queue
   */
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
      priority: this.getPriorityValue(priority),
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

  /**
   * Add delivery job to processing queue
   */
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
   * Add bulk delivery jobs
   */
  async addBulkDeliveryJobs(deliveryJobs: Omit<DeliveryJobData, "retryCount">[]): Promise<void> {
    const jobs = deliveryJobs.map((jobData, index) => ({
      name: "process-delivery",
      data: { ...jobData, retryCount: 0 },
      opts: {
        priority: this.getPriorityValue(Priority.NORMAL),
        attempts: 5,
        backoff: {
          type: "exponential",
          delay: 1000,
        },
        delay: index * 20, // Minimal 250 plan: 20ms stagger for ZeptoMail 500 burst (was 100)
      } as JobOptions,
    }));

    await this.deliveryQueue.addBulk(jobs);

    this.logger.log(`Added ${jobs.length} delivery jobs to queue`);
  }

  /**
   * Retry failed notification
   */
  async retryNotification(
    notificationId: string,
    tenantId: string,
    priority: Priority = Priority.NORMAL,
    retryCount: number = 0,
  ): Promise<void> {
    await this.addNotificationJob(notificationId, tenantId, priority, undefined, retryCount + 1);
  }

  /**
   * Retry failed delivery
   */
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

  /**
   * Get queue statistics
   */
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

  /**
   * Pause queues
   */
  async pauseQueues(): Promise<void> {
    await Promise.all([this.notificationQueue.pause(), this.deliveryQueue.pause()]);
    this.logger.log("Queues paused");
  }

  /**
   * Resume queues
   */
  async resumeQueues(): Promise<void> {
    await Promise.all([this.notificationQueue.resume(), this.deliveryQueue.resume()]);
    this.logger.log("Queues resumed");
  }

  /**
   * Clean completed and failed jobs
   */
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

  /**
   * Get failed jobs for analysis
   */
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

  /**
   * Add to dead letter queue for manual review
   */
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
    // In a real implementation, this would use a separate dead letter queue
    // For now, we'll use a special job type in the main queue
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
      removeOnComplete: false, // Keep dead letter jobs for manual review
      removeOnFail: false,
    });

    this.logger.log(`Added ${data.type} ${data.id} to dead letter queue`);
  }

  /**
   * Add alert job for system notifications
   */
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

    const priority = this.getAlertPriority(alert.severity);

    await this.notificationQueue.add("process-alert", jobData, {
      priority,
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

  /**
   * Get dead letter queue items for manual review
   */
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

  /**
   * Reprocess dead letter item
   */
  async reprocessDeadLetterItem(deadLetterJobId: string): Promise<void> {
    const job = await this.notificationQueue.getJob(deadLetterJobId);

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

    // Remove the dead letter job
    await job.remove();

    this.logger.log(`Reprocessed dead letter item ${deadLetterJobId}`);
  }

  /**
   * Get alert priority value
   */
  private getAlertPriority(severity: string): number {
    switch (severity) {
      case "critical":
        return 20;
      case "high":
        return 15;
      case "medium":
        return 5;
      case "low":
        return 1;
      default:
        return 5;
    }
  }

  /**
   * Convert priority enum to numeric value for Bull queue
   */
  private getPriorityValue(priority: Priority): number {
    switch (priority) {
      case Priority.URGENT:
        return 10;
      case Priority.HIGH:
        return 5;
      case Priority.NORMAL:
        return 1;
      case Priority.LOW:
        return -5;
      default:
        return 1;
    }
  }
}
