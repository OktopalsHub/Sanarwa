import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { IChatProvider, ChatPayload, ChatResponse } from "../chat-provider.interface";

@Injectable()
export class SlackProvider implements IChatProvider {
  private readonly logger = new Logger(SlackProvider.name);
  private readonly webhookUrl: string;

  constructor(private configService: ConfigService) {
    this.webhookUrl = this.configService.get("SLACK_WEBHOOK_URL") || "";
  }

  async sendMessage(payload: ChatPayload): Promise<ChatResponse> {
    try {
      const slackPayload = {
        channel: payload.channel,
        text: payload.message,
        attachments: payload.attachments?.map((att) => ({
          image_url: att.type === "image" ? att.url : undefined,
          title: att.filename,
          title_link: att.url,
        })),
      };

      const response = await fetch(this.webhookUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(slackPayload),
      });

      if (!response.ok) {
        throw new Error(`Slack API error: ${response.status} ${response.statusText}`);
      }

      this.logger.log(`Message sent successfully to Slack channel: ${payload.channel}`);

      return {
        success: true,
        messageId: `slack_${Date.now()}`,
        timestamp: new Date().toISOString(),
        provider: "slack",
      };
    } catch (error) {
      this.logger.error(`Failed to send Slack message: ${error.message}`, error.stack);
      return {
        success: false,
        error: error.message,
        provider: "slack",
      };
    }
  }

  async validateConfig(): Promise<boolean> {
    return !!this.webhookUrl;
  }

  getProviderName(): string {
    return "slack";
  }
}
