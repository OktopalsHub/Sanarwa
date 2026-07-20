import {
  Channel,
  DeliveryStatus,
  ProviderConfig,
  ProviderHealth,
  ProviderResponse,
} from '../../../providers/types';
import {
  IWhatsAppProvider,
  WhatsAppTemplate,
} from '../../../providers/whatsapp/whatsapp-provider.interface';

export class MockWhatsAppProvider implements IWhatsAppProvider {
  id = 'mock-whatsapp-provider';
  name = 'Mock WhatsApp Provider';
  channel = Channel.WHATSAPP;
  config: ProviderConfig;
  isInitialized = true;

  private shouldFail = false;
  private failureMessage = 'Mock WhatsApp provider failure';
  private responseDelay = 0;
  private supportedMessageTypes = ['text', 'template', 'media'];

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
      messageId: 'mock-whatsapp-' + Math.random().toString(36).substr(2, 9),
      status: DeliveryStatus.SENT,
      timestamp: new Date(),
      providerMessageId: 'wamid.mock-message-id',
      metadata: {
        recipientId: payload.recipient,
      },
    };
  }

  async sendTemplate(
    recipient: string,
    template: WhatsAppTemplate,
    parameters?: Record<string, any>,
  ): Promise<ProviderResponse> {
    if (this.shouldFail) {
      throw new Error(this.failureMessage);
    }

    return {
      messageId:
        'mock-whatsapp-template-' + Math.random().toString(36).substr(2, 9),
      status: DeliveryStatus.SENT,
      timestamp: new Date(),
      providerMessageId: 'wamid.mock-template-message-id',
      metadata: {
        templateName: template.name,
        recipientId: recipient,
      },
    };
  }

  validateWhatsAppNumber(number: string): boolean {
    // Mock validation - check if it's a valid WhatsApp number format
    return /^\+\d{10,15}$/.test(number);
  }

  async getTemplates(): Promise<WhatsAppTemplate[]> {
    return [
      {
        name: 'welcome_message',
        language: 'en',
        components: [
          {
            type: 'body',
            parameters: [{ type: 'text', text: '{{name}}' }],
          },
        ],
      },
      {
        name: 'order_confirmation',
        language: 'en',
        components: [
          {
            type: 'body',
            parameters: [
              { type: 'text', text: '{{orderNumber}}' },
              { type: 'text', text: '{{total}}' },
            ],
          },
        ],
      },
    ];
  }

  validateTemplate(template: WhatsAppTemplate): boolean {
    // Simple validation - check if template has required fields
    return !!(template.name && template.language && template.components);
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

  getSupportedMessageTypes(): string[] {
    return this.supportedMessageTypes;
  }

  async validatePhoneNumber(phoneNumber: string): Promise<boolean> {
    // Mock validation - just check if it starts with + and has digits
    return /^\+\d{10,15}$/.test(phoneNumber);
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

  setSupportedMessageTypes(types: string[]): void {
    this.supportedMessageTypes = types;
  }

  reset(): void {
    this.shouldFail = false;
    this.failureMessage = 'Mock WhatsApp provider failure';
    this.responseDelay = 0;
    this.supportedMessageTypes = ['text', 'template', 'media'];
  }
}
