import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { WebClient } from "@slack/web-api";
let Client: any, GatewayIntentBits: any, TextChannel: any;
try {
  const discord = require("discord.js");
  Client = discord.Client;
  GatewayIntentBits = discord.GatewayIntentBits;
  TextChannel = discord.TextChannel;
} catch (error) {
  // Discord.js not available in test environment
}
import { LoggingService } from "./logging.service";

export interface AlertConfig {
  type: "provider_health" | "system_error" | "security_event" | "performance";
  severity: "low" | "medium" | "high" | "critical";
  title: string;
  message: string;
  metadata?: Record<string, any>;
  timestamp?: Date;
}

export interface AlertChannel {
  type: "slack" | "discord";
  enabled: boolean;
  config: Record<string, any>;
}

@Injectable()
export class AlertingService {
  private slackClient: WebClient | null = null;
  private discordClient: any | null = null;
  private alertChannels: AlertChannel[] = [];
  private errorTracker: Map<string, { count: number; lastSent: Date }> = new Map();
  private readonly errorThreshold = 5; // Send alert after 5 occurrences
  private readonly errorCooldown = 300000; // 5 minutes cooldown

  constructor(
    private configService: ConfigService,
    private loggingService: LoggingService,
  ) {
    this.initializeAlertChannels();
  }

