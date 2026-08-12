import { InjectQueue, Process, Processor } from '@nestjs/bull';
import { Injectable, Logger } from '@nestjs/common';
import { Job, Queue } from 'bull';
import { BaseProviderPayload } from '../../../providers/base/base-provider.interface';
import { ProviderService } from '../../provider/provider.service';
import { TemplateService } from '../../template/template.service';
import {
  MessageDeliveryStatus as DeliveryStatus,
  MessageDelivery,
} from '../message-delivery.entity';
import { Message, MessageStatus, MessagePriority as Priority } from '../message.entity';
import { NOTIFICATION_DELIVERY_QUEUE, NOTIFICATION_QUEUE } from './notification-queue.module';
import {
  AlertJobData,
  DeadLetterJobData,
  DeliveryJobData,
  NotificationJobData,
} from './notification-queue.service';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

@Processor(NOTIFICATION_QUEUE)
@Injectable()
export class NotificationProcessor {
  private readonly logger = new Logger(NotificationProcessor.name);

  constructor(
    @InjectRepository(Message)
    private readonly messageRepository: Repository<Message>,
    @InjectRepository(MessageDelivery)
    private readonly deliveryRepository: Repository<MessageDelivery>,
    private readonly providerService: ProviderService,
    private readonly templateService: TemplateService,
    @InjectQueue(NOTIFICATION_QUEUE)
    private readonly notificationQueue: Queue<NotificationJobData | DeadLetterJobData | AlertJobData>,
    @InjectQueue(NOTIFICATION_DELIVERY_QUEUE)
    private readonly deliveryQueue: Queue<DeliveryJobData>,
  ) { }

  /**
   * Process notification job
   */
  @Process('process-notification')
  async processNotification(job: Job<NotificationJobData>): Promise<void> {
    const { notificationId, tenantId, retryCount = 0 } = job.data;

    this.logger.log(
      `Processing notification ${notificationId} (attempt ${retryCount + 1})`,
    );

    try {
      // Get message with deliveries
      const message = await this.messageRepository.findOne({
        where: { id: notificationId, tenantId },
        relations: ['deliveries'],
      });

      if (!message) {
        throw new Error(`Message ${notificationId} not found`);
      }

      // Update status to processing
      message.status = MessageStatus.PROCESSING;
      await this.messageRepository.save(message);

      // Create delivery records if they don't exist
      if (!message.deliveries || message.deliveries.length === 0) {
        await this.createDeliveryRecords(message);

        // Reload message with deliveries
        const updatedMessage = await this.messageRepository.findOne({
          where: { id: notificationId },
          relations: ['deliveries'],
        });

        if (updatedMessage) {
          message.deliveries = updatedMessage.deliveries;
        }
      }

      // Render template if needed
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
          this.logger.warn(
            `Failed to render template ${message.templateId}: ${error.message}`,
          );
          // Continue with original content if template rendering fails
        }
      }

      // Queue delivery jobs for each delivery
      const deliveryJobs = message.deliveries.map((delivery) => ({
        notificationId: message.id,
        deliveryId: delivery.id,
        tenantId: message.tenantId,
        channel: delivery.channel,
        providerId: delivery.providerId || 'auto-select',
        recipient: delivery.recipient,
        templateData: {
          ...message.data,
          subject: renderedSubject,
          content: renderedContent,
          metadata: message.metadata,
        },
      }));

      // Add bulk delivery jobs
      const jobs = deliveryJobs.map((jobData, index) => ({
        name: 'process-delivery',
        data: { ...jobData, retryCount: 0 },
        opts: {
          priority: this.getPriorityValue(Priority.NORMAL),
          attempts: 5,
          backoff: {
            type: 'exponential',
            delay: 1000,
          },
          delay: index * 100, // Stagger jobs slightly
        },
      }));

      await this.deliveryQueue.addBulk(jobs);

      // Update message status
      message.status = MessageStatus.SENT;
      await this.messageRepository.save(message);

