import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { GoogleAuth } from "google-auth-library";
import { IPushProvider, PushPayload, PushResponse } from "../push-provider.interface";

interface FCMResponse {
  success: number;
  failure: number;
  multicast_id?: string | number;
  results?: Array<{ error?: string; message_id?: string }>;
  error?: string;
}

@Injectable()
export class FCMProvider implements IPushProvider {
  private readonly logger = new Logger(FCMProvider.name);
  private readonly serverKey: string;
  private readonly projectId: string;
  private readonly serviceAccountJson: string;

  constructor(private configService: ConfigService) {
    this.serverKey = this.configService.get("FCM_SERVER_KEY") || "";
    this.projectId = this.configService.get("FCM_PROJECT_ID") || "";
    this.serviceAccountJson = this.configService.get("FCM_SERVICE_ACCOUNT_JSON") || this.configService.get("FCM_SERVICE_ACCOUNT") || "";
  }

  async sendPushNotification(payload: PushPayload): Promise<PushResponse> {
    try {
      const tokens = Array.isArray(payload.deviceTokens)
        ? payload.deviceTokens
        : [payload.deviceTokens];

      // Prefer HTTP v1 if service account available (world-class, not legacy serverKey)
      if (this.serviceAccountJson && this.projectId) {
        return this.sendViaHttpV1(tokens, payload);
      }

      // Build FCM payload with deep linking support
      const fcmPayload: any = {
        registration_ids: tokens,
        notification: {
          title: payload.title,
          body: payload.body,
          image: payload.imageUrl,
          sound: payload.sound || "default",
          badge: payload.badge,
          click_action: payload.clickAction || payload.deepLink?.url,
        },
        data: {
          ...payload.data,
          // Add deep link data for client-side handling
          ...(payload.deepLink && {
            deep_link: payload.deepLink.url,
            fallback_url: payload.deepLink.fallbackUrl,
            android_action: payload.deepLink.androidAction,
            ios_category: payload.deepLink.iosCategory,
          }),
        },
        priority: payload.priority || "high",
        time_to_live: payload.ttl || 3600,
      };

      // Add Android-specific options
      if (payload.android) {
        fcmPayload.android = {
          notification: {
            ...fcmPayload.notification,
            channel_id: payload.android.channelId,
            color: payload.android.color,
            icon: payload.android.icon,
            tag: payload.android.tag,
            sticky: payload.android.sticky,
            vibrate_timings: payload.android.vibrate,
            light_settings: payload.android.lights
              ? {
                  color: payload.android.lights.color,
                  light_on_duration: `${payload.android.lights.onMs}ms`,
                  light_off_duration: `${payload.android.lights.offMs}ms`,
                }
              : undefined,
          },
          data: fcmPayload.data,
        };
      }

      // Add iOS-specific options (APNS)
      if (payload.ios) {
        fcmPayload.apns = {
          payload: {
            aps: {
              alert: {
                title: payload.title,
                body: payload.body,
                subtitle: payload.ios.subtitle,
                "launch-image": payload.ios.launchImage,
              },
              badge: payload.badge,
              sound: payload.sound || "default",
              "thread-id": payload.ios.threadId,
              "mutable-content": payload.ios.mutableContent ? 1 : 0,
              "content-available": payload.ios.contentAvailable ? 1 : 0,
              "interruption-level": payload.ios.interruptionLevel || "active",
              category: payload.category || payload.ios.threadId,
            },
            // Custom data
            ...fcmPayload.data,
          },
        };
      }

      // Add action buttons if provided
      if (payload.actions && payload.actions.length > 0) {
        fcmPayload.data.actions = JSON.stringify(payload.actions);
      }

      const response = await fetch("https://fcm.googleapis.com/fcm/send", {
        method: "POST",
        headers: {
          Authorization: `key=${this.serverKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(fcmPayload),
      });

      const result = (await response.json()) as FCMResponse;

      if (!response.ok) {
        throw new Error(`FCM API error: ${result.error || response.statusText}`);
      }

      const failedTokens =
        result.results
          ?.map((res: any, index: number) => (res.error ? tokens[index] : null))
          .filter((token): token is string => token !== null) || [];

      this.logger.log(`FCM push sent - Success: ${result.success}, Failure: ${result.failure}`);

      return {
        success: result.failure === 0,
        messageId: result.multicast_id?.toString(),
        successCount: result.success,
        failureCount: result.failure,
        failedTokens,
        provider: "fcm",
      };
    } catch (error) {
      this.logger.error(`Failed to send FCM push: ${error.message}`, error.stack);
      return {
        success: false,
        error: error.message,
        provider: "fcm",
      };
    }
  }

  private async sendViaHttpV1(tokens: string[], payload: PushPayload): Promise<PushResponse> {
    const serviceAccount = JSON.parse(this.serviceAccountJson);
    const auth = new GoogleAuth({
      credentials: serviceAccount,
      scopes: ["https://www.googleapis.com/auth/firebase.messaging"],
    });
    const client = await auth.getClient();
    const accessToken = await client.getAccessToken();
    const token = accessToken.token || "";

    let successCount = 0;
    let failureCount = 0;
    const failedTokens: string[] = [];

    for (const deviceToken of tokens) {
      const message: any = {
        message: {
          token: deviceToken,
          notification: { title: payload.title, body: payload.body, image: payload.imageUrl },
          data: payload.data ? Object.fromEntries(Object.entries(payload.data).map(([k, v]) => [k, String(v)])) : undefined,
          android: payload.android
            ? { notification: { channel_id: payload.android.channelId, color: payload.android.color, icon: payload.android.icon, tag: payload.android.tag } }
            : undefined,
          apns: payload.ios
            ? { payload: { aps: { alert: { title: payload.title, body: payload.body }, badge: payload.badge, sound: payload.sound || "default" } } }
            : undefined,
        },
      };

      const res = await fetch(`https://fcm.googleapis.com/v1/projects/${this.projectId}/messages:send`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify(message),
      });
      if (res.ok) successCount++;
      else {
        failureCount++;
        failedTokens.push(deviceToken);
        this.logger.warn(`FCM v1 failed for ${deviceToken.slice(0, 8)}: ${res.status} ${await res.text()}`);
      }
    }

    this.logger.log(`FCM v1 push sent - Success: ${successCount}, Failure: ${failureCount}`);
    return { success: failureCount === 0, successCount, failureCount, failedTokens, provider: "fcm" };
  }

  async validateConfig(): Promise<boolean> {
    if (this.serviceAccountJson && this.projectId) return true;
    return !!(this.serverKey && this.projectId);
  }

  getProviderName(): string {
    return "fcm";
  }
}
