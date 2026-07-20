import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SNSClient, PublishCommand, CreatePlatformEndpointCommand } from '@aws-sdk/client-sns';
import { IPushProvider, PushPayload, PushResponse } from '../push-provider.interface';

@Injectable()
export class SNSProvider implements IPushProvider {
  private readonly logger = new Logger(SNSProvider.name);
  private snsClient: SNSClient;
  private readonly platformApplicationArn: string;

  constructor(private configService: ConfigService) {
    const accessKeyId = this.configService.get('AWS_ACCESS_KEY_ID') || '';
    const secretAccessKey = this.configService.get('AWS_SECRET_ACCESS_KEY') || '';

    this.snsClient = new SNSClient({
      region: this.configService.get('AWS_REGION', 'us-east-1'),
      credentials: {
        accessKeyId,
        secretAccessKey,
      },
    });
    this.platformApplicationArn = this.configService.get('SNS_PLATFORM_APPLICATION_ARN') || '';
  }

  async sendPushNotification(payload: PushPayload): Promise<PushResponse> {
    try {
      const tokens = Array.isArray(payload.deviceTokens) ? payload.deviceTokens : [payload.deviceTokens];
      let successCount = 0;
      let failureCount = 0;
      const failedTokens: string[] = [];

      // Build platform-specific messages with deep linking support
      const gcmData = {
        ...payload.data,
        ...(payload.deepLink && {
          deep_link: payload.deepLink.url,
          fallback_url: payload.deepLink.fallbackUrl,
          android_action: payload.deepLink.androidAction,
        }),
        ...(payload.actions && { actions: JSON.stringify(payload.actions) }),
      };

      const apnsData = {
        ...payload.data,
        ...(payload.deepLink && {
          deep_link: payload.deepLink.url,
          fallback_url: payload.deepLink.fallbackUrl,
          ios_category: payload.deepLink.iosCategory,
        }),
        ...(payload.actions && { actions: JSON.stringify(payload.actions) }),
      };

      const message = {
        default: payload.body,

        // Android (GCM/FCM)
        GCM: JSON.stringify({
          notification: {
            title: payload.title,
            body: payload.body,
            image: payload.imageUrl,
            sound: payload.sound || 'default',
            click_action: payload.clickAction || payload.deepLink?.url,
            ...(payload.android && {
              channel_id: payload.android.channelId,
              color: payload.android.color,
              icon: payload.android.icon,
              tag: payload.android.tag,
              sticky: payload.android.sticky,
            }),
          },
          data: gcmData,
          priority: payload.priority || 'high',
          time_to_live: payload.ttl || 3600,
        }),

        // iOS (APNS)
        APNS: JSON.stringify({
          aps: {
            alert: {
              title: payload.title,
              body: payload.body,
              ...(payload.ios?.subtitle && { subtitle: payload.ios.subtitle }),
              ...(payload.ios?.launchImage && { 'launch-image': payload.ios.launchImage }),
            },
            badge: payload.badge,
            sound: payload.sound || 'default',
            category: payload.category || payload.deepLink?.iosCategory,
            ...(payload.ios?.threadId && { 'thread-id': payload.ios.threadId }),
            ...(payload.ios?.mutableContent && { 'mutable-content': 1 }),
            ...(payload.ios?.contentAvailable && { 'content-available': 1 }),
            ...(payload.ios?.interruptionLevel && { 'interruption-level': payload.ios.interruptionLevel }),
          },
          ...apnsData,
        }),

        // iOS Sandbox (for development)
        APNS_SANDBOX: JSON.stringify({
          aps: {
            alert: {
              title: payload.title,
              body: payload.body,
              ...(payload.ios?.subtitle && { subtitle: payload.ios.subtitle }),
            },
            badge: payload.badge,
            sound: payload.sound || 'default',
            category: payload.category || payload.deepLink?.iosCategory,
          },
          ...apnsData,
        }),
      };

      for (const token of tokens) {
        try {
          // Create endpoint for the token
          const endpointCommand = new CreatePlatformEndpointCommand({
            PlatformApplicationArn: this.platformApplicationArn,
            Token: token,
          });

          const endpointResult = await this.snsClient.send(endpointCommand);

          // Publish to the endpoint
          const publishCommand = new PublishCommand({
            TargetArn: endpointResult.EndpointArn,
            Message: JSON.stringify(message),
            MessageStructure: 'json',
          });

          await this.snsClient.send(publishCommand);
          successCount++;
        } catch (error) {
          this.logger.warn(`Failed to send to token ${token}: ${error.message}`);
          failureCount++;
          failedTokens.push(token);
        }
      }

      this.logger.log(`SNS push sent - Success: ${successCount}, Failure: ${failureCount}`);

      return {
        success: failureCount === 0,
        successCount,
        failureCount,
        failedTokens,
        provider: 'sns',
      };
    } catch (error) {
      this.logger.error(`Failed to send SNS push: ${error.message}`, error.stack);
      return {
        success: false,
        error: error.message,
        provider: 'sns',
      };
    }
  }

  async validateConfig(): Promise<boolean> {
    return !!this.platformApplicationArn;
  }

  getProviderName(): string {
    return 'sns';
  }
}