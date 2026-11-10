import { Injectable, Logger } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { In, Repository } from "typeorm";
import { DeviceRegistration } from "../entities/device-registration.entity";
import { DevicePlatform, PushProvider } from "../enums/device-platform.enum";

@Injectable()
export class DeviceRegistrationService {
  private readonly logger = new Logger(DeviceRegistrationService.name);

  constructor(
    @InjectRepository(DeviceRegistration)
    private readonly deviceRepository: Repository<DeviceRegistration>,
  ) {}

  async registerDevice(request: {
    subscriberId: string;
    tenantId: string;
    deviceToken: string;
    userAgent?: string;
    appBundleId?: string;
    deviceInfo?: Partial<DeviceRegistration["deviceInfo"]>;
    metadata?: Record<string, any>;
  }): Promise<DeviceRegistration> {
    const { platform, provider } = this.detectPlatformAndProvider(
      request.deviceToken,
      request.userAgent,
      request.appBundleId,
    );

    const existingDevice = await this.deviceRepository.findOne({
      where: {
        deviceToken: request.deviceToken,
        subscriberId: request.subscriberId,
        tenantId: request.tenantId,
      },
    });

    if (existingDevice) {
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

  private detectPlatformAndProvider(
    deviceToken: string,
    userAgent?: string,
    appBundleId?: string,
  ): { platform: DevicePlatform; provider: PushProvider } {
    if (this.isIOSToken(deviceToken)) {
      return {
        platform: DevicePlatform.IOS,
        provider: PushProvider.APNS,
      };
    }

    if (this.isAndroidFCMToken(deviceToken)) {
      return {
        platform: DevicePlatform.ANDROID,
        provider: PushProvider.FCM,
      };
    }

    if (this.isExpoToken(deviceToken)) {
      const platform = this.detectExpoPlatform(userAgent, appBundleId);
      return {
        platform,
        provider: PushProvider.EXPO,
      };
    }

    if (this.isWebPushToken(deviceToken)) {
      return {
        platform: DevicePlatform.WEB,
        provider: PushProvider.WEB_PUSH,
      };
    }

    if (userAgent && this.isDesktopUserAgent(userAgent)) {
      return {
        platform: DevicePlatform.DESKTOP,
        provider: PushProvider.WEB_PUSH,
      };
    }

    if (userAgent) {
      const platformFromUA = this.detectPlatformFromUserAgent(userAgent);
      const provider = this.getDefaultProviderForPlatform(platformFromUA);
      return { platform: platformFromUA, provider };
    }

    this.logger.warn(`Could not detect platform for token: ${deviceToken.substring(0, 20)}...`);
    return {
      platform: DevicePlatform.UNKNOWN,
      provider: PushProvider.SNS,
    };
  }

  private isIOSToken(token: string): boolean {
    return /^[a-fA-F0-9]{64}$/.test(token);
  }

  private isAndroidFCMToken(token: string): boolean {
    return (
      token.length > 100 &&
      (token.startsWith("c") || token.startsWith("d") || token.startsWith("e")) &&
      !token.includes(":") &&
      /^[a-zA-Z0-9_-]+$/.test(token)
    );
  }

  private isExpoToken(token: string): boolean {
    return (
      token.startsWith("ExponentPushToken[") ||
      token.startsWith("ExpoPushToken[") ||
      /^Expo.*\[.*\]$/.test(token)
    );
  }

  private isWebPushToken(token: string): boolean {
    return token.length > 200 && /^[a-zA-Z0-9_-]+$/.test(token) && !this.isAndroidFCMToken(token);
  }

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

  private detectExpoPlatform(userAgent?: string, appBundleId?: string): DevicePlatform {
    if (appBundleId) {
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

    return DevicePlatform.ANDROID;
  }

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
   * Prunes tokens a push provider reported as invalid (uninstalled/bad
   * token). They stop matching the router so future sends skip them.
   */
  async pruneInvalidTokens(tokens: string[]): Promise<void> {
    const cleaned = tokens.filter((token) => typeof token === "string" && token.length > 0);
    if (cleaned.length === 0) {
      return;
    }

    await this.deviceRepository.update({ deviceToken: In(cleaned) }, { isActive: false });
    this.logger.log(`Pruned ${cleaned.length} invalid push token(s)`);
  }

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

  /** GDPR/right-to-erasure: removes all device registrations for the subscriber. */
  async eraseSubscriber(tenantId: string, subscriberId: string): Promise<number> {
    const result = await this.deviceRepository.delete({ tenantId, subscriberId });
    const count = result.affected ?? 0;
    if (count > 0) {
      this.logger.log(`Erased ${count} device registration(s) for subscriber ${subscriberId}`);
    }
    return count;
  }
}
