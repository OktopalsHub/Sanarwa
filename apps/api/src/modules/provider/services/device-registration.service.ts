import { Injectable, Logger } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { DeviceRegistration } from "../entities/device-registration.entity";
import { DevicePlatform, PushProvider } from "../enums/device-platform.enum";

@Injectable()
export class DeviceRegistrationService {
  private readonly logger = new Logger(DeviceRegistrationService.name);

  constructor(
    @InjectRepository(DeviceRegistration)
    private readonly deviceRepository: Repository<DeviceRegistration>,
  ) {}

  /**
   * Register a device for push notifications with automatic platform detection
   */
  async registerDevice(request: {
    subscriberId: string;
    tenantId: string;
    deviceToken: string;
    userAgent?: string;
    appBundleId?: string;
    deviceInfo?: Partial<DeviceRegistration["deviceInfo"]>;
    metadata?: Record<string, any>;
  }): Promise<DeviceRegistration> {
    // Detect platform and provider automatically
    const { platform, provider } = this.detectPlatformAndProvider(
      request.deviceToken,
      request.userAgent,
      request.appBundleId,
    );

    // Check if device already exists
    const existingDevice = await this.deviceRepository.findOne({
      where: {
        deviceToken: request.deviceToken,
        subscriberId: request.subscriberId,
        tenantId: request.tenantId,
      },
    });

    if (existingDevice) {
      // Update existing device
      existingDevice.platform = platform;
      existingDevice.provider = provider;
      existingDevice.deviceInfo = { ...existingDevice.deviceInfo, ...request.deviceInfo };
      existingDevice.lastSeen = new Date();
      existingDevice.isActive = true;
      existingDevice.metadata = { ...existingDevice.metadata, ...request.metadata };

      const updated = await this.deviceRepository.save(existingDevice);
      this.logger.log(
        `Updated device registration: ${platform} - ${provider} for subscriber ${request.subscriberId}`,
      );
      return updated;
    }

    // Create new device registration
    const device = this.deviceRepository.create({
      subscriberId: request.subscriberId,
      tenantId: request.tenantId,
      deviceToken: request.deviceToken,
      platform,
      provider,
      appBundleId: request.appBundleId,
      deviceInfo: request.deviceInfo || {},
      isActive: true,
      lastSeen: new Date(),
      registeredAt: new Date(),
      metadata: request.metadata,
    });

    const saved = await this.deviceRepository.save(device);
    this.logger.log(
      `Registered new device: ${platform} - ${provider} for subscriber ${request.subscriberId}`,
    );
    return saved;
  }

  /**
   * Automatically detect platform and provider from device token and user agent
   */
  private detectPlatformAndProvider(
    deviceToken: string,
    userAgent?: string,
    appBundleId?: string,
  ): { platform: DevicePlatform; provider: PushProvider } {
    // iOS APNS Detection
    if (this.isIOSToken(deviceToken)) {
      return {
        platform: DevicePlatform.IOS,
        provider: PushProvider.APNS,
      };
    }

    // Android FCM Detection
    if (this.isAndroidFCMToken(deviceToken)) {
      return {
        platform: DevicePlatform.ANDROID,
        provider: PushProvider.FCM,
      };
    }

    // Expo Detection (React Native)
    if (this.isExpoToken(deviceToken)) {
      // Expo can be iOS or Android, detect from user agent or bundle ID
      const platform = this.detectExpoPlatform(userAgent, appBundleId);
      return {
        platform,
        provider: PushProvider.EXPO,
      };
    }

    // Web Push Detection
    if (this.isWebPushToken(deviceToken)) {
      return {
        platform: DevicePlatform.WEB,
        provider: PushProvider.WEB_PUSH,
      };
    }

    // Desktop Detection (usually web push in Electron)
    if (userAgent && this.isDesktopUserAgent(userAgent)) {
      return {
        platform: DevicePlatform.DESKTOP,
        provider: PushProvider.WEB_PUSH,
      };
    }

    // Fallback: Try to detect from user agent
    if (userAgent) {
      const platformFromUA = this.detectPlatformFromUserAgent(userAgent);
      const provider = this.getDefaultProviderForPlatform(platformFromUA);
      return { platform: platformFromUA, provider };
    }

    // Ultimate fallback
    this.logger.warn(`Could not detect platform for token: ${deviceToken.substring(0, 20)}...`);
    return {
      platform: DevicePlatform.UNKNOWN,
      provider: PushProvider.SNS, // AWS SNS as universal fallback
    };
  }

  /**
   * Detect iOS APNS tokens
   */
  private isIOSToken(token: string): boolean {
    // iOS APNS tokens are 64 hex characters (32 bytes)
    return /^[a-fA-F0-9]{64}$/.test(token);
  }

  /**
   * Detect Android FCM tokens
   */
  private isAndroidFCMToken(token: string): boolean {
    // FCM tokens are typically longer and contain specific patterns
    return (
      token.length > 100 &&
      (token.startsWith("c") || token.startsWith("d") || token.startsWith("e")) &&
      !token.includes(":") && // Not Expo
      /^[a-zA-Z0-9_-]+$/.test(token)
    );
  }

