import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { IChatProvider, ChatPayload, ChatResponse } from '../chat-provider.interface';

@Injectable()
export class DiscordProvider implements IChatProvider {
  private readonly logger = new Logger(DiscordProvider.name);
  private readonly webhookUrl: string;

  constructor(private configService: ConfigService) {
    this.webhookUrl = this.configService.get('DISCORD_WEBHOOK_URL') || '';
  }

  async sendMessage(payload: ChatPayload): Promise<ChatResponse> {
    try {
      const discordPayload = {
        content: payload.message,
        embeds: payload.attachments?.map(att => ({
          image: att.type === 'image' ? { url: att.url } : undefined,
          title: att.filename,
          url: att.url,
        })),
      };

      const response = await fetch(this.webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(discordPayload),
      });

      if (!response.ok) {
        throw new Error(`Discord API error: ${response.status} ${response.statusText}`);
      }

      this.logger.log(`Message sent successfully to Discord`);

      return {
        success: true,
        messageId: `discord_${Date.now()}`,
        timestamp: new Date().toISOString(),
        provider: 'discord',
      };
    } catch (error) {
      this.logger.error(`Failed to send Discord message: ${error.message}`, error.stack);
      return {
        success: false,
        error: error.message,
        provider: 'discord',
      };
    }
  }

  async validateConfig(): Promise<boolean> {
    return !!this.webhookUrl;
  }

  getProviderName(): string {
    return 'discord';
  }
}