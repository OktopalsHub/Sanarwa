import { randomUUID } from "node:crypto";
import { Injectable, Logger } from "@nestjs/common";
import type { NotificationChannel } from "../../../common/enums/notification-channel.enum";
import { MessagePriority } from "../../messaging/message.entity";
import { SendUnifiedDto } from "../../messaging/dto/unified-send.dto";
import { UnifiedSendService } from "../../messaging/unified-send.service";
import { NotificationEngineRequest, NotificationEngineResponse } from "./notification-engine.types";

/**
 * Facade over {@link UnifiedSendService}. Kept as a stable seam for callers
 * that speak the engine request/response shape (transport controller, push
 * controller, messaging, message ingestion). All delivery behavior — channel
 * fan-out, quota, consent, storage policy, fallback — lives on the path
 * through the queue; this service only maps contracts.
 */
@Injectable()
export class NotificationEngineService {
  private readonly logger = new Logger(NotificationEngineService.name);

  constructor(private readonly unifiedSendService: UnifiedSendService) {}

  async send(request: NotificationEngineRequest): Promise<NotificationEngineResponse> {
    const trackingId = request.trackingId ?? randomUUID();
    const scheduledAtIso = request.scheduledAt ? request.scheduledAt.toISOString() : undefined;

    try {
      const response = await this.unifiedSendService.send(
        {
          channels: [request.channel as NotificationChannel],
          to: request.to,
          subject: request.title,
          data: request.message,
          variables: request.templateData ?? request.variables ?? {},
          templateId: request.templateId,
          priority: toMessagePriority(request.priority),
          scheduledAt: scheduledAtIso,
          brandId: request.brandId,
          chatProvider: request.chatProvider,
          metadata: {
            ...request.metadata,
            subscriberId: request.subscriberId ?? request.to,
            trackingId,
            ...(request.webhookUrl ? { webhookUrl: request.webhookUrl } : {}),
          },
        },
        request.tenantId,
        request.projectId,
      );

      return {
        id: response.messageId ?? trackingId,
        trackingId: response.trackingId ?? trackingId,
        messageId: response.messageId,
        deliveryId: undefined,
        status: response.status === "queued" ? "queued" : "failed",
        externalId: undefined,
        error: response.deliveries.find((delivery) => delivery.status === "failed")?.error,
        timestamp: new Date(),
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Notification delivery failed";
      this.logger.error(`Notification send failed: ${message}`);

      return {
        id: trackingId,
        trackingId,
        status: "failed",
        externalId: undefined,
        error: message,
        timestamp: new Date(),
      };
    }
  }
}

function toMessagePriority(priority: NotificationEngineRequest["priority"]): MessagePriority {
  switch (priority) {
    case "high":
      return MessagePriority.HIGH;
    case "low":
      return MessagePriority.LOW;
    default:
      return MessagePriority.NORMAL;
  }
}
