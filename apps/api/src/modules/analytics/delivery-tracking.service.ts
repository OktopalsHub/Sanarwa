import { Injectable, Logger } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { QueryDeepPartialEntity } from "typeorm/query-builder/QueryPartialEntity";
import {
  MessageDeliveryStatus as DeliveryStatus,
  MessageDelivery as NotificationDelivery,
  applyDeliveryState,
  resolveDeliveryStatus,
} from "../messaging/message-delivery.entity";
import {
  Message as Notification,
  MessageStatus as NotificationStatus,
} from "../messaging/message.entity";
import { NotificationChannel } from "../../common/enums/notification-channel.enum";
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

  async updateDeliveryStatus(update: DeliveryStatusUpdate): Promise<void> {
    const { deliveryId, status, providerMessageId, providerResponse, errorMessage, metadata } =
      update;

    this.logger.log(`Updating delivery ${deliveryId} status to ${status}`);

    const delivery = await this.deliveryRepository.findOne({
      where: { id: deliveryId },
      relations: { message: true },
    });

    if (!delivery) {
      this.logger.error(`Delivery ${deliveryId} not found`);
      return;
    }

    const now = new Date();
    const deliveryState: Partial<NotificationDelivery> = { status };
    if (status === DeliveryStatus.SENT) {
      deliveryState.sentAt = now;
    } else if (status === DeliveryStatus.DELIVERED) {
      deliveryState.deliveredAt = now;
    } else if (status === DeliveryStatus.OPENED) {
      deliveryState.openedAt = now;
    } else if (status === DeliveryStatus.CLICKED) {
      deliveryState.clickedAt = now;
    }

    applyDeliveryState(deliveryState, { status });

    const updateData: Partial<NotificationDelivery> = {
      status: deliveryState.status,
      transportStatus: deliveryState.transportStatus,
      engagementStatus: deliveryState.engagementStatus,
      stateUpdatedAt: deliveryState.stateUpdatedAt,
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

    if (deliveryState.sentAt) {
      updateData.sentAt = deliveryState.sentAt;
    }
    if (deliveryState.deliveredAt) {
      updateData.deliveredAt = deliveryState.deliveredAt;
    }
    if (deliveryState.openedAt) {
      updateData.openedAt = deliveryState.openedAt;
    }
    if (deliveryState.clickedAt) {
      updateData.clickedAt = deliveryState.clickedAt;
    }

    await this.deliveryRepository.update(
      deliveryId,
      updateData as QueryDeepPartialEntity<NotificationDelivery>,
    );

    await this.updateNotificationStatusFromDeliveries(delivery.messageId);

    await this.auditLogService.logDeliveryStatusChange(
      deliveryId,
      delivery.status,
      status,
      delivery.message.tenantId,
      { providerMessageId, errorMessage, metadata },
    );

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
      projectId: delivery.message.metadata?.projectId || "unknown",
    });

    this.logger.log(`Delivery ${deliveryId} status updated successfully`);
  }

  async trackDeliveryEvent(
    deliveryId: string,
    eventType: "opened" | "clicked" | "unsubscribed",
    metadata?: Record<string, any>,
  ): Promise<void> {
    const delivery = await this.deliveryRepository.findOne({
      where: { id: deliveryId },
      relations: { message: true },
    });

    if (!delivery) {
      this.logger.error(`Delivery ${deliveryId} not found for event tracking`);
      return;
    }

    const now = new Date();
    let newStatus: DeliveryStatus;
    const deliveryState: Partial<NotificationDelivery> = {};

    switch (eventType) {
      case "opened":
        newStatus = DeliveryStatus.OPENED;
        deliveryState.openedAt = now;
        break;
      case "clicked":
        newStatus = DeliveryStatus.CLICKED;
        deliveryState.openedAt = delivery.openedAt ?? now;
        deliveryState.clickedAt = now;
        break;
      case "unsubscribed":
        newStatus = DeliveryStatus.UNSUBSCRIBED;
        break;
    }

    applyDeliveryState(deliveryState, { status: newStatus });

    const updateData: Partial<NotificationDelivery> = {
      status: deliveryState.status,
      transportStatus: deliveryState.transportStatus,
      engagementStatus: deliveryState.engagementStatus,
      stateUpdatedAt: deliveryState.stateUpdatedAt,
      updatedAt: now,
    };

    if (deliveryState.openedAt) {
      updateData.openedAt = deliveryState.openedAt;
    }
    if (deliveryState.clickedAt) {
      updateData.clickedAt = deliveryState.clickedAt;
    }

    if (metadata) {
      updateData.metadata = { ...delivery.metadata, ...metadata };
    }

    await this.deliveryRepository.update(
      deliveryId,
      updateData as QueryDeepPartialEntity<NotificationDelivery>,
    );

    await this.auditLogService.logDeliveryEvent(
      deliveryId,
      eventType,
      delivery.message.tenantId,
      metadata,
    );

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

  async getDeliveryStats(
    tenantId: string,
    channel?: NotificationChannel,
    startDate?: Date,
    endDate?: Date,
  ): Promise<DeliveryTrackingStats> {
    const queryBuilder = this.deliveryRepository
      .createQueryBuilder("delivery")
      .innerJoin("delivery.message", "message")
      .where("message.tenantId = :tenantId", { tenantId });

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
    const deliveredCount = deliveries.filter(
      (d) => resolveDeliveryStatus(d) === DeliveryStatus.DELIVERED,
    ).length;
    const failedCount = deliveries.filter(
      (d) =>
        resolveDeliveryStatus(d) === DeliveryStatus.FAILED ||
        resolveDeliveryStatus(d) === DeliveryStatus.BOUNCED,
    ).length;
    const pendingCount = deliveries.filter(
      (d) => resolveDeliveryStatus(d) === DeliveryStatus.PENDING,
    ).length;

    const deliveryRate = totalDeliveries > 0 ? (deliveredCount / totalDeliveries) * 100 : 0;
    const failureRate = totalDeliveries > 0 ? (failedCount / totalDeliveries) * 100 : 0;

    const deliveredMessages = deliveries.filter(
      (d) => resolveDeliveryStatus(d) === DeliveryStatus.DELIVERED && d.sentAt && d.deliveredAt,
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

  async getDeliveryHistory(
    notificationId: string,
    tenantId?: string,
  ): Promise<NotificationDelivery[]> {
    const queryBuilder = this.deliveryRepository
      .createQueryBuilder("delivery")
      .where("delivery.messageId = :notificationId", { notificationId });

    if (tenantId) {
      queryBuilder
        .innerJoin("delivery.message", "message")
        .andWhere("message.tenantId = :tenantId", { tenantId });
    }

    return queryBuilder.orderBy("delivery.createdAt", "ASC").getMany();
  }

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
        .innerJoin("delivery.message", "message")
        .andWhere("message.tenantId = :tenantId", { tenantId });
    }

    const deliveries = await queryBuilder.getMany();

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

  private async updateNotificationStatusFromDeliveries(notificationId: string): Promise<void> {
    const deliveries = await this.deliveryRepository.find({
      where: { messageId: notificationId },
    });

    if (deliveries.length === 0) {
      return;
    }

    const deliveryStatuses = deliveries.map((d) => resolveDeliveryStatus(d));
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
        (status) =>
          status === DeliveryStatus.FAILED ||
          status === DeliveryStatus.BOUNCED ||
          status === DeliveryStatus.SKIPPED ||
          status === DeliveryStatus.UNSUBSCRIBED,
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