      this.logger.log(`Successfully processed notification ${notificationId}`);
    } catch (error) {
      this.logger.error(
        `Failed to process notification ${notificationId}: ${error.message}`,
      );

      // Update message status to failed
      await this.messageRepository.update(notificationId, {
        status: MessageStatus.FAILED,
        errorMessage: error.message,
      });

      throw error; // Re-throw to trigger Bull's retry mechanism
    }
  }

  /**
   * Process delivery job
   */
  @Process({ name: 'process-delivery', concurrency: 10 })
  async processDelivery(job: Job<DeliveryJobData>): Promise<void> {
    const {
      notificationId,
      deliveryId,
      tenantId,
      channel,
      providerId,
      recipient,
      templateData,
      retryCount = 0,
    } = job.data;

    this.logger.log(
      `Processing delivery ${deliveryId} for notification ${notificationId} (${channel} to ${recipient}, attempt ${retryCount + 1})`,
    );

    try {
      // Get delivery record
      const delivery = await this.deliveryRepository.findOne({
        where: { id: deliveryId, messageId: notificationId },
      });

      if (!delivery) {
        throw new Error(`Delivery ${deliveryId} not found`);
      }

      // Update delivery status to processing
      delivery.status = DeliveryStatus.SENT;
      await this.deliveryRepository.save(delivery);

      // Prepare provider payload
      const payload: BaseProviderPayload = {
        recipient,
        data: {
          ...templateData,
          subject: templateData.subject,
          content: templateData.content,
        },
        metadata: {
          notificationId,
          deliveryId,
          tenantId,
          ...templateData.metadata,
        },
      };

      // Send via provider
      const result = await this.providerService.send(payload, {
        tenantId,
        channel: channel as any,
        excludeProviders: providerId === 'auto-select' ? [] : undefined,
      });

      // Update delivery with provider response
      delivery.providerId = result.providerId;
      delivery.providerMessageId = result.response?.messageId;
      delivery.providerResponse = result.response;
      delivery.status = DeliveryStatus.DELIVERED;
      delivery.deliveredAt = new Date();

      await this.deliveryRepository.save(delivery);

      // Update parent notification status if all deliveries are complete
      await this.updateNotificationStatusFromDeliveries(notificationId);

      this.logger.log(
        `Successfully processed delivery ${deliveryId} via ${result.providerId}`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to process delivery ${deliveryId}: ${error.message}`,
      );

      // Update delivery status to failed
      await this.deliveryRepository.update(deliveryId, {
        status: DeliveryStatus.FAILED,
        errorMessage: error.message,
        retryCount: retryCount + 1,
      });

      // Update parent notification status
      await this.updateNotificationStatusFromDeliveries(notificationId);

      throw error; // Re-throw to trigger Bull's retry mechanism
    }
  }

  /**
   * Handle failed notification jobs
   */
  @Process('handle-failed-notification')
  async handleFailedNotification(job: Job<NotificationJobData>): Promise<void> {
    const { notificationId, tenantId, retryCount = 0 } = job.data;

    this.logger.error(
      `Notification ${notificationId} failed after all retry attempts (${retryCount} retries)`,
    );

    try {
      // Get the message for context
      const message = await this.messageRepository.findOne({
        where: { id: notificationId, tenantId },
        relations: ['deliveries'],
      });

      if (!message) {
        this.logger.error(`Message ${notificationId} not found for failure handling`);
        return;
      }

      // Update message status to failed
      await this.messageRepository.update(notificationId, {
        status: MessageStatus.FAILED,
        errorMessage: 'Failed after all retry attempts',
      });

      // Add to dead letter queue for manual review
      await this.addToDeadLetterQueue({
        type: 'notification',
        id: notificationId,
        tenantId,
        originalJobData: job.data,
        failureReason: 'Exceeded maximum retry attempts',
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

      // Send alert to administrators
      await this.sendFailureAlert({
        type: 'notification_failure',
        notificationId,
        tenantId,
        retryCount,
        message: `Notification ${notificationId} failed after ${retryCount} retry attempts`,
        severity: 'high',
        metadata: {
          channels: message.channels,
          recipientCount: message.recipients.length,
          templateId: message.templateId,
          priority: message.priority,
        },
      });

      this.logger.log(`Added failed notification ${notificationId} to dead letter queue`);
    } catch (error) {
      this.logger.error(`Error handling failed notification ${notificationId}: ${error.message}`);
    }
  }

  /**
   * Handle failed delivery jobs
   */
  @Process('handle-failed-delivery')
  async handleFailedDelivery(job: Job<DeliveryJobData>): Promise<void> {
    const { deliveryId, notificationId, tenantId, channel, recipient, retryCount = 0 } = job.data;

    this.logger.error(`Delivery ${deliveryId} failed after all retry attempts (${retryCount} retries)`);

    try {
      // Get the delivery for context
      const delivery = await this.deliveryRepository.findOne({
        where: { id: deliveryId, messageId: notificationId },
      });

      if (!delivery) {
        this.logger.error(`Delivery ${deliveryId} not found for failure handling`);
        return;
      }

      // Update delivery status to failed
      await this.deliveryRepository.update(deliveryId, {
        status: DeliveryStatus.FAILED,
        errorMessage: 'Failed after all retry attempts',
        retryCount: retryCount + 1,
      });

      // Update parent notification status
      await this.updateNotificationStatusFromDeliveries(notificationId);

      // Add to dead letter queue for manual review
      await this.addToDeadLetterQueue({
        type: 'delivery',
        id: deliveryId,
        tenantId,
        originalJobData: job.data,
        failureReason: 'Exceeded maximum retry attempts',
        failedAt: new Date(),
        retryCount,
        deliveryData: {
          notificationId,
          channel,
          recipient,
          providerId: delivery.providerId,
          errorMessage: delivery.errorMessage,
        },
      });

      // Send alert to administrators (only for critical channels or high-priority messages)
      const shouldAlert = await this.shouldSendDeliveryAlert(notificationId, channel, retryCount);
      if (shouldAlert) {
        await this.sendFailureAlert({
          type: 'delivery_failure',
          deliveryId,
          notificationId,
          tenantId,
          channel,
          recipient,
          retryCount,
          message: `Delivery ${deliveryId} (${channel} to ${recipient}) failed after ${retryCount} retry attempts`,
          severity: 'medium',
          metadata: {
            channel,
            providerId: delivery.providerId,
            errorMessage: delivery.errorMessage,
          },
        });
      }

      this.logger.log(`Added failed delivery ${deliveryId} to dead letter queue`);
    } catch (error) {
      this.logger.error(`Error handling failed delivery ${deliveryId}: ${error.message}`);
    }
  }

  /**
   * Create delivery records for message
   */
  private async createDeliveryRecords(message: Message): Promise<void> {
    const deliveries: Partial<MessageDelivery>[] = [];

    for (const channel of message.channels) {
      for (const recipient of message.recipients) {
        const recipientAddress = this.getRecipientAddress(recipient, channel);

        if (recipientAddress) {
          deliveries.push({
            messageId: message.id,
            channel,
            providerId: 'pending',
            recipient: recipientAddress,
            status: DeliveryStatus.PENDING,
          });
        }
      }
    }

    if (deliveries.length > 0) {
      await this.deliveryRepository.save(deliveries);
    }
  }

  /**
   * Get recipient address for channel
   */
  private getRecipientAddress(recipient: any, channel: string): string | null {
    switch (channel) {
      case 'email':
        return recipient.email || null;
      case 'sms':
        return recipient.phone || null;
      case 'whatsapp':
        return recipient.whatsappNumber || null;
      case 'push':
        return recipient.deviceToken || null;
      case 'in_app':
        return recipient.userId || null;
      default:
        return recipient.id || null;
    }
  }

  /**
   * Update notification status based on delivery statuses
   */
  private async updateNotificationStatusFromDeliveries(
    notificationId: string,
  ): Promise<void> {
    const deliveries = await this.deliveryRepository.find({
      where: { messageId: notificationId },
    });

    if (deliveries.length === 0) {
      return;
    }

    const deliveryStatuses = deliveries.map((d) => d.status);
    let notificationStatus: MessageStatus;

    if (
      deliveryStatuses.every((status) => status === DeliveryStatus.DELIVERED)
    ) {
      notificationStatus = MessageStatus.DELIVERED;
    } else if (
      deliveryStatuses.some(
        (status) =>
          status === DeliveryStatus.DELIVERED || status === DeliveryStatus.SENT,
      )
    ) {
      notificationStatus = MessageStatus.SENT;
    } else if (
      deliveryStatuses.every((status) => status === DeliveryStatus.FAILED)
    ) {
      notificationStatus = MessageStatus.FAILED;
    } else {
      notificationStatus = MessageStatus.PROCESSING;
    }

    await this.messageRepository.update(notificationId, {
      status: notificationStatus,
    });
  }

  /**
   * Add failed job to dead letter queue for manual review
   */
  private async addToDeadLetterQueue(data: {
    type: 'notification' | 'delivery';
    id: string;
    tenantId: string;
    originalJobData: any;
    failureReason: string;
    failedAt: Date;
    retryCount: number;
    messageData?: any;
    deliveryData?: any;
  }): Promise<void> {
    try {
      // Add to dead letter queue with high priority for manual review
      // Add to dead letter queue
      const jobData = {
        type: 'dead_letter',
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

      await this.notificationQueue.add('handle-dead-letter', jobData, {
        priority: data.type === 'notification' ? 10 : 5,
        attempts: 1,
        removeOnComplete: false,
        removeOnFail: false,
      });

      this.logger.log(`Added ${data.type} ${data.id} to dead letter queue`);
    } catch (error) {
      this.logger.error(`Failed to add ${data.type} ${data.id} to dead letter queue: ${error.message}`);
    }
  }

  /**
   * Send failure alert to administrators
   */
  private async sendFailureAlert(alert: {
    type: string;
    notificationId?: string;
    deliveryId?: string;
    tenantId: string;
    channel?: string;
    recipient?: string;
    retryCount: number;
    message: string;
    severity: 'low' | 'medium' | 'high' | 'critical';
    metadata?: any;
  }): Promise<void> {
    try {
      // Send alert via internal notification system
      // Add alert job
      const alertJobData = {
        type: 'system_alert',
        alert: {
          type: alert.type,
          severity: alert.severity,
          title: `Notification System Alert: ${alert.type}`,
          message: alert.message,
          tenantId: alert.tenantId,
          metadata: {
            ...alert.metadata,
            notificationId: alert.notificationId,
            deliveryId: alert.deliveryId,
            channel: alert.channel,
            recipient: alert.recipient,
            retryCount: alert.retryCount,
            timestamp: new Date().toISOString(),
          },
          recipients: await this.getAlertRecipients(alert.tenantId, alert.severity),
        },
        createdAt: new Date(),
      };

      const priority = this.getAlertPriority(alert.severity);

      await this.notificationQueue.add('process-alert', alertJobData, {
        priority,
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 5000,
        },
        removeOnComplete: 10,
        removeOnFail: 10,
      });

      this.logger.log(`Sent ${alert.severity} alert for ${alert.type}`);
    } catch (error) {
      this.logger.error(`Failed to send failure alert: ${error.message}`);
    }
  }

  /**
   * Determine if delivery failure should trigger an alert
   */
  private async shouldSendDeliveryAlert(
    notificationId: string,
    channel: string,
    retryCount: number,
  ): Promise<boolean> {
    try {
      // Get message to check priority
      const message = await this.messageRepository.findOne({
        where: { id: notificationId },
        select: ['priority', 'channels'],
      });

      if (!message) {
        return false;
      }

      // Always alert for high/urgent priority messages
      if (message.priority === 'high' || message.priority === 'urgent') {
        return true;
      }

      // Alert for critical channels (email, sms) after multiple retries
      const criticalChannels = ['email', 'sms'];
      if (criticalChannels.includes(channel) && retryCount >= 3) {
        return true;
      }

      // Alert if this is the only channel and it failed
      if (message.channels.length === 1 && retryCount >= 2) {
        return true;
      }

      return false;
    } catch (error) {
      this.logger.error(`Error determining alert necessity: ${error.message}`);
      return false; // Default to no alert on error
    }
  }

  /**
   * Get alert recipients based on tenant and severity
   */
  private async getAlertRecipients(tenantId: string, severity: string): Promise<string[]> {
    try {
      // In a real implementation, this would fetch from tenant configuration
      // For now, return system administrators
      const systemAdmins = process.env.SYSTEM_ADMIN_EMAILS?.split(',') || [];

      // For critical alerts, include more recipients
      if (severity === 'critical' || severity === 'high') {
        const tenantAdmins = process.env.TENANT_ADMIN_EMAILS?.split(',') || [];
        return [...systemAdmins, ...tenantAdmins];
      }

      return systemAdmins;
    } catch (error) {
      this.logger.error(`Error getting alert recipients: ${error.message}`);
      return [];
    }
  }

  /**
   * Process retry with exponential backoff
   */
  @Process('retry-notification')
  async retryNotification(job: Job<NotificationJobData & { originalError: string }>): Promise<void> {
    const { notificationId, tenantId, retryCount = 0, originalError } = job.data;
    const maxRetries = 5;
    const baseDelay = 1000; // 1 second

    this.logger.log(`Retrying notification ${notificationId} (attempt ${retryCount + 1}/${maxRetries})`);

    if (retryCount >= maxRetries) {
      // Max retries reached, handle as failed
      await this.handleFailedNotification(job);
      return;
    }

    try {
      // Calculate exponential backoff delay
      const delay = baseDelay * Math.pow(2, retryCount);

      // Add jitter to prevent thundering herd
      const jitter = Math.random() * 1000;
      const totalDelay = delay + jitter;

      // Re-queue with delay
      const jobData: NotificationJobData = {
        notificationId,
        tenantId,
        priority: Priority.NORMAL,
        retryCount: retryCount + 1,
      };

      await this.notificationQueue.add('process-notification', jobData, {
        delay: totalDelay,
        attempts: 1,
        removeOnComplete: 10,
        removeOnFail: 10,
      });

      this.logger.log(`Scheduled retry for notification ${notificationId} in ${totalDelay}ms`);
    } catch (error) {
      this.logger.error(`Failed to schedule retry for notification ${notificationId}: ${error.message}`);
      await this.handleFailedNotification(job);
    }
  }

  /**
   * Process retry for delivery
   */
  @Process('retry-delivery')
  async retryDelivery(job: Job<DeliveryJobData & { originalError: string }>): Promise<void> {
    const { deliveryId, notificationId, tenantId, retryCount = 0, originalError } = job.data;
    const maxRetries = 3;
    const baseDelay = 2000; // 2 seconds

    this.logger.log(`Retrying delivery ${deliveryId} (attempt ${retryCount + 1}/${maxRetries})`);

    if (retryCount >= maxRetries) {
      // Max retries reached, handle as failed
      await this.handleFailedDelivery(job);
      return;
    }

    try {
      // Calculate exponential backoff delay
      const delay = baseDelay * Math.pow(2, retryCount);

      // Add jitter to prevent thundering herd
      const jitter = Math.random() * 500;
      const totalDelay = delay + jitter;

      // Re-queue with delay
      const jobData: DeliveryJobData = {
        ...job.data,
        retryCount: retryCount + 1,
      };

      await this.deliveryQueue.add('process-delivery', jobData, {
        delay: totalDelay,
        attempts: 1,
        removeOnComplete: 10,
        removeOnFail: 10,
      });

      this.logger.log(`Scheduled retry for delivery ${deliveryId} in ${totalDelay}ms`);
    } catch (error) {
      this.logger.error(`Failed to schedule retry for delivery ${deliveryId}: ${error.message}`);
      await this.handleFailedDelivery(job);
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

  /**
   * Get alert priority value
   */
  private getAlertPriority(severity: string): number {
    switch (severity) {
      case 'critical':
        return 20;
      case 'high':
        return 15;
      case 'medium':
        return 5;
      case 'low':
        return 1;
      default:
        return 5;
    }
  }
}
