import { Injectable, Logger } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { EventEmitter2 } from "@nestjs/event-emitter";
import { NotificationLog } from "../entities/notification-log.entity";
import { NotificationCenterItem } from "../entities/notification-center.entity";
import { TenantSettings } from "../../tenant/entities/tenant-settings.entity";
import { Message, MessagePriority, MessageStatus } from "../../messaging/message.entity";
import { MessageDelivery, MessageDeliveryStatus } from "../../messaging/message-delivery.entity";
import { NotificationStoragePolicy } from "../enums/notification-storage-policy.enum";
import { NotificationChannel } from "../engine/notification-engine.types";

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
  centerItem?: NotificationCenterItem;
}

@Injectable()
export class NotificationStorageService {
  private readonly logger = new Logger(NotificationStorageService.name);

  constructor(
    @InjectRepository(NotificationLog)
    private readonly logRepository: Repository<NotificationLog>,
    @InjectRepository(NotificationCenterItem)
    private readonly centerRepository: Repository<NotificationCenterItem>,
    @InjectRepository(TenantSettings)
    private readonly tenantSettingsRepository: Repository<TenantSettings>,
    @InjectRepository(Message)
    private readonly messageRepository: Repository<Message>,
    @InjectRepository(MessageDelivery)
    private readonly deliveryRepository: Repository<MessageDelivery>,
    private readonly eventEmitter: EventEmitter2,
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

    const messageChannel = this.toMessageChannel(input.channel);
    const messagePriority = this.toMessagePriority(input.priority);

    let message: Message | undefined;
    let delivery: MessageDelivery | undefined;

    if (messageChannel && !input.skipMessageRecord) {
      message = await this.messageRepository.save(
        this.messageRepository.create({
          tenantId: input.tenantId,
          channels: [messageChannel],
          recipients: [
            {
              id: input.subscriberId ?? input.to,
              userId: input.subscriberId,
            },
          ],
          templateId: input.templateId,
          data: persistBody ? (input.metadata ?? {}) : {},
          subject: persistBody ? input.title : undefined,
          content: persistBody ? input.message : undefined,
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
          messageId: message.id,
          channel: messageChannel,
          providerId: "pending",
          recipient: input.to,
          status: MessageDeliveryStatus.PENDING,
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

    let centerItem: NotificationCenterItem | undefined;
    if (persistBody && this.isInAppChannel(input.channel)) {
      centerItem = await this.writeNotificationCenter({
        tenantId: input.tenantId,
        subscriberId: input.subscriberId ?? input.to,
        title: input.title ?? "Notification",
        content: input.message,
        channel: input.channel,
        templateId: input.templateId,
        messageId: message?.id,
        expiresAt: input.expiresAt ?? (await this.buildExpiresAt(input.tenantId)),
        metadata: input.metadata,
      });
    }

    return { log, message, delivery, centerItem };
  }

  async writeNotificationCenter(input: {
    tenantId: string;
    subscriberId: string;
    title: string;
    content: string;
    channel: string;
    templateId?: string;
    messageId?: string;
    expiresAt?: Date;
    metadata?: Record<string, any>;
    actionUrl?: string;
    imageUrl?: string;
  }): Promise<NotificationCenterItem> {
    const expiresAt = input.expiresAt ?? (await this.buildExpiresAt(input.tenantId));

    const item = await this.centerRepository.save(
      this.centerRepository.create({
        tenantId: input.tenantId,
        subscriberId: input.subscriberId,
        title: input.title,
        content: input.content,
        channel: input.channel,
        templateId: input.templateId,
        messageId: input.messageId,
        expiresAt,
        metadata: input.metadata,
        actionUrl: input.actionUrl,
        imageUrl: input.imageUrl,
      }),
    );

    this.eventEmitter.emit("notification.created", {
      subscriberId: input.subscriberId,
      notification: item,
    });

    return item;
  }

  async writeFullStorageInApp(input: {
    tenantId: string;
    subscriberId: string;
    title: string;
    content: string;
    channel: string;
    templateId?: string;
    messageId?: string;
    expiresAt?: Date;
    metadata?: Record<string, any>;
  }): Promise<NotificationCenterItem | undefined> {
    return this.writeNotificationCenter(input);
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
    if (deliveryId) {
      const deliveryUpdate: Partial<MessageDelivery> = {
        status:
          outcome.status === "failed"
            ? MessageDeliveryStatus.FAILED
            : outcome.status === "delivered"
              ? MessageDeliveryStatus.DELIVERED
              : MessageDeliveryStatus.SENT,
        providerMessageId: outcome.externalId,
        errorMessage: outcome.error,
        providerId: outcome.providerId ?? "auto-select",
      };

      if (outcome.status === "sent" || outcome.status === "delivered") {
        deliveryUpdate.sentAt = new Date();
      }
      if (outcome.status === "delivered") {
        deliveryUpdate.deliveredAt = new Date();
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
      content: undefined,
      subject: undefined,
      data: {},
    });

    if (logId) {
      await this.logRepository.delete(logId);
    }
  }

  private async buildExpiresAt(tenantId: string): Promise<Date> {
    const days = await this.getContentRetentionDays(tenantId);
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + days);
    return expiresAt;
  }

  private isInAppChannel(channel: NotificationChannel): boolean {
    return channel === "in_app";
  }

  private toMessageChannel(channel: NotificationChannel): Message["channels"][number] | null {
    switch (channel) {
      case "email":
        return "email" as Message["channels"][number];
      case "sms":
        return "sms" as Message["channels"][number];
      case "push":
        return "push" as Message["channels"][number];
      case "whatsapp":
        return "whatsapp" as Message["channels"][number];
      default:
        return null;
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
