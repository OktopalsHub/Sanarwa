import { Injectable, Logger } from "@nestjs/common";
import { EventEmitter2, OnEvent } from "@nestjs/event-emitter";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { Message } from "../../messaging/message.entity";
import { SMSService } from "./sms.service";
import { InjectRedis } from "@nestjs-modules/ioredis";
import type Redis from "ioredis";

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

  private readonly CONTEXT_TTL = 3600;

  constructor(
    @InjectRepository(Message)
    private readonly messageRepository: Repository<Message>,
    private readonly smsService: SMSService,
    private readonly eventEmitter: EventEmitter2,
    @InjectRedis() private readonly redis: Redis,
  ) {}

  @OnEvent("sms.conversation.reply")
  async handleConversationReply(payload: {
    inboundMessage: any;
    originalMessage: Message;
    conversationId: string;
    provider: string;
  }): Promise<void> {
    try {
      this.logger.log(`Processing conversation reply: ${payload.conversationId}`);

      await this.updateConversationContext(payload);

      this.eventEmitter.emit("sms.conversation.message", {
        conversationId: payload.conversationId,
        message: payload.inboundMessage.text,
        from: payload.inboundMessage.from,
        to: payload.inboundMessage.to,
        provider: payload.provider,
        tenantId: payload.originalMessage.tenantId,
        isReply: true,
        originalMessage: payload.originalMessage,
      });

      await this.processConversationAutoReply(payload);
    } catch (error) {
      this.logger.error(`Failed to handle conversation reply: ${error.message}`, error.stack);
    }
  }

  async sendConversationMessage(
    conversationId: string,
    message: string,
    tenantId: string,
    metadata?: Record<string, any>,
  ): Promise<{ success: boolean; messageId?: string; error?: string }> {
    try {
      const context = await this.getConversationContext(conversationId);
      if (!context) {
        return {
          success: false,
          error: "Conversation not found",
        };
      }

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

  async getConversationHistory(
    conversationId: string,
    limit: number = 50,
  ): Promise<{
    messages: Array<{
      id: string;
      data: string;
      direction: "inbound" | "outbound";
      timestamp: Date;
      provider: string;
      status: string;
    }>;
    context: ConversationContext | null;
  }> {
    try {
      const messages = await this.messageRepository
        .createQueryBuilder("message")
        .leftJoinAndSelect("message.deliveries", "delivery")
        .where("message.metadata->'conversationId' = :conversationId", { conversationId })
        .orderBy("message.createdAt", "DESC")
        .limit(limit)
        .getMany();

      const formattedMessages = messages.map((msg) => ({
        id: msg.id,
        data: msg.data || "",
        direction: msg.metadata?.direction || "outbound",
        timestamp: msg.createdAt,
        provider: msg.metadata?.provider || "unknown",
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

  async getActiveConversations(
    tenantId: string,
    limit: number = 100,
  ): Promise<ConversationContext[]> {
    try {
      const recentMessages = await this.messageRepository
        .createQueryBuilder("message")
        .select([
          "message.metadata->'conversationId' as conversationId",
          "message.tenantId as tenantId",
          "message.metadata->'provider' as provider",
          "MAX(message.createdAt) as lastMessageAt",
          "COUNT(*) as messageCount",
        ])
        .where("message.tenantId = :tenantId", { tenantId })
        .andWhere("message.metadata->'conversationId' IS NOT NULL")
        .andWhere("message.createdAt >= :since", {
          since: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
        })
        .groupBy(
          "message.metadata->'conversationId', message.tenantId, message.metadata->'provider'",
        )
        .orderBy("MAX(message.createdAt)", "DESC")
        .limit(limit)
        .getRawMany();

      const conversations: ConversationContext[] = [];

      for (const row of recentMessages) {
        const conversationId = row.conversationid;
        if (!conversationId) continue;

        const phoneNumber = this.extractPhoneFromConversationId(conversationId);

        conversations.push({
          conversationId,
          phoneNumber,
          provider: row.provider || "unknown",
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

  private async processConversationAutoReply(payload: {
    inboundMessage: any;
    originalMessage: Message;
    conversationId: string;
    provider: string;
  }): Promise<void> {
    const message = payload.inboundMessage.text.toLowerCase().trim();
    const tenantId = payload.originalMessage.tenantId;

    if (message === "status") {
      await this.sendConversationMessage(
        payload.conversationId,
        "Your order is being processed. You will receive updates via SMS.",
        tenantId,
        { type: "auto-reply", trigger: "status" },
      );
    } else if (message === "help") {
      await this.sendConversationMessage(
        payload.conversationId,
        "Reply with STATUS for order updates, STOP to unsubscribe, or SUPPORT for human assistance.",
        tenantId,
        { type: "auto-reply", trigger: "help" },
      );
    } else if (message === "support") {
      this.eventEmitter.emit("sms.conversation.escalate", {
        conversationId: payload.conversationId,
        phoneNumber: payload.inboundMessage.from,
        message: payload.inboundMessage.text,
        tenantId,
      });

      await this.sendConversationMessage(
        payload.conversationId,
        "Your request has been forwarded to our support team. Someone will respond shortly.",
        tenantId,
        { type: "auto-reply", trigger: "support", escalated: true },
      );
    }
  }

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
      messageCount: 1,
    };

    await this.redis.set(
      this.conversationKey(payload.conversationId),
      JSON.stringify(context),
      "EX",
      this.CONTEXT_TTL,
    );
  }

  private async getConversationContext(
    conversationId: string,
  ): Promise<ConversationContext | null> {
    const cached = await this.redis.get(this.conversationKey(conversationId));
    if (cached) {
      const context = JSON.parse(cached) as ConversationContext;
      context.lastMessageAt = new Date(context.lastMessageAt);
      return context;
    }

    const message = await this.messageRepository
      .createQueryBuilder("message")
      .where("message.metadata->'conversationId' = :conversationId", { conversationId })
      .orderBy("message.createdAt", "DESC")
      .limit(1)
      .getOne();

    if (!message) {
      return null;
    }

    const phoneNumber = this.extractPhoneFromConversationId(conversationId);
    const context: ConversationContext = {
      conversationId,
      phoneNumber,
      provider: message.metadata?.provider || "unknown",
      tenantId: message.tenantId,
      lastMessageAt: message.createdAt,
      messageCount: 1,
    };

    await this.redis.set(
      this.conversationKey(conversationId),
      JSON.stringify(context),
      "EX",
      this.CONTEXT_TTL,
    );

    return context;
  }

  private async updateConversationActivity(conversationId: string): Promise<void> {
    const raw = await this.redis.get(this.conversationKey(conversationId));
    if (!raw) {
      return;
    }

    const context = JSON.parse(raw) as ConversationContext;
    context.lastMessageAt = new Date();
    context.messageCount++;
    await this.redis.set(
      this.conversationKey(conversationId),
      JSON.stringify(context),
      "EX",
      this.CONTEXT_TTL,
    );
  }

  private extractPhoneFromConversationId(conversationId: string): string {
    const parts = conversationId.split("_");
    if (parts.length >= 2) {
      return "+" + parts.slice(1).join("");
    }
    return "unknown";
  }

  private conversationKey(conversationId: string): string {
    return `sms:conv:${conversationId}`;
  }
}
