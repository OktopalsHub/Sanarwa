import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2, OnEvent } from '@nestjs/event-emitter';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Message } from '../../messaging/message.entity';
import { SMSService } from './sms.service';

export interface ConversationContext {
  conversationId: string;
  phoneNumber: string;
  provider: string;
  tenantId: string;
  lastMessageAt: Date;
  messageCount: number;
  metadata?: Record<string, any>;
}

@Injectable()
export class SMSConversationService {
  private readonly logger = new Logger(SMSConversationService.name);

  // In-memory conversation cache for quick lookups
  private readonly conversationCache = new Map<string, ConversationContext>();

  constructor(
    @InjectRepository(Message)
    private readonly messageRepository: Repository<Message>,
    private readonly smsService: SMSService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  /**
   * Handle conversation replies - ensures replies use the same provider
   */
  @OnEvent('sms.conversation.reply')
  async handleConversationReply(payload: {
    inboundMessage: any;
    originalMessage: Message;
    conversationId: string;
    provider: string;
  }): Promise<void> {
    try {
      this.logger.log(`Processing conversation reply: ${payload.conversationId}`);

      // Update conversation context
      await this.updateConversationContext(payload);

      // Emit event for business logic to handle the reply
      this.eventEmitter.emit('sms.conversation.message', {
        conversationId: payload.conversationId,
        message: payload.inboundMessage.text,
        from: payload.inboundMessage.from,
        to: payload.inboundMessage.to,
        provider: payload.provider,
        tenantId: payload.originalMessage.tenantId,
        isReply: true,
        originalMessage: payload.originalMessage,
      });

      // Example auto-reply logic based on keywords
      await this.processConversationAutoReply(payload);

    } catch (error) {
      this.logger.error(`Failed to handle conversation reply: ${error.message}`, error.stack);
    }
  }

  /**
   * Send a message in an existing conversation (maintains provider continuity)
   */
  async sendConversationMessage(
    conversationId: string,
    message: string,
    tenantId: string,
    metadata?: Record<string, any>
  ): Promise<{ success: boolean; messageId?: string; error?: string }> {
    try {
      // Get conversation context
      const context = await this.getConversationContext(conversationId);
      if (!context) {
        return {
          success: false,
          error: 'Conversation not found',
        };
      }

      // Send using the same provider to maintain conversation continuity
      const result = await this.smsService.sendSMS({
        to: context.phoneNumber,
        message,
        tenantId,
        metadata: {
          ...metadata,
          conversationId,
          isConversationMessage: true,
          preferredProvider: context.provider,
        },
      });

      if (result.success) {
        // Update conversation context
        await this.updateConversationActivity(conversationId);
      }

      return result;
    } catch (error) {
      this.logger.error(`Failed to send conversation message: ${error.message}`, error.stack);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Get conversation history
   */
  async getConversationHistory(
    conversationId: string,
    limit: number = 50
  ): Promise<{
    messages: Array<{
      id: string;
      content: string;
      direction: 'inbound' | 'outbound';
      timestamp: Date;
      provider: string;
      status: string;
    }>;
    context: ConversationContext | null;
  }> {
    try {
      // Get messages for this conversation
      const messages = await this.messageRepository
        .createQueryBuilder('message')
        .leftJoinAndSelect('message.deliveries', 'delivery')
        .where('message.metadata->\'conversationId\' = :conversationId', { conversationId })
        .orderBy('message.createdAt', 'DESC')
        .limit(limit)
        .getMany();

      const formattedMessages = messages.map(msg => ({
        id: msg.id,
        content: msg.content || '',
        direction: msg.metadata?.direction || 'outbound',
        timestamp: msg.createdAt,
        provider: msg.metadata?.provider || 'unknown',
        status: msg.status,
      }));

      const context = await this.getConversationContext(conversationId);

      return {
        messages: formattedMessages,
        context,
      };
    } catch (error) {
      this.logger.error(`Failed to get conversation history: ${error.message}`, error.stack);
      return {
        messages: [],
        context: null,
      };
    }
  }

  /**
   * Get active conversations for a tenant
   */
  async getActiveConversations(
    tenantId: string,
    limit: number = 100
  ): Promise<ConversationContext[]> {
    try {
      // Get recent conversations from database
      const recentMessages = await this.messageRepository
        .createQueryBuilder('message')
        .select([
          'message.metadata->\'conversationId\' as conversationId',
          'message.tenantId as tenantId',
          'message.metadata->\'provider\' as provider',
          'MAX(message.createdAt) as lastMessageAt',
          'COUNT(*) as messageCount'
        ])
        .where('message.tenantId = :tenantId', { tenantId })
        .andWhere('message.metadata->\'conversationId\' IS NOT NULL')
        .andWhere('message.createdAt >= :since', { 
          since: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) // Last 7 days
        })
        .groupBy('message.metadata->\'conversationId\', message.tenantId, message.metadata->\'provider\'')
        .orderBy('MAX(message.createdAt)', 'DESC')
        .limit(limit)
        .getRawMany();

      const conversations: ConversationContext[] = [];

      for (const row of recentMessages) {
        const conversationId = row.conversationid;
        if (!conversationId) continue;

        // Extract phone number from conversation ID
        const phoneNumber = this.extractPhoneFromConversationId(conversationId);
        
        conversations.push({
          conversationId,
          phoneNumber,
          provider: row.provider || 'unknown',
          tenantId: row.tenantId,
          lastMessageAt: new Date(row.lastmessageat),
          messageCount: parseInt(row.messagecount) || 0,
        });
      }

      return conversations;
    } catch (error) {
      this.logger.error(`Failed to get active conversations: ${error.message}`, error.stack);
      return [];
    }
  }

  /**
   * Process auto-reply logic for conversations
   */
  private async processConversationAutoReply(payload: {
    inboundMessage: any;
    originalMessage: Message;
    conversationId: string;
    provider: string;
  }): Promise<void> {
    const message = payload.inboundMessage.text.toLowerCase().trim();
    const tenantId = payload.originalMessage.tenantId;

    // Example conversation-aware auto-replies
    if (message === 'status') {
      await this.sendConversationMessage(
        payload.conversationId,
        'Your order is being processed. You will receive updates via SMS.',
        tenantId,
        { type: 'auto-reply', trigger: 'status' }
      );
    } else if (message === 'help') {
      await this.sendConversationMessage(
        payload.conversationId,
        'Reply with STATUS for order updates, STOP to unsubscribe, or SUPPORT for human assistance.',
        tenantId,
        { type: 'auto-reply', trigger: 'help' }
      );
    } else if (message === 'support') {
      // Escalate to human support
      this.eventEmitter.emit('sms.conversation.escalate', {
        conversationId: payload.conversationId,
        phoneNumber: payload.inboundMessage.from,
        message: payload.inboundMessage.text,
        tenantId,
      });

      await this.sendConversationMessage(
        payload.conversationId,
        'Your request has been forwarded to our support team. Someone will respond shortly.',
        tenantId,
        { type: 'auto-reply', trigger: 'support', escalated: true }
      );
    }
  }

  /**
   * Update conversation context
   */
  private async updateConversationContext(payload: {
    inboundMessage: any;
    originalMessage: Message;
    conversationId: string;
    provider: string;
  }): Promise<void> {
    const context: ConversationContext = {
      conversationId: payload.conversationId,
      phoneNumber: payload.inboundMessage.from,
      provider: payload.provider,
      tenantId: payload.originalMessage.tenantId,
      lastMessageAt: new Date(),
      messageCount: 1, // Will be updated with actual count
    };

    // Cache the context for quick lookups
    this.conversationCache.set(payload.conversationId, context);

    // Clean cache periodically
    if (this.conversationCache.size > 1000) {
      this.cleanConversationCache();
    }
  }

  /**
   * Get conversation context
   */
  private async getConversationContext(conversationId: string): Promise<ConversationContext | null> {
    // Check cache first
    const cached = this.conversationCache.get(conversationId);
    if (cached) {
      return cached;
    }

    // Get from database
    const message = await this.messageRepository
      .createQueryBuilder('message')
      .where('message.metadata->\'conversationId\' = :conversationId', { conversationId })
      .orderBy('message.createdAt', 'DESC')
      .limit(1)
      .getOne();

    if (!message) {
      return null;
    }

    const phoneNumber = this.extractPhoneFromConversationId(conversationId);
    const context: ConversationContext = {
      conversationId,
      phoneNumber,
      provider: message.metadata?.provider || 'unknown',
      tenantId: message.tenantId,
      lastMessageAt: message.createdAt,
      messageCount: 1,
    };

    // Cache for future use
    this.conversationCache.set(conversationId, context);

    return context;
  }

  /**
   * Update conversation activity timestamp
   */
  private async updateConversationActivity(conversationId: string): Promise<void> {
    const context = this.conversationCache.get(conversationId);
    if (context) {
      context.lastMessageAt = new Date();
      context.messageCount++;
    }
  }

  /**
   * Extract phone number from conversation ID
   */
  private extractPhoneFromConversationId(conversationId: string): string {
    // Conversation ID format: provider_phonenumber
    const parts = conversationId.split('_');
    if (parts.length >= 2) {
      return '+' + parts.slice(1).join('');
    }
    return 'unknown';
  }

  /**
   * Clean old entries from conversation cache
   */
  private cleanConversationCache(): void {
    const now = Date.now();
    const maxAge = 60 * 60 * 1000; // 1 hour

    for (const [id, context] of this.conversationCache.entries()) {
      if (now - context.lastMessageAt.getTime() > maxAge) {
        this.conversationCache.delete(id);
      }
    }

    this.logger.debug(`Cleaned conversation cache, ${this.conversationCache.size} entries remaining`);
  }
}