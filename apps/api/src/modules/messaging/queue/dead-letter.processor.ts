import { Process, Processor } from '@nestjs/bull';
import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Job } from 'bull';
import { NOTIFICATION_QUEUE } from './notification-queue.module';
import { DeadLetter, DeadLetterStatus, DeadLetterType } from '../entities/dead-letter.entity';
import { SystemAlert, AlertSeverity, AlertStatus, AlertType } from '../entities/system-alert.entity';
import { AuthEmailService } from '../../auth/services/auth-email.service';
import { DeadLetterRepository } from '../repositories/dead-letter.repository';
// UNCOMMENT TO ENABLE SMS/VOICE NOTIFICATIONS
// import { SMSService } from '../../provider/services/sms.service';
// import { VoiceService } from '../../provider/services/voice.service';

export interface DeadLetterJobData {
  type: 'dead_letter';
  originalType: 'notification' | 'delivery';
  originalId: string;
  tenantId: string;
  failureReason: string;
  failedAt: Date;
  retryCount: number;
  originalJobData: any;
  messageData?: any;
  deliveryData?: any;
}

export interface AlertJobData {
  type: 'system_alert';
  alert: {
    type: string;
    severity: 'low' | 'medium' | 'high' | 'critical';
    title: string;
    message: string;
    tenantId: string;
    metadata?: any;
    recipients: string[];
  };
  createdAt: Date;
}

@Processor(NOTIFICATION_QUEUE)
@Injectable()
export class DeadLetterProcessor {
  private readonly logger = new Logger(DeadLetterProcessor.name);

  constructor(
    private readonly deadLetterRepository: DeadLetterRepository,
    @InjectRepository(SystemAlert)
    private readonly systemAlertRepository: Repository<SystemAlert>,
    private readonly authEmailService: AuthEmailService,
    // UNCOMMENT TO ENABLE SMS/VOICE NOTIFICATIONS
    // private readonly smsService: SMSService,
    // private readonly voiceService: VoiceService,
  ) { }

  /**
   * Process dead letter queue items
   */
  @Process('handle-dead-letter')
  async handleDeadLetter(job: Job<DeadLetterJobData>): Promise<void> {
    const { originalType, originalId } = job.data;

    this.logger.log(`Processing dead letter item: ${originalType} ${originalId}`);

    try {
      // Store dead letter item for manual review
      await this.storeDeadLetterItem(job.data);

      // Send notification to administrators about dead letter item
      await this.notifyAdministrators(job.data);

      // Log the dead letter processing
      this.logger.log(`Dead letter item processed: ${originalType} ${originalId}`);
    } catch (error) {
      this.logger.error(`Failed to process dead letter item ${originalId}: ${error.message}`);
      throw error;
    }
  }

  /**
   * Process system alerts
   */
  @Process('process-alert')
  async processAlert(job: Job<AlertJobData>): Promise<void> {
    const { alert } = job.data;

    this.logger.log(`Processing system alert: ${alert.type} (${alert.severity})`);

    try {
      // Send alert to configured recipients
      await this.sendAlert(alert);

      // Store alert in system logs
      await this.storeAlert(alert);

      this.logger.log(`System alert processed: ${alert.type}`);
    } catch (error) {
      this.logger.error(`Failed to process system alert ${alert.type}: ${error.message}`);
      throw error;
    }
  }

  /**
   * Store dead letter item for manual review
   */
  private async storeDeadLetterItem(data: DeadLetterJobData): Promise<void> {
    try {
      const savedRecord = await this.deadLetterRepository.create({
        originalType: data.originalType as DeadLetterType,
        originalId: data.originalId,
        tenantId: data.tenantId,
        failureReason: data.failureReason,
        failedAt: data.failedAt,
        retryCount: data.retryCount,
        originalJobData: data.originalJobData,
        messageData: data.messageData,
        deliveryData: data.deliveryData,
        status: DeadLetterStatus.PENDING_REVIEW,
        metadata: {
          processedAt: new Date(),
          processor: 'dead-letter-processor',
        },
      });

      this.logger.log('Dead letter item stored for manual review', {
        deadLetterId: savedRecord.id,
        originalType: data.originalType,
        originalId: data.originalId,
        tenantId: data.tenantId,
      });

      // Create system alert for critical failures
      if (data.retryCount >= 3) {
        await this.createCriticalFailureAlert(savedRecord);
      }
    } catch (error) {
      this.logger.error(`Failed to store dead letter item: ${error.message}`);
    }
  }

