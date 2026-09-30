import { MessageDeliveryStatus } from "../message-delivery.entity";
import {
  MessageChannel,
  MessagePriority,
  MessageRecipient,
  MessageStatus,
} from "../message.entity";

/**
 * External Developer SDK Interface for Messaging System
 * Supports both single-tenant and multi-tenant modes
 */
export interface IMessagingSDK {
  /**
   * Send a single message through specified channels
   * @param request - Message request
   * @param tenantId - Optional tenant ID for multi-tenant mode
   */
  sendMessage(request: SendMessageRequest, tenantId?: string): Promise<MessageResponse>;

  /**
   * Send multiple messages in bulk
   * @param request - Bulk message request
   * @param tenantId - Optional tenant ID for multi-tenant mode
   */
  sendBulkMessages(request: BulkMessageRequest, tenantId?: string): Promise<BulkMessageResponse>;

  /**
   * Get message status and delivery information
   * @param messageId - Message ID
   * @param tenantId - Optional tenant ID for multi-tenant mode
   */
  getMessageStatus(messageId: string, tenantId?: string): Promise<MessageStatusResponse>;

  /**
   * Get delivery reports for a message
   * @param messageId - Message ID
   * @param tenantId - Optional tenant ID for multi-tenant mode
   */
  getDeliveryReports(messageId: string, tenantId?: string): Promise<DeliveryReport[]>;

  /**
   * Get messages with pagination and filtering
   * @param query - Query parameters
   * @param tenantId - Optional tenant ID for multi-tenant mode
   */
  getMessages(query: MessageQuery, tenantId?: string): Promise<PaginatedMessageResponse>;

  /**
   * Cancel a scheduled message
   * @param messageId - Message ID
   * @param tenantId - Optional tenant ID for multi-tenant mode
   */
  cancelMessage(messageId: string, tenantId?: string): Promise<void>;

  /**
   * Get delivery statistics
   * @param query - Stats query parameters
   * @param tenantId - Optional tenant ID for multi-tenant mode
   */
  getDeliveryStats(query: StatsQuery, tenantId?: string): Promise<DeliveryStats>;
}

export interface SendMessageRequest {
  channels: MessageChannel[];
  recipients: MessageRecipient[];
  templateId?: string;
  data: Record<string, any>;
  priority?: MessagePriority;
  subject?: string;
  content?: string;
  scheduledAt?: Date;
  metadata?: Record<string, any>;
}

export interface BulkMessageRequest {
  messages: SendMessageRequest[];
  batchId?: string;
}

export interface MessageResponse {
  id: string;
  status: MessageStatus;
  channels: MessageChannel[];
  recipientCount: number;
  scheduledAt?: Date;
  createdAt: Date;
  estimatedDelivery?: Date;
}

export interface BulkMessageResponse {
  batchId: string;
  totalMessages: number;
  successCount: number;
  failedCount: number;
  messages: MessageResponse[];
}

export interface MessageStatusResponse {
  id: string;
  status: MessageStatus;
  channels: MessageChannel[];
  recipients: MessageRecipient[];
  deliveries: DeliveryReport[];
  createdAt: Date;
  sentAt?: Date;
  completedAt?: Date;
  errorMessage?: string;
}

export interface DeliveryReport {
  id: string;
  channel: MessageChannel;
  recipient: string;
  status: MessageDeliveryStatus;
  providerId: string;
  providerMessageId?: string;
  sentAt?: Date;
  deliveredAt?: Date;
  openedAt?: Date;
  clickedAt?: Date;
  errorMessage?: string;
  retryCount: number;
}

export interface MessageQuery {
  page?: number;
  limit?: number;
  status?: MessageStatus;
  channel?: MessageChannel;
  startDate?: Date;
  endDate?: Date;
  search?: string;
}

export interface PaginatedMessageResponse {
  data: MessageResponse[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface StatsQuery {
  startDate: Date;
  endDate: Date;
  channel?: MessageChannel;
  groupBy?: "day" | "week" | "month";
}

export interface DeliveryStats {
  totalMessages: number;
  deliveredMessages: number;
  failedMessages: number;
  deliveryRate: number;
  channelStats: ChannelStats[];
  timeSeriesData: TimeSeriesPoint[];
}

export interface ChannelStats {
  channel: MessageChannel;
  sent: number;
  delivered: number;
  failed: number;
  deliveryRate: number;
}

export interface TimeSeriesPoint {
  date: string;
  sent: number;
  delivered: number;
  failed: number;
}
