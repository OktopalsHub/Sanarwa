import { Injectable, Logger } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { AuthEmailService } from "../../auth/services/auth-email.service";
import {
  AlertSeverity,
  AlertStatus,
  AlertType,
  SystemAlert,
} from "../entities/system-alert.entity";
import type { DeadLetterJobData, SystemAlertPayload } from "./dead-letter.types";
import {
  generateAlertEmailHtml,
  generateAlertEmailText,
  generateDeadLetterEmailHtml,
  generateDeadLetterEmailText,
  getAlertChannels,
  getSlackColorBySeverity,
} from "./dead-letter-email.templates";

@Injectable()
export class DeadLetterAlertService {
  private readonly logger = new Logger(DeadLetterAlertService.name);

  constructor(
    @InjectRepository(SystemAlert)
    private readonly systemAlertRepository: Repository<SystemAlert>,
    private readonly authEmailService: AuthEmailService,
  ) {}

  getAdminEmails(_tenantId: string): string[] {
    const systemAdmins = process.env.SYSTEM_ADMIN_EMAILS?.split(",") || [];
    return systemAdmins.filter((email) => email.includes("@"));
  }

  async storeAlert(alert: SystemAlertPayload): Promise<void> {
    try {
      const alertRecord = this.systemAlertRepository.create({
        tenantId: alert.tenantId,
        alertType: alert.type as AlertType,
        severity: alert.severity as AlertSeverity,
        status: AlertStatus.ACTIVE,
        title: alert.title,
        message: alert.message,
        metadata: alert.metadata as Record<string, unknown> | undefined,
        recipients: alert.recipients,
      });
      await this.systemAlertRepository.save(alertRecord);
    } catch (error) {
      this.logger.error(`Failed to store alert: ${error.message}`);
    }
  }

  async sendAlert(alert: SystemAlertPayload): Promise<void> {
    if (alert.recipients.length === 0) {
      this.logger.warn(`No recipients configured for alert: ${alert.type}`);
      return;
    }

    for (const channel of getAlertChannels(alert.severity)) {
      try {
        await this.sendAlertViaChannel(alert, channel);
      } catch (error) {
        this.logger.error(`Failed to send alert via ${channel}: ${error.message}`);
      }
    }
  }

  async sendDeadLetterNotification(
    adminEmails: string[],
    data: DeadLetterJobData,
  ): Promise<void> {
    const subject = `🚨 Dead Letter Queue Alert: ${data.originalType} ${data.originalId}`;
    for (const email of adminEmails) {
      await this.authEmailService.sendEmail({
        to: [email],
        subject,
        html: generateDeadLetterEmailHtml(data),
        text: generateDeadLetterEmailText(data),
        from: process.env.SYSTEM_ALERT_FROM_EMAIL || "alerts@yourapp.com",
      });
    }
  }

  private async sendAlertViaChannel(alert: SystemAlertPayload, channel: string): Promise<void> {
    switch (channel) {
      case "email":
        await this.sendEmailAlert(alert);
        break;
      case "sms":
        await this.sendSMSAlert(alert);
        break;
      case "slack":
        await this.sendSlackAlert(alert);
        break;
      default:
        this.logger.warn(`Unknown alert channel: ${channel}`);
    }
  }

  private async sendEmailAlert(alert: SystemAlertPayload): Promise<void> {
    const emailRecipients = alert.recipients.filter((r) => r.includes("@"));
    if (emailRecipients.length === 0) {
      return;
    }

    const subject = `🚨 System Alert: ${alert.title}`;
    for (const email of emailRecipients) {
      await this.authEmailService.sendEmail({
        to: [email],
        subject,
        html: generateAlertEmailHtml(alert),
        text: generateAlertEmailText(alert),
        from: process.env.SYSTEM_ALERT_FROM_EMAIL || "alerts@yourapp.com",
      });
    }
  }

  private async sendSMSAlert(alert: SystemAlertPayload): Promise<void> {
    const smsRecipients = alert.recipients.filter((r) => r.startsWith("+"));
    if (smsRecipients.length === 0) {
      return;
    }
    const message = `🚨 SYSTEM ALERT: ${alert.title}\n\n${alert.message}`;
    this.logger.log(
      `[SMS DISABLED] Would send SMS alert to ${smsRecipients.join(", ")}: ${message}`,
    );
  }

  private async sendSlackAlert(alert: SystemAlertPayload): Promise<void> {
    if (!process.env.SLACK_WEBHOOK_URL) {
      this.logger.warn("Slack webhook URL not configured");
      return;
    }
    const slackMessage = {
      text: `🚨 System Alert: ${alert.title}`,
      attachments: [
        {
          color: getSlackColorBySeverity(alert.severity),
          fields: [
            { title: "Severity", value: alert.severity.toUpperCase(), short: true },
            { title: "Type", value: alert.type, short: true },
            { title: "Tenant", value: alert.tenantId, short: true },
            { title: "Message", value: alert.message, short: false },
          ],
        },
      ],
    };
    this.logger.log(`[SLACK DISABLED] Would send Slack alert: ${JSON.stringify(slackMessage)}`);
  }
}