  /**
   * Notify administrators about dead letter items
   */
  private async notifyAdministrators(data: DeadLetterJobData): Promise<void> {
    try {
      // Send email notification to administrators
      const adminEmails = await this.getAdminEmails(data.tenantId);
      if (adminEmails.length > 0) {
        await this.sendDeadLetterNotification(adminEmails, data);
      } else {
        this.logger.warn('No admin emails configured for dead letter notifications');
      }
      //   subject,
      //   html: message,
      //   priority: 'high',
      // });

      this.logger.log(`Dead letter notification sent to administrators for ${data.originalId}`);
    } catch (error) {
      this.logger.error(`Failed to notify administrators about dead letter item: ${error.message}`);
    }
  }

  /**
   * Send system alert
   */
  private async sendAlert(alert: {
    type: string;
    severity: 'low' | 'medium' | 'high' | 'critical';
    title: string;
    message: string;
    tenantId: string;
    metadata?: any;
    recipients: string[];
  }): Promise<void> {
    try {
      if (alert.recipients.length === 0) {
        this.logger.warn(`No recipients configured for alert: ${alert.type}`);
        return;
      }

      // Send alert via multiple channels based on severity
      const channels = this.getAlertChannels(alert.severity);

      for (const channel of channels) {
        await this.sendAlertViaChannel(alert, channel);
      }

      this.logger.log(`Alert sent via ${channels.join(', ')}: ${alert.type}`);
    } catch (error) {
      this.logger.error(`Failed to send alert ${alert.type}: ${error.message}`);
    }
  }

  /**
   * Store alert in system logs
   */
  private async storeAlert(alert: any): Promise<void> {
    try {
      // Store alert in database
      const alertRecord = this.systemAlertRepository.create({
        tenantId: alert.tenantId,
        alertType: alert.type as AlertType,
        severity: alert.severity as AlertSeverity,
        status: AlertStatus.ACTIVE,
        title: alert.title,
        message: alert.message,
        metadata: alert.metadata,
        recipients: alert.recipients,
      });

      await this.systemAlertRepository.save(alertRecord);

      this.logger.log('Alert stored in system logs', {
        alertId: alertRecord.id,
        type: alert.type,
        severity: alert.severity,
      });
    } catch (error) {
      this.logger.error(`Failed to store alert: ${error.message}`);
    }
  }



  /**
   * Get alert channels based on severity
   */
  private getAlertChannels(severity: string): string[] {
    switch (severity) {
      case 'critical':
        return ['email', 'sms', 'slack'];
      case 'high':
        return ['email', 'slack'];
      case 'medium':
        return ['email'];
      case 'low':
        return ['slack'];
      default:
        return ['email'];
    }
  }

  /**
   * Send alert via specific channel
   */
  private async sendAlertViaChannel(alert: any, channel: string): Promise<void> {
    try {
      switch (channel) {
        case 'email':
          await this.sendEmailAlert(alert);
          break;
        case 'sms':
          await this.sendSMSAlert(alert);
          break;
        case 'slack':
          await this.sendSlackAlert(alert);
          break;
        default:
          this.logger.warn(`Unknown alert channel: ${channel}`);
      }
    } catch (error) {
      this.logger.error(`Failed to send alert via ${channel}: ${error.message}`);
    }
  }

  /**
   * Send email alert
   */
  private async sendEmailAlert(alert: any): Promise<void> {
    try {
      const emailRecipients = alert.recipients.filter((r: string) => r.includes('@'));
      
      if (emailRecipients.length === 0) {
        this.logger.warn('No email recipients found for alert');
        return;
      }

      const subject = `🚨 System Alert: ${alert.title}`;
      const htmlContent = this.generateAlertEmailHtml(alert);
      const textContent = this.generateAlertEmailText(alert);

      // Send to each recipient (in production, consider batching)
      for (const email of emailRecipients) {
        await this.authEmailService.sendEmail({
          to: [email],
          subject,
          html: htmlContent,
          text: textContent,
          from: process.env.SYSTEM_ALERT_FROM_EMAIL || 'alerts@yourapp.com',
        });
      }

      this.logger.log(`Email alert sent to ${emailRecipients.length} recipients: ${alert.title}`);
    } catch (error) {
      this.logger.error(`Failed to send email alert: ${error.message}`, error);
    }
  }

  /**
   * Send SMS alert (PRODUCTION READY - Remove comments to enable)
   */
  private async sendSMSAlert(alert: any): Promise<void> {
    try {
      const smsRecipients = alert.recipients.filter((r: string) => r.startsWith('+'));
      
      if (smsRecipients.length === 0) {
        this.logger.warn('No SMS recipients found for alert');
        return;
      }

      const message = `🚨 SYSTEM ALERT: ${alert.title}\n\n${alert.message}\n\nSeverity: ${alert.severity.toUpperCase()}\nTenant: ${alert.tenantId}\nTime: ${new Date().toLocaleString()}\n\nCheck dashboard for details.`;
      
      // REMOVE COMMENTS TO ENABLE SMS ALERTS
      // for (const phoneNumber of smsRecipients) {
      //   await this.smsService.sendSMS({
      //     to: phoneNumber,
      //     message,
      //     tenantId: alert.tenantId,
      //     metadata: { 
      //       type: 'system_alert', 
      //       alertType: alert.type,
      //       severity: alert.severity,
      //       alertId: alert.id || `alert_${Date.now()}`,
      //       timestamp: new Date()
      //     }
      //   });
      // }
      //
      // this.logger.log(`SMS alert sent to ${smsRecipients.length} recipients: ${alert.title}`);

      // FOR TESTING: Log what would be sent
      this.logger.log(`[SMS DISABLED] Would send SMS alert to ${smsRecipients.length} recipients (${smsRecipients.join(', ')}): ${message}`);
    } catch (error) {
      this.logger.error(`Failed to send SMS alert: ${error.message}`, error);
    }
  }

