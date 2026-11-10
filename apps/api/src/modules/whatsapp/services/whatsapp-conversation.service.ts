import { Injectable, Logger } from "@nestjs/common";
import { EventEmitter2 } from "@nestjs/event-emitter";
import { InjectRedis } from "@nestjs-modules/ioredis";
import type Redis from "ioredis";
import * as crypto from "crypto";

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
  data: string;
  messageType: "text" | "image" | "video" | "document" | "audio" | "location";
  direction: "inbound" | "outbound";
  timestamp: Date;
  metadata?: Record<string, any>;
}

const CONVERSATION_TTL = 60 * 60 * 24 * 30;
const MAX_MESSAGES_PER_CONVERSATION = 500;
const idKey = (id: string) => `wa:conv:id:${id}`;
const aliasKey = (tenantId: string, phoneNumber: string) => `wa:conv:tp:${tenantId}:${phoneNumber}`;
const tenantKey = (tenantId: string) => `wa:conv:tenant:${tenantId}`;
const messagesKey = (id: string) => `wa:conv:msgs:${id}`;

@Injectable()
export class WhatsAppConversationService {
  private readonly logger = new Logger(WhatsAppConversationService.name);

  constructor(
    private readonly eventEmitter: EventEmitter2,
    @InjectRedis() private readonly redis: Redis,
  ) {}

  async getOrCreateConversation(
    phoneNumber: string,
    tenantId: string,
    subscriberId?: string,
  ): Promise<WhatsAppConversation> {
    const key = `${tenantId}:${phoneNumber}`;
    const existingId = await this.redis.get(aliasKey(tenantId, phoneNumber));

    if (existingId) {
      const existing = await this.readConversation(existingId);
      if (existing) {
        return existing;
      }
    }

    const conversation: WhatsAppConversation = {
      id: `conv_${Date.now()}_${crypto.randomBytes(9).toString("base64url")}`,
      phoneNumber,
      tenantId,
      subscriberId,
      lastMessageAt: new Date(),
      messageCount: 0,
      status: "active",
    };

    await this.writeConversation(conversation);

    this.logger.log(`Created conversation ${conversation.id} for ${phoneNumber}`);

    this.eventEmitter.emit("whatsapp.conversation.created", conversation);

    return conversation;
  }

  async addMessage(
    conversationId: string,
    message: Omit<ConversationMessage, "id">,
  ): Promise<ConversationMessage> {
    const conversation = await this.readConversation(conversationId);

    if (!conversation) {
      throw new Error(`Conversation ${conversationId} not found`);
    }

    const fullMessage: ConversationMessage = {
      id: `msg_${Date.now()}_${crypto.randomBytes(9).toString("base64url")}`,
      ...message,
    };

    const key = messagesKey(conversationId);
    await this.redis
      .multi()
      .lpush(key, JSON.stringify(fullMessage))
      .ltrim(key, 0, MAX_MESSAGES_PER_CONVERSATION - 1)
      .expire(key, CONVERSATION_TTL)
      .exec();

    conversation.lastMessageAt = new Date();
    conversation.messageCount++;
    await this.writeConversation(conversation);

    this.logger.log(`Added message to conversation ${conversationId}: ${fullMessage.id}`);

    this.eventEmitter.emit("whatsapp.conversation.message_added", fullMessage);

    return fullMessage;
  }

