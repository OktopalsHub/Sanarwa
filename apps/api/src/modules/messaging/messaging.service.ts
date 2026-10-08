import { Injectable, Logger, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { In, Repository } from "typeorm";
import { getPaginationSummary } from "../../common/dto/pagination.dto";
import { IPaginatedData } from "../../common/interfaces";
import { BulkMessageDto, SendMessageDto } from "./dto/send-message.dto";
import { MessageStatus } from "./message.entity";
import { MessageDeliveryRepository, MessageRepository } from "./repositories";
import { DigestService, DigestNotification } from "./services/digest.service";
import { SchedulingService, ScheduleConfig } from "./services/scheduling.service";
import { NotificationEngineService } from "../notifications/engine/notification-engine.service";
import { NotificationLog } from "../notifications/entities/notification-log.entity";
import { applyMessageLogFilters, mapLogsToMessageListRecords } from "./message-log.query";

@Injectable()
export class MessagingService {
  private readonly logger = new Logger(MessagingService.name);

  constructor(
    private readonly messageRepository: MessageRepository,
    private readonly messageDeliveryRepository: MessageDeliveryRepository,
    private readonly digestService: DigestService,
    private readonly schedulingService: SchedulingService,
    private readonly notificationEngine: NotificationEngineService,
    @InjectRepository(NotificationLog)
    private readonly logRepository: Repository<NotificationLog>,
  ) {}

  /**
   * Filter recipients based on subscriber preferences
   */
  private async filterRecipientsByPreferences(
    recipients: any[],
    channels: string[],
    tenantId: string,
  ): Promise<any[]> {
    const filteredRecipients: any[] = [];

    for (const recipient of recipients) {
      const subscriberId = recipient.subscriberId || recipient.userId;

      if (!subscriberId) {
        // No subscriber ID, include recipient
        filteredRecipients.push(recipient);
        continue;
      }

      // Transport system: include all recipients without preference checking
      filteredRecipients.push(recipient);
    }

    return filteredRecipients;
  }

  /**
   * Filter channels based on subscriber preferences
   */
  private async filterChannelsByPreferences(
    channels: string[],
    subscriberId: string,
    tenantId: string,
  ): Promise<string[]> {
    // Transport system: return all channels without preference checking
    return channels;
  }

  async sendMessage(sendMessageDto: SendMessageDto, tenantId?: string) {
    const metadata = {
      ...sendMessageDto.metadata,
      ...(sendMessageDto.brandId && { brandId: sendMessageDto.brandId }),
    };

    const filteredRecipients = await this.filterRecipientsByPreferences(
      sendMessageDto.recipients,
      sendMessageDto.channels,
      tenantId || "default",
    );

    if (filteredRecipients.length === 0) {
      this.logger.warn(
        "No recipients passed preference filters for channels: " +
          sendMessageDto.channels.join(", "),
      );
      return {
        id: `msg_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
        status: MessageStatus.FAILED,
        channels: sendMessageDto.channels,
        recipientCount: 0,
        deliveries: [],
        createdAt: new Date(),
        message: "No recipients passed preference filters",
      };
    }

    return this.notificationEngine.sendMessagingRequest({
      tenantId: tenantId || "default",
      projectId:
        (sendMessageDto.metadata?.projectId as string | undefined) ?? tenantId ?? "default",
      channels: sendMessageDto.channels,
      recipients: filteredRecipients,
      subject: sendMessageDto.subject,
      content: sendMessageDto.content,
      data: sendMessageDto.data,
      templateId: sendMessageDto.templateId,
      priority: sendMessageDto.priority,
      brandId: sendMessageDto.brandId,
      scheduledAt: sendMessageDto.scheduledAt,
      metadata,
    });
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

  /**
   * Get message status - ONLY for scheduled messages
   * Immediate sends don't have persistent status
   */
  async getMessageStatus(messageId: string, tenantId?: string) {
    // Check if this is a transient ID (immediate send)
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

  /**
   * Get delivery reports - ONLY for scheduled messages
   * Immediate sends don't store delivery records
   */
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

    // For scheduled messages, return basic info without detailed delivery records
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
    const hasContent = Boolean(message?.content || message?.subject);

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
      content: hasContent ? (message?.content ?? null) : null,
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

  /**
   * Process scheduled messages only (called by scheduler/cron)
   */
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

    const resolveAddress = (recipient: (typeof message.recipients)[number], channel: string) => {
      switch (channel.toLowerCase()) {
        case "email":
          return recipient.email;
        case "sms":
          return recipient.phone;
        case "whatsapp":
          return recipient.whatsappNumber ?? recipient.phone;
        case "push":
          return recipient.deviceToken ?? recipient.userId ?? recipient.id;
        case "in_app":
        case "inapp":
          return recipient.userId ?? recipient.id;
        case "webhook":
          return recipient.id;
        default:
          return undefined;
      }
    };

    for (const channel of message.channels) {
      for (const recipient of message.recipients) {
        const to = resolveAddress(recipient, channel);
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
            channel: channel.toLowerCase() === "inapp" ? "in_app" : channel.toLowerCase() as
              | "email"
              | "sms"
              | "push"
              | "whatsapp"
              | "webhook"
              | "in_app",
            to,
            title: message.subject,
            message: message.content ?? "",
            data: message.data,
            templateId: message.templateId,
            priority: message.priority,
            subscriberId: recipient.userId ?? recipient.id,
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

  /**
   * DIRECT SEND METHODS - Transport mode (no storage)
   */

  // private async sendEmailDirect(messageData: any) {
  //   const emailPayload = {
  //     to: messageData.recipients.map(r => r.email).filter(Boolean),
  //     subject: messageData.subject,
  //     html: messageData.content?.html,
  //     text: messageData.content?.text,
  //     from: messageData.metadata?.fromEmail,
  //     templateId: messageData.templateId,
  //     templateData: messageData.data,
  //   };

  //   const brandId = messageData.metadata?.brandId;
  //   return this.quotaAwareOrchestrator.sendEmail(emailPayload, messageData.tenantId, brandId);
  // }

  // private async sendSMSDirect(messageData: any) {
  //   const smsPayload = {
  //     to: messageData.recipients.map(r => r.phone).filter(Boolean),
  //     message: messageData.content?.text || messageData.subject,
  //     templateId: messageData.templateId,
  //     templateData: messageData.data,
  //   };

  //   return this.quotaAwareOrchestrator.sendSMS(smsPayload, messageData.tenantId);
  // }

  // private async sendPushDirect(messageData: any) {
  //   const pushPayload = {
  //     deviceTokens: messageData.recipients.map(r => r.pushToken).filter(Boolean),
  //     title: messageData.subject,
  //     body: messageData.content?.text,
  //     data: messageData.data,
  //     templateId: messageData.templateId,
  //   };

  //   const brandId = messageData.metadata?.brandId;
  //   return this.quotaAwareOrchestrator.sendPushNotification(pushPayload, messageData.tenantId, brandId);
  // }

  // private async sendWhatsAppDirect(messageData: any) {
  //   const whatsappPayload = {
  //     channel: 'whatsapp',
  //     to: messageData.recipients.map(r => r.phone).filter(Boolean),
  //     message: messageData.content?.text || messageData.subject,
  //     templateId: messageData.templateId,
  //     templateData: messageData.data,
  //   };

  //   return this.quotaAwareOrchestrator.sendChatMessage(whatsappPayload, 'whatsapp', messageData.tenantId);
  // }

  // private async sendInAppDirect(messageData: any) {
  //   const inAppPayload = {
  //     userId: messageData.recipients.map(r => r.userId).filter(Boolean)[0] || '',
  //     message: messageData.content?.text || messageData.subject,
  //     title: messageData.subject,
  //     data: messageData.data,
  //     templateId: messageData.templateId,
  //   };

  //   return this.quotaAwareOrchestrator.sendInAppNotification(inAppPayload);
  // }

  // private async sendVoiceDirect(messageData: any) {
  //   const voicePayload = {
  //     to: messageData.recipients.map(r => r.phone).filter(Boolean),
  //     message: messageData.content?.text || messageData.subject,
  //     templateId: messageData.templateId,
  //     templateData: messageData.data,
  //   };

  //   return this.quotaAwareOrchestrator.sendVoiceCall(voicePayload, messageData.tenantId);
  // }

  /**
   * SCHEDULED MESSAGE PROCESSING - Only for stored scheduled messages
   */

  // private async processEmailChannel(message: any) {
  //   const emailPayload = {
  //     to: message.recipients.map(r => r.email).filter(Boolean),
  //     subject: message.subject,
  //     html: message.content?.html,
  //     text: message.content?.text,
  //     from: message.metadata?.fromEmail,
  //     templateId: message.templateId,
  //     templateData: message.data,
  //   };

  //   const brandId = message.metadata?.brandId;
  //   return this.quotaAwareOrchestrator.sendEmail(emailPayload, message.tenantId, brandId);
  // }

  // private async processSMSChannel(message: any) {
  //   const smsPayload = {
  //     to: message.recipients.map(r => r.phone).filter(Boolean),
  //     message: message.content?.text || message.subject,
  //     templateId: message.templateId,
  //     templateData: message.data,
  //   };

  //   return this.quotaAwareOrchestrator.sendSMS(smsPayload, message.tenantId);
  // }

  // private async processPushChannel(message: any) {
  //   const pushPayload = {
  //     deviceTokens: message.recipients.map(r => r.pushToken).filter(Boolean),
  //     title: message.subject,
  //     body: message.content?.text,
  //     data: message.data,
  //     templateId: message.templateId,
  //   };

  //   const brandId = message.metadata?.brandId;
  //   return this.quotaAwareOrchestrator.sendPushNotification(pushPayload, message.tenantId, brandId);
  // }

  // private async processWhatsAppChannel(message: any) {
  //   const whatsappPayload = {
  //     channel: 'whatsapp',
  //     to: message.recipients.map(r => r.phone).filter(Boolean),
  //     message: message.content?.text || message.subject,
  //     templateId: message.templateId,
  //     templateData: message.data,
  //   };

  //   return this.quotaAwareOrchestrator.sendChatMessage(whatsappPayload, 'whatsapp', message.tenantId);
  // }

  // private async processInAppChannel(message: any) {
  //   const inAppPayload = {
  //     userId: message.recipients.map(r => r.userId).filter(Boolean)[0] || '',
  //     message: message.content?.text || message.subject,
  //     title: message.subject,
  //     data: message.data,
  //     templateId: message.templateId,
  //   };

  //   return this.quotaAwareOrchestrator.sendInAppNotification(inAppPayload);
  // }

  // private async processVoiceChannel(message: any) {
  //   const voicePayload = {
  //     to: message.recipients.map(r => r.phone).filter(Boolean),
  //     message: message.content?.text || message.subject,
  //     templateId: message.templateId,
  //     templateData: message.data,
  //   };

  //   return this.quotaAwareOrchestrator.sendVoiceCall(voicePayload, message.tenantId);
  // }

  /**
   * Send external notification (email, SMS, push, etc.)
   * TRANSPORT MODE: Direct send without storage
   */
  async sendExternalNotification(request: {
    tenantId: string;
    templateId?: string;
    channels: string[];
    recipients: Array<{
      email?: string;
      phone?: string;
      userId?: string;
    }>;
    data: Record<string, any>;
    subject?: string;
    content?: string;
    priority?: string;
    scheduledAt?: Date;
    metadata?: Record<string, any>;
  }) {
    // Use the main sendMessage method which handles transport mode
    return this.sendMessage(
      {
        channels: request.channels as any,
        recipients: request.recipients as any,
        templateId: request.templateId,
        data: request.data,
        subject: request.subject,
        content: request.content,
        priority: request.priority as any,
        scheduledAt: request.scheduledAt,
        metadata: request.metadata,
      },
      request.tenantId,
    );
  }

  /**
   * DIGEST/BATCHING METHODS
   */

  /**
   * Send notification with digest support
   */
  async sendWithDigest(
    sendMessageDto: SendMessageDto,
    tenantId: string,
    frequency: "instant" | "daily" | "weekly" | "monthly" = "instant",
  ) {
    const digestConfig = this.digestService.getDigestConfig(frequency);
    if (!digestConfig) {
      throw new Error(`Invalid digest frequency: ${frequency}`);
    }

    // For instant, send immediately
    if (frequency === "instant") {
      return this.sendMessage(sendMessageDto, tenantId);
    }

    // For other frequencies, queue for digest
    for (const recipient of sendMessageDto.recipients) {
      const subscriberId = recipient.userId || recipient.id;
      if (!subscriberId) continue;

      for (const channel of sendMessageDto.channels) {
        const contentText =
          typeof sendMessageDto.content === "string"
            ? sendMessageDto.content
            : (sendMessageDto.content as any)?.text || "";

        const digestNotification: DigestNotification = {
          id: `notif_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          subscriberId,
          tenantId,
          channel,
          title: sendMessageDto.subject || "",
          content: contentText,
          data: sendMessageDto.data,
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

  /**
   * Get digest queue statistics
   */
  getDigestStats() {
    return this.digestService.getQueueStats();
  }

  /**
   * Get pending digests for a subscriber
   */
  getPendingDigests(subscriberId: string, tenantId: string) {
    return this.digestService.getPendingDigests(subscriberId, tenantId);
  }

  /**
   * SCHEDULING METHODS
   */

  /**
   * Schedule notification for specific time in subscriber's timezone
   */
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
          content: sendMessageDto.content,
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

  /**
   * Get scheduling statistics
   */
  getSchedulingStats() {
    return this.schedulingService.getSchedulingStats();
  }

  /**
   * Get pending scheduled notifications for a subscriber
   */
  getPendingScheduledNotifications(subscriberId: string, tenantId: string) {
    return this.schedulingService.getPendingNotifications(subscriberId, tenantId);
  }

  /**
   * Get notifications ready to send
   */
  getReadyNotifications() {
    return this.schedulingService.getReadyNotifications();
  }

  /**
   * Cancel scheduled notification
   */
  async cancelScheduledNotification(notificationId: string) {
    await this.schedulingService.cancelNotification(notificationId);
    return { status: "cancelled", notificationId };
  }

  /**
   * Validate timezone
   */
  isValidTimezone(timezone: string): boolean {
    return this.schedulingService.isValidTimezone(timezone);
  }

  /**
   * Get all valid timezones
   */
  getValidTimezones(): string[] {
    return this.schedulingService.getValidTimezones();
  }
}
