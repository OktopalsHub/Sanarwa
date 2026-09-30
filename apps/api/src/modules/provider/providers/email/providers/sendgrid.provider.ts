import { Injectable, Logger } from "@nestjs/common";
import { NotificationChannel } from "../../../../../common/enums/notification-channel.enum";
import {
  BaseEmailProvider,
  EmailDeliveryResult,
  EmailMessage,
  EmailProviderConfig,
  EmailProviderStats,
} from "../email-provider.interface";

interface SendGridConfig {
  apiKey: string;
  fromEmail?: string;
  fromName?: string;
  replyToEmail?: string;
  sandboxMode?: boolean;
}

@Injectable()
export class SendGridProvider extends BaseEmailProvider {
  readonly providerId = "sendgrid";
  readonly name = "SendGrid";
  readonly channel = NotificationChannel.EMAIL;

  private readonly logger = new Logger(SendGridProvider.name);
  private sgMail: any;
  private isInitialized = false;

  constructor(config: EmailProviderConfig) {
    super(config);
  }

  async initialize(): Promise<void> {
    try {
      // Dynamic import to avoid bundling if not used
      const sgMail = await import("@sendgrid/mail");
      this.sgMail = sgMail.default;

      const sendGridConfig = this.config.config as SendGridConfig;
      this.sgMail.setApiKey(sendGridConfig.apiKey);

      this.isInitialized = true;
      this.logger.log("SendGrid provider initialized successfully");
    } catch (error) {
      this.logger.error("Failed to initialize SendGrid provider", error);
      throw new Error(`SendGrid initialization failed: ${error.message}`, { cause: error });
    }
  }

  async sendEmail(message: EmailMessage): Promise<EmailDeliveryResult> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    const startTime = Date.now();
    const sendGridConfig = this.config.config as SendGridConfig;

