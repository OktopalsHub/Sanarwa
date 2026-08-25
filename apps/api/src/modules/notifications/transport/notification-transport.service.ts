import { Injectable, Logger } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { NotificationLog } from "../entities/notification-log.entity";
import { NotificationEngineService } from "../engine/notification-engine.service";
import { NotificationEngineRequest } from "../engine/notification-engine.types";

export interface NotificationRequest {
  to: string;
  channel: "email" | "sms" | "push" | "whatsapp" | "webhook" | "in_app";
  title?: string;
  message: string;
  data?: Record<string, any>;
  priority?: "low" | "normal" | "high";
  scheduledAt?: Date;
  expiresAt?: Date;
  templateId?: string;
  templateData?: Record<string, any>;
  trackingId?: string;
  webhookUrl?: string;
  tenantId: string;
  projectId: string;
}

export interface BulkNotificationRequest {
  notifications: NotificationRequest[];
  batchId?: string;
}

export interface NotificationResponse {
  id: string;
  status: "queued" | "sent" | "delivered" | "failed";
  trackingId?: string;
  externalId?: string;
  error?: string;
  timestamp: Date;
}

@Injectable()
export class NotificationTransportService {
  private readonly logger = new Logger(NotificationTransportService.name);

  constructor(
    @InjectRepository(NotificationLog)
    private logRepository: Repository<NotificationLog>,
    private readonly notificationEngine: NotificationEngineService,
  ) {}

  async send(request: NotificationRequest): Promise<NotificationResponse> {
    const engineRequest: NotificationEngineRequest = {
      tenantId: request.tenantId,
      projectId: request.projectId,
      channel: request.channel,
      to: request.to,
      title: request.title,
      message: request.message,
      data: request.templateData ?? request.data,
      priority: request.priority,
      scheduledAt: request.scheduledAt,
      expiresAt: request.expiresAt,
      templateId: request.templateId,
      templateData: request.templateData,
      trackingId: request.trackingId,
      webhookUrl: request.webhookUrl,
      subscriberId:
        request.channel === "push" || request.channel === "in_app" ? request.to : undefined,
      metadata: request.data,
    };

    const result = await this.notificationEngine.send(engineRequest);

    return {
      id: result.id,
      trackingId: result.trackingId,
      status: result.status,
      externalId: result.externalId,
      error: result.error,
      timestamp: result.timestamp,
    };
  }

  async sendBulk(request: BulkNotificationRequest): Promise<{
    batchId: string;
    results: NotificationResponse[];
    summary: {
      total: number;
      queued: number;
      failed: number;
    };
  }> {
    const batchId = request.batchId || this.generateBatchId();
    const results: NotificationResponse[] = [];
    const batchSize = 100;
    const batches = this.chunkArray(request.notifications, batchSize);

    for (const batch of batches) {
      const batchPromises = batch.map((notification) =>
        this.send({
          ...notification,
          trackingId: `${batchId}_${this.generateId()}`,
        }),
      );

      const batchResults = await Promise.allSettled(batchPromises);

      batchResults.forEach((result, index) => {
        if (result.status === "fulfilled") {
          results.push(result.value);
        } else {
          results.push({
            id: `${batchId}_${index}_failed`,
            status: "failed",
            error: result.reason?.message || "Unknown error",
            timestamp: new Date(),
          });
        }
      });
    }

    const summary = {
      total: results.length,
      queued: results.filter((item) => item.status === "queued" || item.status === "sent").length,
      failed: results.filter((item) => item.status === "failed").length,
    };

    return { batchId, results, summary };
  }

  async getDeliveryStatus(trackingId: string): Promise<NotificationLog | null> {
    return this.logRepository.findOne({
      where: { trackingId },
      select: [
        "id",
        "trackingId",
        "channel",
        "status",
        "sentAt",
        "deliveredAt",
        "error",
        "externalId",
      ],
    });
  }

  async getAnalytics(
    tenantId: string,
    options: {
      startDate?: Date;
      endDate?: Date;
      channel?: string;
    } = {},
  ) {
    const query = this.logRepository
      .createQueryBuilder("log")
      .where("log.tenantId = :tenantId", { tenantId });

    if (options.startDate) {
      query.andWhere("log.createdAt >= :startDate", {
        startDate: options.startDate,
      });
    }
    if (options.endDate) {
      query.andWhere("log.createdAt <= :endDate", { endDate: options.endDate });
    }
    if (options.channel) {
      query.andWhere("log.channel = :channel", { channel: options.channel });
    }

    const [total, sent, delivered, failed] = await Promise.all([
      query.getCount(),
      query.clone().andWhere("log.status = :status", { status: "sent" }).getCount(),
      query.clone().andWhere("log.status = :status", { status: "delivered" }).getCount(),
      query.clone().andWhere("log.status = :status", { status: "failed" }).getCount(),
    ]);

    return {
      total,
      sent,
      delivered,
      failed,
      deliveryRate: total > 0 ? (delivered / total) * 100 : 0,
    };
  }

  private generateBatchId(): string {
    return `batch_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
  }

  private generateId(): string {
    return Math.random().toString(36).slice(2, 9);
  }

  private chunkArray<T>(array: T[], size: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }
    return chunks;
  }
}
