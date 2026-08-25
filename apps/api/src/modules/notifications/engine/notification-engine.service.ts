import { Injectable, Logger } from "@nestjs/common";
import { assertSafeWebhookUrl } from "../../../common/security/utils/safe-url";
import { ProviderOrchestratorService } from "../../provider/provider-orchestrator.service";
import { SmartPushRouterService } from "../../provider/services/smart-push-router.service";
import { NotificationStorageService } from "../storage/notification-storage.service";
import { NotificationStoragePolicy } from "../enums/notification-storage-policy.enum";
import {
  MessagingEngineRequest,
  NotificationEngineRequest,
  NotificationEngineResponse,
} from "./notification-engine.types";
import { NotificationQueueService } from "../../messaging/queue/notification-queue.service";
import { MessagePriority, MessageStatus } from "../../messaging/message.entity";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { Message } from "../../messaging/message.entity";

interface ChannelDeliveryResult {
  status: "sent" | "delivered" | "failed";
  externalId?: string;
  error?: string;
  providerId?: string;
}

@Injectable()
export class NotificationEngineService {
  private readonly logger = new Logger(NotificationEngineService.name);

  constructor(
    private readonly storageService: NotificationStorageService,
    private readonly providerOrchestrator: ProviderOrchestratorService,
    private readonly smartPushRouter: SmartPushRouterService,
    private readonly notificationQueueService: NotificationQueueService,
    @InjectRepository(Message)
    private readonly messageRepository: Repository<Message>,
  ) {}

  async send(request: NotificationEngineRequest): Promise<NotificationEngineResponse> {
    const trackingId = request.trackingId ?? this.generateTrackingId();
    const policy = await this.storageService.getStoragePolicy(request.tenantId);

    if (request.scheduledAt && request.scheduledAt.getTime() > Date.now()) {
      return this.enqueueScheduledSend(request, trackingId, policy);
    }

    const context = await this.storageService.persistSendContext({
      tenantId: request.tenantId,
      projectId: request.projectId,
      channel: request.channel,
      to: request.to,
      trackingId,
      title: request.title,
      message: request.message,
      policy,
      priority: request.priority,
      expiresAt: request.expiresAt,
      templateId: request.templateId,
      brandId: request.brandId,
      subscriberId: request.subscriberId ?? request.to,
      metadata: {
        ...request.metadata,
        data: request.data,
        webhookUrl: request.webhookUrl,
      },
    });

    try {
      const result = await this.deliver(request);

      if (context.delivery?.id) {
        await this.storageService.updateDeliveryOutcome(
          context.delivery.id,
          context.log.id,
          result,
        );
      } else if (context.log.id) {
        await this.storageService.updateDeliveryOutcome(undefined, context.log.id, result);
      }

      if (context.message?.id) {
        await this.messageRepository.update(context.message.id, {
          status: result.status === "failed" ? MessageStatus.FAILED : MessageStatus.DELIVERED,
          deliveredAt: result.status === "failed" ? undefined : new Date(),
          errorMessage: result.error,
        });
      }

      if (policy === NotificationStoragePolicy.EPHEMERAL && context.message?.id) {
        await this.storageService.finalizeEphemeral(context.message.id, context.log.id);
      }

      return {
        id: context.log.id,
        trackingId,
        messageId: context.message?.id,
        deliveryId: context.delivery?.id,
        status: result.status,
        externalId: result.externalId,
        error: result.error,
        timestamp: new Date(),
      };
    } catch (error) {
      this.logger.error(`Notification delivery failed: ${error.message}`, error.stack);

      if (context.delivery?.id) {
        await this.storageService.updateDeliveryOutcome(context.delivery.id, context.log.id, {
          status: "failed",
          error: error.message,
        });
      }

      return {
        id: context.log.id ?? trackingId,
        trackingId,
        messageId: context.message?.id,
        deliveryId: context.delivery?.id,
        status: "failed",
        error: error.message,
        timestamp: new Date(),
      };
    }
  }