    try {
      const msg = {
        to: Array.isArray(message.to) ? message.to : [message.to],
        from: {
          email: message.from || sendGridConfig.fromEmail,
          name: message.fromName || sendGridConfig.fromName,
        },
        subject: message.subject,
        html: message.html,
        text: message.text,
        cc: message.cc,
        bcc: message.bcc,
        replyTo: message.replyTo || sendGridConfig.replyToEmail,
        headers: message.headers,
        mailSettings: sendGridConfig.sandboxMode
          ? {
              sandboxMode: { enable: true },
            }
          : undefined,
        attachments: message.attachments?.map((att) => ({
          filename: att.filename,
          content: typeof att.content === "string" ? att.content : att.content.toString("base64"),
          type: att.contentType,
          disposition: att.cid ? "inline" : "attachment",
          contentId: att.cid,
        })),
      };

      // Handle template emails
      if (message.templateId) {
        Object.assign(msg, {
          templateId: message.templateId,
          dynamicTemplateData: message.templateData || {},
        });
        delete msg.html;
        delete msg.text;
      }

      const response = await this.sgMail.send(msg);
      const latency = Date.now() - startTime;

      return {
        messageId: response[0]?.headers?.["x-message-id"] || `sg_${Date.now()}`,
        status: "sent",
        providerId: this.providerId,
        timestamp: new Date(),
        cost: await this.calculateCost(Array.isArray(message.to) ? message.to.length : 1),
        metadata: {
          latency,
          statusCode: response[0]?.statusCode,
          headers: response[0]?.headers,
        },
      };
    } catch (error) {
      const latency = Date.now() - startTime;

      this.logger.error("SendGrid email send failed", {
        error: error.message,
        to: message.to,
        subject: message.subject,
      });

      return {
        messageId: `sg_failed_${Date.now()}`,
        status: "failed",
        providerId: this.providerId,
        timestamp: new Date(),
        error: error.message,
        metadata: {
          latency,
          statusCode: error.code,
          errorType: error.response?.body?.errors?.[0]?.field || "unknown",
        },
      };
    }
  }

  async sendBulkEmails(messages: EmailMessage[]): Promise<EmailDeliveryResult[]> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    const sendGridConfig = this.config.config as SendGridConfig;
    const results: EmailDeliveryResult[] = [];

    try {
      const bulkMessages = messages.map((message) => ({
        to: Array.isArray(message.to) ? message.to : [message.to],
        from: {
          email: message.from || sendGridConfig.fromEmail,
          name: message.fromName || sendGridConfig.fromName,
        },
        subject: message.subject,
        html: message.html,
        text: message.text,
        cc: message.cc,
        bcc: message.bcc,
        replyTo: message.replyTo || sendGridConfig.replyToEmail,
        headers: message.headers,
        templateId: message.templateId,
        dynamicTemplateData: message.templateData,
      }));

      const response = await this.sgMail.send(bulkMessages);

      response.forEach((res: any, index: number) => {
        results.push({
          messageId: res.headers?.["x-message-id"] || `sg_bulk_${Date.now()}_${index}`,
          status: "sent",
          providerId: this.providerId,
          timestamp: new Date(),
          cost: 0, // Will be calculated in batch
          metadata: {
            statusCode: res.statusCode,
            headers: res.headers,
          },
        });
      });

      return results;
    } catch (error) {
      this.logger.error("SendGrid bulk email send failed", error);

      // Return failed results for all messages
      return messages.map((_, index) => ({
        messageId: `sg_bulk_failed_${Date.now()}_${index}`,
        status: "failed",
        providerId: this.providerId,
        timestamp: new Date(),
        error: error.message,
        metadata: {
          errorType: "bulk_send_failure",
        },
      }));
    }
  }

  async validateConfig(
    config: Record<string, any>,
  ): Promise<{ isValid: boolean; errors: string[] }> {
    const errors: string[] = [];
    const sendGridConfig = config as SendGridConfig;

    if (!sendGridConfig.apiKey) {
      errors.push("API key is required");
    } else if (!sendGridConfig.apiKey.startsWith("SG.")) {
      errors.push("Invalid SendGrid API key format");
    }

    if (sendGridConfig.fromEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(sendGridConfig.fromEmail)) {
      errors.push("Invalid from email format");
    }

    if (
      sendGridConfig.replyToEmail &&
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(sendGridConfig.replyToEmail)
    ) {
      errors.push("Invalid reply-to email format");
    }

    // Test API key if provided
    if (sendGridConfig.apiKey && errors.length === 0) {
      try {
        const sgMail = await import("@sendgrid/mail");
        sgMail.default.setApiKey(sendGridConfig.apiKey);

        // Test with a simple API call
        await sgMail.default.send({
          to: "test@example.com",
          from: sendGridConfig.fromEmail || "test@example.com",
          subject: "Test",
          text: "Test",
          mailSettings: {
            sandboxMode: { enable: true },
          },
        });
      } catch (error) {
        if (error.code === 401) {
          errors.push("Invalid API key");
        } else if (error.code === 403) {
          errors.push("API key does not have sufficient permissions");
        }
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  async getStats(): Promise<EmailProviderStats> {
    // In a real implementation, this would fetch from a database or cache
    return {
      totalSent: 0,
      totalFailed: 0,
      averageLatency: 0,
      deliveryRate: 0,
      lastUsed: new Date(),
      costToDate: 0,
    };
  }

  async healthCheck(): Promise<{ healthy: boolean; latency: number; error?: string }> {
    const startTime = Date.now();

    try {
      if (!this.isInitialized) {
        await this.initialize();
      }

      // Simple health check - try to access SendGrid API
      const sendGridConfig = this.config.config as SendGridConfig;
      const sgMail = await import("@sendgrid/mail");
      sgMail.default.setApiKey(sendGridConfig.apiKey);

      // Test with sandbox mode
      await sgMail.default.send({
        to: "healthcheck@example.com",
        from: sendGridConfig.fromEmail || "healthcheck@example.com",
        subject: "Health Check",
        text: "Health check message",
        mailSettings: {
          sandboxMode: { enable: true },
        },
      });

      return {
        healthy: true,
        latency: Date.now() - startTime,
      };
    } catch (error) {
      return {
        healthy: false,
        latency: Date.now() - startTime,
        error: error.message,
      };
    }
  }

  async getCost(messageCount: number): Promise<number> {
    return this.calculateCost(messageCount);
  }

  async getTemplates(): Promise<Array<{ id: string; name: string; subject: string }>> {
    try {
      if (!this.isInitialized) {
        await this.initialize();
      }

      // SendGrid doesn't provide a direct API to list templates via the mail library
      // This would require using the SendGrid Web API v3 directly
      this.logger.warn("Template listing not implemented for SendGrid provider");
      return [];
    } catch (error) {
      this.logger.error("Failed to fetch SendGrid templates", error);
      return [];
    }
  }

  private async calculateCost(messageCount: number): Promise<number> {
    // SendGrid pricing: $0.60 per 1000 emails for first 40k, then $0.55
    const baseRate = 0.0006; // $0.60 per 1000
    const discountRate = 0.00055; // $0.55 per 1000 after 40k
    const discountThreshold = 40000;

    let cost = 0;

    if (messageCount <= discountThreshold) {
      cost = messageCount * baseRate;
    } else {
      cost = discountThreshold * baseRate;
      cost += (messageCount - discountThreshold) * discountRate;
    }

    // Add infrastructure fee (30% markup)
    const infrastructureFee = cost * 0.3;

    return cost + infrastructureFee;
  }
}
