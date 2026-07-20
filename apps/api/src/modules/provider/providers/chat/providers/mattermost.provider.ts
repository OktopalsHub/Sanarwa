import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { IChatProvider, ChatPayload, ChatResponse } from '../chat-provider.interface';

interface MattermostTeam {
  id: string;
  name: string;
  // Add other fields as needed
}

interface MattermostPostResponse {
  id: string;
  message?: string;
  // Add other fields as needed
}

@Injectable()
export class MattermostProvider implements IChatProvider {
  private readonly logger = new Logger(MattermostProvider.name);
  private readonly webhookUrl: string;
  private readonly accessToken: string;
  private readonly serverUrl: string;

  constructor(private configService: ConfigService) {
    this.webhookUrl = this.configService.get('MATTERMOST_WEBHOOK_URL') || '';
    this.accessToken = this.configService.get('MATTERMOST_ACCESS_TOKEN') || '';
    this.serverUrl = this.configService.get('MATTERMOST_SERVER_URL') || '';
  }

  async sendMessage(payload: ChatPayload): Promise<ChatResponse> {
    try {
      // Use webhook if available, otherwise use API
      if (this.webhookUrl) {
        return await this.sendViaWebhook(payload);
      } else if (this.accessToken && this.serverUrl) {
        return await this.sendViaAPI(payload);
      } else {
        throw new Error('No Mattermost configuration available (webhook or API token required)');
      }
    } catch (error) {
      this.logger.error(`Failed to send Mattermost message: ${error.message}`, error.stack);
      return {
        success: false,
        error: error.message,
        provider: 'mattermost',
      };
    }
  }

  private async sendViaWebhook(payload: ChatPayload): Promise<ChatResponse> {
    const mattermostPayload = {
      channel: payload.channel,
      text: payload.message,
      username: 'Notification Bot',
      icon_emoji: ':bell:',
      attachments: payload.attachments?.map(att => ({
        fallback: att.filename || 'Attachment',
        color: 'good',
        title: att.filename,
        title_link: att.url,
        image_url: att.type === 'image' ? att.url : undefined,
      })),
    };

    const response = await fetch(this.webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(mattermostPayload),
    });

    if (!response.ok) {
      throw new Error(`Mattermost webhook error: ${response.status} ${response.statusText}`);
    }

    this.logger.log(`Message sent successfully to Mattermost channel: ${payload.channel}`);

    return {
      success: true,
      messageId: `mattermost_webhook_${Date.now()}`,
      timestamp: new Date().toISOString(),
      provider: 'mattermost',
    };
  }

  private async sendViaAPI(payload: ChatPayload): Promise<ChatResponse> {
    // First, get channel ID if channel name is provided
    let channelId = payload.channel;

    if (!channelId.match(/^[a-z0-9]{26}$/)) {
      // It's a channel name, need to get channel ID
      const channelResponse = await fetch(`${this.serverUrl}/api/v4/teams/name/${payload.channel}`, {
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
        },
      });

      if (channelResponse.ok) {
        const channelData = await channelResponse.json() as MattermostTeam;
        channelId = channelData.id;
      }
    }

    const mattermostPayload = {
      channel_id: channelId,
      message: payload.message,
      props: {
        attachments: payload.attachments?.map(att => ({
          fallback: att.filename || 'Attachment',
          color: 'good',
          title: att.filename,
          title_link: att.url,
          image_url: att.type === 'image' ? att.url : undefined,
        })),
      },
    };

    const response = await fetch(`${this.serverUrl}/api/v4/posts`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(mattermostPayload),
    });

    const result = await response.json() as MattermostPostResponse;

    if (!response.ok) {
      throw new Error(`Mattermost API error: ${result.message || response.statusText}`);
    }

    this.logger.log(`Message sent successfully to Mattermost: ${result.id}`);

    return {
      success: true,
      messageId: result.id,
      timestamp: new Date().toISOString(),
      provider: 'mattermost',
    };
  }

  async validateConfig(): Promise<boolean> {
    return !!(this.webhookUrl || (this.accessToken && this.serverUrl));
  }

  getProviderName(): string {
    return 'mattermost';
  }
}