import { Injectable, Logger } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import {
  MessageDeliveryStatus as DeliveryStatus,
  MessageDelivery as NotificationDelivery,
} from "../messaging/message-delivery.entity";
import {
  Message as Notification,
  MessageChannel as NotificationChannel,
  MessageStatus as NotificationStatus,
} from "../messaging/message.entity";

export enum AuditEventType {
  NOTIFICATION_CREATED = "notification_created",
  NOTIFICATION_SENT = "notification_sent",
  NOTIFICATION_FAILED = "notification_failed",
  NOTIFICATION_CANCELLED = "notification_cancelled",
  DELIVERY_STATUS_CHANGED = "delivery_status_changed",
  DELIVERY_EVENT = "delivery_event",
  PROVIDER_FAILOVER = "provider_failover",
  WEBHOOK_SENT = "webhook_sent",
  WEBHOOK_FAILED = "webhook_failed",
  TEMPLATE_RENDERED = "template_rendered",
  BULK_OPERATION = "bulk_operation",
}

export interface AuditLogEntry {
  id?: string;
  tenantId: string;
  eventType: AuditEventType;
  resourceType: "notification" | "delivery" | "provider" | "webhook" | "template";
  resourceId: string;
  userId?: string;
  details: Record<string, any>;
  metadata?: Record<string, any>;
  timestamp: Date;
  ipAddress?: string;
  userAgent?: string;
}

export interface AuditQuery {
  tenantId: string;
  eventType?: AuditEventType;
  resourceType?: string;
  resourceId?: string;
  userId?: string;
  startDate?: Date;
  endDate?: Date;
  limit?: number;
  offset?: number;
}

@Injectable()
export class AuditLogService {
  private readonly logger = new Logger(AuditLogService.name);
  private readonly auditLogs: AuditLogEntry[] = []; // In-memory storage for demo

  constructor(
    @InjectRepository(Notification)
    private readonly notificationRepository: Repository<Notification>,
    @InjectRepository(NotificationDelivery)
    private readonly deliveryRepository: Repository<NotificationDelivery>,
  ) {}

  /**
   * Log notification creation
   */
  async logNotificationCreated(
    notificationId: string,
    tenantId: string,
    channels: NotificationChannel[],
    recipientCount: number,
    metadata?: Record<string, any>,
  ): Promise<void> {
    await this.createAuditLog({
      tenantId,
      eventType: AuditEventType.NOTIFICATION_CREATED,
      resourceType: "notification",
      resourceId: notificationId,
      details: {
        channels,
        recipientCount,
        action: "created",
      },
      metadata,
      timestamp: new Date(),
    });

    this.logger.log(`Audit: Notification ${notificationId} created for tenant ${tenantId}`);
  }

  /**
   * Log notification status change
   */
  async logNotificationStatusChange(
    notificationId: string,
    oldStatus: NotificationStatus,
    newStatus: NotificationStatus,
    tenantId: string,
    metadata?: Record<string, any>,
  ): Promise<void> {
    const eventType = this.getNotificationEventType(newStatus);

    await this.createAuditLog({
      tenantId,
      eventType,
      resourceType: "notification",
      resourceId: notificationId,
      details: {
        oldStatus,
        newStatus,
        action: "status_changed",
      },
      metadata,
      timestamp: new Date(),
    });

    this.logger.log(
      `Audit: Notification ${notificationId} status changed from ${oldStatus} to ${newStatus}`,
    );
  }

  /**
   * Log delivery status change
   */
  async logDeliveryStatusChange(
    deliveryId: string,
    oldStatus: DeliveryStatus,
    newStatus: DeliveryStatus,
    tenantId: string,
    metadata?: Record<string, any>,
  ): Promise<void> {
    await this.createAuditLog({
      tenantId,
      eventType: AuditEventType.DELIVERY_STATUS_CHANGED,
      resourceType: "delivery",
      resourceId: deliveryId,
      details: {
        oldStatus,
        newStatus,
        action: "status_changed",
      },
      metadata,
      timestamp: new Date(),
    });

    this.logger.log(
      `Audit: Delivery ${deliveryId} status changed from ${oldStatus} to ${newStatus}`,
    );
  }

  /**
   * Log delivery event (open, click, unsubscribe)
   */
  async logDeliveryEvent(
    deliveryId: string,
    eventType: "opened" | "clicked" | "unsubscribed",
    tenantId: string,
    metadata?: Record<string, any>,
  ): Promise<void> {
    await this.createAuditLog({
      tenantId,
      eventType: AuditEventType.DELIVERY_EVENT,
      resourceType: "delivery",
      resourceId: deliveryId,
      details: {
        eventType,
        action: "event_tracked",
      },
      metadata,
      timestamp: new Date(),
    });

    this.logger.log(`Audit: Delivery event ${eventType} tracked for delivery ${deliveryId}`);
  }

