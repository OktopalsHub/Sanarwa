import { NotificationChannel } from "../../../common/enums/notification-channel.enum";
import { Injectable, Logger } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { NotificationLog } from "../entities/notification-log.entity";
import { TenantSettings } from "../../tenant/entities/tenant-settings.entity";
import { Message, MessagePriority, MessageStatus } from "../../messaging/message.entity";
import {
  MessageDelivery,
  MessageDeliveryStatus,
  DeliveryEngagementStatus,
  DeliveryTransportStatus,
  applyDeliveryState,
} from "../../messaging/message-delivery.entity";
import { NotificationStoragePolicy } from "../enums/notification-storage-policy.enum";

export interface PersistSendContextInput {
  tenantId: string;
  projectId: string;
  channel: NotificationChannel;
  to: string;
  trackingId: string;
  title?: string;
  message: string;
  policy: NotificationStoragePolicy;
  priority?: "low" | "normal" | "high";
  scheduledAt?: Date;
  expiresAt?: Date;
  templateId?: string;
  brandId?: string;
  subscriberId?: string;
  metadata?: Record<string, any>;
  skipMessageRecord?: boolean;
}

export interface PersistSendContextResult {
  log: NotificationLog;
  message?: Message;
  delivery?: MessageDelivery;
}

@Injectable()
export class NotificationStorageService {
  private readonly logger = new Logger(NotificationStorageService.name);

  constructor(
    @InjectRepository(NotificationLog)
    private readonly logRepository: Repository<NotificationLog>,
    @InjectRepository(TenantSettings)
    private readonly tenantSettingsRepository: Repository<TenantSettings>,
    @InjectRepository(Message)
    private readonly messageRepository: Repository<Message>,
    @InjectRepository(MessageDelivery)
    private readonly deliveryRepository: Repository<MessageDelivery>,
  ) {}

  async getStoragePolicy(tenantId: string): Promise<NotificationStoragePolicy> {
    const settings = await this.tenantSettingsRepository.findOne({
      where: { tenantId },
    });

    return settings?.notificationStoragePolicy ?? NotificationStoragePolicy.METADATA_ONLY;
  }

  async getContentRetentionDays(tenantId: string): Promise<number> {
    const settings = await this.tenantSettingsRepository.findOne({
      where: { tenantId },
    });

    return (
      settings?.contentRetentionDays ??
      settings?.retentionPolicy?.notificationContentRetentionDays ??
      90
    );
  }

  async getMetadataRetentionDays(tenantId: string): Promise<number> {
    const settings = await this.tenantSettingsRepository.findOne({
      where: { tenantId },
    });

    return (
      settings?.retentionPolicy?.notificationMetadataRetentionDays ??
      settings?.retentionPolicy?.logsRetentionDays ??
      90
    );
  }

  shouldPersistBody(policy: NotificationStoragePolicy): boolean {
    return policy === NotificationStoragePolicy.FULL;
  }

  shouldPersistMetadata(policy: NotificationStoragePolicy): boolean {
    return policy !== NotificationStoragePolicy.EPHEMERAL;
  }

  async createTrackingLog(input: {
    tenantId: string;
    projectId: string;
    channel: NotificationChannel;
    to: string;
    trackingId: string;
    priority?: "low" | "normal" | "high";
    scheduledAt?: Date;
    templateId?: string;
    messageId?: string;
  }): Promise<NotificationLog> {
    return this.logRepository.save(
      this.logRepository.create({
        trackingId: input.trackingId,
        channel: input.channel,
        to: input.to,
        tenantId: input.tenantId,
        projectId: input.projectId,
        status: "queued",
        scheduledAt: input.scheduledAt,
        metadata: {
          templateId: input.templateId,
          priority: input.priority,
          messageId: input.messageId,
        },
      }),
    );
  }

