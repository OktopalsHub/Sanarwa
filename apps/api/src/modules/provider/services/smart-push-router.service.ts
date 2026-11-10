import { Injectable, Logger } from "@nestjs/common";
import { DeviceRegistrationService } from "./device-registration.service";
import { DevicePlatform, PushProvider } from "../enums/device-platform.enum";
import { PushPayload } from "../providers/push/push-provider.interface";

export interface SmartPushPayload extends PushPayload {
  targetUsers?: string[];
  targetPlatforms?: DevicePlatform[];
  fallbackToAll?: boolean;
}

export interface PushRoutingResult {
  routingPlan: Array<{
    provider: PushProvider;
    platform: DevicePlatform;
    deviceTokens: string[];
    payload: PushPayload;
  }>;
  totalDevices: number;
  platformBreakdown: Record<DevicePlatform, number>;
}

@Injectable()
export class SmartPushRouterService {
  private readonly logger = new Logger(SmartPushRouterService.name);

  constructor(private readonly deviceRegistrationService: DeviceRegistrationService) {}

  async routePushNotification(
    payload: SmartPushPayload,
    tenantId: string,
    userIds?: string[],
  ): Promise<PushRoutingResult> {
    const targetUserIds = userIds || payload.targetUsers || [];
    if (targetUserIds.length === 0) {
      throw new Error("No target users specified for push notification");
    }

    const allDevices = await Promise.all(
      targetUserIds.map((subscriberId) =>
        this.deviceRegistrationService.getSubscriberDevices(subscriberId, tenantId),
      ),
    );

    const devices = allDevices.flat();

    if (devices.length === 0) {
      this.logger.warn(`No devices found for users: ${targetUserIds.join(", ")}`);
      return {
        routingPlan: [],
        totalDevices: 0,
        platformBreakdown: {} as Record<DevicePlatform, number>,
      };
    }

    const filteredDevices = payload.targetPlatforms
      ? devices.filter((device) => payload.targetPlatforms!.includes(device.platform))
      : devices;

    const deviceGroups = this.groupDevicesByProviderAndPlatform(filteredDevices);

    const routingPlan = Object.entries(deviceGroups).map(([key, groupDevices]) => {
      const [provider, platform] = key.split("|") as [PushProvider, DevicePlatform];

      return {
        provider,
        platform,
        deviceTokens: (groupDevices as any[]).map((d) => d.deviceToken),
        payload: this.optimizePayloadForPlatform(payload, platform),
      };
    });

    const platformBreakdown = filteredDevices.reduce(
      (acc, device) => {
        acc[device.platform] = (acc[device.platform] || 0) + 1;
        return acc;
      },
      {} as Record<DevicePlatform, number>,
    );

    this.logger.log(
      `Routed push notification to ${filteredDevices.length} devices across ${routingPlan.length} provider/platform combinations`,
    );

    return {
      routingPlan,
      totalDevices: filteredDevices.length,
      platformBreakdown,
    };
  }

  private groupDevicesByProviderAndPlatform(devices: any[]) {
    return devices.reduce(
      (groups, device) => {
        const key = `${device.provider}|${device.platform}`;
        if (!groups[key]) {
          groups[key] = [];
        }
        groups[key].push(device);
        return groups;
      },
      {} as Record<string, any[]>,
    );
  }

  private optimizePayloadForPlatform(
    payload: SmartPushPayload,
    platform: DevicePlatform,
  ): PushPayload {
    const optimized: PushPayload = {
      deviceTokens: [],
      title: payload.title,
      body: payload.body,
      data: payload.data,
      badge: payload.badge,
      sound: payload.sound,
      imageUrl: payload.imageUrl,
      priority: payload.priority || "high",
      ttl: payload.ttl,
      deepLink: payload.deepLink,
      actions: payload.actions,
    };

    switch (platform) {
      case DevicePlatform.IOS:
        optimized.ios = {
          ...payload.ios,
          interruptionLevel: payload.ios?.interruptionLevel || "active",
          mutableContent: payload.ios?.mutableContent ?? true,
        };
        optimized.ttl = payload.ttl || 3600;
        break;

      case DevicePlatform.ANDROID:
        optimized.android = {
          ...payload.android,
          channelId: payload.android?.channelId || "default",
        };
        optimized.ttl = payload.ttl || 86400;
        break;

      case DevicePlatform.WEB:
        optimized.ttl = payload.ttl || 43200;
        optimized.priority = "high";
        delete optimized.ios;
        delete optimized.android;
        break;

      case DevicePlatform.DESKTOP:
        optimized.ttl = payload.ttl || 86400;
        optimized.priority = "normal";
        delete optimized.ios;
        delete optimized.android;
        break;
    }

    return optimized;
  }