  private async initializeAlertChannels() {
    if (!this.configService?.get) {
      return;
    }

    // Initialize Slack
    const slackToken = this.configService.get<string>("SLACK_BOT_TOKEN");
    const slackEnabled = this.configService.get<boolean>("SLACK_ALERTS_ENABLED", false);

    if (slackToken && slackEnabled) {
      this.slackClient = new WebClient(slackToken);
      this.alertChannels.push({
        type: "slack",
        enabled: true,
        config: {
          channel: this.configService.get<string>("SLACK_ALERT_CHANNEL", "#alerts"),
        },
      });
      this.loggingService.info("Slack alerting initialized");
    }

    // Initialize Discord
    const discordToken = this.configService.get<string>("DISCORD_BOT_TOKEN");
    const discordEnabled = this.configService.get<boolean>("DISCORD_ALERTS_ENABLED", false);

    if (discordToken && discordEnabled && Client && GatewayIntentBits) {
      this.discordClient = new Client({
        intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages],
      });

      try {
        await this.discordClient.login(discordToken);
        this.alertChannels.push({
          type: "discord",
          enabled: true,
          config: {
            channelId: this.configService.get<string>("DISCORD_ALERT_CHANNEL_ID"),
          },
        });
        this.loggingService.info("Discord alerting initialized");
      } catch (error) {
        this.loggingService.error("Failed to initialize Discord client", error);
      }
    }
  }

  async sendAlert(alert: AlertConfig): Promise<void> {
    // Only send alerts for 5xx critical errors as specified in requirements
    if (alert.type === "system_error" && alert.severity !== "critical") {
      return;
    }

    // Check error tracking for rate limiting
    if (alert.type === "system_error") {
      const errorKey = `${alert.title}-${alert.message}`;
      const tracked = this.errorTracker.get(errorKey);

      if (tracked) {
        tracked.count++;
        const timeSinceLastSent = Date.now() - tracked.lastSent.getTime();

        // Only send if we've hit the threshold and cooldown has passed
        if (tracked.count < this.errorThreshold || timeSinceLastSent < this.errorCooldown) {
          return;
        }

        tracked.lastSent = new Date();
      } else {
        this.errorTracker.set(errorKey, { count: 1, lastSent: new Date() });
        return; // Don't send on first occurrence
      }
    }

    const alertWithTimestamp = {
      ...alert,
      timestamp: alert.timestamp || new Date(),
    };

    // Send to all enabled channels
    const promises = this.alertChannels
      .filter((channel) => channel.enabled)
      .map((channel) => this.sendToChannel(channel, alertWithTimestamp));

    try {
      await Promise.allSettled(promises);
      this.loggingService.info("Alert sent", {
        type: alert.type,
        severity: alert.severity,
        title: alert.title,
      });
    } catch (error) {
      this.loggingService.error("Failed to send alert", error, {
        alertType: alert.type,
        alertTitle: alert.title,
      });
    }
  }

  private async sendToChannel(channel: AlertChannel, alert: AlertConfig): Promise<void> {
    try {
      switch (channel.type) {
        case "slack":
          await this.sendSlackAlert(channel, alert);
          break;
        case "discord":
          await this.sendDiscordAlert(channel, alert);
          break;
        default:
          throw new Error(`Unknown alert channel type: ${channel.type}`);
      }
    } catch (error) {
      this.loggingService.error(`Failed to send alert to ${channel.type}`, error);
      throw error;
    }
  }

  private async sendSlackAlert(channel: AlertChannel, alert: AlertConfig): Promise<void> {
    if (!this.slackClient) {
      throw new Error("Slack client not initialized");
    }

    const color = this.getSeverityColor(alert.severity);
    const emoji = this.getSeverityEmoji(alert.severity);

    const blocks = [
      {
        type: "header",
        text: {
          type: "plain_text",
          text: `${emoji} ${alert.title}`,
        },
      },
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: alert.message,
        },
      },
    ];

    if (alert.metadata) {
      blocks.push({
        type: "section",
        fields: Object.entries(alert.metadata).map(([key, value]) => ({
          type: "mrkdwn",
          text: `*${key}:* ${value}`,
        })),
      } as any);
    }

    blocks.push({
      type: "context",
      elements: [
        {
          type: "mrkdwn",
          text: `Severity: ${alert.severity.toUpperCase()} | Time: ${alert.timestamp?.toISOString()}`,
        },
      ],
    } as any);

    await this.slackClient.chat.postMessage({
      channel: channel.config.channel,
      blocks,
      attachments: [
        {
          color,
          fallback: `${alert.title}: ${alert.message}`,
        },
      ],
    });
  }

  private async sendDiscordAlert(channel: AlertChannel, alert: AlertConfig): Promise<void> {
    if (!this.discordClient) {
      throw new Error("Discord client not initialized");
    }

    const discordChannel = this.discordClient.channels.cache.get(channel.config.channelId) as any;
    if (!discordChannel) {
      throw new Error(`Discord channel ${channel.config.channelId} not found`);
    }

    const color = this.getSeverityColorHex(alert.severity);
    const emoji = this.getSeverityEmoji(alert.severity);

    const embed = {
      title: `${emoji} ${alert.title}`,
      description: alert.message,
      color: parseInt(color.replace("#", ""), 16),
      timestamp: alert.timestamp?.toISOString(),
      fields: alert.metadata
        ? Object.entries(alert.metadata).map(([key, value]) => ({
            name: key,
            value: String(value),
            inline: true,
          }))
        : [],
      footer: {
        text: `Severity: ${alert.severity.toUpperCase()}`,
      },
    };

    await discordChannel.send({ embeds: [embed] });
  }

  private getSeverityColor(severity: string): string {
    switch (severity) {
      case "critical":
        return "danger";
      case "high":
        return "warning";
      case "medium":
        return "good";
      case "low":
        return "#36a64f";
      default:
        return "good";
    }
  }

  private getSeverityColorHex(severity: string): string {
    switch (severity) {
      case "critical":
        return "#ff0000";
      case "high":
        return "#ff9900";
      case "medium":
        return "#ffcc00";
      case "low":
        return "#36a64f";
      default:
        return "#36a64f";
    }
  }

  private getSeverityEmoji(severity: string): string {
    switch (severity) {
      case "critical":
        return "🚨";
      case "high":
        return "⚠️";
      case "medium":
        return "⚡";
      case "low":
        return "ℹ️";
      default:
        return "ℹ️";
    }
  }

  // Method to manually test alerting
  async testAlert(channelType?: "slack" | "discord"): Promise<void> {
    const testAlert: AlertConfig = {
      type: "system_error",
      severity: "critical",
      title: "Test Alert",
      message: "This is a test alert to verify the alerting system is working correctly.",
      metadata: {
        environment: this.configService.get<string>("NODE_ENV"),
        timestamp: new Date().toISOString(),
      },
    };

    if (channelType) {
      const channel = this.alertChannels.find((c) => c.type === channelType);
      if (channel) {
        await this.sendToChannel(channel, testAlert);
      } else {
        throw new Error(`Alert channel ${channelType} not configured`);
      }
    } else {
      await this.sendAlert(testAlert);
    }
  }

  // Clean up error tracker periodically
  cleanupErrorTracker(): void {
    const now = Date.now();
    for (const [key, tracked] of this.errorTracker.entries()) {
      const timeSinceLastSent = now - tracked.lastSent.getTime();
      if (timeSinceLastSent > this.errorCooldown * 2) {
        this.errorTracker.delete(key);
      }
    }
  }
}
