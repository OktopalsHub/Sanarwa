import { Injectable, Logger } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { DeviceRegistration } from "../entities/device-registration.entity";
import { DevicePlatform, PushProvider } from "../enums/device-platform.enum";

export interface WebPushSubscription {
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
}

/**
 * Stores web-push subscriptions as device registrations so the smart router
 * and the orchestrator's token pruning apply to them uniformly.
 */
@Injectable()
export class WebPushSubscriptionService {
  private readonly logger = new Logger(WebPushSubscriptionService.name);

  constructor(
    @InjectRepository(DeviceRegistration)
    private readonly deviceRepository: Repository<DeviceRegistration>,
  ) {}

  async register(
    subscriberId: string,
    tenantId: string,
    subscription: WebPushSubscription,
  ): Promise<DeviceRegistration> {
    const existing = await this.deviceRepository.findOne({
      where: {
        deviceToken: subscription.endpoint,
        subscriberId,
        tenantId,
      },
    });

    const webPushInfo = {
      endpoint: subscription.endpoint,
      keys: subscription.keys,
    };

    if (existing) {
      existing.platform = DevicePlatform.WEB;
      existing.provider = PushProvider.WEB_PUSH;
      existing.deviceInfo = { ...existing.deviceInfo };
      existing.metadata = { ...existing.metadata, webPush: webPushInfo };
      existing.lastSeen = new Date();
      existing.isActive = true;
      return this.deviceRepository.save(existing);
    }

    return this.deviceRepository.save(
      this.deviceRepository.create({
        subscriberId,
        tenantId,
        deviceToken: subscription.endpoint,
        platform: DevicePlatform.WEB,
        provider: PushProvider.WEB_PUSH,
        deviceInfo: {},
        metadata: { webPush: webPushInfo },
        lastSeen: new Date(),
        registeredAt: new Date(),
        isActive: true,
      }),
    );
  }

  async getByEndpoint(endpoint: string): Promise<WebPushSubscription | null> {
    const device = await this.deviceRepository.findOne({
      where: { deviceToken: endpoint, isActive: true },
    });
    const webPush = device?.metadata?.["webPush"] as WebPushSubscription | undefined;
    if (!device || !webPush?.keys?.p256dh || !webPush?.keys?.auth) {
      return null;
    }
    return {
      endpoint,
      keys: {
        p256dh: webPush.keys.p256dh,
        auth: webPush.keys.auth,
      },
    };
  }
}