  /**
   * Log provider failover
   */
  async logProviderFailover(
    notificationId: string,
    fromProviderId: string,
    toProviderId: string,
    channel: NotificationChannel,
    tenantId: string,
    reason: string,
    metadata?: Record<string, any>,
  ): Promise<void> {
    await this.createAuditLog({
      tenantId,
      eventType: AuditEventType.PROVIDER_FAILOVER,
      resourceType: "provider",
      resourceId: notificationId,
      details: {
        fromProviderId,
        toProviderId,
        channel,
        reason,
        action: "failover",
      },
      metadata,
      timestamp: new Date(),
    });

    this.logger.log(
      `Audit: Provider failover from ${fromProviderId} to ${toProviderId} for notification ${notificationId}`,
    );
  }

  /**
   * Log webhook delivery
   */
  async logWebhookDelivery(
    tenantId: string,
    webhookUrl: string,
    eventType: string,
    success: boolean,
    responseStatus?: number,
    errorMessage?: string,
    metadata?: Record<string, any>,
  ): Promise<void> {
    const auditEventType = success ? AuditEventType.WEBHOOK_SENT : AuditEventType.WEBHOOK_FAILED;

    await this.createAuditLog({
      tenantId,
      eventType: auditEventType,
      resourceType: "webhook",
      resourceId: webhookUrl,
      details: {
        eventType,
        success,
        responseStatus,
        errorMessage,
        action: success ? "sent" : "failed",
      },
      metadata,
      timestamp: new Date(),
    });

    this.logger.log(
      `Audit: Webhook ${success ? "sent" : "failed"} to ${webhookUrl} for tenant ${tenantId}`,
    );
  }

  /**
   * Log template rendering
   */
  async logTemplateRendering(
    templateId: string,
    tenantId: string,
    success: boolean,
    renderTime: number,
    errorMessage?: string,
    metadata?: Record<string, any>,
  ): Promise<void> {
    await this.createAuditLog({
      tenantId,
      eventType: AuditEventType.TEMPLATE_RENDERED,
      resourceType: "template",
      resourceId: templateId,
      details: {
        success,
        renderTime,
        errorMessage,
        action: "rendered",
      },
      metadata,
      timestamp: new Date(),
    });

    this.logger.log(
      `Audit: Template ${templateId} ${success ? "rendered successfully" : "failed to render"}`,
    );
  }

  /**
   * Log bulk operation
   */
  async logBulkOperation(
    tenantId: string,
    operationType: "send" | "cancel" | "retry",
    totalCount: number,
    successCount: number,
    failureCount: number,
    metadata?: Record<string, any>,
  ): Promise<void> {
    await this.createAuditLog({
      tenantId,
      eventType: AuditEventType.BULK_OPERATION,
      resourceType: "notification",
      resourceId: `bulk-${operationType}-${Date.now()}`,
      details: {
        operationType,
        totalCount,
        successCount,
        failureCount,
        action: "bulk_operation",
      },
      metadata,
      timestamp: new Date(),
    });

    this.logger.log(
      `Audit: Bulk ${operationType} operation completed - ${successCount}/${totalCount} successful`,
    );
  }

  /**
   * Get audit logs with filtering and pagination
   */
  async getAuditLogs(query: AuditQuery): Promise<{
    logs: AuditLogEntry[];
    total: number;
    page: number;
    limit: number;
  }> {
    let filteredLogs = this.auditLogs.filter((log) => log.tenantId === query.tenantId);

    // Apply filters
    if (query.eventType) {
      filteredLogs = filteredLogs.filter((log) => log.eventType === query.eventType);
    }

    if (query.resourceType) {
      filteredLogs = filteredLogs.filter((log) => log.resourceType === query.resourceType);
    }

    if (query.resourceId) {
      filteredLogs = filteredLogs.filter((log) => log.resourceId === query.resourceId);
    }

    if (query.userId) {
      filteredLogs = filteredLogs.filter((log) => log.userId === query.userId);
    }

    if (query.startDate) {
      filteredLogs = filteredLogs.filter((log) => log.timestamp >= query.startDate!);
    }

    if (query.endDate) {
      filteredLogs = filteredLogs.filter((log) => log.timestamp <= query.endDate!);
    }

    // Sort by timestamp (newest first)
    filteredLogs.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

    // Apply pagination
    const limit = query.limit || 50;
    const offset = query.offset || 0;
    const page = Math.floor(offset / limit) + 1;
    const paginatedLogs = filteredLogs.slice(offset, offset + limit);

    return {
      logs: paginatedLogs,
      total: filteredLogs.length,
      page,
      limit,
    };
  }

