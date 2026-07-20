import {
  Controller,
  Post,
  Get,
  Body,
  Query,
  Headers,
  HttpCode,
  HttpStatus,
  Logger,
  BadRequestException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { Public } from '../../auth/decorators/public.decorator';

export interface WhatsAppWebhookEntry {
  id: string;
  changes: Array<{
    value: {
      messaging_product: string;
      metadata: {
        display_phone_number: string;
        phone_number_id: string;
      };
      contacts?: Array<{
        profile: {
          name: string;
        };
        wa_id: string;
      }>;
      messages?: Array<{
        from: string;
        id: string;
        timestamp: string;
        text?: {
          body: string;
        };
        type: string;
        context?: {
          from: string;
          id: string;
        };
      }>;
      statuses?: Array<{
        id: string;
        status: 'sent' | 'delivered' | 'read' | 'failed';
        timestamp: string;
        recipient_id: string;
        errors?: Array<{
          code: number;
          title: string;
          message: string;
        }>;
      }>;
    };
    field: string;
  }>;
}

export interface WhatsAppWebhookPayload {
  object: string;
  entry: WhatsAppWebhookEntry[];
}

export interface InboundWhatsAppMessage {
  messageId: string;
  from: string;
  to: string;
  text: string;
  timestamp: Date;
  provider: string;
  contactName?: string;
  messageType: string;
  metadata?: Record<string, any>;
}

export interface WhatsAppStatusUpdate {
  messageId: string;
  status: 'sent' | 'delivered' | 'read' | 'failed';
  timestamp: Date;
  recipient: string;
  provider: string;
  errorCode?: number;
  errorMessage?: string;
}

@ApiTags('WhatsApp Webhooks')
@Controller('webhooks/whatsapp')
@Public()
export class WhatsAppWebhookController {
  private readonly logger = new Logger(WhatsAppWebhookController.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly eventEmitter: EventEmitter2,
  ) { }

  @Get()
  @ApiOperation({ summary: 'Verify WhatsApp webhook' })
  @ApiResponse({ status: 200, description: 'Webhook verified successfully' })
  verifyWebhook(
    @Query('hub.mode') mode: string,
    @Query('hub.verify_token') verifyToken: string,
    @Query('hub.challenge') challenge: string,
  ): string {
    const expectedToken = this.configService.get('WHATSAPP_WEBHOOK_VERIFY_TOKEN');

    if (mode === 'subscribe' && verifyToken === expectedToken) {
      this.logger.log('WhatsApp webhook verified successfully');
      return challenge;
    }

    this.logger.error('WhatsApp webhook verification failed');
    throw new UnauthorizedException('Invalid verification token');
  }

  @Post()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Handle WhatsApp webhook events' })
  @ApiResponse({ status: 200, description: 'Webhook processed successfully' })
  async handleWebhook(
    @Body() payload: WhatsAppWebhookPayload,
    @Headers('x-hub-signature-256') signature?: string,
  ): Promise<{ success: boolean }> {
    try {
      // Validate webhook signature if configured
      if (signature && !this.validateSignature(JSON.stringify(payload), signature)) {
        throw new UnauthorizedException('Invalid webhook signature');
      }

      if (payload.object !== 'whatsapp_business_account') {
        throw new BadRequestException('Invalid webhook object type');
      }

      for (const entry of payload.entry) {
        for (const change of entry.changes) {
          if (change.field === 'messages') {
            await this.processMessages(change.value);
            await this.processStatuses(change.value);
          }
        }
      }

      return { success: true };
    } catch (error) {
      this.logger.error(`Failed to process WhatsApp webhook: ${error.message}`, error.stack);
      throw new BadRequestException('Failed to process webhook');
    }
  }

  private async processMessages(value: any): Promise<void> {
    if (!value.messages) return;

    for (const message of value.messages) {
      try {
        const contact = value.contacts?.find((c: any) => c.wa_id === message.from);

        const inboundMessage: InboundWhatsAppMessage = {
          messageId: message.id,
          from: message.from,
          to: value.metadata.phone_number_id,
          text: message.text?.body || '',
          timestamp: new Date(parseInt(message.timestamp) * 1000),
          provider: 'whatsapp',
          contactName: contact?.profile?.name,
          messageType: message.type,
          metadata: {
            displayPhoneNumber: value.metadata.display_phone_number,
            phoneNumberId: value.metadata.phone_number_id,
            context: message.context,
          },
        };

        // Add conversation context for routing
        if (!inboundMessage.metadata) {
          inboundMessage.metadata = {};
        }
        inboundMessage.metadata.conversationId = this.generateConversationId(
          inboundMessage.from,
          'whatsapp'
        );

        // Emit event for processing
        this.eventEmitter.emit('whatsapp.message.received', inboundMessage);

        this.logger.log(`Inbound WhatsApp message received: ${message.id} from ${message.from}`);
      } catch (error) {
        this.logger.error(`Failed to process WhatsApp message: ${error.message}`, error.stack);
      }
    }
  }

  private async processStatuses(value: any): Promise<void> {
    if (!value.statuses) return;

    for (const status of value.statuses) {
      try {
        const statusUpdate: WhatsAppStatusUpdate = {
          messageId: status.id,
          status: status.status,
          timestamp: new Date(parseInt(status.timestamp) * 1000),
          recipient: status.recipient_id,
          provider: 'whatsapp',
          errorCode: status.errors?.[0]?.code,
          errorMessage: status.errors?.[0]?.message,
        };

        // Emit event for processing
        this.eventEmitter.emit('whatsapp.status.updated', statusUpdate);

        this.logger.log(
          `WhatsApp message status updated: ${status.id} -> ${status.status} for ${status.recipient_id}`
        );
      } catch (error) {
        this.logger.error(`Failed to process WhatsApp status: ${error.message}`, error.stack);
      }
    }
  }

  private validateSignature(body: string, signature: string): boolean {
    // WhatsApp uses HMAC SHA256 for signature validation
    const crypto = require('crypto');
    const appSecret = this.configService.get('WHATSAPP_APP_SECRET');

    if (!appSecret) {
      this.logger.warn('WhatsApp app secret not configured, skipping signature validation');
      return true;
    }

    const expectedSignature = crypto
      .createHmac('sha256', appSecret)
      .update(body, 'utf8')
      .digest('hex');

    const providedSignature = signature.replace('sha256=', '');

    return crypto.timingSafeEqual(
      Buffer.from(expectedSignature, 'hex'),
      Buffer.from(providedSignature, 'hex')
    );
  }

  private generateConversationId(phoneNumber: string, provider: string): string {
    // Create a consistent conversation ID for message threading
    const normalized = phoneNumber.replace(/[^\d]/g, '');
    return `${provider}_${normalized}`;
  }
}