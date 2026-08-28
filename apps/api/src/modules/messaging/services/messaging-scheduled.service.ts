import { Injectable, Logger, NotFoundException } from "@nestjs/common";
import { MessageStatus } from "../message.entity";
import { MessageRepository } from "../repositories";

@Injectable()
export class MessagingScheduledService {
  private readonly logger = new Logger(MessagingScheduledService.name);

  constructor(private readonly messageRepository: MessageRepository) {}

  async getMessageStatus(messageId: string, tenantId?: string) {
    if (messageId.startsWith("msg_")) {
      throw new NotFoundException(
        "Status not available for immediate sends. Only scheduled messages have persistent status.",
      );
    }

    const whereCondition = tenantId ? { tenantId } : {};
    const message = await this.messageRepository.findById(messageId, false, whereCondition);

    if (!message) {
      throw new NotFoundException(`Message ${messageId} not found`);
    }

    return {
      id: message.id,
      status: message.status,
      channels: message.channels,
      recipients: message.recipients,
      createdAt: message.createdAt,
      scheduledAt: message.scheduledAt,
      deliveredAt: message.deliveredAt,
      errorMessage: message.errorMessage,
    };
  }

  async getDeliveryReports(messageId: string, tenantId?: string) {
    if (messageId.startsWith("msg_")) {
      throw new NotFoundException(
        "Delivery reports not available for immediate sends. Use provider webhooks for delivery tracking.",
      );
    }

    if (tenantId) {
      const message = await this.messageRepository.findById(messageId, false, {
        tenantId,
      });
      if (!message) {
        throw new NotFoundException(`Message ${messageId} not found`);
      }
    }

    return {
      messageId,
      note: "Detailed delivery tracking available via provider webhooks",
    };
  }

  async cancelMessage(messageId: string, tenantId?: string) {
    const whereCondition = tenantId ? { tenantId } : {};
    const message = await this.messageRepository.findById(messageId, false, whereCondition);

    if (!message) {
      throw new NotFoundException(`Message ${messageId} not found`);
    }

    if (message.status !== MessageStatus.PENDING) {
      throw new Error(`Cannot cancel message with status: ${message.status}`);
    }

    await this.messageRepository.update(messageId, {
      status: MessageStatus.CANCELLED,
    });
  }

  async processMessage(messageId: string) {
    try {
      const message = await this.messageRepository.findById(messageId);
      if (!message) {
        throw new Error(`Message ${messageId} not found`);
      }

      await this.messageRepository.update(messageId, {
        status: MessageStatus.PROCESSING,
      });

      const deliveryResults: Array<{
        channel: string;
        status: "delivered" | "failed";
        result?: any;
        error?: string;
      }> = [];

      for (const channel of message.channels) {
        try {
          let result;

          switch (channel.toLowerCase()) {
            default:
              this.logger.warn(`Unsupported channel: ${channel}`);
              continue;
          }

          deliveryResults.push({
            channel,
            status: "delivered",
            result,
          });
        } catch (error) {
          this.logger.error(`Failed to process ${channel} for message ${messageId}:`, error);
          deliveryResults.push({
            channel,
            status: "failed",
            error: error.message,
          });
        }
      }

      const hasFailures = deliveryResults.some((r) => r.status === "failed");
      const hasSuccess = deliveryResults.some((r) => r.status === "delivered");

      let finalStatus = MessageStatus.FAILED;
      if (hasSuccess && !hasFailures) {
        finalStatus = MessageStatus.DELIVERED;
      } else if (hasSuccess && hasFailures) {
        finalStatus = MessageStatus.PARTIALLY_DELIVERED;
      }

      await this.messageRepository.update(messageId, {
        status: finalStatus,
        deliveredAt: hasSuccess ? new Date() : undefined,
        errorMessage: hasFailures ? "Some channels failed" : undefined,
      });

      this.logger.log(`Processed scheduled message ${messageId}: ${finalStatus}`);
    } catch (error) {
      this.logger.error(`Failed to process message ${messageId}:`, error);
      await this.messageRepository.update(messageId, {
        status: MessageStatus.FAILED,
        errorMessage: error.message,
      });
    }
  }
}
