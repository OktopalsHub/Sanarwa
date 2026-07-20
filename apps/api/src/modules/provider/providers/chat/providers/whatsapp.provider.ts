import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { IChatProvider, ChatPayload, ChatResponse } from '../chat-provider.interface';

export interface WhatsAppConfig {
  accessToken: string;
  phoneNumberId: string;
  businessAccountId?: string;
  webhookVerifyToken?: string;
  apiVersion?: string;
}

export interface WhatsAppTemplate {
  name: string;
  language: string;
  components?: Array<{
    type: 'header' | 'body' | 'footer' | 'button';
    parameters?: Array<{
      type: 'text' | 'currency' | 'date_time' | 'image' | 'document' | 'video';
      text?: string;
      currency?: { fallback_value: string; code: string; amount_1000: number };
      date_time?: { fallback_value: string };
      image?: { link: string };
      document?: { link: string; filename?: string };
      video?: { link: string };
    }>;
  }>;
}

interface WhatsAppSendResponse {
  messaging_product: string;
  contacts: any[];
  messages: Array<{ id: string }>;
  error?: { message: string; type: string; code: number };
}

interface WhatsAppTemplatesResponse {
  data: any[];
  error?: { message: string; type: string; code: number };
}

@Injectable()
export class WhatsAppProvider implements IChatProvider {
  private readonly logger = new Logger(WhatsAppProvider.name);
  private config: WhatsAppConfig;
  private apiUrl: string;

  constructor(private configService: ConfigService) {
    this.initializeConfig();
  }

  private initializeConfig(customConfig?: WhatsAppConfig) {
    this.config = customConfig || {
      accessToken: this.configService.get('WHATSAPP_ACCESS_TOKEN') || '',
      phoneNumberId: this.configService.get('WHATSAPP_PHONE_NUMBER_ID') || '',
      businessAccountId: this.configService.get('WHATSAPP_BUSINESS_ACCOUNT_ID') || '',
      webhookVerifyToken: this.configService.get('WHATSAPP_WEBHOOK_VERIFY_TOKEN') || '',
      apiVersion: this.configService.get('WHATSAPP_API_VERSION') || 'v18.0',
    };

    this.apiUrl = `https://graph.facebook.com/${this.config.apiVersion}/${this.config.phoneNumberId}/messages`;
  }

  // BYOP support - initialize with custom configuration
  initializeWithConfig(config: WhatsAppConfig): void {
    this.initializeConfig(config);
    this.logger.log('WhatsApp provider initialized with custom BYOP configuration');
  }

  async sendMessage(payload: ChatPayload): Promise<ChatResponse> {
    try {
      const whatsappPayload = {
        messaging_product: 'whatsapp',
        to: payload.channel, // WhatsApp uses phone number as channel
        type: 'text',
        text: {
          body: payload.message,
        },
      };

      const response = await fetch(this.apiUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.config.accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(whatsappPayload),
      });

      const result = await response.json() as WhatsAppSendResponse;

      if (!response.ok) {
        throw new Error(`WhatsApp API error: ${result.error?.message || response.statusText}`);
      }

      this.logger.log(`WhatsApp message sent successfully: ${result.messages?.[0]?.id}`);

      return {
        success: true,
        messageId: result.messages?.[0]?.id,
        timestamp: new Date().toISOString(),
        provider: 'whatsapp',
      };
    } catch (error) {
      this.logger.error(`Failed to send WhatsApp message: ${error.message}`, error.stack);
      return {
        success: false,
        error: error.message,
        provider: 'whatsapp',
      };
    }
  }

  async sendTemplate(
    phoneNumber: string,
    template: WhatsAppTemplate,
    parameters?: Record<string, any>
  ): Promise<ChatResponse> {
    try {
      const whatsappPayload = {
        messaging_product: 'whatsapp',
        to: phoneNumber,
        type: 'template',
        template: {
          name: template.name,
          language: {
            code: template.language,
          },
          components: template.components || [],
        },
      };

      const response = await fetch(this.apiUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.config.accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(whatsappPayload),
      });

      const result = await response.json() as WhatsAppSendResponse;

      if (!response.ok) {
        throw new Error(`WhatsApp Template API error: ${result.error?.message || response.statusText}`);
      }

      this.logger.log(`WhatsApp template sent successfully: ${result.messages?.[0]?.id}`);

      return {
        success: true,
        messageId: result.messages?.[0]?.id,
        timestamp: new Date().toISOString(),
        provider: 'whatsapp',
      };
    } catch (error) {
      this.logger.error(`Failed to send WhatsApp template: ${error.message}`, error.stack);
      return {
        success: false,
        error: error.message,
        provider: 'whatsapp',
      };
    }
  }

  async getTemplates(): Promise<WhatsAppTemplate[]> {
    try {
      if (!this.config.businessAccountId) {
        throw new Error('Business Account ID is required to fetch templates');
      }

      const url = `https://graph.facebook.com/${this.config.apiVersion}/${this.config.businessAccountId}/message_templates`;

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${this.config.accessToken}`,
          'Content-Type': 'application/json',
        },
      });

      const result = await response.json() as WhatsAppTemplatesResponse;

      if (!response.ok) {
        throw new Error(`WhatsApp Templates API error: ${result.error?.message || response.statusText}`);
      }

      return result.data?.map((template: any) => ({
        name: template.name,
        language: template.language,
        components: template.components || [],
      })) || [];
    } catch (error) {
      this.logger.error(`Failed to fetch WhatsApp templates: ${error.message}`, error.stack);
      return [];
    }
  }

  async validateConfig(customConfig?: WhatsAppConfig): Promise<boolean> {
    const configToValidate = customConfig || this.config;

    if (!configToValidate.accessToken || !configToValidate.phoneNumberId) {
      return false;
    }

    try {
      // Test API connection by fetching phone number info
      const response = await fetch(
        `https://graph.facebook.com/${configToValidate.apiVersion || 'v18.0'}/${configToValidate.phoneNumberId}`,
        {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${configToValidate.accessToken}`,
            'Content-Type': 'application/json',
          },
        }
      );

      return response.ok;
    } catch (error) {
      this.logger.error(`WhatsApp config validation failed: ${error.message}`);
      return false;
    }
  }

  getProviderName(): string {
    return 'whatsapp';
  }

  getSupportedFeatures(): string[] {
    return [
      'text_messages',
      'media_messages',
      'templates',
      'interactive_messages',
      'delivery_receipts',
      'read_receipts'
    ];
  }

  getCostPerMessage(countryCode?: string): number {
    // WhatsApp Business API pricing varies by country and conversation type
    const basePricing: Record<string, number> = {
      'US': 0.005,
      'CA': 0.005,
      'GB': 0.009,
      'DE': 0.009,
      'FR': 0.009,
      'IN': 0.004,
      'BR': 0.008,
      'MX': 0.007,
      'AU': 0.009,
      'ZA': 0.005,
      'NG': 0.007,
      '*': 0.008, // Default
    };

    return basePricing[countryCode || '*'] || basePricing['*'];
  }
}