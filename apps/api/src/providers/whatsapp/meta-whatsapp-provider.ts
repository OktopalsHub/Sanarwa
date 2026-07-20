import { Injectable } from '@nestjs/common';
import { BaseProvider } from '../base/base-provider.abstract';
import {
  Channel,
  ProviderConfig,
  ProviderHealth,
  ProviderHealthStatus,
  ProviderResponse,
} from '../types';
import {
  IWhatsAppProvider,
  WhatsAppConfig,
  WhatsAppPayload,
  WhatsAppTemplate,
} from './whatsapp-provider.interface';

interface MetaWhatsAppRequest {
  messaging_product: string;
  to: string;
  type: string;
  text?: {
    body: string;
  };
  template?: {
    name: string;
    language: {
      code: string;
    };
    components?: any[];
  };
  interactive?: any;
  image?: {
    link: string;
    caption?: string;
  };
  video?: {
    link: string;
    caption?: string;
  };
  audio?: {
    link: string;
  };
  document?: {
    link: string;
    caption?: string;
    filename?: string;
  };
}

interface MetaWhatsAppResponse {
  messaging_product: string;
  contacts: Array<{
    input: string;
    wa_id: string;
  }>;
  messages: Array<{
    id: string;
  }>;
}

interface MetaWhatsAppError {
  error: {
    message: string;
    type: string;
    code: number;
    error_subcode?: number;
    fbtrace_id: string;
  };
}

