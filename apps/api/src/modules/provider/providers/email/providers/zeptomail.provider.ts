import { Injectable, Logger } from "@nestjs/common";
import { NotificationChannel } from "../../../../../common/enums/notification-channel.enum";
import {
  BaseEmailProvider,
  EmailDeliveryResult,
  EmailMessage,
  EmailProviderConfig,
  EmailProviderStats,
} from "../email-provider.interface";

interface ZeptoMailConfig {
  apiKey: string;
  apiUrl?: string;
  fromEmail?: string;
  fromName?: string;
  replyToEmail?: string;
}

interface ZeptoMailAddress {
  address: string;
  name?: string;
}

interface ZeptoMailRecipient {
  email_address: ZeptoMailAddress;
}

interface ZeptoMailResponse {
  request_id?: string;
  data?: Array<{ code?: string; message?: string }>;
  error?: { code?: string; message?: string };
}

const DEFAULT_API_URL = "https://api.zeptomail.com/v1.1/email";

@Injectable()
export class ZeptoMailProvider extends BaseEmailProvider {
  readonly providerId = "zeptomail";
  readonly name = "ZeptoMail";
  readonly channel = NotificationChannel.EMAIL;

  private readonly logger = new Logger(ZeptoMailProvider.name);
  private isInitialized = false;

  constructor(config: EmailProviderConfig) {
    super(config);
  }

  async initialize(): Promise<void> {
    const zeptoConfig = this.config.config as ZeptoMailConfig;
    if (!zeptoConfig.apiKey) {
      throw new Error("ZeptoMail API key is required");
    }

    this.isInitialized = true;
    this.logger.log("ZeptoMail provider initialized successfully");
  }

  async sendEmail(message: EmailMessage): Promise<EmailDeliveryResult> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    const startTime = Date.now();
    const zeptoConfig = this.config.config as ZeptoMailConfig;

    try {
      const sender = this.resolveSender(message, zeptoConfig);
      if (!sender.address) {
        throw new Error("ZeptoMail requires a sender email address");
      }

      const payload: Record<string, unknown> = {
        from: sender,
        to: this.toRecipients(message.to),
        subject: message.subject,
        htmlbody: message.html,
        textbody: message.text,
        cc: message.cc?.length ? this.toRecipients(message.cc) : undefined,
        bcc: message.bcc?.length ? this.toRecipients(message.bcc) : undefined,
        reply_to: message.replyTo
          ? this.toRecipients(message.replyTo)
          : zeptoConfig.replyToEmail
            ? this.toRecipients(zeptoConfig.replyToEmail)
            : undefined,
        headers: message.headers,
        attachments: message.attachments?.map((attachment) => ({
          name: attachment.filename,
          content:
            typeof attachment.content === "string"
              ? Buffer.from(attachment.content).toString("base64")
              : attachment.content.toString("base64"),
          mime_type: attachment.contentType,
        })),
      };

      if (message.templateId) {
        payload.template_key = message.templateId;
        payload.merge_info = message.templateData ?? {};
      }

      const response = await fetch(zeptoConfig.apiUrl || DEFAULT_API_URL, {
        method: "POST",
        headers: {
          Authorization: `Zoho-enczapikey ${zeptoConfig.apiKey}`,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify(payload),
      });

      const responseData = (await response.json().catch(() => ({}))) as ZeptoMailResponse;

      if (!response.ok) {
        throw new Error(
          `ZeptoMail API error: ${
            responseData.error?.message || response.statusText || response.status
          }`,
        );
      }

      const latency = Date.now() - startTime;

      return {
        messageId: responseData.request_id || `zeptomail_${Date.now()}`,
        status: "sent",
        providerId: this.providerId,
        timestamp: new Date(),
        cost: await this.calculateCost(Array.isArray(message.to) ? message.to.length : 1),
        metadata: {
          latency,
          statusCode: response.status,
          requestId: responseData.request_id,
        },
      };
    } catch (error) {
      const latency = Date.now() - startTime;

      this.logger.error("ZeptoMail email send failed", {
        error: error.message,
        to: message.to,
        subject: message.subject,
      });

      return {
        messageId: `zeptomail_failed_${Date.now()}`,
        status: "failed",
        providerId: this.providerId,
        timestamp: new Date(),
        error: error.message,
        metadata: {
          latency,
          errorType: "send_failure",
        },
      };
    }
  }

  async sendBulkEmails(messages: EmailMessage[]): Promise<EmailDeliveryResult[]> {
    const results: EmailDeliveryResult[] = [];

    for (const message of messages) {
      results.push(await this.sendEmail(message));
    }

    return results;
  }

  async validateConfig(
    config: Record<string, any>,
  ): Promise<{ isValid: boolean; errors: string[] }> {
    const errors: string[] = [];
    const zeptoConfig = config as ZeptoMailConfig;

    if (!zeptoConfig.apiKey) {
      errors.push("API key is required");
    }

    if (!zeptoConfig.fromEmail) {
      errors.push("From email is required");
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(zeptoConfig.fromEmail)) {
      errors.push("Invalid from email format");
    }

    if (zeptoConfig.replyToEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(zeptoConfig.replyToEmail)) {
      errors.push("Invalid reply-to email format");
    }

    if (zeptoConfig.apiUrl && !/^https?:\/\//.test(zeptoConfig.apiUrl)) {
      errors.push("API URL must start with http:// or https://");
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  async getStats(): Promise<EmailProviderStats> {
    return {
      totalSent: 0,
      totalFailed: 0,
      averageLatency: 0,
      deliveryRate: 0,
      lastUsed: new Date(),
      costToDate: 0,
    };
  }

  async getCost(messageCount: number): Promise<number> {
    return this.calculateCost(messageCount);
  }

  private resolveSender(message: EmailMessage, config: ZeptoMailConfig): ZeptoMailAddress {
    const fallbackEmail = config.fromEmail;
    const fallbackName = config.fromName;
    const rawFrom = message.from || fallbackEmail;
    const rawName = message.fromName || fallbackName;

    if (!rawFrom) {
      return { address: "" };
    }

    const match = rawFrom.match(/^(.*?)\s*<([^>]+)>$/);
    if (match) {
      return { address: match[2].trim(), name: match[1].trim() || rawName };
    }

    return { address: rawFrom.trim(), name: rawName };
  }

  private toRecipients(value: string | string[]): ZeptoMailRecipient[] {
    const addresses = Array.isArray(value) ? value : [value];
    return addresses.map((address) => ({
      email_address: { address: address.trim() },
    }));
  }

  private async calculateCost(messageCount: number): Promise<number> {
    const baseCost = messageCount * 0.0004;
    const infrastructureFee = baseCost * 0.2;

    return baseCost + infrastructureFee;
  }
}
