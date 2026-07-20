import {
  BaseProviderPayload,
  IBaseProvider,
} from '../base/base-provider.interface';

export interface EmailPayload extends BaseProviderPayload {
  recipient: string; // email address
  subject: string;
  htmlContent?: string;
  textContent?: string;
  attachments?: EmailAttachment[];
  replyTo?: string;
  from?: string;
  fromName?: string;
}

export interface EmailAttachment {
  filename: string;
  content: Buffer | string;
  contentType: string;
  disposition?: 'attachment' | 'inline';
  contentId?: string;
}

export interface EmailConfig {
  apiKey?: string;
  region?: string;
  fromEmail: string;
  fromName?: string;
  replyToEmail?: string;
  customHeaders?: Record<string, string>;
}

export interface IEmailProvider extends IBaseProvider {
  send(payload: EmailPayload): Promise<import('../types').ProviderResponse>;
}