  /**
   * Send Slack alert (PRODUCTION READY - Remove comments to enable)
   */
  private async sendSlackAlert(alert: any): Promise<void> {
    try {
      const slackWebhookUrl = process.env.SLACK_WEBHOOK_URL;
      if (!slackWebhookUrl) {
        this.logger.warn('Slack webhook URL not configured - set SLACK_WEBHOOK_URL environment variable');
        return;
      }

      const slackMessage = {
        text: `🚨 System Alert: ${alert.title}`,
        attachments: [
          {
            color: this.getSlackColorBySeverity(alert.severity),
            fields: [
              { title: 'Severity', value: alert.severity.toUpperCase(), short: true },
              { title: 'Type', value: alert.type, short: true },
              { title: 'Tenant', value: alert.tenantId, short: true },
              { title: 'Time', value: new Date().toLocaleString(), short: true },
              { title: 'Message', value: alert.message, short: false }
            ],
            footer: 'System Alert',
            ts: Math.floor(Date.now() / 1000)
          }
        ]
      };

      // REMOVE COMMENTS TO ENABLE SLACK ALERTS
      // const response = await fetch(slackWebhookUrl, {
      //   method: 'POST',
      //   headers: { 'Content-Type': 'application/json' },
      //   body: JSON.stringify(slackMessage)
      // });
      //
      // if (!response.ok) {
      //   throw new Error(`Slack webhook returned ${response.status}: ${response.statusText}`);
      // }
      //
      // this.logger.log(`Slack alert sent: ${alert.title}`);

      // FOR TESTING: Log what would be sent
      this.logger.log(`[SLACK DISABLED] Would send Slack alert: ${JSON.stringify(slackMessage, null, 2)}`);
    } catch (error) {
      this.logger.error(`Failed to send Slack alert: ${error.message}`, error);
    }
  }

  /**
   * Get Slack color based on alert severity
   */
  private getSlackColorBySeverity(severity: string): string {
    const colors = {
      low: '#36a64f',      // Green
      medium: '#ff9500',   // Orange  
      high: '#ff6b35',     // Red-Orange
      critical: '#e01e5a'  // Red
    };
    return colors[severity] || '#808080'; // Gray for unknown
  }



  /**
   * Create critical failure alert
   */
  private async createCriticalFailureAlert(deadLetter: DeadLetter): Promise<void> {
    const alert = {
      type: AlertType.DEAD_LETTER,
      severity: AlertSeverity.CRITICAL,
      title: `Critical Failure: ${deadLetter.originalType} ${deadLetter.originalId}`,
      message: `A ${deadLetter.originalType} has failed ${deadLetter.retryCount} times and has been moved to the dead letter queue. Manual intervention required.`,
      tenantId: deadLetter.tenantId,
      metadata: {
        deadLetterId: deadLetter.id,
        originalType: deadLetter.originalType,
        originalId: deadLetter.originalId,
        failureReason: deadLetter.failureReason,
        retryCount: deadLetter.retryCount,
      },
      recipients: await this.getAdminEmails(deadLetter.tenantId),
    };

    await this.sendAlert(alert);
  }

  /**
   * Send dead letter notification email
   */
  private async sendDeadLetterNotification(adminEmails: string[], data: DeadLetterJobData): Promise<void> {
    try {
      const subject = `🚨 Dead Letter Queue Alert: ${data.originalType} ${data.originalId}`;
      const htmlContent = this.generateDeadLetterEmailHtml(data);
      const textContent = this.generateDeadLetterEmailText(data);

      for (const email of adminEmails) {
        await this.authEmailService.sendEmail({
          to: [email],
          subject,
          html: htmlContent,
          text: textContent,
          from: process.env.SYSTEM_ALERT_FROM_EMAIL || 'alerts@yourapp.com',
        });
      }

      this.logger.log(`Dead letter notification sent to ${adminEmails.length} administrators`);
    } catch (error) {
      this.logger.error(`Failed to send dead letter notification: ${error.message}`, error);
    }
  }

