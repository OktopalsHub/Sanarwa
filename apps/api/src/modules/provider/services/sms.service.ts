import { Injectable, Logger } from "@nestjs/common";
import { EventEmitter2, OnEvent } from "@nestjs/event-emitter";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { Message, MessageStatus, MessagePriority } from "../../messaging/message.entity";
import { NotificationChannel } from "../../../common/enums/notification-channel.enum";
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

  async sendSMS(request: OutboundSMSRequest): Promise<OutboundSMSResponse> {
    try {
      const preferredProvider = request.metadata?.preferredProvider;

      const routingResult = await this.smartRouter.selectProvider(request.to, preferredProvider);

      this.logger.log(
        `Routing SMS to ${request.to} via ${routingResult.providerId} (${routingResult.region})${preferredProvider ? " [conversation continuity]" : ""}`,
      );

      const provider = this.getProviderInstance(routingResult.providerId);
      if (!provider) {
        throw new Error(`Provider ${routingResult.providerId} not available`);
      }

      const result = await provider.sendSMS({
        to: request.to,
        message: request.message,
        from: request.from,
        metadata: request.metadata,
      });

      if (!result.success) {
        throw new Error(result.error || "SMS sending failed");
      }

      const message = await this.storeOutboundMessage(request, result, routingResult);

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

  async sendBulkSMS(requests: OutboundSMSRequest[]): Promise<{
    successful: number;
    failed: number;
    results: OutboundSMSResponse[];
  }> {
    const results: OutboundSMSResponse[] = [];
    let successful = 0;
    let failed = 0;

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

      if (i + batchSize < requests.length) {
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
    }

    this.logger.log(`Bulk SMS completed: ${successful} successful, ${failed} failed`);

    return { successful, failed, results };
  }

  @OnEvent("sms.inbound.received")
  async handleInboundSMS(payload: InboundSMSPayload): Promise<void> {
    try {
      this.logger.log(`Processing inbound SMS from ${payload.from} via ${payload.provider}`);

      await this.storeInboundMessage(payload);

      await this.routeReplyToOriginalProvider(payload);

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

      await this.processAutoReply(payload);
    } catch (error) {
      this.logger.error(`Failed to process inbound SMS: ${error.message}`, error.stack);
    }
  }

  @OnEvent("sms.status.updated")
  async handleSMSStatusUpdate(payload: SMSStatusPayload): Promise<void> {
    try {
      this.logger.log(`Processing SMS status update: ${payload.messageId} -> ${payload.status}`);

      await this.updateMessageDeliveryStatus(payload);

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
      .andWhere("message.channels @> :channels", {
        channels: JSON.stringify([NotificationChannel.SMS]),
      })
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

        const cost = message.metadata?.cost || 0;
        totalCost += cost;

        const provider = message.metadata?.provider || "unknown";
        providerBreakdown[provider] = (providerBreakdown[provider] || 0) + 1;

        const recipient = message.recipients[0]?.phone;
        if (recipient) {
          const country = this.extractCountryFromPhone(recipient);
          countryBreakdown[country] = (countryBreakdown[country] || 0) + 1;
        }
      }

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

  private getProviderInstance(providerId: string): any {
    const providers = {
      twilio: this.twilioProvider,
      termii: this.termiiProvider,
      telnyx: this.telnyxProvider,
      infobip: this.infobipProvider,
    };

    return providers[providerId];
  }

  private async storeOutboundMessage(
    request: OutboundSMSRequest,
    result: any,
    routing: any,
  ): Promise<Message> {
    const message = this.messageRepository.create({
      tenantId: request.tenantId,
      channels: [NotificationChannel.SMS],
      recipients: [
        {
          id: `sms_${Date.now()}`,
          phone: request.to,
          userId: request.userId,
          metadata: request.metadata,
        },
      ],
      variables: {
        message: request.message,
        from: request.from,
        provider: routing.providerId,
        region: routing.region,
      },
      status: MessageStatus.SENT,
      priority: MessagePriority.NORMAL,
      data: request.message,
      metadata: {
        provider: routing.providerId,
        providerMessageId: result.messageId,
        cost: routing.costPerSMS,
        direction: "outbound",
        conversationId: this.generateConversationId(request.to, routing.providerId),
      },
    });

    const savedMessage = await this.messageRepository.save(message);

    const delivery = this.messageDeliveryRepository.create({
      messageId: savedMessage.id,
      channel: NotificationChannel.SMS,
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

  private async storeInboundMessage(payload: InboundSMSPayload): Promise<Message> {
    const tenantId = (await this.findTenantByPhoneNumber(payload.to)) || "system";

    const message = this.messageRepository.create({
      tenantId,
      channels: [NotificationChannel.SMS],
      recipients: [
        {
          id: `sms_inbound_${Date.now()}`,
          phone: payload.to,
          metadata: payload.metadata,
        },
      ],
      variables: {
        message: payload.text,
        from: payload.from,
        to: payload.to,
        provider: payload.provider,
      },
      status: MessageStatus.DELIVERED,
      priority: MessagePriority.NORMAL,
      data: payload.text,
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

    const delivery = this.messageDeliveryRepository.create({
      messageId: savedMessage.id,
      channel: NotificationChannel.SMS,
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

  private async updateMessageDeliveryStatus(payload: SMSStatusPayload): Promise<void> {
    const delivery = await this.messageDeliveryRepository.findOne({
      where: { providerMessageId: payload.messageId },
      relations: { message: true },
    });

    if (delivery) {
      const mappedStatus = this.mapStatusToDeliveryStatus(payload.status);

      delivery.status = mappedStatus;
      delivery.errorMessage = payload.errorMessage;

      if (payload.status === "delivered" && !delivery.deliveredAt) {
        delivery.deliveredAt = payload.timestamp;
      }

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

      if (delivery.message) {
        await this.updateMessageStatus(delivery.message.id);
      }
    } else {
      this.logger.warn(`No delivery record found for message ID: ${payload.messageId}`);
    }
  }

  private async processAutoReply(payload: InboundSMSPayload): Promise<void> {
    const lowerText = payload.text.toLowerCase().trim();

    if (lowerText === "stop" || lowerText === "unsubscribe") {
      this.eventEmitter.emit("sms.unsubscribe.requested", {
        phoneNumber: payload.from,
        provider: payload.provider,
        timestamp: payload.timestamp,
      });
    }

    if (lowerText === "help" || lowerText === "info") {
      await this.sendSMS({
        to: payload.from,
        message: "For support, visit our website or call customer service.",
        tenantId: "system",
        metadata: { type: "auto-reply", trigger: "help" },
      });
    }
  }

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

    try {
      const testResult = await this.sendSMS({
        to: "+1234567890",
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

  private generateConversationId(phoneNumber: string, provider: string): string {
    const normalized = phoneNumber.replace(/[^\d]/g, "");
    return `${provider}_${normalized}`;
  }

  private async findTenantByPhoneNumber(phoneNumber: string): Promise<string | null> {
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

  private mapStatusToDeliveryStatus(status: string): MessageDeliveryStatus {
    const statusMap: Record<string, MessageDeliveryStatus> = {
      sent: MessageDeliveryStatus.SENT,
      delivered: MessageDeliveryStatus.DELIVERED,
      failed: MessageDeliveryStatus.FAILED,
      received: MessageDeliveryStatus.DELIVERED,
    };

    return statusMap[status] || MessageDeliveryStatus.FAILED;
  }

  private async updateMessageStatus(messageId: string): Promise<void> {
    const message = await this.messageRepository.findOne({
      where: { id: messageId },
      relations: { deliveries: true },
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

  private extractCountryFromPhone(phoneNumber: string): string {
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

  async routeReplyToOriginalProvider(inboundPayload: InboundSMSPayload): Promise<void> {
    const conversationId = this.generateConversationId(
      inboundPayload.from,
      inboundPayload.provider,
    );

    const originalMessage = await this.messageRepository
      .createQueryBuilder("message")
      .where("message.metadata->'conversationId' = :conversationId", { conversationId })
      .andWhere("message.metadata->'direction' = :direction", { direction: "outbound" })
      .orderBy("message.createdAt", "DESC")
      .limit(1)
      .getOne();

    if (originalMessage) {
      this.eventEmitter.emit("sms.conversation.reply", {
        inboundMessage: inboundPayload,
        originalMessage,
        conversationId,
        provider: inboundPayload.provider,
      });
    }
  }

  async sendConversationReply(
    conversationId: string,
    replyMessage: string,
    tenantId: string,
  ): Promise<OutboundSMSResponse> {
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