  /**
   * Get audit trail for a specific notification
   */
  async getNotificationAuditTrail(
    notificationId: string,
    tenantId: string,
  ): Promise<AuditLogEntry[]> {
    // Get notification-related logs
    const notificationLogs = this.auditLogs.filter(
      (log) =>
        log.tenantId === tenantId &&
        log.resourceId === notificationId &&
        log.resourceType === "notification",
    );

    // Get delivery-related logs for this notification
    const deliveries = await this.deliveryRepository.find({
      where: { messageId: notificationId },
    });

    const deliveryIds = deliveries.map((d) => d.id);
    const deliveryLogs = this.auditLogs.filter(
      (log) =>
        log.tenantId === tenantId &&
        deliveryIds.includes(log.resourceId) &&
        log.resourceType === "delivery",
    );

    // Combine and sort by timestamp
    const allLogs = [...notificationLogs, ...deliveryLogs];
    return allLogs.toSorted((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
  }

  /**
   * Get audit statistics
   */
  async getAuditStatistics(
    tenantId: string,
    startDate?: Date,
    endDate?: Date,
  ): Promise<{
    totalEvents: number;
    eventsByType: Record<AuditEventType, number>;
    eventsByResource: Record<string, number>;
    eventsOverTime: Array<{ date: string; count: number }>;
  }> {
    let logs = this.auditLogs.filter((log) => log.tenantId === tenantId);

    if (startDate) {
      logs = logs.filter((log) => log.timestamp >= startDate);
    }

    if (endDate) {
      logs = logs.filter((log) => log.timestamp <= endDate);
    }

    const totalEvents = logs.length;

    // Count by event type
    const eventsByType = logs.reduce(
      (acc, log) => {
        acc[log.eventType] = (acc[log.eventType] || 0) + 1;
        return acc;
      },
      {} as Record<AuditEventType, number>,
    );

    // Count by resource type
    const eventsByResource = logs.reduce(
      (acc, log) => {
        acc[log.resourceType] = (acc[log.resourceType] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>,
    );

    // Events over time (daily)
    const eventsOverTime = logs.reduce(
      (acc, log) => {
        const date = log.timestamp.toISOString().split("T")[0];
        const existing = acc.find((item) => item.date === date);
        if (existing) {
          existing.count++;
        } else {
          acc.push({ date, count: 1 });
        }
        return acc;
      },
      [] as Array<{ date: string; count: number }>,
    );

    eventsOverTime.sort((a, b) => a.date.localeCompare(b.date));

    return {
      totalEvents,
      eventsByType,
      eventsByResource,
      eventsOverTime,
    };
  }

  /**
   * Export audit logs
   */
  async exportAuditLogs(query: AuditQuery, format: "json" | "csv" = "json"): Promise<string> {
    const { logs } = await this.getAuditLogs(query);

    if (format === "csv") {
      return this.convertToCSV(logs);
    }

    return JSON.stringify(logs, null, 2);
  }

  /**
   * Private helper methods
   */

  private async createAuditLog(entry: AuditLogEntry): Promise<void> {
    const auditLog: AuditLogEntry = {
      id: this.generateId(),
      ...entry,
    };

    // In a real implementation, this would be stored in a database
    this.auditLogs.push(auditLog);

    // Keep only the last 10000 logs in memory to prevent memory leaks
    if (this.auditLogs.length > 10000) {
      this.auditLogs.splice(0, this.auditLogs.length - 10000);
    }
  }

  private getNotificationEventType(status: NotificationStatus): AuditEventType {
    switch (status) {
      case NotificationStatus.SENT:
        return AuditEventType.NOTIFICATION_SENT;
      case NotificationStatus.FAILED:
        return AuditEventType.NOTIFICATION_FAILED;
      case NotificationStatus.CANCELLED:
        return AuditEventType.NOTIFICATION_CANCELLED;
      default:
        return AuditEventType.NOTIFICATION_CREATED;
    }
  }

  private generateId(): string {
    return `audit_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private convertToCSV(logs: AuditLogEntry[]): string {
    if (logs.length === 0) {
      return "";
    }

    const headers = [
      "id",
      "tenantId",
      "eventType",
      "resourceType",
      "resourceId",
      "userId",
      "timestamp",
      "details",
      "metadata",
    ];

    const csvRows = [
      headers.join(","),
      ...logs.map((log) =>
        [
          log.id,
          log.tenantId,
          log.eventType,
          log.resourceType,
          log.resourceId,
          log.userId || "",
          log.timestamp.toISOString(),
          JSON.stringify(log.details).replace(/"/g, '""'),
          JSON.stringify(log.metadata || {}).replace(/"/g, '""'),
        ]
          .map((field) => `"${field}"`)
          .join(","),
      ),
    ];

    return csvRows.join("\n");
  }
}