  /**
   * Get admin emails for tenant
   */
  private async getAdminEmails(tenantId: string): Promise<string[]> {
    // In production, query tenant admins from database
    // For now, return system admin emails from environment
    const systemAdmins = process.env.SYSTEM_ADMIN_EMAILS?.split(',') || [];
    return systemAdmins.filter(email => email.includes('@'));
  }

  /**
   * Generate HTML content for alert email
   */
  private generateAlertEmailHtml(alert: any): string {
    const severityColor = {
      low: '#28a745',
      medium: '#ffc107', 
      high: '#fd7e14',
      critical: '#dc3545'
    }[alert.severity] || '#6c757d';

    return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>System Alert</title>
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: ${severityColor}; color: white; padding: 20px; text-align: center; }
        .content { padding: 20px; border: 1px solid #ddd; }
        .severity { background: ${severityColor}; color: white; padding: 5px 10px; border-radius: 3px; }
        .metadata { background: #f8f9fa; padding: 15px; border-radius: 5px; margin: 15px 0; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🚨 System Alert</h1>
        </div>
        <div class="content">
            <h2>${alert.title}</h2>
            <p><strong>Severity:</strong> <span class="severity">${alert.severity.toUpperCase()}</span></p>
            <p><strong>Type:</strong> ${alert.type}</p>
            <p><strong>Tenant:</strong> ${alert.tenantId}</p>
            <p><strong>Time:</strong> ${new Date().toLocaleString()}</p>
            
            <h3>Message:</h3>
            <p>${alert.message}</p>
            
            ${alert.metadata ? `
            <div class="metadata">
                <h4>Additional Details:</h4>
                <pre>${JSON.stringify(alert.metadata, null, 2)}</pre>
            </div>
            ` : ''}
            
            <p><em>This is an automated system alert. Please investigate and take appropriate action.</em></p>
        </div>
    </div>
</body>
</html>`;
  }

  /**
   * Generate text content for alert email
   */
  private generateAlertEmailText(alert: any): string {
    return `
SYSTEM ALERT

Title: ${alert.title}
Severity: ${alert.severity.toUpperCase()}
Type: ${alert.type}
Tenant: ${alert.tenantId}
Time: ${new Date().toLocaleString()}

Message:
${alert.message}

${alert.metadata ? `
Additional Details:
${JSON.stringify(alert.metadata, null, 2)}
` : ''}

This is an automated system alert. Please investigate and take appropriate action.
    `.trim();
  }

  /**
   * Generate HTML content for dead letter notification
   */
  private generateDeadLetterEmailHtml(data: DeadLetterJobData): string {
    return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>Dead Letter Queue Alert</title>
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #dc3545; color: white; padding: 20px; text-align: center; }
        .content { padding: 20px; border: 1px solid #ddd; }
        .details { background: #f8f9fa; padding: 15px; border-radius: 5px; margin: 15px 0; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>💀 Dead Letter Queue Alert</h1>
        </div>
        <div class="content">
            <h2>Failed ${data.originalType}: ${data.originalId}</h2>
            
            <div class="details">
                <p><strong>Original Type:</strong> ${data.originalType}</p>
                <p><strong>Original ID:</strong> ${data.originalId}</p>
                <p><strong>Tenant ID:</strong> ${data.tenantId}</p>
                <p><strong>Retry Count:</strong> ${data.retryCount}</p>
                <p><strong>Failed At:</strong> ${data.failedAt}</p>
                <p><strong>Failure Reason:</strong> ${data.failureReason}</p>
            </div>
            
            <h3>What happened?</h3>
            <p>This ${data.originalType} has failed ${data.retryCount} times and has been moved to the dead letter queue for manual review.</p>
            
            <h3>Next steps:</h3>
            <ul>
                <li>Review the failure reason above</li>
                <li>Check system logs for more details</li>
                <li>Investigate the root cause</li>
                <li>Consider manual retry if appropriate</li>
            </ul>
            
            <p><em>This requires immediate attention to prevent data loss.</em></p>
        </div>
    </div>
</body>
</html>`;
  }

  /**
   * Generate text content for dead letter notification
   */
  private generateDeadLetterEmailText(data: DeadLetterJobData): string {
    return `
DEAD LETTER QUEUE ALERT

Failed ${data.originalType}: ${data.originalId}

Details:
- Original Type: ${data.originalType}
- Original ID: ${data.originalId}
- Tenant ID: ${data.tenantId}
- Retry Count: ${data.retryCount}
- Failed At: ${data.failedAt}
- Failure Reason: ${data.failureReason}

What happened?
This ${data.originalType} has failed ${data.retryCount} times and has been moved to the dead letter queue for manual review.

Next steps:
- Review the failure reason above
- Check system logs for more details
- Investigate the root cause
- Consider manual retry if appropriate

This requires immediate attention to prevent data loss.
    `.trim();
  }
}