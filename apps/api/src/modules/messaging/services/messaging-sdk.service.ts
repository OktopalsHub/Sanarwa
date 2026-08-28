import { Injectable, Logger, NotFoundException } from "@nestjs/common";
import { getPaginationSummary } from "src/common/dto/pagination.dto";
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
} from "../interfaces/messaging-sdk.interface";
import { MessageDeliveryStatus } from "../message-delivery.entity";
import { MessageStatus } from "../message.entity";
import { MessagingService } from "../messaging.service";
import { MessageDeliveryRepository, MessageRepository } from "../repositories";
import {
  calculateChannelStats,
  calculateCompletedAt,
  calculateEstimatedDelivery,
  calculateTimeSeriesData,
  mapToDeliveryReport,
} from "./messaging-sdk.helpers";

@Injectable()
export class MessagingSDKService implements IMessagingSDK {
  private readonly logger = new Logger(MessagingSDKService.name);

  constructor(
    private readonly messageRepository: MessageRepository,
    private readonly messageDeliveryRepository: MessageDeliveryRepository,
    private readonly messagingService: MessagingService,
  ) {}

  async sendMessage(request: SendMessageRequest, tenantId?: string): Promise<MessageResponse> {
    const message = await this.messageRepository.create({
      tenantId: tenantId || "default",
      channels: request.channels,
      recipients: request.recipients,
      templateId: request.templateId,
      data: request.data,
      priority: request.priority,
      subject: request.subject,
      content: request.content,
      scheduledAt: request.scheduledAt,
      metadata: request.metadata,
      status: request.scheduledAt ? MessageStatus.PENDING : MessageStatus.PROCESSING,
    });

    if (!request.scheduledAt) {
      await this.messagingService.processMessage(message.id);
    }

    return {
      id: message.id,
      status: message.status,
      channels: message.channels,
      recipientCount: message.recipients.length,
      scheduledAt: message.scheduledAt,
      createdAt: message.createdAt,
      estimatedDelivery: calculateEstimatedDelivery(message.channels, message.scheduledAt),
    };
  }

  async sendBulkMessages(
    request: BulkMessageRequest,
    tenantId?: string,
  ): Promise<BulkMessageResponse> {
    const batchId =
      request.batchId || `batch_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
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
        this.logger.error(`Failed to send message in batch ${batchId}:`, error.message, {
          error: error.stack,
          batchId,
          messageIndex: request.messages.indexOf(messageRequest),
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

  async getMessageStatus(messageId: string, tenantId?: string): Promise<MessageStatusResponse> {
    const whereCondition = tenantId ? { tenantId } : {};
    const message = await this.messageRepository.findById(messageId, false, whereCondition, [
      "deliveries",
    ]);

    if (!message) {
      throw new NotFoundException(`Message ${messageId} not found`);
    }

    const deliveries = await this.messageDeliveryRepository.findByMessageId(messageId);

    return {
      id: message.id,
      status: message.status,
      channels: message.channels,
      recipients: message.recipients,
      deliveries: deliveries.map(mapToDeliveryReport),
      createdAt: message.createdAt,
      sentAt: deliveries.find((d) => d.sentAt)?.sentAt,
      completedAt: calculateCompletedAt(deliveries),
      errorMessage: message.errorMessage,
    };
  }

  async getDeliveryReports(messageId: string, tenantId?: string): Promise<DeliveryReport[]> {
    if (tenantId) {
      const message = await this.messageRepository.findById(messageId, false, {
        tenantId,
      });
      if (!message) {
        throw new NotFoundException(`Message ${messageId} not found`);
      }
    }

    const deliveries = await this.messageDeliveryRepository.findByMessageId(messageId);
    return deliveries.map(mapToDeliveryReport);
  }

  async getMessages(query: MessageQuery, tenantId?: string): Promise<PaginatedMessageResponse> {
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

    const result = await this.messageRepository.findAllPaginated(page, limit, false, where, [
      "deliveries",
    ]);

    const mappedData = result.data.map((message) => ({
      id: message.id,
      status: message.status,
      channels: message.channels,
      recipientCount: message.recipients.length,
      scheduledAt: message.scheduledAt,
      createdAt: message.createdAt,
    }));

    const paginatedData = await getPaginationSummary(
      mappedData,
      result.total,
      { page, limit },
      "messages",
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

  async getDeliveryStats(query: StatsQuery, tenantId?: string): Promise<DeliveryStats> {
    const whereCondition: any = {
      createdAt: {
        gte: query.startDate,
        lte: query.endDate,
      },
    };
    if (tenantId) whereCondition.tenantId = tenantId;

    const messages = await this.messageRepository.find({
      where: whereCondition,
      relations: ["deliveries"],
    });

    const totalMessages = messages.length;
    const deliveredMessages = messages.filter((m) =>
      m.deliveries.some((d) => d.status === MessageDeliveryStatus.DELIVERED),
    ).length;
    const failedMessages = messages.filter((m) => m.status === MessageStatus.FAILED).length;

    return {
      totalMessages,
      deliveredMessages,
      failedMessages,
      deliveryRate: totalMessages > 0 ? (deliveredMessages / totalMessages) * 100 : 0,
      channelStats: calculateChannelStats(messages, query.channel),
      timeSeriesData: calculateTimeSeriesData(messages, query.groupBy || "day"),
    };
  }
}
