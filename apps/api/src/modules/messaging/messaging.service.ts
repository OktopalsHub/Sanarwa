import { BadRequestException, Injectable, Logger, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { In, Repository } from "typeorm";
import { getPaginationSummary } from "../../common/dto/pagination.dto";
import { IPaginatedData } from "../../common/interfaces";
import { BulkMessageDto, SendMessageDto } from "./dto/send-message.dto";
import { MessagePriority, MessageRecipient, MessageStatus } from "./message.entity";
import { MessageDeliveryRepository, MessageRepository } from "./repositories";
import { DigestService, DigestNotification } from "./services/digest.service";
import { SchedulingService, ScheduleConfig } from "./services/scheduling.service";
import { NotificationEngineService } from "../notifications/engine/notification-engine.service";
import { ChatProvider } from "../../common/enums/chat-provider.enum";
import { UnifiedSendService } from "./unified-send.service";
import { NotificationQueueService } from "./queue/notification-queue.service";
import { NotificationLog } from "../notifications/entities/notification-log.entity";
import { applyMessageLogFilters, mapLogsToMessageListRecords } from "./message-log.query";
import { NotificationChannel } from "../../common/enums/notification-channel.enum";
import { resolveAddress } from "./resolve-address";

@Injectable()
export class MessagingService {
  private readonly logger = new Logger(MessagingService.name);

  constructor(
    private readonly messageRepository: MessageRepository,
    private readonly messageDeliveryRepository: MessageDeliveryRepository,
    private readonly digestService: DigestService,
    private readonly schedulingService: SchedulingService,
    private readonly notificationEngine: NotificationEngineService,
    private readonly unifiedSendService: UnifiedSendService,
    private readonly notificationQueueService: NotificationQueueService,
    @InjectRepository(NotificationLog)
    private readonly logRepository: Repository<NotificationLog>,
  ) {}

  async sendMessage(sendMessageDto: SendMessageDto, tenantId?: string, idempotencyKey?: string) {
    if (!tenantId) {
      throw new BadRequestException("tenantId is required to send a message");
    }

    return this.unifiedSendService.send(
      {
        channels: sendMessageDto.channels,
        recipients: sendMessageDto.recipients,
        variables: sendMessageDto.variables,
        templateId: sendMessageDto.templateId,
        priority: sendMessageDto.priority,
        subject: sendMessageDto.subject,
        data: sendMessageDto.data,
        scheduledAt: sendMessageDto.scheduledAt
          ? new Date(sendMessageDto.scheduledAt).toISOString()
          : undefined,
        metadata: sendMessageDto.metadata,
        brandId: sendMessageDto.brandId,
        chatProvider: sendMessageDto.chatProvider,
        fallback: sendMessageDto.fallback,
      },
      tenantId,
      sendMessageDto.metadata?.projectId as string | undefined,
      idempotencyKey,
    );
  }

  async sendBulkMessages(bulkMessageDto: BulkMessageDto, tenantId?: string) {
    const results: any[] = [];
    let successCount = 0;
    let failedCount = 0;

    for (const messageDto of bulkMessageDto.messages) {
      try {
        const result = await this.sendMessage(messageDto, tenantId);
        results.push(result);
        successCount++;
      } catch (error) {
        failedCount++;
        this.logger.error("Failed to send message in bulk:", error.message, {
          error: error.stack,
          messageIndex: bulkMessageDto.messages.indexOf(messageDto),
          batchId: bulkMessageDto.batchId,
        });
      }
    }

    return {
      batchId: bulkMessageDto.batchId || `batch_${Date.now()}`,
      totalMessages: bulkMessageDto.messages.length,
      successCount,
      failedCount,
      messages: results,
    };
  }

  async getMessageStatus(messageId: string, tenantId?: string) {
    if (messageId.startsWith("msg_")) {
      throw new NotFoundException(
        "Status not available for immediate sends. Only scheduled messages have persistent status.",
      );
    }

    const whereCondition = tenantId ? { tenantId } : {};
    const message = await this.messageRepository.findById(messageId, false, whereCondition);

    if (!message) {
      throw new NotFoundException(`Message ${messageId} not found`);
    }

    return {
      id: message.id,
      status: message.status,
      channels: message.channels,
      recipients: message.recipients,
      createdAt: message.createdAt,
      scheduledAt: message.scheduledAt,
      deliveredAt: message.deliveredAt,
      errorMessage: message.errorMessage,
    };
  }

  async getDeliveryReports(messageId: string, tenantId?: string) {
    if (messageId.startsWith("msg_")) {
      throw new NotFoundException(
        "Delivery reports not available for immediate sends. Use provider webhooks for delivery tracking.",
      );
    }

    if (tenantId) {
      const message = await this.messageRepository.findById(messageId, false, {
        tenantId,
      });
      if (!message) {
        throw new NotFoundException(`Message ${messageId} not found`);
      }
    }

    return {
      messageId,
      note: "Detailed delivery tracking available via provider webhooks",
    };
  }

  async getTenantMessages(query: any, tenantId?: string): Promise<IPaginatedData<any>> {
    const page = Math.max(Number(query.page) || 1, 1);
    const limit = Math.min(Math.max(Number(query.limit) || 20, 1), 100);

    const qb = this.logRepository.createQueryBuilder("log");
    applyMessageLogFilters(qb, query, tenantId);

    qb.orderBy("log.createdAt", "DESC")
      .skip((page - 1) * limit)
      .take(limit);

    const [logs, total] = await qb.getManyAndCount();
    const messageIds = [
      ...new Set(
        logs.map((log) => log.metadata?.messageId).filter((id): id is string => Boolean(id)),
      ),
    ];
    const messages = messageIds.length
      ? await this.messageRepository.find({ where: { id: In(messageIds) } })
      : [];
    const records = mapLogsToMessageListRecords(logs, messages);

    return getPaginationSummary(records, total, { page, limit }, "messages");
  }

  async getMessageDetail(id: string, tenantId?: string) {
    const log = await this.findLog(id, tenantId);
    if (!log) {
      throw new NotFoundException(`Message ${id} not found`);
    }

    const messageId = log.metadata?.messageId;
    const message = messageId
      ? await this.messageRepository.findById(messageId, false, tenantId ? { tenantId } : {})
      : null;
    const deliveries = messageId
      ? await this.messageDeliveryRepository.findByMessageId(messageId)
      : [];

    const events = this.buildTimeline(log, deliveries);
    const hasContent = Boolean(message?.data || message?.subject);

    return {
      id: log.id,
      trackingId: log.trackingId,
      channel: log.channel,
      to: log.to,
      status: log.status,
      projectId: log.projectId,
      messageId,
      error: log.error,
      createdAt: log.createdAt,
      sentAt: log.sentAt,
      deliveredAt: log.deliveredAt,
      failedAt: log.failedAt,
      scheduledAt: log.scheduledAt,
      subject: message?.subject ?? null,
      data: hasContent ? (message?.data ?? null) : null,
      hasContent,
      events,
      deliveries: deliveries.map((delivery) => ({
        id: delivery.id,
        channel: delivery.channel,
        recipient: delivery.recipient,
        status: delivery.status,
        providerId: delivery.providerId,
        providerMessageId: delivery.providerMessageId,
        providerResponse: delivery.providerResponse,
        errorMessage: delivery.errorMessage,
        sentAt: delivery.sentAt,
        deliveredAt: delivery.deliveredAt,
        openedAt: delivery.openedAt,
        clickedAt: delivery.clickedAt,
      })),
    };
  }

  private async findLog(id: string, tenantId?: string) {
    const scoped = tenantId ? { tenantId } : {};
    const byId = await this.logRepository.findOne({ where: { id, ...scoped } });
    if (byId) return byId;

    const byTracking = await this.logRepository.findOne({
      where: { trackingId: id, ...scoped },
    });
    if (byTracking) return byTracking;

    const qb = this.logRepository.createQueryBuilder("log");
    qb.where("log.metadata->>'messageId' = :id", { id });
    if (tenantId) {
      qb.andWhere("log.tenantId = :tenantId", { tenantId });
    }
    return qb.getOne();
  }

  private buildTimeline(
    log: NotificationLog,
    deliveries: Array<{
      status: string;
      sentAt?: Date;
      deliveredAt?: Date;
      openedAt?: Date;
      clickedAt?: Date;
      errorMessage?: string;
      providerResponse?: unknown;
    }>,
  ) {
    const events: Array<{
      type: string;
      at: Date;
      error?: string;
      detail?: unknown;
    }> = [{ type: "queued", at: log.createdAt }];

    if (log.sentAt) events.push({ type: "sent", at: log.sentAt });
    if (log.deliveredAt) events.push({ type: "delivered", at: log.deliveredAt });
    if (log.failedAt) {
      events.push({ type: "failed", at: log.failedAt, error: log.error });
    }

    for (const delivery of deliveries) {
      if (delivery.openedAt) {
        events.push({ type: "opened", at: delivery.openedAt });
      }
      if (delivery.clickedAt) {
        events.push({ type: "clicked", at: delivery.clickedAt });
      }
      if (delivery.status === "bounced") {
        events.push({
          type: "bounced",
          at: delivery.deliveredAt ?? log.createdAt,
          error: delivery.errorMessage,
          detail: delivery.providerResponse,
        });
      }
    }

    return events.sort((a, b) => a.at.getTime() - b.at.getTime());
  }

  async cancelMessage(messageId: string, tenantId?: string) {
    const whereCondition = tenantId ? { tenantId } : {};
    const message = await this.messageRepository.findById(messageId, false, whereCondition);

    if (!message) {
      throw new NotFoundException(`Message ${messageId} not found`);
    }

    if (message.status !== MessageStatus.PENDING) {
      throw new Error(`Cannot cancel message with status: ${message.status}`);
    }

    await this.messageRepository.update(messageId, {
      status: MessageStatus.CANCELLED,
    });
  }

  /**
   * Edits a still-scheduled message (title/body/data/priority, and its send
   * time). Sending started messages cannot be edited — the delivery is
   * already in flight. Moving `scheduledAt` also moves the delayed job.
   */
  async updateScheduledMessage(
    messageId: string,
    patch: {
      data?: string;
      subject?: string;
      variables?: Record<string, unknown>;
      priority?: MessagePriority;
      scheduledAt?: Date;
    },
    tenantId?: string,
  ) {
    const whereCondition = tenantId ? { tenantId } : {};
    const message = await this.messageRepository.findById(messageId, true, whereCondition);

    if (!message) {
      throw new NotFoundException(`Message ${messageId} not found`);
    }

    if (message.status !== MessageStatus.PENDING) {
      throw new BadRequestException(
        `Cannot edit message with status: ${message.status}; only scheduled messages can be edited`,
      );
    }

    await this.messageRepository.update(messageId, {
      data: patch.data ?? message.data,
      subject: patch.subject ?? message.subject,
      variables: patch.variables ?? message.variables,
      priority: patch.priority ?? message.priority,
      scheduledAt: patch.scheduledAt ?? message.scheduledAt,
    });

    if (patch.scheduledAt) {
      await this.notificationQueueService.rescheduleNotificationJob(messageId, patch.scheduledAt);
    }

    return this.messageRepository.findById(messageId, true, whereCondition);
  }

  async getDeliveryStats(query: any, tenantId?: string) {
    const qb = this.logRepository.createQueryBuilder("log");
    applyMessageLogFilters(qb, query, tenantId);

    const logs = await qb.getMany();
    const sent = logs.filter((log) => ["sent", "delivered"].includes(log.status)).length;
    const delivered = logs.filter((log) => log.status === "delivered").length;
    const failed = logs.filter((log) => log.status === "failed").length;
    const queued = logs.filter((log) => log.status === "queued").length;

    return {
      total: logs.length,
      sent,
      delivered,
      failed,
      queued,
      deliveryRate: sent > 0 ? Math.round((delivered / sent) * 1000) / 10 : 0,
    };
  }

  async processMessage(messageId: string) {
    const message = await this.messageRepository.findById(messageId);
    if (!message) {
      throw new NotFoundException(`Message ${messageId} not found`);
    }

    await this.messageRepository.update(messageId, {
      status: MessageStatus.PROCESSING,
    });

    const projectId =
      typeof message.metadata?.projectId === "string" ? message.metadata.projectId : undefined;

    if (!projectId) {
      await this.messageRepository.update(messageId, {
        status: MessageStatus.FAILED,
        errorMessage: "Scheduled message is missing project scope",
      });
      return;
    }

    const deliveries: Array<{
      channel: string;
      status: "delivered" | "failed";
      error?: string;
    }> = [];

    const resolveAddressLocal = (
      recipient: (typeof message.recipients)[number],
      channel: string,
    ) => {
      const result = resolveAddress(
        recipient as never,
        channel as NotificationChannel,
        (typeof message.metadata?.chatProvider === "string"
          ? message.metadata.chatProvider
          : undefined) as ChatProvider | undefined,
      );
      return result ?? undefined;
    };

    for (const channel of message.channels) {
      for (const recipient of message.recipients) {
        const to = resolveAddressLocal(recipient, channel);
        if (!to) {
          deliveries.push({
            channel,
            status: "failed",
            error: "Missing recipient address for channel",
          });
          continue;
        }

        try {
          const result = await this.notificationEngine.send({
            tenantId: message.tenantId,
            projectId,
            channel,
            to,
            title: message.subject,
            message: message.data ?? "",
            variables: message.variables,
            templateId: message.templateId,
            priority:
              message.priority === MessagePriority.LOW
                ? "low"
                : message.priority === MessagePriority.HIGH ||
                    message.priority === MessagePriority.URGENT
                  ? "high"
                  : "normal",
            subscriberId: recipient.userId ?? recipient.id,
            chatProvider:
              typeof message.metadata?.chatProvider === "string"
                ? (message.metadata.chatProvider as ChatProvider)
                : undefined,
            brandId:
              typeof message.metadata?.brandId === "string" ? message.metadata.brandId : undefined,
            metadata: message.metadata,
          });

          deliveries.push({
            channel,
            status: result.status === "failed" ? "failed" : "delivered",
            error: result.error,
          });
        } catch (error) {
          deliveries.push({
            channel,
            status: "failed",
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }
    }

    const hasFailures = deliveries.some((delivery) => delivery.status === "failed");
    const hasSuccess = deliveries.some((delivery) => delivery.status === "delivered");
    const finalStatus =
      hasSuccess && hasFailures
        ? MessageStatus.PARTIALLY_DELIVERED
        : hasSuccess
          ? MessageStatus.DELIVERED
          : MessageStatus.FAILED;

    await this.messageRepository.update(messageId, {
      status: finalStatus,
      deliveredAt: hasSuccess ? new Date() : undefined,
      errorMessage: hasFailures ? "Some scheduled deliveries failed" : undefined,
    });

    this.logger.log(`Processed scheduled message ${messageId}: ${finalStatus}`);
  }

  async sendExternalNotification(request: {
    tenantId: string;
    templateId?: string;
    channels: string[];
    recipients: Array<{
      email?: string;
      phone?: string;
      userId?: string;
    }>;
    variables: Record<string, any>;
    subject?: string;
    data?: string;
    priority?: string;
    scheduledAt?: Date;
    metadata?: Record<string, any>;
  }) {
    return this.sendMessage(
      {
        channels: request.channels as any,
        recipients: request.recipients as any,
        templateId: request.templateId,
        variables: request.variables,
        subject: request.subject,
        data: request.data,
        priority: request.priority as any,
        scheduledAt: request.scheduledAt,
        metadata: request.metadata,
      },
      request.tenantId,
    );
  }

  async sendWithDigest(
    sendMessageDto: SendMessageDto,
    tenantId: string,
    frequency: "instant" | "daily" | "weekly" | "monthly" = "instant",
  ) {
    const digestConfig = this.digestService.getDigestConfig(frequency);
    if (!digestConfig) {
      throw new Error(`Invalid digest frequency: ${frequency}`);
    }

    if (frequency === "instant") {
      return this.sendMessage(sendMessageDto, tenantId);
    }

    for (const recipient of sendMessageDto.recipients) {
      const subscriberId = recipient.userId || recipient.id;
      if (!subscriberId) continue;

      for (const channel of sendMessageDto.channels) {
        const contentText =
          typeof sendMessageDto.data === "string"
            ? sendMessageDto.data
            : ((sendMessageDto.data as any)?.text ?? "");

        const digestNotification: DigestNotification = {
          id: `notif_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          subscriberId,
          tenantId,
          channel,
          title: sendMessageDto.subject || "",
          data: contentText,
          variables: sendMessageDto.variables,
          createdAt: new Date(),
          templateId: sendMessageDto.templateId,
        };

        await this.digestService.queueNotificationForDigest(digestNotification, digestConfig);
      }
    }

    return {
      status: "queued_for_digest",
      frequency,
      recipientCount: sendMessageDto.recipients.length,
      message: `Notifications queued for ${frequency} digest delivery`,
    };
  }

  async getDigestStats() {
    return this.digestService.getQueueStats();
  }

  async getPendingDigests(subscriberId: string, tenantId: string) {
    return this.digestService.getPendingDigests(subscriberId, tenantId);
  }

  async scheduleNotification(
    sendMessageDto: SendMessageDto,
    tenantId: string,
    scheduleConfig: ScheduleConfig,
  ) {
    const scheduled: any[] = [];

    for (const recipient of sendMessageDto.recipients) {
      const subscriberId = recipient.userId || recipient.id;
      if (!subscriberId) continue;

      for (const channel of sendMessageDto.channels) {
        const notification = {
          id: `sched_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          subscriberId,
          tenantId,
          channel,
          data: sendMessageDto.data,
          metadata: {
            ...sendMessageDto.metadata,
            templateId: sendMessageDto.templateId,
            subject: sendMessageDto.subject,
          },
        };

        const scheduledNotif = await this.schedulingService.scheduleNotification(
          notification as any,
          scheduleConfig,
        );

        scheduled.push(scheduledNotif);
      }
    }

    return {
      status: "scheduled",
      timezone: scheduleConfig.timezone,
      sendTime: scheduleConfig.sendTime,
      notificationCount: scheduled.length,
      notifications: scheduled,
    };
  }

  async getSchedulingStats() {
    return this.schedulingService.getSchedulingStats();
  }

  async getPendingScheduledNotifications(subscriberId: string, tenantId: string) {
    return this.schedulingService.getPendingNotifications(subscriberId, tenantId);
  }

  async getReadyNotifications() {
    return this.schedulingService.getReadyNotifications();
  }

  async cancelScheduledNotification(notificationId: string) {
    await this.schedulingService.cancelNotification(notificationId);
    return { status: "cancelled", notificationId };
  }

  isValidTimezone(timezone: string): boolean {
    return this.schedulingService.isValidTimezone(timezone);
  }

  getValidTimezones(): string[] {
    return this.schedulingService.getValidTimezones();
  }
}
