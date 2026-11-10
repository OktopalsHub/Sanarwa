import { Injectable, Logger } from "@nestjs/common";
import { NotificationChannel } from "../../../common/enums/notification-channel.enum";
import { assertSafeWebhookUrl } from "../../../common/security/utils/safe-url";
import { NotificationStoragePolicy } from "../enums/notification-storage-policy.enum";
import { ProviderOrchestratorService } from "../../provider/provider-orchestrator.service";
import { SmartPushRouterService } from "../../provider/services/smart-push-router.service";
import { TopicsService } from "../../topics/topics.service";

export interface DeliverInput {
  tenantId: string;
  projectId?: string;
  channel: NotificationChannel;
  to: string;
  subject?: string;
  data: string;
  variables?: Record<string, any>;
  templateId?: string;
  templateData?: Record<string, any>;
  priority?: "low" | "normal" | "high" | "urgent" | string;
  brandId?: string;
  metadata?: Record<string, any>;
  webhookUrl?: string;
  messageId?: string;
  deliveryId?: string;
}

export interface DeliverOutcome {
  status: "sent" | "failed";
  externalId?: string;
  error?: string;
  providerId?: string;
  retryable?: boolean;
}

@Injectable()
export class DeliveryExecutorService {
  private readonly logger = new Logger(DeliveryExecutorService.name);

  constructor(
    private readonly providerOrchestrator: ProviderOrchestratorService,
    private readonly topicsService?: TopicsService,
    private readonly smartPushRouter?: SmartPushRouterService,
  ) {}

  async deliver(input: DeliverInput): Promise<DeliverOutcome> {
    switch (input.channel) {
      case NotificationChannel.EMAIL:
        return this.deliverEmail(input);
      case NotificationChannel.SMS:
        return this.deliverSms(input);
      case NotificationChannel.PUSH:
        return this.deliverPush(input);
      case NotificationChannel.WHATSAPP:
        return this.deliverWhatsApp(input);
      case NotificationChannel.CHAT:
        return this.deliverChat(input);
      case NotificationChannel.WEBHOOK:
        return this.deliverWebhook(input);
      case NotificationChannel.IN_APP:
        return this.deliverInApp(input);
      case NotificationChannel.VOICE:
        return this.deliverVoice(input);
      default:
        return {
          status: "failed",
          error: `Channel ${input.channel} is not deliverable via the notification engine`,
        };
    }
  }

  private async deliverEmail(input: DeliverInput): Promise<DeliverOutcome> {
    const html = looksLikeMarkup(input.data)
      ? input.data
      : input.data
          .replace(/&/g, "&amp;")
          .replace(/</g, "&lt;")
          .replace(/>/g, "&gt;")
          .replace(/"/g, "&quot;")
          .replace(/'/g, "&#39;");

    const result = await this.providerOrchestrator.sendEmail(
      {
        to: input.to,
        subject: input.subject ?? "Notification",
        text: input.data,
        html,
        templateId: input.templateId,
        templateData: input.templateData ?? input.variables,
      },
      input.tenantId,
      input.brandId,
    );

    return toOutcome(result, "email");
  }

  private async deliverVoice(input: DeliverInput): Promise<DeliverOutcome> {
    const phone = input.to;
    const result = await this.providerOrchestrator.sendVoiceCall(
      {
        to: [phone],
        message: input.data,
        templateId: input.templateId,
        templateData: input.templateData ?? input.variables,
      },
      input.tenantId,
    );

    return toOutcome(result, "telnyx");
  }

  private async deliverSms(input: DeliverInput): Promise<DeliverOutcome> {
    const result = await this.providerOrchestrator.sendSMS(
      { to: input.to, message: input.data },
      input.tenantId,
    );

    return toOutcome(result, "sms");
  }

  private async deliverPush(input: DeliverInput): Promise<DeliverOutcome> {
    const pushPayload = {
      deviceTokens: input.to,
      title: input.subject ?? "Notification",
      body: input.data,
      data: input.variables,
      priority: input.priority === "high" ? ("high" as const) : ("normal" as const),
      ...this.richPushPayload(input.metadata),
    };

    if (this.looksLikeDeviceToken(input.to) || (!this.smartPushRouter && !this.topicsService)) {
      const result = await this.providerOrchestrator.sendPushNotification(
        pushPayload,
        input.tenantId,
        input.brandId,
      );

      return toOutcome(result, "fcm");
    }

    const topic =
      typeof input.metadata?.["topic"] === "string" ? input.metadata["topic"] : undefined;
    const targetUsers =
      topic && this.topicsService
        ? await this.topicsService.listSubscribers(input.tenantId, topic)
        : [(input.metadata?.subscriberId as string | undefined) ?? input.to];

    const routing = await this.smartPushRouter!.routePushNotification(
      {
        ...pushPayload,
        deviceTokens: [],
        targetUsers,
      },
      input.tenantId,
      targetUsers,
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
          { ...plan.payload, deviceTokens: plan.deviceTokens },
          input.tenantId,
          input.brandId,
        ),
      ),
    );

    const failed = responses.find((outcome) => outcome.status === "failed");
    const sent = responses.find((outcome) => outcome.status === "sent");

    return {
      status: failed && !sent ? "failed" : "sent",
      externalId: sent && sent.status === "sent" ? sent.externalId : undefined,
      error: failed && failed.status === "failed" ? failed.reason : undefined,
      providerId: routing.routingPlan[0]?.provider,
    };
  }

  private looksLikeDeviceToken(value: string): boolean {
    return (
      value.includes("ExponentPushToken") || value.length > 80 || /^[a-f0-9:-]{64,}$/i.test(value)
    );
  }

