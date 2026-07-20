import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { WebClient } from '@slack/web-api';
import { Client, EmbedBuilder, TextChannel } from 'discord.js';

export interface AlertPayload {
  title: string;
  message: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  timestamp: Date;
  metadata?: Record<string, any>;
  error?: Error;
}

@Injectable()
export class AlertService {
  private readonly logger = new Logger(AlertService.name);
  private slackClient?: WebClient;
  private discordClient?: Client;
  private isDiscordReady = false;

  constructor(private readonly configService: ConfigService) {
    this.initializeClients();
  }

  private async initializeClients(): Promise<void> {
    // Initialize Slack client
    const slackToken = this.configService.get<string>('SLACK_BOT_TOKEN');
    const slackEnabled = this.configService.get<string>('SLACK_ALERTS_ENABLED', 'false') === 'true';

    if (slackToken && slackToken !== 'xoxb-your-slack-bot-token' && slackEnabled) {
      this.slackClient = new WebClient(slackToken);
      this.logger.log('Slack client initialized');
    } else if (slackEnabled) {
      this.logger.warn('Slack alerts enabled but token not configured properly');
    }

    // Initialize Discord client
    const discordToken = this.configService.get<string>('DISCORD_BOT_TOKEN');
    const discordEnabled = this.configService.get<string>('DISCORD_ALERTS_ENABLED', 'false') === 'true';

    if (discordToken && discordToken !== 'your-discord-bot-token' && discordEnabled) {
      this.discordClient = new Client({
        intents: ['Guilds', 'GuildMessages'],
      });

      this.discordClient.once('ready', () => {
        this.isDiscordReady = true;
        this.logger.log('Discord client ready');
      });

      try {
        await this.discordClient.login(discordToken);
      } catch (error) {
        this.logger.error('Failed to initialize Discord client', error);
      }
    } else if (discordEnabled) {
      this.logger.warn('Discord alerts enabled but token not configured properly');
    }
  }

  async sendAlert(payload: AlertPayload): Promise<void> {
    const promises: Promise<void>[] = [];

    // Send to Slack if enabled
    if (this.shouldSendSlackAlert()) {
      promises.push(this.sendSlackAlert(payload));
    }

    // Send to Discord if enabled
    if (this.shouldSendDiscordAlert()) {
      promises.push(this.sendDiscordAlert(payload));
    }

    if (promises.length > 0) {
      await Promise.allSettled(promises);
    }
  }

  async send5xxAlert(error: Error, request: any, statusCode: number): Promise<void> {
    const payload: AlertPayload = {
      title: `🚨 ${statusCode} Error Detected`,
      message: `A ${statusCode} error occurred in the notification platform`,
      severity: statusCode >= 500 ? 'critical' : 'high',
      timestamp: new Date(),
      metadata: {
        statusCode,
        method: request.method,
        url: request.url,
        userAgent: request.get('User-Agent'),
        ip: request.ip,
        errorMessage: error.message,
        stack: error.stack?.split('\n').slice(0, 5).join('\n'), // First 5 lines of stack
      },
      error,
    };

    await this.sendAlert(payload);
  }

  async sendSystemAlert(title: string, message: string, severity: AlertPayload['severity'] = 'medium', metadata?: Record<string, any>): Promise<void> {
    const payload: AlertPayload = {
      title,
      message,
      severity,
      timestamp: new Date(),
      metadata,
    };

    await this.sendAlert(payload);
  }

  async sendSecurityAlert(title: string, message: string, severity: AlertPayload['severity'] = 'high', metadata?: Record<string, any>): Promise<void> {
    const payload: AlertPayload = {
      title: `🔒 ${title}`,
      message,
      severity,
      timestamp: new Date(),
      metadata,
    };

    await this.sendAlert(payload);
  }

  private shouldSendSlackAlert(): boolean {
    return !!(
      this.slackClient &&
      this.configService.get<string>('SLACK_ALERTS_ENABLED', 'false') === 'true'
    );
  }

