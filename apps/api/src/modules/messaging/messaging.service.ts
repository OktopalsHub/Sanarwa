import { Injectable } from "@nestjs/common";
import { BulkMessageDto, SendMessageDto } from "./dto/send-message.dto";
import { DigestNotification, DigestService } from "./services/digest.service";
import { ScheduleConfig, SchedulingService } from "./services/scheduling.service";
import { MessagingLogService } from "./services/messaging-log.service";
import { MessagingScheduledService } from "./services/messaging-scheduled.service";
import { MessagingSendService } from "./services/messaging-send.service";

@Injectable()
export class MessagingService {
  constructor(
    private readonly send: MessagingSendService,
    private readonly logs: MessagingLogService,
    private readonly scheduled: MessagingScheduledService,
    private readonly digestService: DigestService,
    private readonly schedulingService: SchedulingService,
  ) {}

  sendMessage(sendMessageDto: SendMessageDto, tenantId?: string) {
    return this.send.sendMessage(sendMessageDto, tenantId);
  }

  sendBulkMessages(bulkMessageDto: BulkMessageDto, tenantId?: string) {
    return this.send.sendBulkMessages(bulkMessageDto, tenantId);
  }

  sendExternalNotification(
    request: Parameters<MessagingSendService["sendExternalNotification"]>[0],
  ) {
    return this.send.sendExternalNotification(request);
  }

  getMessageStatus(messageId: string, tenantId?: string) {
    return this.scheduled.getMessageStatus(messageId, tenantId);
  }

  getDeliveryReports(messageId: string, tenantId?: string) {
    return this.scheduled.getDeliveryReports(messageId, tenantId);
  }

  getTenantMessages(query: any, tenantId?: string) {
    return this.logs.getTenantMessages(query, tenantId);
  }

  getMessageDetail(id: string, tenantId?: string) {
    return this.logs.getMessageDetail(id, tenantId);
  }

  cancelMessage(messageId: string, tenantId?: string) {
    return this.scheduled.cancelMessage(messageId, tenantId);
  }

  getDeliveryStats(query: any, tenantId?: string) {
    return this.logs.getDeliveryStats(query, tenantId);
  }

  processMessage(messageId: string) {
    return this.scheduled.processMessage(messageId);
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
      return this.send.sendMessage(sendMessageDto, tenantId);
    }

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

  getDigestStats() {
    return this.digestService.getQueueStats();
  }

  getPendingDigests(subscriberId: string, tenantId: string) {
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

  getSchedulingStats() {
    return this.schedulingService.getSchedulingStats();
  }

  getPendingScheduledNotifications(subscriberId: string, tenantId: string) {
    return this.schedulingService.getPendingNotifications(subscriberId, tenantId);
  }

  getReadyNotifications() {
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