  /**
   * Maps the rich push fields the API exposes onto the adapter payload.
   * Everything is optional — the mandatory shape stays `title + body`.
   */
  private richPushPayload(metadata?: Record<string, any>): Record<string, any> {
    if (!metadata) {
      return {};
    }

    const rich: Record<string, any> = {};
    const number = (value: unknown) =>
      typeof value === "number" && Number.isFinite(value) ? value : undefined;
    const text = (value: unknown) =>
      typeof value === "string" && value.length > 0 ? value : undefined;

    rich.badge = number(metadata.badge);
    rich.sound = text(metadata.sound);
    rich.category = text(metadata.category);
    if (text(metadata.actionUrl)) {
      rich.clickAction = metadata.actionUrl;
    }
    if (Array.isArray(metadata.actions) && metadata.actions.length > 0) {
      rich.actions = metadata.actions;
    }
    if (metadata.deepLink && typeof metadata.deepLink === "object") {
      rich.deepLink = metadata.deepLink;
    }
    if (metadata.android && typeof metadata.android === "object") {
      rich.android = metadata.android;
    }
    if (metadata.ios && typeof metadata.ios === "object") {
      rich.ios = metadata.ios;
    }
    if (Array.isArray(metadata.tags) && metadata.tags.length > 0) {
      rich.tags = metadata.tags;
      rich.threadId = rich.threadId ?? metadata.tags[0];
    }
    if (text(metadata.threadId)) {
      rich.threadId = metadata.threadId;
    }
    if (text(metadata.imageUrl)) {
      rich.imageUrl = metadata.imageUrl;
    }
    const ttl = number(metadata.timeToLive ?? metadata.ttl);
    if (ttl !== undefined) {
      rich.ttl = ttl;
    }
    if (text(metadata.collapseKey)) {
      rich.collapseKey = metadata.collapseKey;
    }

    for (const key of Object.keys(rich)) {
      if (rich[key] === undefined) {
        delete rich[key];
      }
    }
    return rich;
  }

  private async deliverWhatsApp(input: DeliverInput): Promise<DeliverOutcome> {
    const result = await this.providerOrchestrator.sendChatMessage(
      {
        channel: input.to,
        message: input.data,
        subject: input.subject,
        metadata: { ...input.variables, ...input.metadata },
      },
      "whatsapp",
      input.tenantId,
    );

    return toOutcome(result, "whatsapp");
  }

  private async deliverChat(input: DeliverInput): Promise<DeliverOutcome> {
    const providerName =
      typeof input.metadata?.chatProvider === "string" ? input.metadata.chatProvider : "slack";
    const variables = input.variables ?? {};

    const result = await this.providerOrchestrator.sendChatMessage(
      {
        channel: input.to,
        message: input.data,
        subject: input.subject,
        blocks: Array.isArray(variables.blocks) ? variables.blocks : undefined,
        embeds: Array.isArray(variables.embeds) ? variables.embeds : undefined,
        metadata: { ...variables, ...input.metadata },
      },
      providerName,
      input.tenantId,
    );

    return toOutcome(result, providerName);
  }

  private async deliverWebhook(input: DeliverInput): Promise<DeliverOutcome> {
    const webhookUrl = input.webhookUrl ?? input.metadata?.webhookUrl;

    if (!webhookUrl || typeof webhookUrl !== "string") {
      return { status: "failed", error: "Webhook URL is required" };
    }

    await assertSafeWebhookUrl(webhookUrl);

    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      redirect: "error",
      signal: AbortSignal.timeout(30000),
      body: JSON.stringify({
        to: input.to,
        title: input.subject,
        message: input.data,
        data: input.variables,
        tenantId: input.tenantId,
        projectId: input.projectId,
      }),
    });

    if (!response.ok) {
      return { status: "failed", error: `Webhook returned ${response.status}` };
    }

    return { status: "sent", providerId: "webhook" };
  }

  private async deliverInApp(input: DeliverInput): Promise<DeliverOutcome> {
    const notificationType = "info";

    const result = await this.providerOrchestrator.sendInAppNotification(
      {
        userId: [input.to],
        title: input.subject ?? "Notification",
        message: input.data,
        type: notificationType,
        priority: input.priority === "high" ? "high" : input.priority === "low" ? "low" : "normal",
        data: input.variables,
        actions: Array.isArray(input.metadata?.actions) ? input.metadata.actions : undefined,
        persistent: input.templateData?.storagePolicy === NotificationStoragePolicy.FULL,
        messageId: input.messageId,
        deliveryId: input.deliveryId,
      },
      input.tenantId,
    );

    return toOutcome(result, "in_app");
  }
}

function looksLikeMarkup(value: string): boolean {
  const trimmed = value.trim();
  return /<[a-zA-Z]/.test(trimmed) && />/.test(trimmed);
}

function toOutcome(
  outcome:
    | { readonly status: "sent"; readonly externalId?: string; readonly providerId?: string }
    | {
        readonly status: "failed";
        readonly reason: string;
        readonly providerId?: string;
        readonly retryable?: boolean;
      },
  fallbackProviderId: string,
): DeliverOutcome {
  if (outcome.status === "sent") {
    return {
      status: "sent",
      externalId: outcome.externalId,
      providerId: outcome.providerId ?? fallbackProviderId,
    };
  }

  return {
    status: "failed",
    error: outcome.reason,
    providerId: outcome.providerId ?? fallbackProviderId,
    ...(outcome.retryable === undefined ? {} : { retryable: outcome.retryable }),
  };
}
