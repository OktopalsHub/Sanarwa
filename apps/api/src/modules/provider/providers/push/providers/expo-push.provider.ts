import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { IPushProvider, PushPayload, PushResponse } from '../push-provider.interface';

interface ExpoPushResponse {
  data: Array<{ status: string; message?: string; details?: any }>;
  message?: string;
}

@Injectable()
export class ExpoPushProvider implements IPushProvider {
  private readonly logger = new Logger(ExpoPushProvider.name);
  private readonly accessToken: string;
  private readonly apiUrl = 'https://exp.host/--/api/v2/push/send';

  constructor(private configService: ConfigService) {
    this.accessToken = this.configService.get('EXPO_ACCESS_TOKEN') || '';
  }

  async sendPushNotification(payload: PushPayload): Promise<PushResponse> {
    try {
      const tokens = Array.isArray(payload.deviceTokens) ? payload.deviceTokens : [payload.deviceTokens];

      const expoMessages = tokens.map(token => ({
        to: token,
        title: payload.title,
        body: payload.body,
        subtitle: payload.ios?.subtitle,
        data: {
          ...payload.data,
          // Add deep link data for Expo client handling
          ...(payload.deepLink && {
            deepLink: payload.deepLink.url,
            fallbackUrl: payload.deepLink.fallbackUrl,
            androidAction: payload.deepLink.androidAction,
            iosCategory: payload.deepLink.iosCategory,
          }),
          // Add action buttons
          ...(payload.actions && { actions: payload.actions }),
        },
        badge: payload.badge,
        sound: payload.sound || 'default',
        priority: payload.priority || 'high',
        ttl: payload.ttl || 3600,
        channelId: payload.android?.channelId || payload.category,

        // Expo-specific deep linking
        ...(payload.deepLink && {
          // Expo handles deep links via data field, but we can also set categoryId
          categoryId: payload.deepLink.iosCategory,
        }),

        // Android-specific options
        ...(payload.android && {
          android: {
            channelId: payload.android.channelId,
            color: payload.android.color,
            icon: payload.android.icon,
            sticky: payload.android.sticky,
            vibrate: payload.android.vibrate,
          },
        }),

        // iOS-specific options
        ...(payload.ios && {
          ios: {
            sound: payload.sound || 'default',
            badge: payload.badge,
            ...(payload.ios.interruptionLevel && {
              interruptionLevel: payload.ios.interruptionLevel
            }),
            ...(payload.ios.mutableContent && { mutableContent: payload.ios.mutableContent }),
            ...(payload.ios.contentAvailable && { contentAvailable: payload.ios.contentAvailable }),
          },
        }),
      }));

      const response = await fetch(this.apiUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(expoMessages),
      });

      const result = await response.json() as ExpoPushResponse;

      if (!response.ok) {
        throw new Error(`Expo Push API error: ${result.message || response.statusText}`);
      }

      const failedTokens = result.data
        ?.map((res: any, index: number) => res.status === 'error' ? tokens[index] : null)
        .filter((token): token is string => token !== null) || [];

      const successCount = result.data?.filter((res: any) => res.status === 'ok').length || 0;
      const failureCount = tokens.length - successCount;

      this.logger.log(`Expo push sent - Success: ${successCount}, Failure: ${failureCount}`);

      return {
        success: failureCount === 0,
        successCount,
        failureCount,
        failedTokens,
        provider: 'expo-push',
      };
    } catch (error) {
      this.logger.error(`Failed to send Expo push: ${error.message}`, error.stack);
      return {
        success: false,
        error: error.message,
        provider: 'expo-push',
      };
    }
  }

  async validateConfig(): Promise<boolean> {
    return !!this.accessToken;
  }

  getProviderName(): string {
    return 'expo-push';
  }
}