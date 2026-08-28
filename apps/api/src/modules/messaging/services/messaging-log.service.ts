import { Injectable, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { In, Repository } from "typeorm";
import { getPaginationSummary } from "../../../common/dto/pagination.dto";
import { IPaginatedData } from "../../../common/interfaces";
import { NotificationLog } from "../../notifications/entities/notification-log.entity";
import { applyMessageLogFilters, mapLogsToMessageListRecords } from "../message-log.query";
import { MessageDeliveryRepository, MessageRepository } from "../repositories";

@Injectable()
export class MessagingLogService {
  constructor(
    private readonly messageRepository: MessageRepository,
    private readonly messageDeliveryRepository: MessageDeliveryRepository,
    @InjectRepository(NotificationLog)
    private readonly logRepository: Repository<NotificationLog>,
  ) {}

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
}