  async persistSendContext(input: PersistSendContextInput): Promise<PersistSendContextResult> {
    const persistBody = this.shouldPersistBody(input.policy);
    const persistMetadata = this.shouldPersistMetadata(input.policy);

    const messagePriority = this.toMessagePriority(input.priority);

    let message: Message | undefined;
    let delivery: MessageDelivery | undefined;

    if (!input.skipMessageRecord) {
      message = await this.messageRepository.save(
        this.messageRepository.create({
          tenantId: input.tenantId,
          channels: [input.channel],
          recipients: [
            {
              id: input.subscriberId ?? input.to,
              userId: input.subscriberId,
            },
          ],
          templateId: input.templateId,
          variables: persistBody ? (input.metadata ?? {}) : {},
          subject: persistBody ? input.title : undefined,
          data: persistBody ? input.message : undefined,
          scheduledAt: input.scheduledAt,
          priority: messagePriority,
          status: input.scheduledAt ? MessageStatus.PENDING : MessageStatus.PROCESSING,
          metadata: {
            ...input.metadata,
            projectId: input.projectId,
            trackingId: input.trackingId,
            storagePolicy: input.policy,
            brandId: input.brandId,
          },
        }),
      );

      delivery = await this.deliveryRepository.save(
        this.deliveryRepository.create({
          tenantId: input.tenantId,
          messageId: message.id,
          channel: input.channel,
          providerId: "pending",
          recipient: input.to,
          status: MessageDeliveryStatus.PENDING,
          transportStatus: DeliveryTransportStatus.PENDING,
          engagementStatus: DeliveryEngagementStatus.UNKNOWN,
          stateUpdatedAt: new Date(),
          metadata: {
            trackingId: input.trackingId,
            projectId: input.projectId,
          },
        }),
      );
    }

    let log: NotificationLog;
    if (persistMetadata) {
      log = await this.logRepository.save(
        this.logRepository.create({
          trackingId: input.trackingId,
          channel: input.channel,
          to: input.to,
          tenantId: input.tenantId,
          projectId: input.projectId,
          status: "queued",
          scheduledAt: input.scheduledAt,
          metadata: {
            templateId: input.templateId,
            priority: input.priority,
            messageId: message?.id,
            deliveryId: delivery?.id,
          },
        }),
      );
    } else {
      log = {
        id: input.trackingId,
        trackingId: input.trackingId,
        channel: input.channel,
        to: input.to,
        tenantId: input.tenantId,
        projectId: input.projectId,
        status: "queued",
        createdAt: new Date(),
      } as NotificationLog;
    }

    return { log, message, delivery };
  }

  async updateDeliveryOutcome(
    deliveryId: string | undefined,
    logId: string | undefined,
    outcome: {
      status: "sent" | "delivered" | "failed";
      externalId?: string;
      error?: string;
      providerId?: string;
    },
  ): Promise<void> {
    if (!logId && deliveryId) {
      const row = await this.logRepository
        .createQueryBuilder("log")
        .where("log.metadata->>'deliveryId' = :deliveryId", { deliveryId })
        .getOne();
      if (row) {
        logId = row.id;
      }
    }
    if (deliveryId) {
      const deliveryStatus: MessageDeliveryStatus =
        outcome.status === "failed"
          ? MessageDeliveryStatus.FAILED
          : outcome.status === "delivered"
            ? MessageDeliveryStatus.DELIVERED
            : MessageDeliveryStatus.SENT;

      const delivery: Partial<MessageDelivery> = { status: deliveryStatus };
      if (deliveryStatus !== MessageDeliveryStatus.FAILED) {
        delivery.sentAt = new Date();
      }
      if (deliveryStatus === MessageDeliveryStatus.DELIVERED) {
        delivery.deliveredAt = new Date();
      }

      applyDeliveryState(delivery, { status: deliveryStatus });

      const deliveryUpdate: Record<string, any> = {
        status: delivery.status,
        transportStatus: delivery.transportStatus,
        engagementStatus: delivery.engagementStatus,
        stateUpdatedAt: delivery.stateUpdatedAt,
        providerMessageId: outcome.externalId,
        errorMessage: outcome.error,
        providerId: outcome.providerId ?? "auto-select",
      };
      if (delivery.sentAt) {
        deliveryUpdate.sentAt = delivery.sentAt;
      }
      if (delivery.deliveredAt) {
        deliveryUpdate.deliveredAt = delivery.deliveredAt;
      }

      await this.deliveryRepository.update(
        deliveryId,
        deliveryUpdate as Parameters<Repository<MessageDelivery>["update"]>[1],
      );
    }

    if (logId) {
      const logUpdate: Partial<NotificationLog> = {
        status: outcome.status,
        externalId: outcome.externalId,
        error: outcome.error,
      };
      if (outcome.status === "sent") logUpdate.sentAt = new Date();
      if (outcome.status === "delivered") logUpdate.deliveredAt = new Date();
      if (outcome.status === "failed") logUpdate.failedAt = new Date();

      await this.logRepository.update(logId, logUpdate);
    }
  }

  async finalizeEphemeral(messageId: string, logId?: string): Promise<void> {
    await this.messageRepository.update(messageId, {
      data: undefined,
      subject: undefined,
      variables: {},
    });

    if (logId) {
      await this.logRepository.delete(logId);
    }
  }

  private toMessagePriority(priority?: string): MessagePriority {
    switch (priority) {
      case "high":
        return MessagePriority.HIGH;
      case "low":
        return MessagePriority.LOW;
      case "urgent":
        return MessagePriority.URGENT;
      default:
        return MessagePriority.NORMAL;
    }
  }
}
