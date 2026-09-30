import { Injectable, Logger } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { QueryDeepPartialEntity } from "typeorm/query-builder/QueryPartialEntity";
import {
  MessageDeliveryStatus as DeliveryStatus,
  MessageDelivery as NotificationDelivery,
} from "../messaging/message-delivery.entity";
import {
  Message as Notification,
  MessageChannel as NotificationChannel,
  MessageStatus as NotificationStatus,
} from "../messaging/message.entity";
import { AuditLogService } from "./audit-log.service";
import { WebhookService } from "./webhook.service";

export interface DeliveryStatusUpdate {
  deliveryId: string;
  status: DeliveryStatus;
  providerMessageId?: string;
  providerResponse?: any;
  errorMessage?: string;
  metadata?: Record<string, any>;
}

export interface DeliveryTrackingStats {
  totalDeliveries: number;
  deliveredCount: number;
  failedCount: number;
  pendingCount: number;
  deliveryRate: number;
  failureRate: number;
  averageDeliveryTime?: number;
}

@Injectable()
export class DeliveryTrackingService {
  private readonly logger = new Logger(DeliveryTrackingService.name);

  constructor(
    @InjectRepository(NotificationDelivery)
    private readonly deliveryRepository: Repository<NotificationDelivery>,
    @InjectRepository(Notification)
    private readonly messageRepository: Repository<Notification>,
    private readonly webhookService: WebhookService,
    private readonly auditLogService: AuditLogService,
  ) {}

  /**
   * Update delivery status with real-time tracking
   */
  async updateDeliveryStatus(update: DeliveryStatusUpdate): Promise<void> {
    const { deliveryId, status, providerMessageId, providerResponse, errorMessage, metadata } =
      update;

    this.logger.log(`Updating delivery ${deliveryId} status to ${status}`);

    // Find the delivery record
    const delivery = await this.deliveryRepository.findOne({
      where: { id: deliveryId },
      relations: ["notification"],
    });

    if (!delivery) {
      this.logger.error(`Delivery ${deliveryId} not found`);
      return;
    }

    // Prepare update data
    const updateData: Partial<NotificationDelivery> = {
      status,
      updatedAt: new Date(),
    };

    if (providerMessageId) {
      updateData.providerMessageId = providerMessageId;
    }

    if (providerResponse) {
      updateData.providerResponse = providerResponse;
    }

    if (errorMessage) {
      updateData.errorMessage = errorMessage;
    }

    if (metadata) {
      updateData.metadata = { ...delivery.metadata, ...metadata };
    }

    // Set timestamp based on status
    const now = new Date();
    switch (status) {
      case DeliveryStatus.SENT:
        updateData.sentAt = now;
        break;
      case DeliveryStatus.DELIVERED:
        updateData.deliveredAt = now;
        break;
      case DeliveryStatus.OPENED:
        updateData.openedAt = now;
        break;
      case DeliveryStatus.CLICKED:
        updateData.clickedAt = now;
        break;
    }

    // Update delivery record
    await this.deliveryRepository.update(
      deliveryId,
      updateData as QueryDeepPartialEntity<NotificationDelivery>,
    );

    // Update parent notification status
    await this.updateNotificationStatusFromDeliveries(delivery.messageId);

    // Log audit trail
    await this.auditLogService.logDeliveryStatusChange(
      deliveryId,
      delivery.status,
      status,
      delivery.message.tenantId,
      { providerMessageId, errorMessage, metadata },
    );

    // Send webhook notification if configured
    await this.webhookService.sendDeliveryStatusWebhook(delivery.message.tenantId, {
      deliveryId,
      notificationId: delivery.messageId,
      channel: delivery.channel,
      recipient: delivery.recipient,
      oldStatus: delivery.status,
      newStatus: status,
      timestamp: now,
      providerMessageId,
      errorMessage,
      metadata,
      tenantId: delivery.message.tenantId,
      projectId: delivery.message.metadata?.projectId || "unknown", // Try to get from metadata
    });

    this.logger.log(`Delivery ${deliveryId} status updated successfully`);
  }

  /**
   * Track delivery events (opens, clicks, etc.)
   */
  async trackDeliveryEvent(
    deliveryId: string,
    eventType: "opened" | "clicked" | "unsubscribed",
    metadata?: Record<string, any>,
  ): Promise<void> {
    const delivery = await this.deliveryRepository.findOne({
      where: { id: deliveryId },
      relations: ["notification"],
    });

    if (!delivery) {
      this.logger.error(`Delivery ${deliveryId} not found for event tracking`);
      return;
    }

    const now = new Date();
    const updateData: Partial<NotificationDelivery> = {
      updatedAt: now,
      metadata: { ...delivery.metadata, ...metadata },
    };

    let newStatus: DeliveryStatus;

    switch (eventType) {
      case "opened":
        updateData.openedAt = now;
        newStatus = DeliveryStatus.OPENED;
        break;
      case "clicked":
        updateData.clickedAt = now;
        newStatus = DeliveryStatus.CLICKED;
        break;
      case "unsubscribed":
        newStatus = DeliveryStatus.UNSUBSCRIBED;
        break;
    }

    updateData.status = newStatus;

    await this.deliveryRepository.update(
      deliveryId,
      updateData as QueryDeepPartialEntity<NotificationDelivery>,
    );

    // Log audit trail
    await this.auditLogService.logDeliveryEvent(
      deliveryId,
      eventType,
      delivery.message.tenantId,
      metadata,
    );

    // Send webhook notification
    await this.webhookService.sendDeliveryEventWebhook(delivery.message.tenantId, {
      deliveryId,
      notificationId: delivery.messageId,
      eventType,
      timestamp: now,
      metadata,
      tenantId: delivery.message.tenantId,
      projectId: delivery.message.metadata?.projectId || "unknown",
    });

    this.logger.log(`Delivery event ${eventType} tracked for delivery ${deliveryId}`);
  }