  /**
   * Detect Expo tokens
   */
  private isExpoToken(token: string): boolean {
    // Expo tokens have format: ExponentPushToken[xxx] or ExpoPushToken[xxx]
    return (
      token.startsWith("ExponentPushToken[") ||
      token.startsWith("ExpoPushToken[") ||
      /^Expo.*\[.*\]$/.test(token)
    );
  }

  /**
   * Detect Web Push tokens
   */
  private isWebPushToken(token: string): boolean {
    // Web push tokens are usually very long base64-like strings
    return token.length > 200 && /^[a-zA-Z0-9_-]+$/.test(token) && !this.isAndroidFCMToken(token);
  }

  /**
   * Detect desktop user agents
   */
  private isDesktopUserAgent(userAgent: string): boolean {
    const desktopPatterns = [
      /Electron/i,
      /Windows NT/i,
      /Macintosh/i,
      /Linux.*X11/i,
      /Chrome.*Windows/i,
      /Firefox.*Windows/i,
      /Safari.*Mac/i,
    ];

    return (
      desktopPatterns.some((pattern) => pattern.test(userAgent)) &&
      !/Mobile|Android|iPhone|iPad/i.test(userAgent)
    );
  }

  /**
   * Detect platform from Expo token context
   */
  private detectExpoPlatform(userAgent?: string, appBundleId?: string): DevicePlatform {
    if (appBundleId) {
      // iOS bundle IDs typically use reverse domain notation
      if (/^[a-zA-Z0-9.-]+\.[a-zA-Z0-9.-]+$/.test(appBundleId)) {
        return DevicePlatform.IOS;
      }
    }

    if (userAgent) {
      if (/iPhone|iPad|iOS/i.test(userAgent)) {
        return DevicePlatform.IOS;
      }
      if (/Android/i.test(userAgent)) {
        return DevicePlatform.ANDROID;
      }
    }

    // Default to Android for Expo if unclear
    return DevicePlatform.ANDROID;
  }

  /**
   * Detect platform from user agent
   */
  private detectPlatformFromUserAgent(userAgent: string): DevicePlatform {
    if (/iPhone|iPad|iOS/i.test(userAgent)) {
      return DevicePlatform.IOS;
    }
    if (/Android/i.test(userAgent)) {
      return DevicePlatform.ANDROID;
    }
    if (this.isDesktopUserAgent(userAgent)) {
      return DevicePlatform.DESKTOP;
    }
    return DevicePlatform.WEB;
  }

  /**
   * Get default provider for platform
   */
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

  /**
   * Get active devices for a subscriber
   */
  async getSubscriberDevices(
    subscriberId: string,
    tenantId: string,
  ): Promise<DeviceRegistration[]> {
    return this.deviceRepository.find({
      where: {
        subscriberId,
        tenantId,
        isActive: true,
      },
      order: {
        lastSeen: "DESC",
      },
    });
  }

  /**
   * Get devices by platform for a subscriber
   */
  async getDevicesByPlatform(
    subscriberId: string,
    tenantId: string,
    platform: DevicePlatform,
  ): Promise<DeviceRegistration[]> {
    return this.deviceRepository.find({
      where: {
        subscriberId,
        tenantId,
        platform,
        isActive: true,
      },
    });
  }

  /**
   * Deactivate a device
   */
  async deactivateDevice(
    deviceToken: string,
    subscriberId: string,
    tenantId: string,
  ): Promise<void> {
    await this.deviceRepository.update(
      { deviceToken, subscriberId, tenantId },
      { isActive: false },
    );
    this.logger.log(
      `Deactivated device: ${deviceToken.substring(0, 20)}... for subscriber ${subscriberId}`,
    );
  }

  /**
   * Clean up old inactive devices
   */
  async cleanupInactiveDevices(daysInactive: number = 30): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysInactive);

    const result = await this.deviceRepository.delete({
      lastSeen: { $lt: cutoffDate } as any,
      isActive: false,
    });

    this.logger.log(`Cleaned up ${result.affected || 0} inactive devices`);
    return result.affected || 0;
  }

  /**
   * Get device statistics
   */
  async getDeviceStats(tenantId: string): Promise<{
    totalDevices: number;
    activeDevices: number;
    platformBreakdown: Record<DevicePlatform, number>;
    providerBreakdown: Record<PushProvider, number>;
  }> {
    const devices = await this.deviceRepository.find({
      where: { tenantId },
    });

    const activeDevices = devices.filter((d) => d.isActive);

    const platformBreakdown = devices.reduce(
      (acc, device) => {
        acc[device.platform] = (acc[device.platform] || 0) + 1;
        return acc;
      },
      {} as Record<DevicePlatform, number>,
    );

    const providerBreakdown = devices.reduce(
      (acc, device) => {
        acc[device.provider] = (acc[device.provider] || 0) + 1;
        return acc;
      },
      {} as Record<PushProvider, number>,
    );

    return {
      totalDevices: devices.length,
      activeDevices: activeDevices.length,
      platformBreakdown,
      providerBreakdown,
    };
  }
}
