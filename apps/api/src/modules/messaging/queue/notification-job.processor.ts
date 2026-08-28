import { Process, Processor } from "@nestjs/bull";
import { Injectable, Logger } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Job } from "bull";
import { Repository } from "typeorm";
import { TemplateService } from "../../template/template.service";
import { Message, MessageStatus, MessagePriority as Priority } from "../message.entity";
import { NOTIFICATION_QUEUE } from "./notification-queue.constants";
import { NotificationJobData } from "./notification-queue.types";
import { NotificationProcessorSupport } from "./notification-processor.support";
import { getPriorityValue } from "./notification-processor.utils";

@Processor(NOTIFICATION_QUEUE)
@Injectable()
export class NotificationJobProcessor {
  private readonly logger = new Logger(NotificationJobProcessor.name);

  constructor(
    @InjectRepository(Message)
    private readonly messageRepository: Repository<Message>,
    private readonly templateService: TemplateService,
    private readonly support: NotificationProcessorSupport,
  ) {}

  @Process("process-notification")
  async processNotification(job: Job<NotificationJobData>): Promise<void> {
    const { notificationId, tenantId, retryCount = 0 } = job.data;
    this.logger.log(`Processing notification ${notificationId} (attempt ${retryCount + 1})`);

    try {
      const message = await this.messageRepository.findOne({
        where: { id: notificationId, tenantId },
        relations: ["deliveries"],
      });
      if (!message) {
        throw new Error(`Message ${notificationId} not found`);
      }

      message.status = MessageStatus.PROCESSING;
      await this.messageRepository.save(message);

      if (!message.deliveries?.length) {
        await this.support.createDeliveryRecords(message);
        const updated = await this.messageRepository.findOne({
          where: { id: notificationId },
          relations: ["deliveries"],
        });
        if (updated) {
          message.deliveries = updated.deliveries;
        }
      }

      let renderedContent = message.content;
      let renderedSubject = message.subject;
      if (message.templateId) {
        try {
          const rendered = await this.templateService.render({
            templateId: message.templateId,
            tenantId: message.tenantId,
            data: message.data,
          });
          renderedContent = rendered.content;
          renderedSubject = rendered.subject;
        } catch (error) {
          this.logger.warn(`Failed to render template ${message.templateId}: ${error.message}`);
        }
      }

      const deliveryJobs = message.deliveries!.map((delivery) => ({
        notificationId: message.id,
        deliveryId: delivery.id,
        tenantId: message.tenantId,
        channel: delivery.channel,
        providerId: delivery.providerId || "auto-select",
        recipient: delivery.recipient,
        templateData: {
          ...message.data,
          subject: renderedSubject,
          content: renderedContent,
          metadata: message.metadata,
        },
      }));

      await this.support.deliveryQueueRef.addBulk(
        deliveryJobs.map((jobData, index) => ({
          name: "process-delivery",
          data: { ...jobData, retryCount: 0 },
          opts: {
            priority: getPriorityValue(Priority.NORMAL),
            attempts: 5,
            backoff: { type: "exponential", delay: 1000 },
            delay: index * 100,
          },
        })),
      );

      message.status = MessageStatus.SENT;
      await this.messageRepository.save(message);
      this.logger.log(`Successfully processed notification ${notificationId}`);
    } catch (error) {
      this.logger.error(`Failed to process notification ${notificationId}: ${error.message}`);
      await this.messageRepository.update(notificationId, {
        status: MessageStatus.FAILED,
        errorMessage: error.message,
      });
      throw error;
    }
  }

  @Process("handle-failed-notification")
  async handleFailedNotification(job: Job<NotificationJobData>): Promise<void> {
    const { notificationId, tenantId, retryCount = 0 } = job.data;
    this.logger.error(
      `Notification ${notificationId} failed after all retry attempts (${retryCount} retries)`,
    );

    try {
      const message = await this.messageRepository.findOne({
        where: { id: notificationId, tenantId },
        relations: ["deliveries"],
      });
      if (!message) {
        this.logger.error(`Message ${notificationId} not found for failure handling`);
        return;
      }

      await this.messageRepository.update(notificationId, {
        status: MessageStatus.FAILED,
        errorMessage: "Failed after all retry attempts",
      });

      await this.support.addToDeadLetterQueue({
        type: "notification",
        id: notificationId,
        tenantId,
        originalJobData: job.data,
        failureReason: "Exceeded maximum retry attempts",
        failedAt: new Date(),
        retryCount,
        messageData: {
          subject: message.subject,
          content: message.content,
          channels: message.channels,
          recipients: message.recipients,
          templateId: message.templateId,
          priority: message.priority,
        },
      });

      await this.support.sendFailureAlert({
        type: "notification_failure",
        notificationId,
        tenantId,
        retryCount,
        message: `Notification ${notificationId} failed after ${retryCount} retry attempts`,
        severity: "high",
        metadata: {
          channels: message.channels,
          recipientCount: message.recipients.length,
          templateId: message.templateId,
          priority: message.priority,
        },
      });
    } catch (error) {
      this.logger.error(`Error handling failed notification ${notificationId}: ${error.message}`);
    }
  }

  @Process("retry-notification")
  async retryNotification(
    job: Job<NotificationJobData & { originalError?: string }>,
  ): Promise<void> {
    const { notificationId, tenantId, retryCount = 0 } = job.data;
    const maxRetries = 5;
    const baseDelay = 1000;

    if (retryCount >= maxRetries) {
      await this.handleFailedNotification(job);
      return;
    }

    try {
      const totalDelay = baseDelay * 2 ** retryCount + Math.random() * 1000;
      await this.support.notificationQueueRef.add(
        "process-notification",
        {
          notificationId,
          tenantId,
          priority: Priority.NORMAL,
          retryCount: retryCount + 1,
        },
        { delay: totalDelay, attempts: 1, removeOnComplete: 10, removeOnFail: 10 },
      );
      this.logger.log(`Scheduled retry for notification ${notificationId} in ${totalDelay}ms`);
    } catch (error) {
      this.logger.error(
        `Failed to schedule retry for notification ${notificationId}: ${error.message}`,
      );
      await this.handleFailedNotification(job);
    }
  }
}
