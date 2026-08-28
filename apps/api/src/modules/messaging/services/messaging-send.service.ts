import { Injectable, Logger } from "@nestjs/common";
import { MessageStatus } from "../message.entity";
import { BulkMessageDto, SendMessageDto } from "../dto/send-message.dto";
import { NotificationEngineService } from "../../notifications/engine/notification-engine.service";

@Injectable()
export class MessagingSendService {
  private readonly logger = new Logger(MessagingSendService.name);

  constructor(private readonly notificationEngine: NotificationEngineService) {}

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

  private async filterRecipientsByPreferences(
    recipients: any[],
    channels: string[],
    tenantId: string,
  ): Promise<any[]> {
    const filteredRecipients: any[] = [];

    for (const recipient of recipients) {
      const subscriberId = recipient.subscriberId || recipient.userId;

      if (!subscriberId) {
        filteredRecipients.push(recipient);
        continue;
      }

      filteredRecipients.push(recipient);
    }

    return filteredRecipients;
  }
}
