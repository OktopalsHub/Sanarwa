import { Injectable, Logger, BadRequestException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { EventEmitter2 } from "@nestjs/event-emitter";
import { WhatsAppBusinessAPIService } from "./whatsapp-business-api.service";
import { Message, MessageChannel, MessageStatus } from "../../messaging/message.entity";
import { MessageDelivery, MessageDeliveryStatus } from "../../messaging/message-delivery.entity";

export interface WhatsAppSendOptions {
  templateName: string;
  languageCode?: string;
  parameters?: Array<{ type: string; text: string }>;
  mediaUrl?: string;
  mediaType?: "image" | "video" | "document" | "audio";
  retryCount?: number;
}

@Injectable()
export class WhatsAppMessageService {
  private readonly logger = new Logger(WhatsAppMessageService.name);

  constructor(
    @InjectRepository(Message)
    private readonly messageRepository: Repository<Message>,
    @InjectRepository(MessageDelivery)
    private readonly deliveryRepository: Repository<MessageDelivery>,
    private readonly whatsappApi: WhatsAppBusinessAPIService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  /**
   * Send WhatsApp message with enhanced error handling and retry logic
   */
  async sendMessage(
    phoneNumber: string,
    options: WhatsAppSendOptions,
    messageId: string,
    tenantId: string,
  ): Promise<{ success: boolean; externalId?: string; error?: string }> {
    try {
      // Validate phone number
      const validation = this.whatsappApi.validatePhoneNumber(phoneNumber);
      if (!validation.isValid) {
        throw new BadRequestException(validation.error);
      }

      this.logger.log(
        `Sending WhatsApp message to ${phoneNumber} using template ${options.templateName}`,
      );

      // Build components for template
      const components = this.buildTemplateComponents(options);

      // Send message
      const result = await this.whatsappApi.sendTemplateMessage(
        validation.cleanNumber!,
        options.templateName,
        options.languageCode || "en",
        components,
      );

      // Record delivery
      await this.recordDelivery(messageId, tenantId, result.messageId, MessageDeliveryStatus.SENT);

      this.logger.log(`WhatsApp message sent successfully: ${result.messageId}`);

      // Emit event for tracking
      this.eventEmitter.emit("whatsapp.message.sent", {
        messageId,
        externalId: result.messageId,
        phoneNumber: validation.cleanNumber,
        tenantId,
        timestamp: new Date(),
      });

      return { success: true, externalId: result.messageId };
    } catch (error) {
      this.logger.error(`Failed to send WhatsApp message to ${phoneNumber}`, error.message);

      // Record failure
      await this.recordDelivery(
        messageId,
        tenantId,
        undefined,
        MessageDeliveryStatus.FAILED,
        error.message,
      );

      // Emit failure event
      this.eventEmitter.emit("whatsapp.message.failed", {
        messageId,
        phoneNumber,
        tenantId,
        error: error.message,
        timestamp: new Date(),
      });

      return { success: false, error: error.message };
    }
  }

  /**
   * Send text message (for simple messages)
   */
  async sendTextMessage(
    phoneNumber: string,
    message: string,
    messageId: string,
    tenantId: string,
  ): Promise<{ success: boolean; externalId?: string; error?: string }> {
    try {
      const validation = this.whatsappApi.validatePhoneNumber(phoneNumber);
      if (!validation.isValid) {
        throw new BadRequestException(validation.error);
      }

      this.logger.log(`Sending WhatsApp text message to ${phoneNumber}`);

      const result = await this.whatsappApi.sendTextMessage(validation.cleanNumber!, message);

      await this.recordDelivery(messageId, tenantId, result.messageId, MessageDeliveryStatus.SENT);

      this.eventEmitter.emit("whatsapp.message.sent", {
        messageId,
        externalId: result.messageId,
        phoneNumber: validation.cleanNumber,
        tenantId,
        type: "text",
        timestamp: new Date(),
      });

      return { success: true, externalId: result.messageId };
    } catch (error) {
      this.logger.error(`Failed to send WhatsApp text message to ${phoneNumber}`, error.message);

      await this.recordDelivery(
        messageId,
        tenantId,
        undefined,
        MessageDeliveryStatus.FAILED,
        error.message,
      );

      return { success: false, error: error.message };
    }
  }

  /**
   * Handle incoming WhatsApp messages
   */
  async handleIncomingMessage(payload: any): Promise<void> {
    try {
      const message = payload.entry[0].changes[0].value.messages?.[0];
      if (!message) return;

      this.logger.log(`Received WhatsApp message: ${message.id}`);

      const from = payload.entry[0].changes[0].value.contacts[0].wa_id;
      const messageType = message.type;
      let content = "";

      // Extract content based on message type
      switch (messageType) {
        case "text":
          content = message.text.body;
          break;
        case "image":
          content = `[Image: ${message.image.caption || "No caption"}]`;
          break;
        case "video":
          content = `[Video: ${message.video.caption || "No caption"}]`;
          break;
        case "document":
          content = `[Document: ${message.document.filename}]`;
          break;
        case "audio":
          content = "[Audio message]";
          break;
        case "location":
          content = `[Location: ${message.location.latitude}, ${message.location.longitude}]`;
          break;
        default:
          content = `[${messageType} message]`;
      }

      // Emit event for processing
      this.eventEmitter.emit("whatsapp.message.received", {
        externalId: message.id,
        from,
        content,
        messageType,
        timestamp: new Date(parseInt(message.timestamp) * 1000),
        metadata: {
          messageId: message.id,
          type: messageType,
        },
      });
    } catch (error) {
      this.logger.error("Failed to handle incoming WhatsApp message", error);
    }
  }

  /**
   * Handle WhatsApp status updates
   */
  async handleStatusUpdate(payload: any): Promise<void> {
    try {
      const status = payload.entry[0].changes[0].value.statuses?.[0];
      if (!status) return;

      this.logger.log(`WhatsApp status update: ${status.id} -> ${status.status}`);

      const deliveryStatus = this.mapWhatsAppStatus(status.status);

      // Update delivery record
      await this.deliveryRepository.update({ externalId: status.id } as any, {
        status: deliveryStatus,
        updatedAt: new Date(),
        metadata: {
          whatsappStatus: status.status,
          timestamp: status.timestamp,
          errors: status.errors,
        },
      });

      // Emit event
      this.eventEmitter.emit("whatsapp.status.updated", {
        externalId: status.id,
        status: deliveryStatus,
        whatsappStatus: status.status,
        timestamp: new Date(),
      });
    } catch (error) {
      this.logger.error("Failed to handle WhatsApp status update", error);
    }
  }

  /**
   * Build template components from options
   */
  private buildTemplateComponents(
    options: WhatsAppSendOptions,
  ): Array<{ type: string; parameters: Array<{ type: string; text: string }> }> {
    if (!options.parameters || options.parameters.length === 0) {
      return [];
    }

    return [
      {
        type: "body",
        parameters: options.parameters,
      },
    ];
  }

  /**
   * Record message delivery
   */
  private async recordDelivery(
    messageId: string,
    tenantId: string,
    externalId: string | undefined,
    status: MessageDeliveryStatus,
    error?: string,
  ): Promise<void> {
    try {
      const delivery = this.deliveryRepository.create({
        messageId,
        tenantId,
        channel: MessageChannel.WHATSAPP,
        externalId,
        status,
        error,
        metadata: {
          provider: "meta_whatsapp",
          timestamp: new Date(),
        },
      } as any);

      await this.deliveryRepository.save(delivery);
    } catch (err) {
      this.logger.error("Failed to record delivery", err);
    }
  }

  /**
   * Map WhatsApp status to standard status
   */
  private mapWhatsAppStatus(whatsappStatus: string): MessageDeliveryStatus {
    const statusMap: Record<string, MessageDeliveryStatus> = {
      sent: MessageDeliveryStatus.SENT,
      delivered: MessageDeliveryStatus.DELIVERED,
      read: MessageDeliveryStatus.DELIVERED,
      failed: MessageDeliveryStatus.FAILED,
    };

    return statusMap[whatsappStatus] || MessageDeliveryStatus.PENDING;
  }

  /**
   * Get message delivery status
   */
  async getDeliveryStatus(messageId: string): Promise<MessageDelivery | null> {
    return this.deliveryRepository.findOne({
      where: { messageId, channel: MessageChannel.WHATSAPP },
    });
  }

  /**
   * Retry failed message
   */
  async retryMessage(
    messageId: string,
    phoneNumber: string,
    options: WhatsAppSendOptions,
    tenantId: string,
  ): Promise<{ success: boolean; error?: string }> {
    try {
      // Check retry count
      const delivery = await this.getDeliveryStatus(messageId);
      if (!delivery) {
        throw new Error("Delivery record not found");
      }

      const retryCount = (delivery.metadata?.retryCount || 0) + 1;
      if (retryCount > (options.retryCount || 3)) {
        throw new Error("Max retries exceeded");
      }

      // Retry send
      const result = await this.sendMessage(phoneNumber, options, messageId, tenantId);

      if (result.success) {
        // Update retry count
        await this.deliveryRepository.update(
          { id: delivery.id },
          {
            metadata: {
              ...delivery.metadata,
              retryCount,
            },
          },
        );
      }

      return result;
    } catch (error) {
      this.logger.error(`Failed to retry message ${messageId}`, error);
      return { success: false, error: error.message };
    }
  }
}
