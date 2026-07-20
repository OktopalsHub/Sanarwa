import {
  MessageDeliveryStatus as DeliveryStatus,
  MessageDelivery as NotificationDelivery,
} from '../../modules/messaging/message-delivery.entity';
import { MessageChannel as NotificationChannel } from '../../modules/messaging/message.entity';

export class DeliveryFactory {
  static create(
    overrides: Partial<NotificationDelivery> = {},
  ): NotificationDelivery {
    const defaultDelivery: NotificationDelivery = {
      id: 'delivery-' + Math.random().toString(36).substr(2, 9),
      messageId: 'message-' + Math.random().toString(36).substr(2, 9),
      channel: NotificationChannel.EMAIL,
      providerId: 'aws_ses',
      recipient: 'test@example.com',
      status: DeliveryStatus.PENDING,
      providerMessageId: undefined,
      providerResponse: undefined,
      errorMessage: undefined,
      retryCount: 0,
      sentAt: undefined,
      deliveredAt: undefined,
      openedAt: undefined,
      clickedAt: undefined,
      metadata: undefined,
      message: null as any, // Will be set by the caller if needed
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    return { ...defaultDelivery, ...overrides };
  }

  static createMany(
    count: number,
    overrides: Partial<NotificationDelivery> = {},
  ): NotificationDelivery[] {
    return Array.from({ length: count }, (_, index) =>
      this.create({
        ...overrides,
        id: `delivery-${index + 1}`,
        recipient: `test${index + 1}@example.com`,
      }),
    );
  }

  static createWithStatus(
    status: DeliveryStatus,
    overrides: Partial<NotificationDelivery> = {},
  ): NotificationDelivery {
    const timestamps = this.getTimestampsForStatus(status);
    return this.create({ ...overrides, status, ...timestamps });
  }

  static createForChannel(
    channel: NotificationChannel,
    overrides: Partial<NotificationDelivery> = {},
  ): NotificationDelivery {
    const channelConfig = this.getConfigForChannel(channel);
    return this.create({
      ...overrides,
      channel,
      ...channelConfig,
    });
  }

  static createSuccessful(
    overrides: Partial<NotificationDelivery> = {},
  ): NotificationDelivery {
    return this.create({
      ...overrides,
      status: DeliveryStatus.DELIVERED,
      providerMessageId: 'msg-' + Math.random().toString(36).substr(2, 9),
      sentAt: new Date(Date.now() - 60000), // 1 minute ago
      deliveredAt: new Date(),
    });
  }

  static createFailed(
    errorMessage: string,
    overrides: Partial<NotificationDelivery> = {},
  ): NotificationDelivery {
    return this.create({
      ...overrides,
      status: DeliveryStatus.FAILED,
      errorMessage,
      retryCount: 3,
    });
  }

  static createWithProvider(
    providerId: string,
    overrides: Partial<NotificationDelivery> = {},
  ): NotificationDelivery {
    return this.create({ ...overrides, providerId });
  }

  static createWithRetries(
    retryCount: number,
    overrides: Partial<NotificationDelivery> = {},
  ): NotificationDelivery {
    return this.create({ ...overrides, retryCount });
  }

  private static getTimestampsForStatus(status: DeliveryStatus) {
    const now = new Date();
    const oneMinuteAgo = new Date(now.getTime() - 60000);
    const twoMinutesAgo = new Date(now.getTime() - 120000);

    switch (status) {
      case DeliveryStatus.SENT:
        return { sentAt: oneMinuteAgo };
      case DeliveryStatus.DELIVERED:
        return { sentAt: twoMinutesAgo, deliveredAt: oneMinuteAgo };
      case DeliveryStatus.OPENED:
        return {
          sentAt: twoMinutesAgo,
          deliveredAt: oneMinuteAgo,
          openedAt: now,
        };
      case DeliveryStatus.CLICKED:
        return {
          sentAt: twoMinutesAgo,
          deliveredAt: oneMinuteAgo,
          openedAt: now,
          clickedAt: now,
        };
      default:
        return {};
    }
  }

  private static getConfigForChannel(channel: NotificationChannel) {
    switch (channel) {
      case NotificationChannel.EMAIL:
        return {
          providerId: 'aws_ses',
          recipient: 'test@example.com',
        };
      case NotificationChannel.SMS:
        return {
          providerId: 'aws_sns',
          recipient: '+1234567890',
        };
      case NotificationChannel.PUSH:
        return {
          providerId: 'aws_pinpoint',
          recipient: 'device-token-123',
        };
      case NotificationChannel.WHATSAPP:
        return {
          providerId: 'meta_whatsapp',
          recipient: '+1234567890',
        };

      default:
        return {
          providerId: 'default_provider',
          recipient: 'test@example.com',
        };
    }
  }
}
