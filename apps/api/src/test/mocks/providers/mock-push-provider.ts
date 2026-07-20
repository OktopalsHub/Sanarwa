import { IPushProvider } from '../../../providers/push/push-provider.interface';
import {
  Channel,
  DeliveryStatus,
  ProviderConfig,
  ProviderHealth,
  ProviderResponse,
} from '../../../providers/types';

export class MockPushProvider implements IPushProvider {
  id = 'mock-push-provider';
  name = 'Mock Push Provider';
  channel = Channel.PUSH;
  config: ProviderConfig;
  isInitialized = true;

  private shouldFail = false;
  private failureMessage = 'Mock push provider failure';
  private responseDelay = 0;
  private registeredDevices = new Set<string>();

  constructor(config: ProviderConfig) {
    this.config = config;
  }

  async send(payload: any): Promise<ProviderResponse> {
    if (this.responseDelay > 0) {
      await new Promise((resolve) => setTimeout(resolve, this.responseDelay));
    }

    if (this.shouldFail) {
      throw new Error(this.failureMessage);
    }

    return {
      messageId: 'mock-push-' + Math.random().toString(36).substr(2, 9),
      status: DeliveryStatus.SENT,
      timestamp: new Date(),
      providerMessageId: 'mock-push-message-id',
      metadata: {
        deliveryReceipt: true,
      },
    };
  }

  async validateConfig(config: ProviderConfig): Promise<boolean> {
    return (
      config && config.credentials && typeof config.credentials === 'object'
    );
  }

  async checkHealth(): Promise<{ status: ProviderHealth; lastChecked: Date }> {
    return {
      status: this.shouldFail
        ? ProviderHealth.UNHEALTHY
        : ProviderHealth.HEALTHY,
      lastChecked: new Date(),
    };
  }

  async registerDevice(
    registration: import('../../../providers/push/push-provider.interface').DeviceRegistration,
  ): Promise<void> {
    this.registeredDevices.add(
      `${registration.userId}:${registration.deviceToken}`,
    );
  }

  async unregisterDevice(deviceToken: string): Promise<void> {
    // Remove all registrations for this device token
    for (const registration of this.registeredDevices) {
      if (registration.includes(deviceToken)) {
        this.registeredDevices.delete(registration);
      }
    }
  }

  validateDeviceToken(deviceToken: string): boolean {
    // Simple validation - just check if it's a non-empty string
    return typeof deviceToken === 'string' && deviceToken.length > 0;
  }

  async sendBulk(payloads: any[]): Promise<ProviderResponse[]> {
    const results: ProviderResponse[] = [];

    for (const payload of payloads) {
      try {
        const result = await this.send(payload);
        results.push(result);
      } catch (error) {
        results.push({
          messageId:
            'mock-push-failed-' + Math.random().toString(36).substr(2, 9),
          status: DeliveryStatus.FAILED,
          timestamp: new Date(),
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    return results;
  }

  isDeviceRegistered(deviceToken: string, userId: string): boolean {
    return this.registeredDevices.has(`${userId}:${deviceToken}`);
  }

  async initialize(): Promise<void> {
    this.isInitialized = true;
  }

  async destroy(): Promise<void> {
    this.isInitialized = false;
    this.registeredDevices.clear();
  }

  // Test helper methods
  setShouldFail(shouldFail: boolean, message?: string): void {
    this.shouldFail = shouldFail;
    if (message) {
      this.failureMessage = message;
    }
  }

  setResponseDelay(delay: number): void {
    this.responseDelay = delay;
  }

  getRegisteredDevicesCount(): number {
    return this.registeredDevices.size;
  }

  reset(): void {
    this.shouldFail = false;
    this.failureMessage = 'Mock push provider failure';
    this.responseDelay = 0;
    this.registeredDevices.clear();
  }
}