  async sendMessagingRequest(request: MessagingEngineRequest): Promise<{
    id: string;
    status: MessageStatus;
    channels: string[];
    recipientCount: number;
    deliveries: Array<{
      channel: string;
      status: "delivered" | "failed";
      trackingId?: string;
      error?: string;
    }>;
    scheduledAt?: Date;
    createdAt: Date;
  }> {
    if (request.scheduledAt) {
      return this.scheduleMessagingRequest(request);
    }

    const deliveries: Array<{
      channel: string;
      status: "delivered" | "failed";
      trackingId?: string;
      error?: string;
    }> = [];

    for (const channel of request.channels) {
      const engineChannel = this.normalizeChannel(channel);
      if (!engineChannel) {
        this.logger.warn(`Unsupported channel: ${channel}`);
        continue;
      }

      for (const recipient of request.recipients) {
        const to = this.resolveRecipientAddress(recipient, engineChannel);
        if (!to) {
          deliveries.push({
            channel,
            status: "failed",
            error: "Missing recipient address for channel",
          });
          continue;
        }

        try {
          const result = await this.send({
            tenantId: request.tenantId,
            projectId: request.projectId,
            channel: engineChannel,
            to,
            title: request.subject,
            message: request.content ?? "",
            data: request.data,
            templateId: request.templateId,
            priority: request.priority as NotificationEngineRequest["priority"],
            brandId: request.brandId,
            subscriberId: recipient.subscriberId ?? recipient.userId ?? recipient.id,
            metadata: {
              ...request.metadata,
              recipientId: recipient.id,
            },
          });

          deliveries.push({
            channel,
            status: result.status === "failed" ? "failed" : "delivered",
            trackingId: result.trackingId,
            error: result.error,
          });
        } catch (error) {
          deliveries.push({
            channel,
            status: "failed",
            error: error.message,
          });
        }
      }
    }

    const hasSuccess = deliveries.some((item) => item.status === "delivered");
    const hasFailures = deliveries.some((item) => item.status === "failed");

    let status = MessageStatus.FAILED;
    if (hasSuccess && !hasFailures) {
      status = MessageStatus.DELIVERED;
    } else if (hasSuccess && hasFailures) {
      status = MessageStatus.PARTIALLY_DELIVERED;
    }

    return {
      id: `msg_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
      status,
      channels: request.channels,
      recipientCount: request.recipients.length,
      deliveries,
      createdAt: new Date(),
    };
  }

  private async enqueueScheduledSend(
    request: NotificationEngineRequest,
    trackingId: string,
    policy: NotificationStoragePolicy,
  ): Promise<NotificationEngineResponse> {
    const persistBody = this.storageService.shouldPersistBody(policy);
    const persistMetadata = this.storageService.shouldPersistMetadata(policy);
    const messageChannel = this.normalizeChannel(request.channel);
    const channels = messageChannel ? [messageChannel] : [];

    const message = await this.messageRepository.save(
      this.messageRepository.create({
        tenantId: request.tenantId,
        channels: channels as any,
        recipients: [{ id: request.to, userId: request.subscriberId ?? request.to }],
        templateId: request.templateId,
        data: request.data ?? {},
        subject: persistBody ? request.title : undefined,
        content: persistBody ? request.message : undefined,
        scheduledAt: request.scheduledAt,
        priority: this.toMessagePriority(request.priority),
        status: MessageStatus.PENDING,
        metadata: {
          ...request.metadata,
          projectId: request.projectId,
          trackingId,
          storagePolicy: policy,
          brandId: request.brandId,
          channel: request.channel,
          to: request.to,
        },
      }),
    );

    await this.notificationQueueService.addNotificationJob(
      message.id,
      request.tenantId,
      this.toMessagePriority(request.priority),
      request.scheduledAt,
    );

    if (persistMetadata) {
      await this.storageService.createTrackingLog({
        tenantId: request.tenantId,
        projectId: request.projectId,
        channel: request.channel,
        to: request.to,
        trackingId,
        priority: request.priority,
        scheduledAt: request.scheduledAt,
        templateId: request.templateId,
        messageId: message.id,
      });
    }

    return {
      id: message.id,
      trackingId,
      messageId: message.id,
      status: "queued",
      timestamp: new Date(),
    };
  }

  private async scheduleMessagingRequest(request: MessagingEngineRequest) {
    const policy = await this.storageService.getStoragePolicy(request.tenantId);
    const persistBody = this.storageService.shouldPersistBody(policy);

    const message = await this.messageRepository.save(
      this.messageRepository.create({
        tenantId: request.tenantId,
        channels: request.channels as any,
        recipients: request.recipients,
        templateId: request.templateId,
        data: request.data ?? {},
        subject: persistBody ? request.subject : undefined,
        content: persistBody ? request.content : undefined,
        scheduledAt: request.scheduledAt,
        priority: this.toMessagePriority(request.priority),
        status: MessageStatus.PENDING,
        metadata: {
          ...request.metadata,
          projectId: request.projectId,
          storagePolicy: policy,
          brandId: request.brandId,
        },
      }),
    );

    await this.notificationQueueService.addNotificationJob(
      message.id,
      request.tenantId,
      this.toMessagePriority(request.priority),
      request.scheduledAt,
    );

    return {
      id: message.id,
      status: message.status,
      channels: message.channels,
      recipientCount: message.recipients.length,
      deliveries: [],
      scheduledAt: message.scheduledAt,
      createdAt: message.createdAt,
    };
  }

  private async deliver(request: NotificationEngineRequest): Promise<ChannelDeliveryResult> {
    switch (request.channel) {
      case "email":
        return this.sendEmail(request);
      case "sms":
        return this.sendSMS(request);
      case "push":
        return this.sendPush(request);
      case "whatsapp":
        return this.sendWhatsApp(request);
      case "webhook":
        return this.sendWebhook(request);
      case "in_app":
        return this.sendInApp(request);
      default:
        throw new Error(`Unsupported channel: ${request.channel}`);
    }
  }

  private async sendEmail(request: NotificationEngineRequest): Promise<ChannelDeliveryResult> {
    const html = request.message
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
    const result = await this.providerOrchestrator.sendEmail(
      {
        to: request.to,
        subject: request.title ?? "Notification",
        text: request.message,
        html,
        templateId: request.templateId,
        templateData: request.templateData ?? request.data,
      },
      request.tenantId,
      request.brandId,
    );

    return {
      status: "sent",
      externalId: result?.messageId ?? result?.MessageId,
      providerId: result?.provider ?? "email",
    };
  }

  private async sendSMS(request: NotificationEngineRequest): Promise<ChannelDeliveryResult> {
    const result = await this.providerOrchestrator.sendSMS(
      {
        to: request.to,
        message: request.message,
        metadata: request.data,
      },
      request.tenantId,
    );

    return {
      status: result?.success === false ? "failed" : "sent",
      externalId: result?.messageId,
      error: result?.error,
      providerId: result?.provider,
    };
  }

  private async sendPush(request: NotificationEngineRequest): Promise<ChannelDeliveryResult> {
    const title = request.title ?? "Notification";
    const pushPayload = {
      deviceTokens: request.to,
      title,
      body: request.message,
      data: request.data,
      priority: request.priority === "high" ? ("high" as const) : ("normal" as const),
    };

    if (this.looksLikeDeviceToken(request.to)) {
      const result = await this.providerOrchestrator.sendPushNotification(
        pushPayload,
        request.tenantId,
        request.brandId,
      );

      return {
        status: result?.success === false ? "failed" : "sent",
        externalId: result?.messageId,
        error: result?.error,
        providerId: result?.provider,
      };
    }

    const routing = await this.smartPushRouter.routePushNotification(
      {
        ...pushPayload,
        deviceTokens: [],
        targetUsers: [request.subscriberId ?? request.to],
      },
      request.tenantId,
      [request.subscriberId ?? request.to],
    );

    if (routing.routingPlan.length === 0) {
      return {
        status: "failed",
        error: "No registered devices found for push recipient",
      };
    }

    const responses = await Promise.all(
      routing.routingPlan.map((plan) =>
        this.providerOrchestrator.sendPushNotification(
          {
            ...plan.payload,
            deviceTokens: plan.deviceTokens,
          },
          request.tenantId,
          request.brandId,
        ),
      ),
    );

    const failed = responses.find((response) => response?.success === false);
    const success = responses.find((response) => response?.success !== false);

    return {
      status: failed && !success ? "failed" : "sent",
      externalId: success?.messageId,
      error: failed?.error,
      providerId: success?.provider ?? routing.routingPlan[0]?.provider,
    };
  }

  private async sendWhatsApp(request: NotificationEngineRequest): Promise<ChannelDeliveryResult> {
    const result = await this.providerOrchestrator.sendChatMessage(
      {
        channel: request.to,
        message: request.message,
        metadata: request.data,
      },
      "whatsapp",
      request.tenantId,
    );

    return {
      status: "sent",
      externalId: result?.messageId ?? result?.id,
      providerId: "whatsapp",
    };
  }

  private async sendWebhook(request: NotificationEngineRequest): Promise<ChannelDeliveryResult> {
    const webhookUrl = request.webhookUrl ?? request.metadata?.webhookUrl;
    if (!webhookUrl) {
      return { status: "failed", error: "Webhook URL is required" };
    }

    assertSafeWebhookUrl(webhookUrl);

    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        to: request.to,
        title: request.title,
        message: request.message,
        data: request.data,
        tenantId: request.tenantId,
        projectId: request.projectId,
      }),
    });

    if (!response.ok) {
      return {
        status: "failed",
        error: `Webhook returned ${response.status}`,
      };
    }

    return {
      status: "sent",
      externalId: `webhook_${Date.now()}`,
      providerId: "webhook",
    };
  }

  private async sendInApp(request: NotificationEngineRequest): Promise<ChannelDeliveryResult> {
    const result = await this.providerOrchestrator.sendInAppNotification(
      {
        userId: [request.subscriberId ?? request.to],
        title: request.title ?? "Notification",
        message: request.message,
        type: "info",
        priority:
          request.priority === "high" ? "high" : request.priority === "low" ? "low" : "normal",
        data: request.data,
        persistent:
          (await this.storageService.getStoragePolicy(request.tenantId)) ===
          NotificationStoragePolicy.FULL,
      },
      request.tenantId,
    );

    if (result?.success === false) {
      return {
        status: "failed",
        error: result.error ?? "In-app notification failed",
      };
    }

    return {
      status: "sent",
      externalId: result?.messageId,
      providerId: "in_app",
    };
  }

  private normalizeChannel(channel: string) {
    const normalized = channel.toLowerCase();
    if (normalized === "inapp") return "in_app" as const;
    if (
      normalized === "email" ||
      normalized === "sms" ||
      normalized === "push" ||
      normalized === "whatsapp" ||
      normalized === "webhook" ||
      normalized === "in_app"
    ) {
      return normalized;
    }
    return null;
  }

  private resolveRecipientAddress(
    recipient: MessagingEngineRequest["recipients"][number],
    channel: string,
  ): string | null {
    switch (channel) {
      case "email":
        return recipient.email ?? null;
      case "sms":
        return recipient.phone ?? null;
      case "whatsapp":
        return recipient.whatsappNumber ?? recipient.phone ?? null;
      case "push":
        return recipient.deviceToken ?? recipient.subscriberId ?? recipient.userId ?? recipient.id;
      case "in_app":
        return recipient.subscriberId ?? recipient.userId ?? recipient.id;
      case "webhook":
        return recipient.id;
      default:
        return recipient.id;
    }
  }

  private looksLikeDeviceToken(value: string): boolean {
    return (
      value.includes("ExponentPushToken") || value.length > 80 || /^[a-f0-9:-]{64,}$/i.test(value)
    );
  }

  private toMessagePriority(priority?: string): MessagePriority {
    switch (priority) {
      case "high":
        return MessagePriority.HIGH;
      case "low":
        return MessagePriority.LOW;
      case "urgent":
        return MessagePriority.URGENT;
      default:
        return MessagePriority.NORMAL;
    }
  }

  private generateTrackingId(): string {
    return `ntf_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
  }
}
