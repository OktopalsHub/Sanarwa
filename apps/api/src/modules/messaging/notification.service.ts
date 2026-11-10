import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";

import { NotificationLog } from "../notifications/entities/notification-log.entity";
import { NotificationEngineService } from "../notifications/engine/notification-engine.service";
import { NotificationEngineRequest } from "../notifications/engine/notification-engine.types";
import type { MachineApiKey } from "../auth/decorators/current-api-key.decorator";
import { NotificationChannel } from "../../common/enums/notification-channel.enum";
import { BulkNotificationRequestDto, NotificationRequestDto } from "./dto/notification-request.dto";
import {
  BulkNotificationResponseDto,
  DeliveryStatus,
  NotificationResponseDto,
  NotificationStatusDto,
} from "./dto/notification-response.dto";

import { DELIVERABLE_CHANNELS } from "../../common/enums/notification-channel.enum";

const LOG_STATUSES: Record<NotificationLog["status"], DeliveryStatus> = {
  queued: DeliveryStatus.PENDING,
  sent: DeliveryStatus.SENT,
  delivered: DeliveryStatus.DELIVERED,
  failed: DeliveryStatus.FAILED,
  cancelled: DeliveryStatus.FAILED,
};

@Injectable()
export class NotificationService {
  constructor(
    private readonly notificationEngine: NotificationEngineService,
    @InjectRepository(NotificationLog)
    private readonly notificationLogRepository: Repository<NotificationLog>,
  ) {}

  async sendNotification(
    request: NotificationRequestDto,
    apiKey: MachineApiKey,
  ): Promise<NotificationResponseDto> {
    const engineRequest = this.toEngineRequest(request, apiKey);
    const result = await this.notificationEngine.send(engineRequest);
    return this.toResponseDto(result.id, result.status, result.error);
  }

  async sendBulkNotifications(
    request: BulkNotificationRequestDto,
    apiKey: MachineApiKey,
  ): Promise<BulkNotificationResponseDto> {
    const results: NotificationResponseDto[] = [];

    for (const notification of request.notifications) {
      try {
        const engineRequest = this.toEngineRequest(notification, apiKey);
        const result = await this.notificationEngine.send(engineRequest);
        results.push(this.toResponseDto(result.id, result.status, result.error));
      } catch (error) {
        results.push(this.toResponseDto(undefined, "failed", this.errorMessage(error)));
      }
    }

    return {
      total: results.length,
      successful: results.filter((r) => r.status !== "failed").length,
      failed: results.filter((r) => r.status === "failed").length,
      results,
    };
  }

  async getNotificationStatus(id: string, tenantId: string): Promise<NotificationStatusDto> {
    const log = await this.notificationLogRepository.findOne({
      where: { id, tenantId },
    });

    if (!log) {
      throw new NotFoundException(`Notification ${id} not found`);
    }

    return {
      id: log.id,
      status: LOG_STATUSES[log.status],
      updatedAt: log.sentAt ?? log.deliveredAt ?? log.failedAt ?? log.createdAt,
      retryCount: log.metadata?.retryCount,
      errorDetails: log.error,
    };
  }

  private toEngineRequest(
    request: NotificationRequestDto,
    apiKey: MachineApiKey,
  ): NotificationEngineRequest {
    const tenantId = apiKey.tenantId;
    if (!tenantId) {
      throw new BadRequestException(
        "The supplied API key is not bound to a tenant; cannot resolve notification scope",
      );
    }

    if (!DELIVERABLE_CHANNELS.has(request.channel)) {
      throw new BadRequestException(
        `NotificationChannel ${request.channel} is not deliverable through the notification engine`,
      );
    }

    if (!request.message && !request.template) {
      throw new BadRequestException(
        "A notification needs `message` text or a `template` reference",
      );
    }

    if (request.channel === NotificationChannel.CHAT && !request.chatProvider) {
      throw new BadRequestException(
        "Chat notifications need `chatProvider` (slack, discord or telegram)",
      );
    }

    return {
      tenantId,
      projectId: apiKey.projectId,
      channel: request.channel,
      to: request.to,
      title: request.subject,
      message: request.message ?? "",
      templateId: request.template,
      templateData: request.variables,
      variables: request.variables,
      priority: request.priority as NotificationEngineRequest["priority"],
      brandId: request.brandId,
      chatProvider: request.chatProvider,
      metadata: request.metadata,
    };
  }

  private toResponseDto(
    id: string | undefined,
    status: string,
    error: string | undefined,
  ): NotificationResponseDto {
    return {
      id: id ?? "unknown",
      status,
      error,
      createdAt: new Date(),
    };
  }

  private errorMessage(error: unknown): string {
    return error instanceof Error ? error.message : "Notification delivery failed";
  }
}
