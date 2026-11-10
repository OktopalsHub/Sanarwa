import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { EventEmitter2 } from "@nestjs/event-emitter";
import { InjectRepository } from "@nestjs/typeorm";
import { DeepPartial, Repository } from "typeorm";
import { InAppNotification } from "../../../messaging/entities/in-app-notification.entity";
import { InAppPayload, InAppResponse } from "./in-app-provider.interface";
import { WebSocketProvider } from "./providers/websocket.provider";
import { SSEProvider } from "./providers/sse.provider";

@Injectable()
export class InAppOrchestratorService {
  private readonly logger = new Logger(InAppOrchestratorService.name);

  constructor(
    private configService: ConfigService,
    private webSocketProvider: WebSocketProvider,
    private sseProvider: SSEProvider,
    @InjectRepository(InAppNotification)
    private readonly inAppRepo: Repository<InAppNotification>,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  private async persistNotification(
    payload: InAppPayload & { transactionId?: string; feedId?: string; tenantId?: string },
  ): Promise<InAppNotification> {
    const userIds = Array.isArray(payload.userId) ? payload.userId : [payload.userId];
    const subscriberId = userIds[0] as string;
    const userId = subscriberId;

    const tid = (payload as any).transactionId;
    if (tid) {
      const existing = await this.inAppRepo.findOne({
        where: { transactionId: tid, tenantId: (payload as any).tenantId } as any,
      });
      if (existing) {
        this.logger.log(`In-App idempotent hit transactionId=${tid} -> ${existing.id}`);
        return existing;
      }
    }

    const tenantId = payload.tenantId ?? payload.data?.tenantId;

    if (!tenantId) {
      throw new Error("In-app notification persist requires tenantId");
    }

    const notificationInput: DeepPartial<InAppNotification> = {
      title: payload.title,
      message: payload.message,
      channel: "in_app",
      messageId: payload.messageId,
      deliveryId: payload.deliveryId,
      type: (payload.type as any) || "info",
      status: "pending" as any,
      category: payload.data?.category || "general",
      data: payload.data,
      metadata: payload.data,
      userId,
      subscriberId,
      tenantId,
      transactionId: tid,
      feedId: (payload as any).feedId || payload.data?.feedId || "default",
      seen: false,
      archived: false,
      priority: payload.priority || "normal",
      avatar: payload.data?.avatar,
      actions: payload.actions,
      expiresAt: payload.expiresAt,
    };
    const n = this.inAppRepo.create(notificationInput);
    const saved = await this.inAppRepo.save(n);
    this.logger.log(`In-App persisted ${saved.id} for ${subscriberId} feed:${saved.feedId}`);
    return saved;
  }

  async sendInAppNotification(
    payload: InAppPayload & { transactionId?: string; feedId?: string; tenantId?: string },
  ): Promise<InAppResponse> {
    let persisted: InAppNotification | null = null;
    try {
      persisted = await this.persistNotification(payload);
    } catch (e) {
      this.logger.warn(`In-App persist failed, delivering without a feed entry: ${e.message}`);
    }

    if (persisted) {
      try {
        const userIds = Array.isArray(payload.userId) ? payload.userId : [payload.userId];
        for (const uid of userIds) {
          if (uid === "*") continue;
          this.eventEmitter.emit("in-app.notification.created", {
            tenantId: (persisted as any).tenantId,
            subscriberId: uid,
            notification: persisted,
          });
        }
        persisted.status = "sent" as any;
        persisted.sentAt = new Date();
        await this.inAppRepo.save(persisted);
      } catch (e) {
        this.logger.warn(`In-App gateway emit failed (still persisted): ${e.message}`);
      }
    }

    try {
      if (await this.webSocketProvider.validateConfig()) {
        const result = await this.webSocketProvider.sendNotification(payload);
        if (result.success) return { ...result, messageId: persisted?.id || result.messageId };
      }
      const fallback = await this.sseProvider.sendNotification(payload);
      return {
        ...fallback,
        messageId: persisted?.id || fallback.messageId,
        success: !!persisted || fallback.success,
      } as any;
    } catch (error) {
      return {
        success: !!persisted,
        messageId: persisted?.id,
        provider: "in-app-worldclass-persist",
        error: error.message,
      } as any;
    }
  }

  async sendToRoom(roomId: string, payload: InAppPayload): Promise<InAppResponse> {
    return this.sendInAppNotification({ ...payload, roomId } as any);
  }
  async sendBatchNotifications(
    notifications: Array<{
      userId: string | string[];
      title: string;
      message: string;
      type?: InAppPayload["type"];
      priority?: InAppPayload["priority"];
      data?: Record<string, any>;
    }>,
  ): Promise<InAppResponse[]> {
    return Promise.all(
      notifications.map((n) =>
        this.sendInAppNotification({ ...n, transactionId: (n as any).transactionId } as any),
      ),
    );
  }
  async sendCallNotification(
    payload: InAppPayload & { callData: NonNullable<InAppPayload["callData"]> },
  ): Promise<InAppResponse> {
    return this.sendInAppNotification(payload as any);
  }
  async sendSystemAnnouncement(
    title: string,
    message: string,
    options?: any,
  ): Promise<InAppResponse> {
    return this.sendInAppNotification({
      userId: ["*"],
      title,
      message,
      type: options?.type || "info",
      priority: options?.priority || "normal",
      persistent: options?.persistent || true,
      data: options?.data,
    } as any);
  }
  async sendActivityNotification(userId: string, activity: any): Promise<InAppResponse> {
    return this.sendInAppNotification({
      userId: activity.roomId ? ["*"] : [userId],
      title: "User Activity",
      message: `User ${userId} is ${activity.type}`,
      type: "info",
      priority: "low",
      persistent: false,
      data: { activityType: activity.type, userId, roomId: activity.roomId, ...activity.metadata },
      roomId: activity.roomId,
    } as any);
  }
  async sendProgressNotification(userId: string, progress: any): Promise<InAppResponse> {
    return this.sendInAppNotification({
      userId,
      title: progress.taskName,
      message: progress.message || `${progress.status} - ${progress.percentage}%`,
      type:
        progress.status === "failed"
          ? "error"
          : progress.status === "completed"
            ? "success"
            : "info",
      priority: "normal",
      persistent: progress.status === "completed" || progress.status === "failed",
      data: { taskId: progress.taskId, percentage: progress.percentage, status: progress.status },
    } as any);
  }
  async getProviderStatus(): Promise<any> {
    return {
      webSocket: { available: await this.webSocketProvider.validateConfig(), healthy: true },
      sse: { available: await this.sseProvider.validateConfig(), healthy: true },
      gateway: { available: true, healthy: true },
      persist: { available: true },
    };
  }
}
