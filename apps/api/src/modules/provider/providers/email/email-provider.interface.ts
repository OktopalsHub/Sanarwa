import { NotificationChannel } from '../../../../common/enums/notification-channel.enum';

export interface EmailMessage {
  to: string | string[];
  from?: string;
  fromName?: string;
  subject: string;
  html?: string;
  text?: string;
  cc?: string[];
  bcc?: string[];
  replyTo?: string;
  attachments?: EmailAttachment[];
  headers?: Record<string, string>;
  templateId?: string;
  templateData?: Record<string, any>;
  brandConfig?: {
    defaultFromEmail?: string;
    defaultFromName?: string;
    domain?: string;
    verified?: boolean;
    dkimEnabled?: boolean;
  };
}

export interface EmailAttachment {
  filename: string;
  content: Buffer | string;
  contentType?: string;
  encoding?: string;
  cid?: string; // For inline attachments
}

export interface EmailDeliveryResult {
  messageId: string;
  status: 'sent' | 'queued' | 'failed';
  providerId: string;
  timestamp: Date;
  cost?: number;
  metadata?: Record<string, any>;
  error?: string;
}

export interface EmailProviderConfig {
  providerId: string;
  name: string;
  isActive: boolean;
  priority: number;
  config: Record<string, any>;
  rateLimits?: {
    perSecond?: number;
    perMinute?: number;
    perHour?: number;
    perDay?: number;
  };
  failoverConfig?: {
    maxRetries: number;
    retryDelay: number;
    fallbackProviderId?: string;
  };
}

export interface EmailProviderStats {
  totalSent: number;
  totalFailed: number;
  averageLatency: number;
  deliveryRate: number;
  lastUsed: Date;
  costToDate: number;
}

export abstract class BaseEmailProvider {
  abstract readonly providerId: string;
  abstract readonly name: string;
  abstract readonly channel: NotificationChannel.EMAIL;

  constructor(protected config: EmailProviderConfig) { }

  abstract initialize(): Promise<void>;
  abstract sendEmail(message: EmailMessage): Promise<EmailDeliveryResult>;
  abstract validateConfig(config: Record<string, any>): Promise<{ isValid: boolean; errors: string[] }>;
  abstract getStats(): Promise<EmailProviderStats>;
  abstract healthCheck(): Promise<{ healthy: boolean; latency: number; error?: string }>;
  abstract getCost(messageCount: number): Promise<number>;

  // Optional methods that providers can override
  async sendBulkEmails?(messages: EmailMessage[]): Promise<EmailDeliveryResult[]> {
    return Promise.all(messages.map(msg => this.sendEmail(msg)));
  }

  async getTemplates?(): Promise<Array<{ id: string; name: string; subject: string }>> {
    return [];
  }

  async createTemplate?(template: { name: string; subject: string; html: string; text?: string }): Promise<string> {
    throw new Error('Template creation not supported by this provider');
  }

  async updateTemplate?(templateId: string, template: Partial<{ name: string; subject: string; html: string; text?: string }>): Promise<void> {
    throw new Error('Template updates not supported by this provider');
  }

  async deleteTemplate?(templateId: string): Promise<void> {
    throw new Error('Template deletion not supported by this provider');
  }
}