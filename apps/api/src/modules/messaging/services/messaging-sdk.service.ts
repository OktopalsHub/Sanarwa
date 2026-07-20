import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { getPaginationSummary } from 'src/common/dto/pagination.dto';
import {
  BulkMessageRequest,
  BulkMessageResponse,
  DeliveryReport,
  DeliveryStats,
  IMessagingSDK,
  MessageQuery,
  MessageResponse,
  MessageStatusResponse,
  PaginatedMessageResponse,
  SendMessageRequest,
  StatsQuery,
} from '../interfaces/messaging-sdk.interface';
import { MessageDeliveryStatus } from '../message-delivery.entity';
import { MessageChannel, MessageStatus } from '../message.entity';
import { MessagingService } from '../messaging.service';
import { MessageDeliveryRepository, MessageRepository } from '../repositories';

/**
 * SDK Service for External Developer Integration
 * Provides a clean, tenant-aware API for SaaS applications
 */
@Injectable()
export class MessagingSDKService implements IMessagingSDK {
  private readonly logger = new Logger(MessagingSDKService.name);

  constructor(
    private readonly messageRepository: MessageRepository,
    private readonly messageDeliveryRepository: MessageDeliveryRepository,
    private readonly messagingService: MessagingService,
  ) { }

  async sendMessage(
    request: SendMessageRequest,
    tenantId?: string,
  ): Promise<MessageResponse> {
    const message = await this.messageRepository.create({
      tenantId: tenantId || 'default',
      channels: request.channels,
      recipients: request.recipients,
      templateId: request.templateId,
      data: request.data,
      priority: request.priority,
      subject: request.subject,
      content: request.content,
      scheduledAt: request.scheduledAt,
      metadata: request.metadata,
      status: request.scheduledAt
        ? MessageStatus.PENDING
        : MessageStatus.PROCESSING,
    });

    // If not scheduled, process immediately
    if (!request.scheduledAt) {
      // Queue for processing (this would typically be done via a job queue)
      await this.messagingService.processMessage(message.id);
    }

    return {
      id: message.id,
      status: message.status,
      channels: message.channels,
      recipientCount: message.recipients.length,
      scheduledAt: message.scheduledAt,
      createdAt: message.createdAt,
      estimatedDelivery: this.calculateEstimatedDelivery(
        message.channels,
        message.scheduledAt,
      ),
    };
  }