  private shouldSendDiscordAlert(): boolean {
    return !!(
      this.discordClient &&
      this.isDiscordReady &&
      this.configService.get<string>('DISCORD_ALERTS_ENABLED', 'false') === 'true'
    );
  }

  private async sendSlackAlert(payload: AlertPayload): Promise<void> {
    try {
      const channel = this.configService.get<string>('SLACK_ALERT_CHANNEL', '#alerts');
      const color = this.getSeverityColor(payload.severity);

      const blocks = [
        {
          type: 'header',
          text: {
            type: 'plain_text',
            text: payload.title,
          },
        },
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: payload.message,
          },
        },
        {
          type: 'section',
          fields: [
            {
              type: 'mrkdwn',
              text: `*Severity:* ${payload.severity.toUpperCase()}`,
            },
            {
              type: 'mrkdwn',
              text: `*Time:* ${payload.timestamp.toISOString()}`,
            },
          ],
        },
      ];

      if (payload.metadata) {
        const metadataText = Object.entries(payload.metadata)
          .map(([key, value]) => `*${key}:* ${typeof value === 'object' ? JSON.stringify(value) : value}`)
          .join('\n');

        blocks.push({
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `*Details:*\n${metadataText}`,
          },
        });
      }

      await this.slackClient!.chat.postMessage({
        channel,
        blocks,
        attachments: [
          {
            color,
            fallback: `${payload.title}: ${payload.message}`,
          },
        ],
      });

      this.logger.log(`Alert sent to Slack: ${payload.title}`);
    } catch (error) {
      this.logger.error('Failed to send Slack alert', error);
    }
  }

  private async sendDiscordAlert(payload: AlertPayload): Promise<void> {
    try {
      const channelId = this.configService.get<string>('DISCORD_ALERT_CHANNEL_ID');
      if (!channelId) {
        this.logger.warn('Discord alert channel ID not configured');
        return;
      }

      const channel = await this.discordClient!.channels.fetch(channelId) as TextChannel;
      if (!channel) {
        this.logger.error(`Discord channel not found: ${channelId}`);
        return;
      }

      const embed = new EmbedBuilder()
        .setTitle(payload.title)
        .setDescription(payload.message)
        .setColor(this.getDiscordSeverityColor(payload.severity))
        .setTimestamp(payload.timestamp)
        .addFields([
          {
            name: 'Severity',
            value: payload.severity.toUpperCase(),
            inline: true,
          },
          {
            name: 'Time',
            value: payload.timestamp.toISOString(),
            inline: true,
          },
        ]);

      if (payload.metadata) {
        const metadataEntries = Object.entries(payload.metadata).slice(0, 10); // Discord field limit
        metadataEntries.forEach(([key, value]) => {
          embed.addFields([{
            name: key,
            value: typeof value === 'object' ?
              `\`\`\`json\n${JSON.stringify(value, null, 2).slice(0, 1000)}\`\`\`` :
              String(value).slice(0, 1000),
            inline: false,
          }]);
        });
      }

      await channel.send({ embeds: [embed] });
      this.logger.log(`Alert sent to Discord: ${payload.title}`);
    } catch (error) {
      this.logger.error('Failed to send Discord alert', error);
    }
  }

  private getSeverityColor(severity: AlertPayload['severity']): string {
    switch (severity) {
      case 'critical':
        return '#FF0000'; // Red
      case 'high':
        return '#FF8C00'; // Orange
      case 'medium':
        return '#FFD700'; // Yellow
      case 'low':
        return '#32CD32'; // Green
      default:
        return '#808080'; // Gray
    }
  }

  private getDiscordSeverityColor(severity: AlertPayload['severity']): number {
    switch (severity) {
      case 'critical':
        return 0xFF0000; // Red
      case 'high':
        return 0xFF8C00; // Orange
      case 'medium':
        return 0xFFD700; // Yellow
      case 'low':
        return 0x32CD32; // Green
      default:
        return 0x808080; // Gray
    }
  }

  async onModuleDestroy(): Promise<void> {
    if (this.discordClient) {
      await this.discordClient.destroy();
    }
  }
}