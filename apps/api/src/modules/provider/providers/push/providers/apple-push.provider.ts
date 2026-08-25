import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { IPushProvider, PushPayload, PushResponse } from "../../push/push-provider.interface";

@Injectable()
export class ApplePushProvider implements IPushProvider {
  private readonly logger = new Logger(ApplePushProvider.name);
  private readonly apnsKeyId: string;
  private readonly apnsTeamId: string;
  private readonly apnsBundleId: string;
  private readonly apnsPrivateKey: string;
  private readonly apnsEnvironment: "development" | "production";

  constructor(private configService: ConfigService) {
    this.apnsKeyId = this.configService.get("APNS_KEY_ID") || "";
    this.apnsTeamId = this.configService.get("APNS_TEAM_ID") || "";
    this.apnsBundleId = this.configService.get("APNS_BUNDLE_ID") || "";
    this.apnsPrivateKey = this.configService.get("APNS_PRIVATE_KEY") || "";
    this.apnsEnvironment = this.configService.get("APNS_ENVIRONMENT", "development") as
      | "development"
      | "production";
  }

  async sendPushNotification(payload: PushPayload): Promise<PushResponse> {
    try {
      const tokens = Array.isArray(payload.deviceTokens)
        ? payload.deviceTokens
        : [payload.deviceTokens];
      const deliveredTo: string[] = [];
      const failedDeliveries: string[] = [];

      // Build standard APNS payload
      const apnsPayload = {
        aps: {
          alert: {
            title: payload.title,
            body: payload.body,
            ...(payload.ios?.subtitle && { subtitle: payload.ios.subtitle }),
            ...(payload.ios?.launchImage && { "launch-image": payload.ios.launchImage }),
          },
          badge: payload.badge,
          sound: payload.sound || "default",
          category: payload.category,
          ...(payload.ios?.threadId && { "thread-id": payload.ios.threadId }),
          ...(payload.ios?.mutableContent && { "mutable-content": 1 }),
          ...(payload.ios?.contentAvailable && { "content-available": 1 }),
          ...(payload.ios?.interruptionLevel && {
            "interruption-level": payload.ios.interruptionLevel,
          }),
        },
        // Custom data payload
        ...payload.data,
        // Deep link support
        ...(payload.deepLink && {
          deep_link: payload.deepLink.url,
          fallback_url: payload.deepLink.fallbackUrl,
          ios_category: payload.deepLink.iosCategory,
        }),
        // Action buttons
        ...(payload.actions && { actions: JSON.stringify(payload.actions) }),
        // Image URL
        ...(payload.imageUrl && { image_url: payload.imageUrl }),
      };

      // Send to each device token
      for (const token of tokens) {
        try {
          await this.sendAPNSNotification(token, apnsPayload, payload.priority);
          deliveredTo.push(token);
          this.logger.debug(`Push notification sent to token: ${token.substring(0, 8)}...`);
        } catch (error) {
          this.logger.warn(
            `Failed to send push to token ${token.substring(0, 8)}...: ${error.message}`,
          );
          failedDeliveries.push(token);
        }
      }

      const messageId = `apple_push_${Date.now()}`;

      this.logger.log(
        `Apple push notification sent to ${deliveredTo.length}/${tokens.length} devices`,
      );

      return {
        success: deliveredTo.length > 0,
        messageId,
        successCount: deliveredTo.length,
        failureCount: failedDeliveries.length,
        failedTokens: failedDeliveries,
        provider: "apple-push",
      };
    } catch (error) {
      this.logger.error(`Failed to send Apple push notification: ${error.message}`, error.stack);
      return {
        success: false,
        error: error.message,
        provider: "apple-push",
      };
    }
  }

  private async sendAPNSNotification(
    deviceToken: string,
    payload: any,
    priority?: "low" | "normal" | "high" | "urgent",
  ): Promise<void> {
    const apnsUrl =
      this.apnsEnvironment === "production"
        ? "https://api.push.apple.com"
        : "https://api.sandbox.push.apple.com";

    // Generate JWT token for APNS authentication
    const jwtToken = await this.generateJWTToken();

    const response = await fetch(`${apnsUrl}/3/device/${deviceToken}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${jwtToken}`,
        "Content-Type": "application/json",
        "apns-topic": this.apnsBundleId,
        "apns-priority": this.mapPriorityToAPNSPriority(priority),
        "apns-push-type": "alert",
        "apns-expiration": (Math.floor(Date.now() / 1000) + 3600).toString(), // 1 hour
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(`APNS error: ${response.status} ${errorBody}`);
    }
  }

  private async generateJWTToken(): Promise<string> {
    // In production, use a proper JWT library like 'jsonwebtoken'
    // This is a simplified version for demonstration
    const header = {
      alg: "ES256",
      kid: this.apnsKeyId,
    };

    const payload = {
      iss: this.apnsTeamId,
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 3600, // 1 hour
    };

    // In production, properly sign this JWT with the APNS private key
    return `apns_jwt_token_${Date.now()}`;
  }

  private mapPriorityToAPNSPriority(priority?: string): string {
    switch (priority) {
      case "urgent":
      case "high":
        return "10"; // High priority
      case "normal":
      case "low":
      default:
        return "5"; // Normal priority
    }
  }

  async validateConfig(): Promise<boolean> {
    return !!(this.apnsKeyId && this.apnsTeamId && this.apnsBundleId && this.apnsPrivateKey);
  }

  getProviderName(): string {
    return "apple-push";
  }
}