  async getMessages(
    conversationId: string,
    limit: number = 50,
    offset: number = 0,
  ): Promise<ConversationMessage[]> {
    const raw = await this.redis.lrange(messagesKey(conversationId), 0, -1);

    return raw
      .map((item) => this.reviveMessage(item))
      .toSorted((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
      .slice(offset, offset + limit);
  }

  async searchConversations(tenantId: string, query: string): Promise<WhatsAppConversation[]> {
    const conversations = await this.readTenantConversations(tenantId);

    return conversations.filter(
      (conversation) =>
        conversation.phoneNumber.includes(query) ||
        conversation.subscriberId?.includes(query) ||
        conversation.metadata?.name?.includes(query),
    );
  }

  async archiveConversation(conversationId: string): Promise<void> {
    const conversation = await this.readConversation(conversationId);

    if (!conversation) {
      throw new Error(`Conversation ${conversationId} not found`);
    }

    conversation.status = "archived";
    await this.writeConversation(conversation);

    this.logger.log(`Archived conversation ${conversationId}`);

    this.eventEmitter.emit("whatsapp.conversation.archived", conversation);
  }

  async getConversationStats(tenantId: string): Promise<{
    total: number;
    active: number;
    inactive: number;
    archived: number;
    totalMessages: number;
  }> {
    const conversations = await this.readTenantConversations(tenantId);

    return {
      total: conversations.length,
      active: conversations.filter((c) => c.status === "active").length,
      inactive: conversations.filter((c) => c.status === "inactive").length,
      archived: conversations.filter((c) => c.status === "archived").length,
      totalMessages: conversations.reduce((sum, c) => sum + c.messageCount, 0),
    };
  }

  async markInactive(conversationId: string): Promise<void> {
    const conversation = await this.readConversation(conversationId);

    if (!conversation) {
      throw new Error(`Conversation ${conversationId} not found`);
    }

    conversation.status = "inactive";
    await this.writeConversation(conversation);

    this.logger.log(`Marked conversation ${conversationId} as inactive`);

    this.eventEmitter.emit("whatsapp.conversation.inactive", conversation);
  }

  async getRecentConversations(
    tenantId: string,
    limit: number = 20,
  ): Promise<WhatsAppConversation[]> {
    const conversations = await this.readTenantConversations(tenantId);

    return conversations
      .toSorted((a, b) => b.lastMessageAt.getTime() - a.lastMessageAt.getTime())
      .slice(0, limit);
  }

  async deleteConversation(conversationId: string): Promise<void> {
    const conversation = await this.readConversation(conversationId);

    if (conversation) {
      await this.redis.del(idKey(conversation.id));
      await this.redis.del(aliasKey(conversation.tenantId, conversation.phoneNumber));
      await this.redis.srem(tenantKey(conversation.tenantId), conversation.id);
    }

    await this.redis.del(messagesKey(conversationId));

    this.logger.log(`Deleted conversation ${conversationId}`);

    this.eventEmitter.emit("whatsapp.conversation.deleted", { id: conversationId });
  }

  private async readConversation(id: string): Promise<WhatsAppConversation | null> {
    const raw = await this.redis.get(idKey(id));
    if (!raw) {
      return null;
    }

    const conversation = JSON.parse(raw) as WhatsAppConversation;
    conversation.lastMessageAt = new Date(conversation.lastMessageAt);
    return conversation;
  }

  private async readTenantConversations(tenantId: string): Promise<WhatsAppConversation[]> {
    const ids = await this.redis.smembers(tenantKey(tenantId));
    if (ids.length === 0) {
      return [];
    }

    const raws = await this.redis.mget(ids.map((id) => idKey(id)));
    const conversations: WhatsAppConversation[] = [];

    for (const raw of raws) {
      if (!raw) {
        continue;
      }

      const conversation = JSON.parse(raw) as WhatsAppConversation;
      conversation.lastMessageAt = new Date(conversation.lastMessageAt);
      conversations.push(conversation);
    }

    return conversations;
  }

  private async writeConversation(conversation: WhatsAppConversation): Promise<void> {
    const payload = JSON.stringify(conversation);
    await this.redis.set(idKey(conversation.id), payload, "EX", CONVERSATION_TTL);
    await this.redis.set(
      aliasKey(conversation.tenantId, conversation.phoneNumber),
      conversation.id,
      "EX",
      CONVERSATION_TTL,
    );
    await this.redis.sadd(tenantKey(conversation.tenantId), conversation.id);
    await this.redis.expire(tenantKey(conversation.tenantId), CONVERSATION_TTL);
  }

  private reviveMessage(raw: string): ConversationMessage {
    const message = JSON.parse(raw) as ConversationMessage;
    message.timestamp = new Date(message.timestamp);
    return message;
  }
}
