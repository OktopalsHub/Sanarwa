import { Process, Processor } from "@nestjs/bull";
import { Injectable, Logger } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Job } from "bull";
import { Repository } from "typeorm";
import { BaseProviderPayload } from "../../../providers/base/base-provider.interface";
import { ProviderService } from "../../provider/provider.service";
import {
  MessageDeliveryStatus as DeliveryStatus,
  MessageDelivery,
} from "../message-delivery.entity";
import { NOTIFICATION_DELIVERY_QUEUE } from "./notification-queue.constants";
import { DeliveryJobData } from "./notification-queue.types";
import { NotificationProcessorSupport } from "./notification-processor.support";

@Processor(NOTIFICATION_DELIVERY_QUEUE)
@Injectable()
export class NotificationDeliveryProcessor {
  private readonly logger = new Logger(NotificationDeliveryProcessor.name);

  constructor(
    @InjectRepository(MessageDelivery)
    private readonly deliveryRepository: Repository<MessageDelivery>,
    private readonly providerService: ProviderService,
    private readonly support: NotificationProcessorSupport,
  ) {}

  @Process({ name: "process-delivery", concurrency: 10 })
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
      const delivery = await this.deliveryRepository.findOne({
        where: { id: deliveryId, messageId: notificationId },
      });
      if (!delivery) {
        throw new Error(`Delivery ${deliveryId} not found`);
      }

      delivery.status = DeliveryStatus.SENT;
      await this.deliveryRepository.save(delivery);

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

      const result = await this.providerService.send(payload, {
        tenantId,
        channel: channel as never,
        excludeProviders: providerId === "auto-select" ? [] : undefined,
      });

      delivery.providerId = result.providerId;
      delivery.providerMessageId = result.response?.messageId;
      delivery.providerResponse = result.response;
      delivery.status = DeliveryStatus.DELIVERED;
      delivery.deliveredAt = new Date();
      await this.deliveryRepository.save(delivery);

      await this.support.updateNotificationStatusFromDeliveries(notificationId);
      this.logger.log(`Successfully processed delivery ${deliveryId} via ${result.providerId}`);
    } catch (error) {
      this.logger.error(`Failed to process delivery ${deliveryId}: ${error.message}`);
      await this.deliveryRepository.update(deliveryId, {
        status: DeliveryStatus.FAILED,
        errorMessage: error.message,
        retryCount: retryCount + 1,
      });
      await this.support.updateNotificationStatusFromDeliveries(notificationId);
      throw error;
    }
  }

  @Process("handle-failed-delivery")
  async handleFailedDelivery(job: Job<DeliveryJobData>): Promise<void> {
    const { deliveryId, notificationId, tenantId, channel, recipient, retryCount = 0 } = job.data;
    this.logger.error(
      `Delivery ${deliveryId} failed after all retry attempts (${retryCount} retries)`,
    );

    try {
      const delivery = await this.deliveryRepository.findOne({
        where: { id: deliveryId, messageId: notificationId },
      });
      if (!delivery) {
        this.logger.error(`Delivery ${deliveryId} not found for failure handling`);
        return;
      }

      await this.deliveryRepository.update(deliveryId, {
        status: DeliveryStatus.FAILED,
        errorMessage: "Failed after all retry attempts",
        retryCount: retryCount + 1,
      });
      await this.support.updateNotificationStatusFromDeliveries(notificationId);

      await this.support.addToDeadLetterQueue({
        type: "delivery",
        id: deliveryId,
        tenantId,
        originalJobData: job.data,
        failureReason: "Exceeded maximum retry attempts",
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

      if (await this.support.shouldSendDeliveryAlert(notificationId, channel, retryCount)) {
        await this.support.sendFailureAlert({
          type: "delivery_failure",
          deliveryId,
          notificationId,
          tenantId,
          channel,
          recipient,
          retryCount,
          message: `Delivery ${deliveryId} (${channel} to ${recipient}) failed after ${retryCount} retry attempts`,
          severity: "medium",
          metadata: {
            channel,
            providerId: delivery.providerId,
            errorMessage: delivery.errorMessage,
          },
        });
      }
    } catch (error) {
      this.logger.error(`Error handling failed delivery ${deliveryId}: ${error.message}`);
    }
  }

  @Process("retry-delivery")
  async retryDelivery(job: Job<DeliveryJobData & { originalError?: string }>): Promise<void> {
    const { deliveryId, retryCount = 0 } = job.data;
    const maxRetries = 3;
    const baseDelay = 2000;

    if (retryCount >= maxRetries) {
      await this.handleFailedDelivery(job);
      return;
    }

    try {
      const totalDelay = baseDelay * 2 ** retryCount + Math.random() * 500;
      await this.support.deliveryQueueRef.add(
        "process-delivery",
        { ...job.data, retryCount: retryCount + 1 },
        { delay: totalDelay, attempts: 1, removeOnComplete: 10, removeOnFail: 10 },
      );
      this.logger.log(`Scheduled retry for delivery ${deliveryId} in ${totalDelay}ms`);
    } catch (error) {
      this.logger.error(`Failed to schedule retry for delivery ${deliveryId}: ${error.message}`);
      await this.handleFailedDelivery(job);
    }
  }
}
