import { BaseProviderPayload, IBaseProvider } from "../base/base-provider.interface";

export interface WhatsAppPayload extends BaseProviderPayload {
  recipient: string; // WhatsApp number in E.164 format
  message: WhatsAppMessage;
  templateName?: string;
  templateLanguage?: string;
  templateParameters?: string[];
}

export interface WhatsAppMessage {
  type: "text" | "template" | "media" | "interactive";
  text?: string;
  mediaUrl?: string;
  mediaType?: "image" | "video" | "audio" | "document";
  caption?: string;
  filename?: string;
  interactive?: WhatsAppInteractive;
}

export interface WhatsAppInteractive {
  type: "button" | "list";
  header?: {
    type: "text" | "image" | "video" | "document";
    text?: string;
    mediaUrl?: string;
  };
  body: {
    text: string;
  };
  footer?: {
    text: string;
  };
  action: WhatsAppAction;
}

export interface WhatsAppAction {
  buttons?: WhatsAppButton[];
  button?: string;
  sections?: WhatsAppSection[];
}

export interface WhatsAppButton {
  type: "reply";
  reply: {
    id: string;
    title: string;
  };
}

export interface WhatsAppSection {
  title: string;
  rows: WhatsAppRow[];
}

export interface WhatsAppRow {
  id: string;
  title: string;
  description?: string;
}

export interface WhatsAppConfig {
  apiKey?: string;
  phoneNumberId?: string;
  businessAccountId?: string;
  accessToken?: string;
  webhookVerifyToken?: string;
  apiVersion?: string;
  baseUrl?: string;
}

export interface WhatsAppTemplate {
  name: string;
  language: string;
  components: WhatsAppTemplateComponent[];
}

export interface WhatsAppTemplateComponent {
  type: "header" | "body" | "footer" | "button";
  parameters?: WhatsAppTemplateParameter[];
}

export interface WhatsAppTemplateParameter {
  type: "text" | "currency" | "date_time" | "image" | "document" | "video";
  text?: string;
  currency?: {
    fallback_value: string;
    code: string;
    amount_1000: number;
  };
  date_time?: {
    fallback_value: string;
  };
  image?: {
    link: string;
  };
  document?: {
    link: string;
    filename?: string;
  };
  video?: {
    link: string;
  };
}

export interface IWhatsAppProvider extends IBaseProvider {
  send(payload: WhatsAppPayload): Promise<import("../types").ProviderResponse>;

  /**
   * Send a template message
   */
  sendTemplate(
    recipient: string,
    template: WhatsAppTemplate,
    parameters?: Record<string, any>,
  ): Promise<import("../types").ProviderResponse>;

  /**
   * Validate WhatsApp number format
   */
  validateWhatsAppNumber(number: string): boolean;

  /**
   * Get available message templates
   */
  getTemplates(): Promise<WhatsAppTemplate[]>;

  /**
   * Validate template parameters
   */
  validateTemplate(template: WhatsAppTemplate): boolean;
}