  async sendBulkMessages(
    request: BulkMessageRequest,
    tenantId?: string,
  ): Promise<BulkMessageResponse> {
    const batchId =
      request.batchId ||
      `batch_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const results: MessageResponse[] = [];
    let successCount = 0;
    let failedCount = 0;

    for (const messageRequest of request.messages) {
      try {
        const result = await this.sendMessage(messageRequest, tenantId);
        results.push(result);
        successCount++;
      } catch (error) {
        failedCount++;
        // Log error but continue processing other messages
        this.logger.error(`Failed to send message in batch ${batchId}:`, error.message, {
          error: error.stack,
          batchId,
          messageIndex: request.messages.indexOf(messageRequest)
        });
      }
    }

    return {
      batchId,
      totalMessages: request.messages.length,
      successCount,
      failedCount,
      messages: results,
    };
  }

  async getMessageStatus(
    messageId: string,
    tenantId?: string,
  ): Promise<MessageStatusResponse> {
    const whereCondition = tenantId ? { tenantId } : {};
    const message = await this.messageRepository.findById(
      messageId,
      false,
      whereCondition,
      ['deliveries'],
    );

    if (!message) {
      throw new NotFoundException(`Message ${messageId} not found`);
    }

    const deliveries =
      await this.messageDeliveryRepository.findByMessageId(messageId);

    return {
      id: message.id,
      status: message.status,
      channels: message.channels,
      recipients: message.recipients,
      deliveries: deliveries.map(this.mapToDeliveryReport),
      createdAt: message.createdAt,
      sentAt: deliveries.find((d) => d.sentAt)?.sentAt,
      completedAt: this.calculateCompletedAt(deliveries),
      errorMessage: message.errorMessage,
    };
  }

  async getDeliveryReports(
    messageId: string,
    tenantId?: string,
  ): Promise<DeliveryReport[]> {
    // Verify message belongs to tenant (if tenant ID provided)
    if (tenantId) {
      const message = await this.messageRepository.findById(messageId, false, {
        tenantId,
      });
      if (!message) {
        throw new NotFoundException(`Message ${messageId} not found`);
      }
    }

    const deliveries =
      await this.messageDeliveryRepository.findByMessageId(messageId);
    return deliveries.map(this.mapToDeliveryReport);
  }

  async getMessages(
    query: MessageQuery,
    tenantId?: string,
  ): Promise<PaginatedMessageResponse> {
    const page = query.page || 1;
    const limit = query.limit || 20;

    const where: any = {};
    if (tenantId) where.tenantId = tenantId;
    if (query.status) where.status = query.status;
    if (query.startDate || query.endDate) {
      where.createdAt = {};
      if (query.startDate) where.createdAt.gte = query.startDate;
      if (query.endDate) where.createdAt.lte = query.endDate;
    }

    const result = await this.messageRepository.findAllPaginated(
      page,
      limit,
      false,
      where,
      ['deliveries'],
    );

    const mappedData = result.data.map((message) => ({
      id: message.id,
      status: message.status,
      channels: message.channels,
      recipientCount: message.recipients.length,
      scheduledAt: message.scheduledAt,
      createdAt: message.createdAt,
    }));

    // Use new pagination internally but convert to old format for interface compatibility
    const paginatedData = await getPaginationSummary(
      mappedData,
      result.total,
      { page, limit },
      'messages',
    );

    return {
      data: paginatedData.records,
      total: paginatedData.totalItems,
      page: paginatedData.page,
      limit: paginatedData.limit,
      totalPages: paginatedData.pageCount,
    };
  }

  async cancelMessage(messageId: string, tenantId?: string): Promise<void> {
    const whereCondition = tenantId ? { tenantId } : {};
    const message = await this.messageRepository.findById(
      messageId,
      false,
      whereCondition,
    );

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

  async getDeliveryStats(
    query: StatsQuery,
    tenantId?: string,
  ): Promise<DeliveryStats> {
    // This would typically use a more optimized query or aggregation
    const whereCondition: any = {
      createdAt: {
        gte: query.startDate,
        lte: query.endDate,
      },
    };
    if (tenantId) whereCondition.tenantId = tenantId;

    const messages = await this.messageRepository.find({
      where: whereCondition,
      relations: ['deliveries'],
    });

    const totalMessages = messages.length;
    const deliveredMessages = messages.filter((m) =>
      m.deliveries.some((d) => d.status === MessageDeliveryStatus.DELIVERED),
    ).length;
    const failedMessages = messages.filter(
      (m) => m.status === MessageStatus.FAILED,
    ).length;

    const channelStats = this.calculateChannelStats(messages, query.channel);
    const timeSeriesData = this.calculateTimeSeriesData(
      messages,
      query.groupBy || 'day',
    );

    return {
      totalMessages,
      deliveredMessages,
      failedMessages,
      deliveryRate:
        totalMessages > 0 ? (deliveredMessages / totalMessages) * 100 : 0,
      channelStats,
      timeSeriesData,
    };
  }

  private mapToDeliveryReport(delivery: any): DeliveryReport {
    return {
      id: delivery.id,
      channel: delivery.channel,
      recipient: delivery.recipient,
      status: delivery.status,
      providerId: delivery.providerId,
      providerMessageId: delivery.providerMessageId,
      sentAt: delivery.sentAt,
      deliveredAt: delivery.deliveredAt,
      openedAt: delivery.openedAt,
      clickedAt: delivery.clickedAt,
      errorMessage: delivery.errorMessage,
      retryCount: delivery.retryCount,
    };
  }

  private calculateEstimatedDelivery(
    channels: MessageChannel[],
    scheduledAt?: Date,
  ): Date {
    const baseTime = scheduledAt || new Date();
    // Add estimated processing time based on channels
    const processingTime = channels.includes(MessageChannel.EMAIL)
      ? 30000
      : 5000; // 30s for email, 5s for others
    return new Date(baseTime.getTime() + processingTime);
  }

  private calculateCompletedAt(deliveries: any[]): Date | undefined {
    const lastDelivery = deliveries
      .filter(
        (d) =>
          d.status === MessageDeliveryStatus.DELIVERED ||
          d.status === MessageDeliveryStatus.FAILED,
      )
      .sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      )[0];

    return lastDelivery?.deliveredAt || lastDelivery?.createdAt;
  }

  private calculateChannelStats(
    messages: any[],
    filterChannel?: MessageChannel,
  ) {
    const channelMap = new Map();

    messages.forEach((message) => {
      message.channels.forEach((channel: MessageChannel) => {
        if (filterChannel && channel !== filterChannel) return;

        if (!channelMap.has(channel)) {
          channelMap.set(channel, { sent: 0, delivered: 0, failed: 0 });
        }

        const stats = channelMap.get(channel);
        stats.sent++;

        const channelDeliveries = message.deliveries.filter(
          (d: any) => d.channel === channel,
        );
        if (
          channelDeliveries.some(
            (d: any) => d.status === MessageDeliveryStatus.DELIVERED,
          )
        ) {
          stats.delivered++;
        } else if (
          channelDeliveries.some(
            (d: any) => d.status === MessageDeliveryStatus.FAILED,
          )
        ) {
          stats.failed++;
        }
      });
    });

    return Array.from(channelMap.entries()).map(([channel, stats]) => ({
      channel,
      sent: stats.sent,
      delivered: stats.delivered,
      failed: stats.failed,
      deliveryRate: stats.sent > 0 ? (stats.delivered / stats.sent) * 100 : 0,
    }));
  }

  private calculateTimeSeriesData(
    messages: any[],
    groupBy: 'day' | 'week' | 'month',
  ) {
    // Implementation would group messages by time period and calculate stats
    // This is a simplified version
    const timeMap = new Map();

    messages.forEach((message) => {
      const date = this.formatDateByGrouping(message.createdAt, groupBy);
      if (!timeMap.has(date)) {
        timeMap.set(date, { sent: 0, delivered: 0, failed: 0 });
      }

      const stats = timeMap.get(date);
      stats.sent++;

      if (
        message.deliveries.some(
          (d: any) => d.status === MessageDeliveryStatus.DELIVERED,
        )
      ) {
        stats.delivered++;
      } else if (message.status === MessageStatus.FAILED) {
        stats.failed++;
      }
    });

    return Array.from(timeMap.entries()).map(([date, stats]) => ({
      date,
      sent: stats.sent,
      delivered: stats.delivered,
      failed: stats.failed,
    }));
  }

  private formatDateByGrouping(
    date: Date,
    groupBy: 'day' | 'week' | 'month',
  ): string {
    const d = new Date(date);
    switch (groupBy) {
      case 'day':
        return d.toISOString().split('T')[0];
      case 'week':
        const week = Math.ceil(d.getDate() / 7);
        return `${d.getFullYear()}-${d.getMonth() + 1}-W${week}`;
      case 'month':
        return `${d.getFullYear()}-${d.getMonth() + 1}`;
      default:
        return d.toISOString().split('T')[0];
    }
  }
}
