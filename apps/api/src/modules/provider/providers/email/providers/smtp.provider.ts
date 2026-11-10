import { Injectable, Logger } from "@nestjs/common";
import * as nodemailer from "nodemailer";
import { NotificationChannel } from "../../../../../common/enums/notification-channel.enum";
import {
  BaseEmailProvider,
  EmailDeliveryResult,
  EmailMessage,
  EmailProviderConfig,
  EmailProviderStats,
} from "../email-provider.interface";

interface SMTPConfig {
  host: string;
  port?: number;
  secure?: boolean;
  username?: string;
  password?: string;
  fromEmail?: string;
  fromName?: string;
  replyToEmail?: string;
}

const DEFAULT_SMTP_PORT = 587;

@Injectable()
export class SMTPProvider extends BaseEmailProvider {
  readonly providerId = "smtp";
  readonly name = "SMTP";
  readonly channel = NotificationChannel.EMAIL;

  private readonly logger = new Logger(SMTPProvider.name);
  private transporter: nodemailer.Transporter;
  private isInitialized = false;

  constructor(config: EmailProviderConfig) {
    super(config);
  }

  async initialize(): Promise<void> {
    const smtpConfig = this.config.config as SMTPConfig;
    if (!smtpConfig.host) {
      throw new Error("SMTP host is required");
    }

    this.transporter = nodemailer.createTransport({
      host: smtpConfig.host,
      port: smtpConfig.port ?? DEFAULT_SMTP_PORT,
      secure: smtpConfig.secure ?? smtpConfig.port === 465,
      auth:
        smtpConfig.username && smtpConfig.password
          ? {
              user: smtpConfig.username,
              pass: smtpConfig.password,
            }
          : undefined,
      connectionTimeout: 10_000,
      greetingTimeout: 10_000,
      socketTimeout: 20_000,
    });

    this.isInitialized = true;
    this.logger.log(`SMTP provider initialized for ${smtpConfig.host}`);
  }

  async sendEmail(message: EmailMessage): Promise<EmailDeliveryResult> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    const startTime = Date.now();
    const smtpConfig = this.config.config as SMTPConfig;

    try {
      const info = await this.transporter.sendMail({
        from: this.formatAddress(
          message.from || smtpConfig.fromEmail,
          message.fromName || smtpConfig.fromName,
        ),
        to: message.to,
        cc: message.cc,
        bcc: message.bcc,
        replyTo: message.replyTo || smtpConfig.replyToEmail,
        subject: message.subject,
        html: message.html,
        text: message.text,
        headers: message.headers,
        attachments: message.attachments?.map((attachment) => ({
          filename: attachment.filename,
          content: attachment.content,
          contentType: attachment.contentType,
          encoding: attachment.encoding,
          cid: attachment.cid,
        })),
      });

      return {
        messageId: info.messageId || `smtp_${Date.now()}`,
        status: "sent",
        providerId: this.providerId,
        timestamp: new Date(),
        cost: await this.calculateCost(Array.isArray(message.to) ? message.to.length : 1),
        metadata: {
          latency: Date.now() - startTime,
          host: smtpConfig.host,
          accepted: info.accepted,
          rejected: info.rejected,
        },
      };
    } catch (error) {
      this.logger.error("SMTP email send failed", {
        error: error.message,
        to: message.to,
        subject: message.subject,
      });

      return {
        messageId: `smtp_failed_${Date.now()}`,
        status: "failed",
        providerId: this.providerId,
        timestamp: new Date(),
        error: error.message,
        metadata: {
          latency: Date.now() - startTime,
          errorType: "send_failure",
        },
      };
    }
  }

  async validateConfig(
    config: Record<string, any>,
  ): Promise<{ isValid: boolean; errors: string[] }> {
    const errors: string[] = [];
    const smtpConfig = config as SMTPConfig;

    if (!smtpConfig.host) {
      errors.push("SMTP host is required");
    }

    if (
      smtpConfig.port !== undefined &&
      (!Number.isInteger(smtpConfig.port) || smtpConfig.port <= 0 || smtpConfig.port > 65535)
    ) {
      errors.push("SMTP port must be a valid port number");
    }

    if (smtpConfig.username && !smtpConfig.password) {
      errors.push("SMTP password is required when a username is provided");
    }

    if (!smtpConfig.fromEmail) {
      errors.push("From email is required");
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(smtpConfig.fromEmail)) {
      errors.push("Invalid from email format");
    }

    if (smtpConfig.replyToEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(smtpConfig.replyToEmail)) {
      errors.push("Invalid reply-to email format");
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

  async getCost(_messageCount: number): Promise<number> {
    return this.calculateCost(0);
  }

  private formatAddress(email?: string, name?: string): string {
    if (!email) return "";
    return name ? `"${name}" <${email}>` : email;
  }

  private async calculateCost(_messageCount: number): Promise<number> {
    return 0;
  }
}
