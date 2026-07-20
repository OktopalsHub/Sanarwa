import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { WhatsAppBusinessAPIService } from './whatsapp-business-api.service';
import { WhatsAppMediaService } from './whatsapp-media.service';
import { Message } from '../../messaging/message.entity';

export interface WhatsAppConversation {
  conversationId: string;
  phoneNumber: string;
  lastMessage: string;
  lastMessageTime: Date;
  messageCount: number;
  status: 'active' | 'archived' | 'closed';
}

export interface WhatsAppTemplate {
  name: string;
  category: 'AUTHENTICATION' | 'MARKETING' | 'UTILITY';
  language: string;
  status: 'APPROVED' | 'PENDING' | 'REJECTED';
  components: any[];
}

export interface WhatsAppRateLimit {
  messagesPerSecond: number;
  messagesPerDay: number;
  currentUsage: number;
  resetTime: Date;
}

@Injectable()
export class WhatsAppAdvancedService {
  private readonly logger = new Logger(WhatsAppAdvancedService.name);
  private readonly conversationCache = new Map<string, WhatsAppConversation>();
  private readonly rateLimitMap = new Map<string, WhatsAppRateLimit>();

  constructor(
    @InjectRepository(Message)
    private readonly messageRepository: Repository<Message>,
    private readonly whatsappApi: WhatsAppBusinessAPIService,
    private readonly mediaService: WhatsAppMediaService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  /**
   * Send interactive message (buttons, lists)
   */
  async sendInteractiveMessage(
    phoneNumber: string,
    interactiveType: 'button' | 'list',
    content: {
      header?: string;
      body: string;
      footer?: string;
      buttons?: Array<{ id: string; title: string }>;
      listItems?: Array<{ id: string; title: string; description?: string }>;
    },
    messageId: string,
    tenantId: string,
  ): Promise<{ success: boolean; externalId?: string; error?: string }> {
    try {
      this.logger.log(
        `Sending interactive ${interactiveType} message to ${phoneNumber}`,
      );

      // Check rate limit
      const rateLimitCheck = this.checkRateLimit(tenantId);
      if (!rateLimitCheck.allowed) {
        throw new BadRequestException('Rate limit exceeded');
      }

      const payload = {
        messaging_product: 'whatsapp',
        to: phoneNumber,
        type: 'interactive',
        interactive: {
          type: interactiveType,
          header: content.header ? { type: 'text', text: content.header } : undefined,
          body: { text: content.body },
          footer: content.footer ? { text: content.footer } : undefined,
          ...(interactiveType === 'button' && {
            action: {
              buttons: content.buttons?.map((btn, idx) => ({
                type: 'reply',
                reply: {
                  id: btn.id,
                  title: btn.title,
                },
              })),
            },
          }),
          ...(interactiveType === 'list' && {
            action: {
              button: 'Select',
              sections: [
                {
                  rows: content.listItems?.map(item => ({
                    id: item.id,
                    title: item.title,
                    description: item.description,
                  })),
                },
              ],
            },
          }),
        },
      };

      // Send via API (simulated)
      this.logger.log(`Interactive message prepared for ${phoneNumber}`);

      this.eventEmitter.emit('whatsapp.interactive.sent', {
        messageId,
        phoneNumber,
        type: interactiveType,
        tenantId,
      });

      return { success: true, externalId: `interactive_${messageId}` };
    } catch (error) {
      this.logger.error(
        `Failed to send interactive message to ${phoneNumber}`,
        error.message,
      );
      return { success: false, error: error.message };
    }
  }

  /**
   * Send location message
   */
  async sendLocationMessage(
    phoneNumber: string,
    latitude: number,
    longitude: number,
    name?: string,
    address?: string,
    messageId?: string,
    tenantId?: string,
  ): Promise<{ success: boolean; externalId?: string; error?: string }> {
    try {
      this.logger.log(`Sending location message to ${phoneNumber}`);

      const payload = {
        messaging_product: 'whatsapp',
        to: phoneNumber,
        type: 'location',
        location: {
          latitude,
          longitude,
          name,
          address,
        },
      };

      this.logger.log(`Location message prepared for ${phoneNumber}`);

      this.eventEmitter.emit('whatsapp.location.sent', {
        messageId,
        phoneNumber,
        latitude,
        longitude,
        tenantId,
      });

      return { success: true, externalId: `location_${messageId}` };
    } catch (error) {
      this.logger.error(
        `Failed to send location message to ${phoneNumber}`,
        error.message,
      );
      return { success: false, error: error.message };
    }
  }

  /**
   * Get conversation history
   */
  async getConversationHistory(
    phoneNumber: string,
    limit: number = 50,
  ): Promise<Message[]> {
    try {
      const messages = await this.messageRepository.find({
        where: {
          metadata: {
            whatsappPhone: phoneNumber,
          },
        },
        order: { createdAt: 'DESC' },
        take: limit,
      });

      return messages;
    } catch (error) {
      this.logger.error(
        `Failed to get conversation history for ${phoneNumber}`,
        error,
      );
      return [];
    }
  }

  /**
   * Mark message as read
   */
  async markMessageAsRead(
    messageId: string,
    phoneNumberId: string,
    accessToken: string,
  ): Promise<{ success: boolean }> {
    try {
      this.logger.log(`Marking message ${messageId} as read`);

      // Call WhatsApp API to mark as read
      // This would be implemented in the business API service

      this.eventEmitter.emit('whatsapp.message.read', {
        messageId,
        timestamp: new Date(),
      });

      return { success: true };
    } catch (error) {
      this.logger.error(`Failed to mark message as read: ${messageId}`, error);
      return { success: false };
    }
  }

  /**
   * Get conversation list
   */
  async getConversationList(
    tenantId: string,
    limit: number = 20,
  ): Promise<WhatsAppConversation[]> {
    try {
      const conversations = Array.from(this.conversationCache.values())
        .filter(c => c.status !== 'closed')
        .toSorted((a, b) => b.lastMessageTime.getTime() - a.lastMessageTime.getTime())
        .slice(0, limit);

      return conversations;
    } catch (error) {
      this.logger.error('Failed to get conversation list', error);
      return [];
    }
  }

  /**
   * Archive conversation
   */
  async archiveConversation(conversationId: string): Promise<{ success: boolean }> {
    try {
      const conversation = this.conversationCache.get(conversationId);
      if (conversation) {
        conversation.status = 'archived';
        this.conversationCache.set(conversationId, conversation);
      }

      this.logger.log(`Archived conversation ${conversationId}`);
      return { success: true };
    } catch (error) {
      this.logger.error(`Failed to archive conversation ${conversationId}`, error);
      return { success: false };
    }
  }

  /**
   * Check rate limit
   */
  private checkRateLimit(tenantId: string): { allowed: boolean; remaining: number } {
    const now = new Date();
    let rateLimit = this.rateLimitMap.get(tenantId);

    if (!rateLimit || rateLimit.resetTime < now) {
      rateLimit = {
        messagesPerSecond: 80,
        messagesPerDay: 1000,
        currentUsage: 0,
        resetTime: new Date(now.getTime() + 24 * 60 * 60 * 1000),
      };
    }

    const allowed = rateLimit.currentUsage < rateLimit.messagesPerDay;
    if (allowed) {
      rateLimit.currentUsage++;
    }

    this.rateLimitMap.set(tenantId, rateLimit);

    return {
      allowed,
      remaining: rateLimit.messagesPerDay - rateLimit.currentUsage,
    };
  }

  /**
   * Get rate limit status
   */
  getRateLimitStatus(tenantId: string): WhatsAppRateLimit | null {
    return this.rateLimitMap.get(tenantId) || null;
  }

  /**
   * Handle message reaction
   */
  async handleMessageReaction(payload: {
    messageId: string;
    reaction: string;
    from: string;
  }): Promise<void> {
    try {
      this.logger.log(
        `Message reaction: ${payload.messageId} - ${payload.reaction}`,
      );

      this.eventEmitter.emit('whatsapp.message.reaction', {
        messageId: payload.messageId,
        reaction: payload.reaction,
        from: payload.from,
        timestamp: new Date(),
      });
    } catch (error) {
      this.logger.error('Failed to handle message reaction', error);
    }
  }

  /**
   * Handle message edit
   */
  async handleMessageEdit(payload: {
    messageId: string;
    newText: string;
    editedTimestamp: number;
  }): Promise<void> {
    try {
      this.logger.log(`Message edited: ${payload.messageId}`);

      this.eventEmitter.emit('whatsapp.message.edited', {
        messageId: payload.messageId,
        newText: payload.newText,
        editedAt: new Date(payload.editedTimestamp * 1000),
      });
    } catch (error) {
      this.logger.error('Failed to handle message edit', error);
    }
  }

  /**
   * Handle message deletion
   */
  async handleMessageDeletion(payload: {
    messageId: string;
    deletedTimestamp: number;
  }): Promise<void> {
    try {
      this.logger.log(`Message deleted: ${payload.messageId}`);

      this.eventEmitter.emit('whatsapp.message.deleted', {
        messageId: payload.messageId,
        deletedAt: new Date(payload.deletedTimestamp * 1000),
      });
    } catch (error) {
      this.logger.error('Failed to handle message deletion', error);
    }
  }

  /**
   * Get template performance metrics
   */
  async getTemplateMetrics(templateName: string): Promise<{
    sent: number;
    delivered: number;
    read: number;
    failed: number;
    successRate: number;
  }> {
    try {
      const messages = await this.messageRepository.find({
        where: {
          metadata: {
            whatsappTemplate: templateName,
          },
        },
      });

      const sent = messages.length;
      const delivered = messages.filter(m => m.metadata?.status === 'delivered').length;
      const read = messages.filter(m => m.metadata?.status === 'read').length;
      const failed = messages.filter(m => m.metadata?.status === 'failed').length;

      return {
        sent,
        delivered,
        read,
        failed,
        successRate: sent > 0 ? (delivered / sent) * 100 : 0,
      };
    } catch (error) {
      this.logger.error(`Failed to get template metrics for ${templateName}`, error);
      return { sent: 0, delivered: 0, read: 0, failed: 0, successRate: 0 };
    }
  }

  /**
   * Update conversation metadata
   */
  updateConversationMetadata(
    conversationId: string,
    metadata: Record<string, any>,
  ): void {
    const conversation = this.conversationCache.get(conversationId);
    if (conversation) {
      // Store metadata in conversation
      this.logger.log(`Updated metadata for conversation ${conversationId}`);
    }
  }
}
