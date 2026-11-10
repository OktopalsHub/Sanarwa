import { Injectable, Logger } from "@nestjs/common";
import { NotificationChannel } from "../../../../../common/enums/notification-channel.enum";
import {
  BaseEmailProvider,
  EmailDeliveryResult,
  EmailMessage,
  EmailProviderConfig,
  EmailProviderStats,
} from "../email-provider.interface";

interface ResendConfig {
  apiKey: string;
  fromEmail?: string;
  fromName?: string;
  replyToEmail?: string;
}

interface ResendEmailResponse {
  id?: string;
  message?: string;
}

@Injectable()
export class ResendProvider extends BaseEmailProvider {
  readonly providerId = "resend";
  readonly name = "Resend";
  readonly channel = NotificationChannel.EMAIL;

  private readonly logger = new Logger(ResendProvider.name);
  private readonly baseUrl = "https://api.resend.com";
  private isInitialized = false;

  constructor(config: EmailProviderConfig) {
    super(config);
  }

  async initialize(): Promise<void> {
    try {
      const resendConfig = this.config.config as ResendConfig;
      if (!resendConfig.apiKey) {
        throw new Error("Resend API key is required");
      }

      this.isInitialized = true;
      this.logger.log("Resend provider initialized successfully");
    } catch (error) {
      this.logger.error("Failed to initialize Resend provider", error);
      throw new Error(`Resend initialization failed: ${error.message}`, { cause: error });
    }
  }

  async sendEmail(message: EmailMessage): Promise<EmailDeliveryResult> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    const startTime = Date.now();
    const resendConfig = this.config.config as ResendConfig;

    try {
      const payload = {
        from: message.fromName
          ? `${message.fromName} <${message.from || resendConfig.fromEmail}>`
          : message.from || resendConfig.fromEmail,
        to: Array.isArray(message.to) ? message.to : [message.to],
        subject: message.subject,
        html: message.html,
        text: message.text,
        cc: message.cc,
        bcc: message.bcc,
        reply_to: message.replyTo || resendConfig.replyToEmail,
        headers: message.headers,
        attachments: message.attachments?.map((att) => ({
          filename: att.filename,
          content:
            typeof att.content === "string"
              ? Buffer.from(att.content, "utf8").toString("base64")
              : att.content.toString("base64"),
          type: att.contentType,
          disposition: att.cid ? "inline" : "attachment",
          content_id: att.cid,
        })),
      };

      if (message.templateId) {
        Object.assign(payload, {
          html: message.html,
        });
      }

      const response = await fetch(`${this.baseUrl}/emails`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${resendConfig.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const responseData = (await response.json()) as ResendEmailResponse;
      const latency = Date.now() - startTime;

      if (!response.ok) {
        throw new Error(`Resend API error: ${responseData.message || response.statusText}`);
      }

      return {
        messageId: responseData.id || `resend_${Date.now()}`,
        status: "sent",
        providerId: this.providerId,
        timestamp: new Date(),
        cost: await this.calculateCost(Array.isArray(message.to) ? message.to.length : 1),
        metadata: {
          latency,
          statusCode: response.status,
          resendId: responseData.id,
        },
      };
    } catch (error) {
      const latency = Date.now() - startTime;

      this.logger.error("Resend email send failed", {
        error: error.message,
        to: message.to,
        subject: message.subject,
      });

      return {
        messageId: `resend_failed_${Date.now()}`,
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
      try {
        const result = await this.sendEmail(message);
        results.push(result);
      } catch (error) {
        results.push({
          messageId: `resend_bulk_failed_${Date.now()}`,
          status: "failed",
          providerId: this.providerId,
          timestamp: new Date(),
          error: error.message,
          metadata: {
            errorType: "bulk_send_failure",
          },
        });
      }
    }

    return results;
  }

  async validateConfig(
    config: Record<string, any>,
  ): Promise<{ isValid: boolean; errors: string[] }> {
    const errors: string[] = [];
    const resendConfig = config as ResendConfig;

    if (!resendConfig.apiKey) {
      errors.push("API key is required");
    } else if (!resendConfig.apiKey.startsWith("re_")) {
      errors.push("Invalid Resend API key format (should start with re_)");
    }

    if (resendConfig.fromEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(resendConfig.fromEmail)) {
      errors.push("Invalid from email format");
    }

    if (
      resendConfig.replyToEmail &&
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(resendConfig.replyToEmail)
    ) {
      errors.push("Invalid reply-to email format");
    }

    if (resendConfig.apiKey && errors.length === 0) {
      try {
        const response = await fetch(`${this.baseUrl}/domains`, {
          method: "GET",
          headers: {
            Authorization: `Bearer ${resendConfig.apiKey}`,
          },
        });

        if (!response.ok) {
          if (response.status === 401) {
            errors.push("Invalid API key");
          } else {
            errors.push("API key validation failed");
          }
        }
      } catch (error) {
        errors.push("Unable to validate API key");
      }
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

  async getTemplates(): Promise<Array<{ id: string; name: string; subject: string }>> {
    this.logger.warn("Template listing not implemented for Resend provider");
    return [];
  }

  private async calculateCost(messageCount: number): Promise<number> {
    const freeTierLimit = 3000;
    const rate = 0.0006;

    let cost = 0;

    if (messageCount > freeTierLimit) {
      cost = (messageCount - freeTierLimit) * rate;
    }

    const infrastructureFee = cost * 0.3;

    return cost + infrastructureFee;
  }
}
