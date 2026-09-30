import { Injectable, Logger } from "@nestjs/common";
import { EventEmitter2, OnEvent } from "@nestjs/event-emitter";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import {
  Message,
  MessageChannel,
  MessageStatus,
  MessagePriority,
} from "../../messaging/message.entity";
import { MessageDelivery, MessageDeliveryStatus } from "../../messaging/message-delivery.entity";
import { SmartSMSRouterService } from "./smart-sms-router.service";
import { TwilioProvider } from "../providers/sms/providers/twilio.provider";
import { TermiiProvider } from "../providers/sms/providers/termii.provider";
import { TelnyxProvider } from "../providers/sms/providers/telnyx.provider";
import { InfobipProvider } from "../providers/sms/providers/infobip.provider";
import { InboundSMSPayload, SMSStatusPayload } from "../controllers/sms-webhook.controller";

export interface OutboundSMSRequest {
  to: string;
  message: string;
  from?: string;
  tenantId: string;
  userId?: string;
  metadata?: Record<string, any>;
}

export interface OutboundSMSResponse {
  success: boolean;
  messageId?: string;
  provider?: string;
  cost?: number;
  error?: string;
}

@Injectable()
export class SMSService {
  private readonly logger = new Logger(SMSService.name);

  constructor(
    @InjectRepository(Message)
    private readonly messageRepository: Repository<Message>,
    @InjectRepository(MessageDelivery)
    private readonly messageDeliveryRepository: Repository<MessageDelivery>,
    private readonly smartRouter: SmartSMSRouterService,
    private readonly twilioProvider: TwilioProvider,
    private readonly termiiProvider: TermiiProvider,
    private readonly telnyxProvider: TelnyxProvider,
    private readonly infobipProvider: InfobipProvider,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  /**
   * Send outbound SMS using smart routing
   */
  async sendSMS(request: OutboundSMSRequest): Promise<OutboundSMSResponse> {
    try {
      // Check for preferred provider in metadata (for conversation continuity)
      const preferredProvider = request.metadata?.preferredProvider;

      // Select best provider using smart routing with conversation awareness
      const routingResult = await this.smartRouter.selectProvider(request.to, preferredProvider);

      this.logger.log(
        `Routing SMS to ${request.to} via ${routingResult.providerId} (${routingResult.region})${preferredProvider ? " [conversation continuity]" : ""}`,
      );

      // Get provider instance
      const provider = this.getProviderInstance(routingResult.providerId);
      if (!provider) {
        throw new Error(`Provider ${routingResult.providerId} not available`);
      }

      // Send SMS
      const result = await provider.sendSMS({
        to: request.to,
        message: request.message,
        from: request.from,
        metadata: request.metadata,
      });

      if (!result.success) {
        throw new Error(result.error || "SMS sending failed");
      }

      // Store message record
      const message = await this.storeOutboundMessage(request, result, routingResult);

      // Emit success event
      this.eventEmitter.emit("sms.outbound.sent", {
        messageId: result.messageId,
        tenantId: request.tenantId,
        provider: routingResult.providerId,
        cost: routingResult.costPerSMS,
        recipient: request.to,
      });

      return {
        success: true,
        messageId: result.messageId,
        provider: routingResult.providerId,
        cost: routingResult.costPerSMS,
      };
    } catch (error) {
      this.logger.error(`Failed to send SMS: ${error.message}`, error.stack);

      // Emit failure event
      this.eventEmitter.emit("sms.outbound.failed", {
        tenantId: request.tenantId,
        recipient: request.to,
        error: error.message,
      });

      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Send bulk SMS messages
   */
  async sendBulkSMS(requests: OutboundSMSRequest[]): Promise<{
    successful: number;
    failed: number;
    results: OutboundSMSResponse[];
  }> {
    const results: OutboundSMSResponse[] = [];
    let successful = 0;
    let failed = 0;

    // Process in batches to avoid overwhelming providers
    const batchSize = 100;
    for (let i = 0; i < requests.length; i += batchSize) {
      const batch = requests.slice(i, i + batchSize);

      const batchPromises = batch.map(async (request) => {
        const result = await this.sendSMS(request);
        if (result.success) {
          successful++;
        } else {
          failed++;
        }
        return result;
      });

      const batchResults = await Promise.allSettled(batchPromises);
      results.push(
        ...batchResults.map((r) =>
          r.status === "fulfilled" ? r.value : { success: false, error: "Promise rejected" },
        ),
      );

      // Small delay between batches
      if (i + batchSize < requests.length) {
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
    }

    this.logger.log(`Bulk SMS completed: ${successful} successful, ${failed} failed`);

    return { successful, failed, results };
  }

  /**
   * Handle inbound SMS messages
   */
  @OnEvent("sms.inbound.received")
  async handleInboundSMS(payload: InboundSMSPayload): Promise<void> {
    try {
      this.logger.log(`Processing inbound SMS from ${payload.from} via ${payload.provider}`);

      // Store inbound message
      await this.storeInboundMessage(payload);

      // Route reply to maintain conversation continuity
      await this.routeReplyToOriginalProvider(payload);

      // Emit event for application logic to handle
      this.eventEmitter.emit("sms.inbound.processed", {
        messageId: payload.messageId,
        from: payload.from,
        to: payload.to,
        text: payload.text,
        provider: payload.provider,
        timestamp: payload.timestamp,
        metadata: payload.metadata,
        conversationId: this.generateConversationId(payload.from, payload.provider),
      });

      // Auto-reply logic can be implemented here
      await this.processAutoReply(payload);
    } catch (error) {
      this.logger.error(`Failed to process inbound SMS: ${error.message}`, error.stack);
    }
  }

  /**
   * Handle SMS status updates
   */
  @OnEvent("sms.status.updated")
  async handleSMSStatusUpdate(payload: SMSStatusPayload): Promise<void> {
    try {
      this.logger.log(`Processing SMS status update: ${payload.messageId} -> ${payload.status}`);

      // Update message delivery status
      await this.updateMessageDeliveryStatus(payload);

      // Emit event for analytics and webhooks
      this.eventEmitter.emit("sms.status.processed", {
        messageId: payload.messageId,
        status: payload.status,
        provider: payload.provider,
        timestamp: payload.timestamp,
        errorCode: payload.errorCode,
        errorMessage: payload.errorMessage,
      });
    } catch (error) {
      this.logger.error(`Failed to process SMS status update: ${error.message}`, error.stack);
    }
  }

  /**
   * Get SMS analytics for a tenant
   */
  async getSMSAnalytics(
    tenantId: string,
    startDate: Date,
    endDate: Date,
  ): Promise<{
    totalSent: number;
    totalReceived: number;
    deliveryRate: number;
    totalCost: number;
    providerBreakdown: Record<string, number>;
    countryBreakdown: Record<string, number>;
  }> {
    const queryBuilder = this.messageRepository
      .createQueryBuilder("message")
      .leftJoinAndSelect("message.deliveries", "delivery")
      .where("message.tenantId = :tenantId", { tenantId })
      .andWhere("message.channels @> :channels", { channels: JSON.stringify([MessageChannel.SMS]) })
      .andWhere("message.createdAt >= :startDate", { startDate })
      .andWhere("message.createdAt <= :endDate", { endDate });

    const messages = await queryBuilder.getMany();

    let totalSent = 0;
    let totalReceived = 0;
    let totalDelivered = 0;
    let totalCost = 0;
    const providerBreakdown: Record<string, number> = {};
    const countryBreakdown: Record<string, number> = {};

    for (const message of messages) {
      const isInbound = message.metadata?.direction === "inbound";

      if (isInbound) {
        totalReceived++;
      } else {
        totalSent++;

        // Calculate cost from metadata
        const cost = message.metadata?.cost || 0;
        totalCost += cost;

        // Provider breakdown
        const provider = message.metadata?.provider || "unknown";
        providerBreakdown[provider] = (providerBreakdown[provider] || 0) + 1;

        // Country breakdown (extract from phone number)
        const recipient = message.recipients[0]?.phone;
        if (recipient) {
          const country = this.extractCountryFromPhone(recipient);
          countryBreakdown[country] = (countryBreakdown[country] || 0) + 1;
        }
      }

      // Count delivered messages for delivery rate
      for (const delivery of message.deliveries) {
        if (delivery.status === MessageDeliveryStatus.DELIVERED) {
          totalDelivered++;
        }
      }
    }

    const deliveryRate = totalSent > 0 ? (totalDelivered / totalSent) * 100 : 0;

    return {
      totalSent,
      totalReceived,
      deliveryRate: Math.round(deliveryRate * 100) / 100,
      totalCost: Math.round(totalCost * 100) / 100,
      providerBreakdown,
      countryBreakdown,
    };
  }

  /**
   * Get provider instance by ID
   */
  private getProviderInstance(providerId: string): any {
    const providers = {
      twilio: this.twilioProvider,
      termii: this.termiiProvider,
      telnyx: this.telnyxProvider,
      infobip: this.infobipProvider,
    };

    return providers[providerId];
  }

  /**
   * Store outbound message in database
   */
  private async storeOutboundMessage(
    request: OutboundSMSRequest,
    result: any,
    routing: any,
  ): Promise<Message> {
    const message = this.messageRepository.create({
      tenantId: request.tenantId,
      channels: [MessageChannel.SMS],
      recipients: [
        {
          id: `sms_${Date.now()}`,
          phone: request.to,
          userId: request.userId,
          metadata: request.metadata,
        },
      ],
      data: {
        message: request.message,
        from: request.from,
        provider: routing.providerId,
        region: routing.region,
      },
      status: MessageStatus.SENT,
      priority: MessagePriority.NORMAL,
      content: request.message,
      metadata: {
        provider: routing.providerId,
        providerMessageId: result.messageId,
        cost: routing.costPerSMS,
        direction: "outbound",
        conversationId: this.generateConversationId(request.to, routing.providerId),
      },
    });

    const savedMessage = await this.messageRepository.save(message);

    // Create delivery record
    const delivery = this.messageDeliveryRepository.create({
      messageId: savedMessage.id,
      channel: MessageChannel.SMS,
      providerId: routing.providerId,
      recipient: request.to,
      status: MessageDeliveryStatus.SENT,
      providerMessageId: result.messageId,
      providerResponse: result,
      sentAt: new Date(),
      metadata: {
        cost: routing.costPerSMS,
        region: routing.region,
      },
    });

    await this.messageDeliveryRepository.save(delivery);

    return savedMessage;
  }

  /**
   * Store inbound message in database
   */
  private async storeInboundMessage(payload: InboundSMSPayload): Promise<Message> {
    // Find tenant based on the phone number or use a default system tenant
    const tenantId = (await this.findTenantByPhoneNumber(payload.to)) || "system";

    const message = this.messageRepository.create({
      tenantId,
      channels: [MessageChannel.SMS],
      recipients: [
        {
          id: `sms_inbound_${Date.now()}`,
          phone: payload.to,
          metadata: payload.metadata,
        },
      ],
      data: {
        message: payload.text,
        from: payload.from,
        to: payload.to,
        provider: payload.provider,
      },
      status: MessageStatus.DELIVERED,
      priority: MessagePriority.NORMAL,
      content: payload.text,
      deliveredAt: payload.timestamp,
      metadata: {
        provider: payload.provider,
        providerMessageId: payload.messageId,
        direction: "inbound",
        conversationId: this.generateConversationId(payload.from, payload.provider),
        originalPayload: payload.metadata,
      },
    });

    const savedMessage = await this.messageRepository.save(message);

    // Create delivery record for inbound message
    const delivery = this.messageDeliveryRepository.create({
      messageId: savedMessage.id,
      channel: MessageChannel.SMS,
      providerId: payload.provider,
      recipient: payload.from,
      status: MessageDeliveryStatus.DELIVERED,
      providerMessageId: payload.messageId,
      providerResponse: payload.metadata,
      sentAt: payload.timestamp,
      deliveredAt: payload.timestamp,
      metadata: {
        direction: "inbound",
        originalTo: payload.to,
      },
    });

    await this.messageDeliveryRepository.save(delivery);

    return savedMessage;
  }

  /**
   * Update message delivery status
   */
  private async updateMessageDeliveryStatus(payload: SMSStatusPayload): Promise<void> {
    const delivery = await this.messageDeliveryRepository.findOne({
      where: { providerMessageId: payload.messageId },
      relations: ["message"],
    });

    if (delivery) {
      // Map status to our enum
      const mappedStatus = this.mapStatusToDeliveryStatus(payload.status);

      delivery.status = mappedStatus;
      delivery.errorMessage = payload.errorMessage;

      // Set timestamps based on status
      if (payload.status === "delivered" && !delivery.deliveredAt) {
        delivery.deliveredAt = payload.timestamp;
      }

      // Update metadata with provider response
      delivery.metadata = {
        ...delivery.metadata,
        statusUpdate: {
          status: payload.status,
          timestamp: payload.timestamp,
          errorCode: payload.errorCode,
          errorMessage: payload.errorMessage,
        },
      };

      await this.messageDeliveryRepository.save(delivery);

      // Update parent message status if needed
      if (delivery.message) {
        await this.updateMessageStatus(delivery.message.id);
      }
    } else {
      this.logger.warn(`No delivery record found for message ID: ${payload.messageId}`);
    }
  }

  /**
   * Process auto-reply logic for inbound SMS
   */
  private async processAutoReply(payload: InboundSMSPayload): Promise<void> {
    // Implement auto-reply logic based on keywords, tenant settings, etc.
    // This is a placeholder for custom business logic

    const lowerText = payload.text.toLowerCase().trim();

    // Example: STOP keyword handling
    if (lowerText === "stop" || lowerText === "unsubscribe") {
      // Handle unsubscribe request
      this.eventEmitter.emit("sms.unsubscribe.requested", {
        phoneNumber: payload.from,
        provider: payload.provider,
        timestamp: payload.timestamp,
      });
    }

    // Example: HELP keyword handling
    if (lowerText === "help" || lowerText === "info") {
      // Send help message
      await this.sendSMS({
        to: payload.from,
        message: "For support, visit our website or call customer service.",
        tenantId: "system", // Use system tenant for auto-replies
        metadata: { type: "auto-reply", trigger: "help" },
      });
    }
  }

  /**
   * Test SMS functionality
   */
  async testSMSFunctionality(): Promise<{
    outbound: { success: boolean; error?: string };
    inbound: { supported: boolean; webhookConfigured: boolean };
    providers: Record<string, { available: boolean; configured: boolean }>;
  }> {
    const result: {
      outbound: { success: boolean; error?: string };
      inbound: { supported: boolean; webhookConfigured: boolean };
      providers: Record<string, { available: boolean; configured: boolean }>;
    } = {
      outbound: { success: false },
      inbound: { supported: true, webhookConfigured: true },
      providers: {},
    };

    // Test outbound SMS
    try {
      const testResult = await this.sendSMS({
        to: "+1234567890", // Test number
        message: "Test message from SMS service",
        tenantId: "test",
        metadata: { test: true },
      });

      result.outbound = {
        success: testResult.success,
        ...(testResult.error && { error: testResult.error }),
      };
    } catch (error) {
      result.outbound = {
        success: false,
        error: error.message,
      };
    }

    // Test provider availability
    const providers = ["twilio", "termii", "telnyx", "infobip"];
    for (const providerId of providers) {
      const provider = this.getProviderInstance(providerId);
      result.providers[providerId] = {
        available: !!provider,
        configured: provider ? await provider.validateConfig() : false,
      };
    }

    return result;
  }

  /**
   * Generate conversation ID for tracking message threads
   */
  private generateConversationId(phoneNumber: string, provider: string): string {
    // Create a consistent conversation ID that allows routing replies back to the same provider
    const normalized = phoneNumber.replace(/[^\d]/g, "");
    return `${provider}_${normalized}`;
  }

  /**
   * Find tenant by phone number (for inbound messages)
   */
  private async findTenantByPhoneNumber(phoneNumber: string): Promise<string | null> {
    // Look for recent outbound messages to this number to determine tenant
    const recentMessage = await this.messageRepository
      .createQueryBuilder("message")
      .where("message.recipients @> :recipients", {
        recipients: JSON.stringify([{ phone: phoneNumber }]),
      })
      .andWhere("message.metadata->'direction' = :direction", { direction: "outbound" })
      .orderBy("message.createdAt", "DESC")
      .limit(1)
      .getOne();

    return recentMessage?.tenantId || null;
  }

  /**
   * Map provider status to our delivery status enum
   */
  private mapStatusToDeliveryStatus(status: string): MessageDeliveryStatus {
    const statusMap: Record<string, MessageDeliveryStatus> = {
      sent: MessageDeliveryStatus.SENT,
      delivered: MessageDeliveryStatus.DELIVERED,
      failed: MessageDeliveryStatus.FAILED,
      received: MessageDeliveryStatus.DELIVERED,
    };

    return statusMap[status] || MessageDeliveryStatus.FAILED;
  }

  /**
   * Update parent message status based on delivery statuses
   */
  private async updateMessageStatus(messageId: string): Promise<void> {
    const message = await this.messageRepository.findOne({
      where: { id: messageId },
      relations: ["deliveries"],
    });

    if (!message) return;

    const deliveries = message.deliveries;
    const totalDeliveries = deliveries.length;
    const deliveredCount = deliveries.filter(
      (d) => d.status === MessageDeliveryStatus.DELIVERED,
    ).length;
    const failedCount = deliveries.filter((d) => d.status === MessageDeliveryStatus.FAILED).length;

    let newStatus: MessageStatus;
    if (deliveredCount === totalDeliveries) {
      newStatus = MessageStatus.DELIVERED;
      message.deliveredAt = new Date();
    } else if (failedCount === totalDeliveries) {
      newStatus = MessageStatus.FAILED;
    } else if (deliveredCount > 0) {
      newStatus = MessageStatus.PARTIALLY_DELIVERED;
    } else {
      newStatus = MessageStatus.SENT;
    }

    message.status = newStatus;
    await this.messageRepository.save(message);
  }

  /**
   * Extract country code from phone number
   */
  private extractCountryFromPhone(phoneNumber: string): string {
    // Simple country extraction - in production use libphonenumber-js
    if (phoneNumber.startsWith("+1")) return "US";
    if (phoneNumber.startsWith("+44")) return "GB";
    if (phoneNumber.startsWith("+49")) return "DE";
    if (phoneNumber.startsWith("+234")) return "NG";
    if (phoneNumber.startsWith("+91")) return "IN";
    if (phoneNumber.startsWith("+33")) return "FR";
    if (phoneNumber.startsWith("+61")) return "AU";
    if (phoneNumber.startsWith("+55")) return "BR";
    return "OTHER";
  }

  /**
   * Handle conversation routing for replies
   */
  async routeReplyToOriginalProvider(inboundPayload: InboundSMSPayload): Promise<void> {
    const conversationId = this.generateConversationId(
      inboundPayload.from,
      inboundPayload.provider,
    );

    // Find the original conversation to maintain provider consistency
    const originalMessage = await this.messageRepository
      .createQueryBuilder("message")
      .where("message.metadata->'conversationId' = :conversationId", { conversationId })
      .andWhere("message.metadata->'direction' = :direction", { direction: "outbound" })
      .orderBy("message.createdAt", "DESC")
      .limit(1)
      .getOne();

    if (originalMessage) {
      // Emit event with conversation context
      this.eventEmitter.emit("sms.conversation.reply", {
        inboundMessage: inboundPayload,
        originalMessage,
        conversationId,
        provider: inboundPayload.provider,
      });
    }
  }

  /**
   * Send reply using the same provider as the original conversation
   */
  async sendConversationReply(
    conversationId: string,
    replyMessage: string,
    tenantId: string,
  ): Promise<OutboundSMSResponse> {
    // Find the conversation to get the phone number and preferred provider
    const originalMessage = await this.messageRepository
      .createQueryBuilder("message")
      .where("message.metadata->'conversationId' = :conversationId", { conversationId })
      .orderBy("message.createdAt", "DESC")
      .limit(1)
      .getOne();

    if (!originalMessage) {
      return {
        success: false,
        error: "Conversation not found",
      };
    }

    const phoneNumber = originalMessage.recipients[0]?.phone;
    const preferredProvider = originalMessage.metadata?.provider;

    if (!phoneNumber) {
      return {
        success: false,
        error: "Phone number not found in conversation",
      };
    }

    // Send using the same provider to maintain conversation continuity
    return await this.sendSMS({
      to: phoneNumber,
      message: replyMessage,
      tenantId,
      metadata: {
        conversationId,
        isReply: true,
        preferredProvider,
      },
    });
  }
}