  async getPushRecommendations(tenantId: string): Promise<{
    recommendations: Array<{
      priority: "high" | "medium" | "low";
      title: string;
      description: string;
      action: string;
    }>;
    deviceStats: any;
    providerRecommendations: {
      primary: PushProvider[];
      secondary: PushProvider[];
    };
  }> {
    const deviceStats = await this.deviceRegistrationService.getDeviceStats(tenantId);
    const recommendations: Array<{
      priority: "high" | "medium" | "low";
      title: string;
      description: string;
      action: string;
    }> = [];

    const { platformBreakdown, providerBreakdown, totalDevices } = deviceStats;

    if (totalDevices === 0) {
      recommendations.push({
        priority: "high",
        title: "No Devices Registered",
        description: "No push notification devices are registered for your users",
        action: "Implement device registration in your mobile/web apps",
      });
    }

    const iosDevices = platformBreakdown[DevicePlatform.IOS] || 0;
    if (iosDevices > 0 && !providerBreakdown[PushProvider.APNS]) {
      recommendations.push({
        priority: "high",
        title: "Configure APNS for iOS",
        description: `You have ${iosDevices} iOS devices but APNS is not configured`,
        action: "Add your iOS app certificates and configure APNS",
      });
    }

    const androidDevices = platformBreakdown[DevicePlatform.ANDROID] || 0;
    if (androidDevices > 0 && !providerBreakdown[PushProvider.FCM]) {
      recommendations.push({
        priority: "high",
        title: "Configure FCM for Android",
        description: `You have ${androidDevices} Android devices but FCM is not configured`,
        action: "Add your Firebase server key and configure FCM",
      });
    }

    const webDevices =
      (platformBreakdown[DevicePlatform.WEB] || 0) +
      (platformBreakdown[DevicePlatform.DESKTOP] || 0);
    if (webDevices > 0 && !providerBreakdown[PushProvider.WEB_PUSH]) {
      recommendations.push({
        priority: "medium",
        title: "Configure Web Push",
        description: `You have ${webDevices} web/desktop devices but web push is not configured`,
        action: "Configure VAPID keys for web push notifications",
      });
    }

    const primaryProviders: PushProvider[] = [];
    const secondaryProviders: PushProvider[] = [];

    if (iosDevices > totalDevices * 0.3) {
      primaryProviders.push(PushProvider.APNS);
    }
    if (androidDevices > totalDevices * 0.3) {
      primaryProviders.push(PushProvider.FCM);
    }
    if (webDevices > totalDevices * 0.2) {
      primaryProviders.push(PushProvider.WEB_PUSH);
    }

    secondaryProviders.push(PushProvider.SNS);

    if (providerBreakdown[PushProvider.EXPO] > 0) {
      recommendations.push({
        priority: "low",
        title: "Optimize Expo Push",
        description: "Consider migrating from Expo push to native APNS/FCM for better performance",
        action: "Implement native push notification handling",
      });
    }

    return {
      recommendations,
      deviceStats,
      providerRecommendations: {
        primary: primaryProviders,
        secondary: secondaryProviders,
      },
    };
  }

  async testPushDelivery(
    tenantId: string,
    userId: string,
    platforms: DevicePlatform[],
    testMessage: {
      title: string;
      body: string;
      data?: Record<string, any>;
    },
  ): Promise<{
    success: boolean;
    results: Array<{
      platform: DevicePlatform;
      provider: PushProvider;
      deviceCount: number;
      success: boolean;
      error?: string;
    }>;
  }> {
    try {
      const devices = await this.deviceRegistrationService.getSubscriberDevices(userId, tenantId);
      const targetDevices = devices.filter((d) => platforms.includes(d.platform));

      if (targetDevices.length === 0) {
        return {
          success: false,
          results: platforms.map((platform) => ({
            platform,
            provider: this.getDefaultProviderForPlatform(platform),
            deviceCount: 0,
            success: false,
            error: "No devices found for platform",
          })),
        };
      }

      const routingResult = await this.routePushNotification(
        {
          deviceTokens: [],
          title: `[TEST] ${testMessage.title}`,
          body: `[TEST] ${testMessage.body}`,
          data: { ...testMessage.data, isTest: true },
          targetUsers: [userId],
          targetPlatforms: platforms,
        },
        tenantId,
      );

      const results = routingResult.routingPlan.map((plan) => ({
        platform: plan.platform,
        provider: plan.provider,
        deviceCount: plan.deviceTokens.length,
        success: true,
      }));

      return {
        success: true,
        results,
      };
    } catch (error) {
      this.logger.error(`Push delivery test failed: ${error.message}`, error);
      return {
        success: false,
        results: platforms.map((platform) => ({
          platform,
          provider: this.getDefaultProviderForPlatform(platform),
          deviceCount: 0,
          success: false,
          error: error.message,
        })),
      };
    }
  }

  private getDefaultProviderForPlatform(platform: DevicePlatform): PushProvider {
    switch (platform) {
      case DevicePlatform.IOS:
        return PushProvider.APNS;
      case DevicePlatform.ANDROID:
        return PushProvider.FCM;
      case DevicePlatform.WEB:
      case DevicePlatform.DESKTOP:
        return PushProvider.WEB_PUSH;
      default:
        return PushProvider.SNS;
    }
  }
}
