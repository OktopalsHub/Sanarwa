import { Injectable, Logger } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { EventEmitter2 } from "@nestjs/event-emitter";

export interface WhatsAppConversation {
  id: string;
  phoneNumber: string;
  tenantId: string;
  subscriberId?: string;
  lastMessageAt: Date;
  messageCount: number;
  status: "active" | "inactive" | "archived";
  metadata?: Record<string, any>;
}

export interface ConversationMessage {
  id: string;
  conversationId: string;
  from: string;
  to: string;
  content: string;
  messageType: "text" | "image" | "video" | "document" | "audio" | "location";
  direction: "inbound" | "outbound";
  timestamp: Date;
  metadata?: Record<string, any>;
}

@Injectable()
export class WhatsAppConversationService {
  private readonly logger = new Logger(WhatsAppConversationService.name);
  private conversations = new Map<string, WhatsAppConversation>();
  private messages = new Map<string, ConversationMessage[]>();

  constructor(private readonly eventEmitter: EventEmitter2) {}

  /**
   * Get or create conversation
   */
  async getOrCreateConversation(
    phoneNumber: string,
    tenantId: string,
    subscriberId?: string,
  ): Promise<WhatsAppConversation> {
    const key = `${tenantId}:${phoneNumber}`;

    if (this.conversations.has(key)) {
      return this.conversations.get(key)!;
    }

    const conversation: WhatsAppConversation = {
      id: `conv_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      phoneNumber,
      tenantId,
      subscriberId,
      lastMessageAt: new Date(),
      messageCount: 0,
      status: "active",
    };

    this.conversations.set(key, conversation);
    this.messages.set(conversation.id, []);

    this.logger.log(`Created conversation ${conversation.id} for ${phoneNumber}`);

    this.eventEmitter.emit("whatsapp.conversation.created", conversation);

    return conversation;
  }

  /**
   * Add message to conversation
   */
  async addMessage(
    conversationId: string,
    message: Omit<ConversationMessage, "id">,
  ): Promise<ConversationMessage> {
    const conversation = Array.from(this.conversations.values()).find(
      (c) => c.id === conversationId,
    );

    if (!conversation) {
      throw new Error(`Conversation ${conversationId} not found`);
    }

    const fullMessage: ConversationMessage = {
      id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      ...message,
    };

    if (!this.messages.has(conversationId)) {
      this.messages.set(conversationId, []);
    }

    this.messages.get(conversationId)!.push(fullMessage);

    // Update conversation
    conversation.lastMessageAt = new Date();
    conversation.messageCount++;

    this.logger.log(`Added message to conversation ${conversationId}: ${fullMessage.id}`);

    this.eventEmitter.emit("whatsapp.conversation.message_added", fullMessage);

    return fullMessage;
  }

  /**
   * Get conversation messages
   */
  async getMessages(
    conversationId: string,
    limit: number = 50,
    offset: number = 0,
  ): Promise<ConversationMessage[]> {
    const messages = this.messages.get(conversationId) || [];

    return messages
      .toSorted((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
      .slice(offset, offset + limit);
  }

  /**
   * Search conversations
   */
  async searchConversations(tenantId: string, query: string): Promise<WhatsAppConversation[]> {
    return Array.from(this.conversations.values()).filter(
      (c) =>
        c.tenantId === tenantId &&
        (c.phoneNumber.includes(query) ||
          c.subscriberId?.includes(query) ||
          c.metadata?.name?.includes(query)),
    );
  }

  /**
   * Archive conversation
   */
  async archiveConversation(conversationId: string): Promise<void> {
    const conversation = Array.from(this.conversations.values()).find(
      (c) => c.id === conversationId,
    );

    if (!conversation) {
      throw new Error(`Conversation ${conversationId} not found`);
    }

    conversation.status = "archived";

    this.logger.log(`Archived conversation ${conversationId}`);

    this.eventEmitter.emit("whatsapp.conversation.archived", conversation);
  }

  /**
   * Get conversation statistics
   */
  async getConversationStats(tenantId: string): Promise<{
    total: number;
    active: number;
    inactive: number;
    archived: number;
    totalMessages: number;
  }> {
    const conversations = Array.from(this.conversations.values()).filter(
      (c) => c.tenantId === tenantId,
    );

    const stats = {
      total: conversations.length,
      active: conversations.filter((c) => c.status === "active").length,
      inactive: conversations.filter((c) => c.status === "inactive").length,
      archived: conversations.filter((c) => c.status === "archived").length,
      totalMessages: Array.from(this.messages.values()).reduce((sum, msgs) => sum + msgs.length, 0),
    };

    return stats;
  }

  /**
   * Mark conversation as inactive
   */
  async markInactive(conversationId: string): Promise<void> {
    const conversation = Array.from(this.conversations.values()).find(
      (c) => c.id === conversationId,
    );

    if (!conversation) {
      throw new Error(`Conversation ${conversationId} not found`);
    }

    conversation.status = "inactive";

    this.logger.log(`Marked conversation ${conversationId} as inactive`);

    this.eventEmitter.emit("whatsapp.conversation.inactive", conversation);
  }

  /**
   * Get recent conversations
   */
  async getRecentConversations(
    tenantId: string,
    limit: number = 20,
  ): Promise<WhatsAppConversation[]> {
    return Array.from(this.conversations.values())
      .filter((c) => c.tenantId === tenantId)
      .toSorted((a, b) => b.lastMessageAt.getTime() - a.lastMessageAt.getTime())
      .slice(0, limit);
  }

  /**
   * Delete conversation
   */
  async deleteConversation(conversationId: string): Promise<void> {
    const key = Array.from(this.conversations.entries()).find(
      ([_, c]) => c.id === conversationId,
    )?.[0];

    if (key) {
      this.conversations.delete(key);
    }

    this.messages.delete(conversationId);

    this.logger.log(`Deleted conversation ${conversationId}`);

    this.eventEmitter.emit("whatsapp.conversation.deleted", { id: conversationId });
  }
}
