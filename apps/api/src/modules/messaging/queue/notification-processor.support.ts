import { InjectQueue } from "@nestjs/bull";
import { Injectable, Logger } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Queue } from "bull";
import { Repository } from "typeorm";
import {
  MessageDeliveryStatus as DeliveryStatus,
  MessageDelivery,
} from "../message-delivery.entity";
import { Message, MessageStatus } from "../message.entity";
import { NOTIFICATION_DELIVERY_QUEUE, NOTIFICATION_QUEUE } from "./notification-queue.constants";
import { AlertJobData, DeliveryJobData } from "./notification-queue.types";
import { getAlertPriority, getRecipientAddress } from "./notification-processor.utils";

@Injectable()
export class NotificationProcessorSupport {
  private readonly logger = new Logger(NotificationProcessorSupport.name);

  constructor(
    @InjectRepository(Message)
    private readonly messageRepository: Repository<Message>,
    @InjectRepository(MessageDelivery)
    private readonly deliveryRepository: Repository<MessageDelivery>,
    @InjectQueue(NOTIFICATION_QUEUE)
    private readonly notificationQueue: Queue,
    @InjectQueue(NOTIFICATION_DELIVERY_QUEUE)
    private readonly deliveryQueue: Queue<DeliveryJobData>,
  ) {}

  async createDeliveryRecords(message: Message): Promise<void> {
    const deliveries: Partial<MessageDelivery>[] = [];

    for (const channel of message.channels) {
      for (const recipient of message.recipients) {
        const recipientAddress = getRecipientAddress(recipient, channel);
        if (recipientAddress) {
          deliveries.push({
            messageId: message.id,
            channel,
            providerId: "pending",
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

  async updateNotificationStatusFromDeliveries(notificationId: string): Promise<void> {
    const deliveries = await this.deliveryRepository.find({
      where: { messageId: notificationId },
    });

    if (deliveries.length === 0) {
      return;
    }

    const deliveryStatuses = deliveries.map((d) => d.status);
    let notificationStatus: MessageStatus;

    if (deliveryStatuses.every((status) => status === DeliveryStatus.DELIVERED)) {
      notificationStatus = MessageStatus.DELIVERED;
    } else if (
      deliveryStatuses.some(
        (status) => status === DeliveryStatus.DELIVERED || status === DeliveryStatus.SENT,
      )
    ) {
      notificationStatus = MessageStatus.SENT;
    } else if (deliveryStatuses.every((status) => status === DeliveryStatus.FAILED)) {
      notificationStatus = MessageStatus.FAILED;
    } else {
      notificationStatus = MessageStatus.PROCESSING;
    }

    await this.messageRepository.update(notificationId, { status: notificationStatus });
  }

  async addToDeadLetterQueue(data: {
    type: "notification" | "delivery";
    id: string;
    tenantId: string;
    originalJobData: unknown;
    failureReason: string;
    failedAt: Date;
    retryCount: number;
    messageData?: unknown;
    deliveryData?: unknown;
  }): Promise<void> {
    try {
      await this.notificationQueue.add(
        "handle-dead-letter",
        {
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
        },
        {
          priority: data.type === "notification" ? 10 : 5,
          attempts: 1,
          removeOnComplete: false,
          removeOnFail: false,
        },
      );
      this.logger.log(`Added ${data.type} ${data.id} to dead letter queue`);
    } catch (error) {
      this.logger.error(
        `Failed to add ${data.type} ${data.id} to dead letter queue: ${error.message}`,
      );
    }
  }

  async sendFailureAlert(alert: {
    type: string;
    notificationId?: string;
    deliveryId?: string;
    tenantId: string;
    channel?: string;
    recipient?: string;
    retryCount: number;
    message: string;
    severity: "low" | "medium" | "high" | "critical";
    metadata?: unknown;
  }): Promise<void> {
    try {
      const alertJobData: AlertJobData = {
        type: "system_alert",
        alert: {
          type: alert.type,
          severity: alert.severity,
          title: `Notification System Alert: ${alert.type}`,
          message: alert.message,
          tenantId: alert.tenantId,
          metadata: {
            ...(alert.metadata as object),
            notificationId: alert.notificationId,
            deliveryId: alert.deliveryId,
            channel: alert.channel,
            recipient: alert.recipient,
            retryCount: alert.retryCount,
            timestamp: new Date().toISOString(),
          },
          recipients: this.getAlertRecipients(alert.severity),
        },
        createdAt: new Date(),
      };

      await this.notificationQueue.add("process-alert", alertJobData, {
        priority: getAlertPriority(alert.severity),
        attempts: 3,
        backoff: { type: "exponential", delay: 5000 },
        removeOnComplete: 10,
        removeOnFail: 10,
      });
      this.logger.log(`Sent ${alert.severity} alert for ${alert.type}`);
    } catch (error) {
      this.logger.error(`Failed to send failure alert: ${error.message}`);
    }
  }

  async shouldSendDeliveryAlert(
    notificationId: string,
    channel: string,
    retryCount: number,
  ): Promise<boolean> {
    try {
      const message = await this.messageRepository.findOne({
        where: { id: notificationId },
        select: ["priority", "channels"],
      });
      if (!message) {
        return false;
      }
      if (message.priority === "high" || message.priority === "urgent") {
        return true;
      }
      if (["email", "sms"].includes(channel) && retryCount >= 3) {
        return true;
      }
      if (message.channels.length === 1 && retryCount >= 2) {
        return true;
      }
      return false;
    } catch (error) {
      this.logger.error(`Error determining alert necessity: ${error.message}`);
      return false;
    }
  }

  private getAlertRecipients(severity: string): string[] {
    try {
      const systemAdmins = process.env.SYSTEM_ADMIN_EMAILS?.split(",") || [];
      if (severity === "critical" || severity === "high") {
        const tenantAdmins = process.env.TENANT_ADMIN_EMAILS?.split(",") || [];
        return [...systemAdmins, ...tenantAdmins];
      }
      return systemAdmins;
    } catch (error) {
      this.logger.error(`Error getting alert recipients: ${error.message}`);
      return [];
    }
  }

  get deliveryQueueRef(): Queue<DeliveryJobData> {
    return this.deliveryQueue;
  }

  get notificationQueueRef(): Queue {
    return this.notificationQueue;
  }
}