  /**
   * Get delivery tracking statistics for a tenant
   */
  async getDeliveryStats(
    tenantId: string,
    channel?: NotificationChannel,
    startDate?: Date,
    endDate?: Date,
  ): Promise<DeliveryTrackingStats> {
    const queryBuilder = this.deliveryRepository
      .createQueryBuilder("delivery")
      .innerJoin("delivery.notification", "notification")
      .where("notification.tenantId = :tenantId", { tenantId });

    if (channel) {
      queryBuilder.andWhere("delivery.channel = :channel", { channel });
    }

    if (startDate) {
      queryBuilder.andWhere("delivery.createdAt >= :startDate", { startDate });
    }

    if (endDate) {
      queryBuilder.andWhere("delivery.createdAt <= :endDate", { endDate });
    }

    const deliveries = await queryBuilder.getMany();

    const totalDeliveries = deliveries.length;
    const deliveredCount = deliveries.filter((d) => d.status === DeliveryStatus.DELIVERED).length;
    const failedCount = deliveries.filter(
      (d) => d.status === DeliveryStatus.FAILED || d.status === DeliveryStatus.BOUNCED,
    ).length;
    const pendingCount = deliveries.filter((d) => d.status === DeliveryStatus.PENDING).length;

    const deliveryRate = totalDeliveries > 0 ? (deliveredCount / totalDeliveries) * 100 : 0;
    const failureRate = totalDeliveries > 0 ? (failedCount / totalDeliveries) * 100 : 0;

    // Calculate average delivery time for delivered messages
    const deliveredMessages = deliveries.filter(
      (d) => d.status === DeliveryStatus.DELIVERED && d.sentAt && d.deliveredAt,
    );

    let averageDeliveryTime: number | undefined;
    if (deliveredMessages.length > 0) {
      const totalDeliveryTime = deliveredMessages.reduce((sum, delivery) => {
        const deliveryTime = delivery.deliveredAt!.getTime() - delivery.sentAt!.getTime();
        return sum + deliveryTime;
      }, 0);
      averageDeliveryTime = totalDeliveryTime / deliveredMessages.length;
    }

    return {
      totalDeliveries,
      deliveredCount,
      failedCount,
      pendingCount,
      deliveryRate: Math.round(deliveryRate * 100) / 100,
      failureRate: Math.round(failureRate * 100) / 100,
      averageDeliveryTime,
    };
  }

  /**
   * Get delivery history for a notification
   */
  async getDeliveryHistory(
    notificationId: string,
    tenantId?: string,
  ): Promise<NotificationDelivery[]> {
    const queryBuilder = this.deliveryRepository
      .createQueryBuilder("delivery")
      .where("delivery.messageId = :notificationId", { notificationId });

    if (tenantId) {
      queryBuilder
        .innerJoin("delivery.notification", "notification")
        .andWhere("notification.tenantId = :tenantId", { tenantId });
    }

    return queryBuilder.orderBy("delivery.createdAt", "ASC").getMany();
  }

  /**
   * Get real-time delivery status for multiple notifications
   */
  async getMultipleDeliveryStatus(
    notificationIds: string[],
    tenantId?: string,
  ): Promise<Record<string, NotificationDelivery[]>> {
    const queryBuilder = this.deliveryRepository
      .createQueryBuilder("delivery")
      .where("delivery.messageId IN (:...notificationIds)", {
        notificationIds,
      });

    if (tenantId) {
      queryBuilder
        .innerJoin("delivery.notification", "notification")
        .andWhere("notification.tenantId = :tenantId", { tenantId });
    }

    const deliveries = await queryBuilder.getMany();

    // Group deliveries by notification ID
    return deliveries.reduce(
      (acc, delivery) => {
        if (!acc[delivery.messageId]) {
          acc[delivery.messageId] = [];
        }
        acc[delivery.messageId].push(delivery);
        return acc;
      },
      {} as Record<string, NotificationDelivery[]>,
    );
  }

  /**
   * Private helper to update notification status based on deliveries
   */
  private async updateNotificationStatusFromDeliveries(notificationId: string): Promise<void> {
    const deliveries = await this.deliveryRepository.find({
      where: { messageId: notificationId },
    });

    if (deliveries.length === 0) {
      return;
    }

    // Determine overall notification status based on delivery statuses
    const deliveryStatuses = deliveries.map((d) => d.status);
    let notificationStatus: NotificationStatus;

    if (deliveryStatuses.every((status) => status === DeliveryStatus.DELIVERED)) {
      notificationStatus = NotificationStatus.DELIVERED;
    } else if (
      deliveryStatuses.some(
        (status) => status === DeliveryStatus.DELIVERED || status === DeliveryStatus.SENT,
      )
    ) {
      notificationStatus = NotificationStatus.SENT;
    } else if (
      deliveryStatuses.every(
        (status) => status === DeliveryStatus.FAILED || status === DeliveryStatus.BOUNCED,
      )
    ) {
      notificationStatus = NotificationStatus.FAILED;
    } else {
      notificationStatus = NotificationStatus.PROCESSING;
    }

    await this.messageRepository.update(notificationId, {
      status: notificationStatus,
      updatedAt: new Date(),
    });
  }
}
