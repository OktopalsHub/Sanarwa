import { IEmailProvider } from '../../../providers/email/email-provider.interface';
import {
  Channel,
  DeliveryStatus,
  ProviderConfig,
  ProviderHealth,
  ProviderResponse,
} from '../../../providers/types';

export class MockEmailProvider implements IEmailProvider {
  id = 'mock-email-provider';
  name = 'Mock Email Provider';
  channel = Channel.EMAIL;
  config: ProviderConfig;
  isInitialized = true;

  private shouldFail = false;
  private failureMessage = 'Mock provider failure';
  private responseDelay = 0;

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
      messageId: 'mock-email-' + Math.random().toString(36).substring(2, 11),
      status: DeliveryStatus.SENT,
      timestamp: new Date(),
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

  async initialize(): Promise<void> {
    this.isInitialized = true;
  }

  async destroy(): Promise<void> {
    this.isInitialized = false;
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

  reset(): void {
    this.shouldFail = false;
    this.failureMessage = 'Mock provider failure';
    this.responseDelay = 0;
  }
}
