import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import * as webpush from "web-push";
import { IPushProvider, PushPayload, PushResponse } from "../push-provider.interface";
import { WebPushSubscriptionService } from "../../../services/web-push-subscription.service";

/**
 * Browser push via VAPID (Web Push protocol). Compatible with the rest of
 * the push plumbing: subscriptions are device registrations, and expired
 * endpoints are returned as `failedTokens` so the orchestrator prunes them.
 */
@Injectable()
export class WebPushProvider implements IPushProvider {
  private readonly logger = new Logger(WebPushProvider.name);

  private readonly publicKey: string;
  private readonly privateKey: string;
  private readonly subject: string;

  constructor(
    private readonly configService: ConfigService,
    private readonly subscriptions: WebPushSubscriptionService,
  ) {
    this.publicKey = this.configService.get<string>("VAPID_PUBLIC_KEY", "");
    this.privateKey = this.configService.get<string>("VAPID_PRIVATE_KEY", "");
    this.subject = this.configService.get<string>("VAPID_SUBJECT") || "mailto:ops@example.com";
  }

  getProviderName(): string {
    return "web_push";
  }

  async validateConfig(): Promise<boolean> {
    return Boolean(this.publicKey && this.privateKey);
  }

  async sendPushNotification(payload: PushPayload): Promise<PushResponse> {
    if (!this.publicKey || !this.privateKey) {
      return {
        success: false,
        error: "VAPID keys are not configured (VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY)",
        provider: "web_push",
      };
    }

    const endpoints = Array.isArray(payload.deviceTokens)
      ? payload.deviceTokens
      : [payload.deviceTokens];

    const richPayload = payload as PushPayload & { tags?: string[] };
    const body = JSON.stringify({
      notification: {
        title: payload.title,
        body: payload.body,
        icon: payload.imageUrl,
        actions: (payload.actions ?? []).map((action) => ({
          action: action.id,
          title: action.title,
          icon: action.icon,
        })),
        data: {
          ...payload.data,
          deepLink: payload.deepLink?.url,
          tags: richPayload.tags,
        },
      },
    });

    let successCount = 0;
    const failedTokens: string[] = [];

    for (const endpoint of endpoints) {
      const subscription = await this.subscriptions.getByEndpoint(endpoint);
      if (!subscription) {
        failedTokens.push(endpoint);
        continue;
      }

      try {
        await webpush.sendNotification(subscription as any, body, {
          TTL: payload.ttl ?? 86400,
          urgency: payload.priority === "high" ? "high" : "normal",
          vapidDetails: {
            subject: this.subject,
            publicKey: this.publicKey,
            privateKey: this.privateKey,
          },
        });
        successCount++;
      } catch (error) {
        if ([400, 403, 404, 410].includes((error as any)?.statusCode ?? 0)) {
          failedTokens.push(endpoint);
        }
        this.logger.warn(`Web push to ${endpoint.slice(0, 40)}... failed: ${error.message}`);
      }
    }

    const failureCount = endpoints.length - successCount;
    return {
      success: successCount > 0,
      successCount,
      failureCount,
      failedTokens,
      error:
        successCount === 0 && endpoints.length > 0
          ? `Web push: no deliveries (${failureCount} failures)`
          : undefined,
      provider: "web_push",
    };
  }
}