@Injectable()
export class MetaWhatsAppProvider
  extends BaseProvider
  implements IWhatsAppProvider
{
  private readonly baseUrl = 'https://graph.facebook.com';
  private whatsappConfig: WhatsAppConfig;

  constructor() {
    super('meta-whatsapp', 'Meta WhatsApp Business', Channel.WHATSAPP);
  }

  async send(payload: WhatsAppPayload): Promise<ProviderResponse> {
    if (!this.isInitialized) {
      return this.createErrorResponse('Provider not initialized');
    }

    try {
      if (!this.validateWhatsAppNumber(payload.recipient)) {
        return this.createErrorResponse('Invalid WhatsApp number format');
      }

      let requestData: MetaWhatsAppRequest;

      if (payload.templateName) {
        // Send template message
        requestData = this.buildTemplateRequest(payload);
      } else {
        // Send regular message
        requestData = this.buildMessageRequest(payload);
      }

      const response = await this.makeHttpRequest(requestData);

      if (response.messages && response.messages.length > 0) {
        const messageId = response.messages[0].id;
        this.logger.log(`WhatsApp message sent successfully: ${messageId}`);

        return this.createSuccessResponse(`whatsapp-${Date.now()}`, messageId, {
          recipient: payload.recipient,
          waId: response.contacts[0]?.wa_id,
          messageType: payload.message.type,
        });
      } else {
        this.logger.error('WhatsApp API returned no message ID');
        return this.createErrorResponse('WhatsApp API returned no message ID');
      }
    } catch (error) {
      this.logger.error(`Failed to send WhatsApp message:`, error);
      return this.createErrorResponse(
        `WhatsApp Error: ${error.message}`,
        `whatsapp-error-${Date.now()}`,
      );
    }
  }

  async sendTemplate(
    recipient: string,
    template: WhatsAppTemplate,
    parameters?: Record<string, any>,
  ): Promise<ProviderResponse> {
    if (!this.isInitialized) {
      return this.createErrorResponse('Provider not initialized');
    }

    try {
      if (!this.validateWhatsAppNumber(recipient)) {
        return this.createErrorResponse('Invalid WhatsApp number format');
      }

      if (!this.validateTemplate(template)) {
        return this.createErrorResponse('Invalid template format');
      }

      const requestData: MetaWhatsAppRequest = {
        messaging_product: 'whatsapp',
        to: recipient,
        type: 'template',
        template: {
          name: template.name,
          language: {
            code: template.language,
          },
          components: this.buildTemplateComponents(template, parameters),
        },
      };

      const response = await this.makeHttpRequest(requestData);

      if (response.messages && response.messages.length > 0) {
        const messageId = response.messages[0].id;
        this.logger.log(`WhatsApp template sent successfully: ${messageId}`);

        return this.createSuccessResponse(
          `whatsapp-template-${Date.now()}`,
          messageId,
          {
            recipient,
            templateName: template.name,
            waId: response.contacts[0]?.wa_id,
          },
        );
      } else {
        return this.createErrorResponse('WhatsApp API returned no message ID');
      }
    } catch (error) {
      this.logger.error(`Failed to send WhatsApp template:`, error);
      return this.createErrorResponse(
        `WhatsApp Template Error: ${error.message}`,
      );
    }
  }

  validateWhatsAppNumber(number: string): boolean {
    if (!number || typeof number !== 'string') {
      return false;
    }

    // WhatsApp numbers should be in E.164 format without the + sign
    // or with the + sign (we'll handle both)
    const cleanNumber = number.replace(/^\+/, '');

    // Should be 10-15 digits
    const phoneRegex = /^\d{10,15}$/;
    return phoneRegex.test(cleanNumber);
  }

  async getTemplates(): Promise<WhatsAppTemplate[]> {
    if (!this.isInitialized) {
      throw new Error('Provider not initialized');
    }

    try {
      const url = `${this.baseUrl}/${this.whatsappConfig.apiVersion || 'v18.0'}/${this.whatsappConfig.businessAccountId}/message_templates`;

      const response = await fetch(url, {
        headers: {
          Authorization: `Bearer ${this.whatsappConfig.accessToken}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json() as { data?: any[] };
      return this.mapApiTemplatesToWhatsAppTemplates(data.data || []);
    } catch (error) {
      this.logger.error('Failed to get WhatsApp templates:', error);
      throw error;
    }
  }

  validateTemplate(template: WhatsAppTemplate): boolean {
    if (!template.name || !template.language) {
      return false;
    }

    // Validate language code format (e.g., 'en', 'en_US')
    const languageRegex = /^[a-z]{2}(_[A-Z]{2})?$/;
    if (!languageRegex.test(template.language)) {
      return false;
    }

    // Validate components if present
    if (template.components) {
      for (const component of template.components) {
        if (!['header', 'body', 'footer', 'button'].includes(component.type)) {
          return false;
        }
      }
    }

    return true;
  }

  async validateConfig(config: ProviderConfig): Promise<boolean> {
    if (!this.validateCommonConfig(config)) {
      return false;
    }

    const credentials = config.credentials as WhatsAppConfig;

    if (!credentials.accessToken) {
      this.logger.error('WhatsApp configuration missing accessToken');
      return false;
    }

    if (!credentials.phoneNumberId) {
      this.logger.error('WhatsApp configuration missing phoneNumberId');
      return false;
    }

    if (!credentials.businessAccountId) {
      this.logger.error('WhatsApp configuration missing businessAccountId');
      return false;
    }

    return true;
  }

  protected async performHealthCheck(): Promise<ProviderHealthStatus> {
    if (!this.whatsappConfig.accessToken) {
      throw new Error('WhatsApp access token not configured');
    }

    try {
      // Test connectivity by getting phone number info
      const url = `${this.baseUrl}/${this.whatsappConfig.apiVersion || 'v18.0'}/${this.whatsappConfig.phoneNumberId}`;

      const response = await fetch(url, {
        headers: {
          Authorization: `Bearer ${this.whatsappConfig.accessToken}`,
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json() as { display_phone_number?: string; verified_name?: string };

      return {
        status: ProviderHealth.HEALTHY,
        lastChecked: new Date(),
        uptime: 100,
        metadata: {
          service: 'Meta WhatsApp Business',
          phoneNumber: data.display_phone_number,
          verifiedName: data.verified_name,
          apiVersion: this.whatsappConfig.apiVersion || 'v18.0',
        },
      };
    } catch (error) {
      throw new Error(`WhatsApp health check failed: ${error.message}`);
    }
  }

  protected async onInitialize(): Promise<void> {
    this.whatsappConfig = this.config.credentials as WhatsAppConfig;
    this.logger.log(
      `Meta WhatsApp Provider initialized for phone number ID: ${this.whatsappConfig.phoneNumberId}`,
    );
  }

  private buildMessageRequest(payload: WhatsAppPayload): MetaWhatsAppRequest {
    const baseRequest: MetaWhatsAppRequest = {
      messaging_product: 'whatsapp',
      to: payload.recipient.replace(/^\+/, ''), // Remove + if present
      type: payload.message.type,
    };

    switch (payload.message.type) {
      case 'text':
        baseRequest.text = {
          body: payload.message.text || '',
        };
        break;

      case 'media':
        if (payload.message.mediaType === 'image') {
          baseRequest.type = 'image';
          baseRequest.image = {
            link: payload.message.mediaUrl!,
            caption: payload.message.caption,
          };
        } else if (payload.message.mediaType === 'video') {
          baseRequest.type = 'video';
          baseRequest.video = {
            link: payload.message.mediaUrl!,
            caption: payload.message.caption,
          };
        } else if (payload.message.mediaType === 'audio') {
          baseRequest.type = 'audio';
          baseRequest.audio = {
            link: payload.message.mediaUrl!,
          };
        } else if (payload.message.mediaType === 'document') {
          baseRequest.type = 'document';
          baseRequest.document = {
            link: payload.message.mediaUrl!,
            caption: payload.message.caption,
            filename: payload.message.filename,
          };
        }
        break;

      case 'interactive':
        baseRequest.interactive = payload.message.interactive;
        break;

      default:
        throw new Error(`Unsupported message type: ${payload.message.type}`);
    }

    return baseRequest;
  }

  private buildTemplateRequest(payload: WhatsAppPayload): MetaWhatsAppRequest {
    return {
      messaging_product: 'whatsapp',
      to: payload.recipient.replace(/^\+/, ''),
      type: 'template',
      template: {
        name: payload.templateName!,
        language: {
          code: payload.templateLanguage || 'en',
        },
        components: payload.templateParameters
          ? this.buildTemplateParametersComponents(payload.templateParameters)
          : undefined,
      },
    };
  }

  private buildTemplateComponents(
    template: WhatsAppTemplate,
    parameters?: Record<string, any>,
  ): any[] {
    if (!template.components) {
      return [];
    }

    return template.components.map((component) => {
      const mappedComponent: any = {
        type: component.type,
      };

      if (component.parameters && parameters) {
        mappedComponent.parameters = component.parameters.map((param) => {
          if (param.type === 'text' && parameters[param.text || '']) {
            return {
              type: 'text',
              text: parameters[param.text || ''],
            };
          }
          return param;
        });
      }

      return mappedComponent;
    });
  }

  private buildTemplateParametersComponents(parameters: string[]): any[] {
    return [
      {
        type: 'body',
        parameters: parameters.map((param) => ({
          type: 'text',
          text: param,
        })),
      },
    ];
  }

  private async makeHttpRequest(
    data: MetaWhatsAppRequest,
  ): Promise<MetaWhatsAppResponse> {
    const url = `${this.baseUrl}/${this.whatsappConfig.apiVersion || 'v18.0'}/${this.whatsappConfig.phoneNumberId}/messages`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.whatsappConfig.accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });

    const responseData = await response.json();

    if (!response.ok) {
      const error = responseData as MetaWhatsAppError;
      throw new Error(
        error.error?.message ||
          `HTTP ${response.status}: ${response.statusText}`,
      );
    }

    return responseData as MetaWhatsAppResponse;
  }

  private mapApiTemplatesToWhatsAppTemplates(
    apiTemplates: any[],
  ): WhatsAppTemplate[] {
    return apiTemplates.map((template) => ({
      name: template.name,
      language: template.language,
      components: template.components || [],
    }));
  }

  /**
   * Get message delivery status
   */
  async getMessageStatus(messageId: string): Promise<any> {
    if (!this.isInitialized) {
      throw new Error('Provider not initialized');
    }

    try {
      const url = `${this.baseUrl}/${this.whatsappConfig.apiVersion || 'v18.0'}/${messageId}`;

      const response = await fetch(url, {
        headers: {
          Authorization: `Bearer ${this.whatsappConfig.accessToken}`,
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      return response.json();
    } catch (error) {
      this.logger.error('Failed to get WhatsApp message status:', error);
      throw error;
    }
  }

  /**
   * Upload media to WhatsApp
   */
  async uploadMedia(mediaUrl: string, mediaType: string): Promise<string> {
    if (!this.isInitialized) {
      throw new Error('Provider not initialized');
    }

    try {
      const url = `${this.baseUrl}/${this.whatsappConfig.apiVersion || 'v18.0'}/${this.whatsappConfig.phoneNumberId}/media`;

      const formData = new FormData();
      formData.append('messaging_product', 'whatsapp');
      formData.append('type', mediaType);
      formData.append('file', mediaUrl); // In real implementation, this would be a file

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.whatsappConfig.accessToken}`,
        },
        body: formData,
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json() as { id: string };
      return data.id;
    } catch (error) {
      this.logger.error('Failed to upload WhatsApp media:', error);
      throw error;
    }
  }
}
