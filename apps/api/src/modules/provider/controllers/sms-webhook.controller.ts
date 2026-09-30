import {
  BadRequestException,
  Body,
  Controller,
  Headers,
  HttpCode,
  HttpStatus,
  Logger,
  Post,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import * as crypto from 'crypto';
import { SkipThrottle } from '@nestjs/throttler';
import { Public } from '../../auth/decorators/public.decorator';

export interface InboundSMSPayload {
  messageId: string;
  from: string;
  to: string;
  text: string;
  timestamp: Date;
  provider: string;
  metadata?: Record<string, any>;
}

export interface SMSStatusPayload {
  messageId: string;
  status: 'delivered' | 'failed' | 'sent' | 'received';
  timestamp: Date;
  provider: string;
  errorCode?: string;
  errorMessage?: string;
  metadata?: Record<string, any>;
}

@ApiTags('SMS Webhooks')
@Controller('webhooks/sms')
@Public()
@SkipThrottle()
export class SMSWebhookController {
  private readonly logger = new Logger(SMSWebhookController.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly eventEmitter: EventEmitter2,
  ) { }

  /**
   * Handle Twilio inbound SMS webhooks
   */
  @Post('twilio/inbound')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Handle Twilio inbound SMS webhooks' })
  async handleTwilioInbound(
    @Body() body: any,
    @Headers() headers: Record<string, string>,
  ): Promise<{ success: boolean }> {
    try {
      // Validate Twilio webhook signature
      const signature = headers['x-twilio-signature'];
      if (!this.validateTwilioSignature(body, signature)) {
        throw new UnauthorizedException('Invalid webhook signature');
      }

      const inboundSMS: InboundSMSPayload = {
        messageId: body.MessageSid,
        from: body.From,
        to: body.To,
        text: body.Body,
        timestamp: new Date(),
        provider: 'twilio',
        metadata: {
          accountSid: body.AccountSid,
          messagingServiceSid: body.MessagingServiceSid,
          numMedia: body.NumMedia,
          numSegments: body.NumSegments,
        },
      };

      // Add conversation context for routing
      if (!inboundSMS.metadata) {
        inboundSMS.metadata = {};
      }
      inboundSMS.metadata.conversationId = this.generateConversationId(inboundSMS.from, 'twilio');

      // Emit event for processing
      this.eventEmitter.emit('sms.inbound.received', inboundSMS);

      this.logger.log(`Inbound SMS received from Twilio: ${body.MessageSid}`);
      return { success: true };
    } catch (error) {
      this.logger.error(`Failed to process Twilio inbound SMS: ${error.message}`);
      throw new BadRequestException('Failed to process webhook');
    }
  }

  /**
   * Handle Twilio SMS status callbacks
   */
  @Post('twilio/status')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Handle Twilio SMS status callbacks' })
  async handleTwilioStatus(
    @Body() body: any,
    @Headers() headers: Record<string, string>,
  ): Promise<{ success: boolean }> {
    try {
      // Validate Twilio webhook signature
      const signature = headers['x-twilio-signature'];
      if (!this.validateTwilioSignature(body, signature)) {
        throw new UnauthorizedException('Invalid webhook signature');
      }

      const statusUpdate: SMSStatusPayload = {
        messageId: body.MessageSid,
        status: this.mapTwilioStatus(body.MessageStatus),
        timestamp: new Date(),
        provider: 'twilio',
        errorCode: body.ErrorCode,
        errorMessage: body.ErrorMessage,
        metadata: {
          accountSid: body.AccountSid,
          price: body.Price,
          priceUnit: body.PriceUnit,
        },
      };

      // Emit event for processing
      this.eventEmitter.emit('sms.status.updated', statusUpdate);

      this.logger.log(`SMS status updated from Twilio: ${body.MessageSid} -> ${body.MessageStatus}`);
      return { success: true };
    } catch (error) {
      this.logger.error(`Failed to process Twilio status callback: ${error.message}`);
      throw new BadRequestException('Failed to process webhook');
    }
  }

  /**
   * Handle Termii inbound SMS webhooks
   */
  @Post('termii/inbound')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Handle Termii inbound SMS webhooks' })
  async handleTermiiInbound(
    @Body() body: any,
    @Headers() headers: Record<string, string>,
  ): Promise<{ success: boolean }> {
    try {
      // Termii doesn't use signature validation by default
      // You can implement API key validation if needed

      const inboundSMS: InboundSMSPayload = {
        messageId: body.message_id || `termii_${Date.now()}`,
        from: body.from,
        to: body.to,
        text: body.text || body.message,
        timestamp: new Date(body.date || Date.now()),
        provider: 'termii',
        metadata: {
          channel: body.channel,
          type: body.type,
        },
      };

      // Add conversation context for routing
      if (!inboundSMS.metadata) {
        inboundSMS.metadata = {};
      }
      inboundSMS.metadata.conversationId = this.generateConversationId(inboundSMS.from, 'termii');

      // Emit event for processing
      this.eventEmitter.emit('sms.inbound.received', inboundSMS);

      this.logger.log(`Inbound SMS received from Termii: ${inboundSMS.messageId}`);
      return { success: true };
    } catch (error) {
      this.logger.error(`Failed to process Termii inbound SMS: ${error.message}`);
      throw new BadRequestException('Failed to process webhook');
    }
  }

  /**
   * Handle Telnyx inbound SMS webhooks
   */
  @Post('telnyx/inbound')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Handle Telnyx inbound SMS webhooks' })
  async handleTelnyxInbound(
    @Body() body: any,
    @Headers() headers: Record<string, string>,
  ): Promise<{ success: boolean }> {
    try {
      // Validate Telnyx webhook signature if configured
      const signature = headers['telnyx-signature-ed25519'];
      if (signature && !this.validateTelnyxSignature(body, signature, headers['telnyx-timestamp'])) {
        throw new UnauthorizedException('Invalid webhook signature');
      }

      const eventData = body.data;
      const inboundSMS: InboundSMSPayload = {
        messageId: eventData.id,
        from: eventData.from.phone_number,
        to: eventData.to[0].phone_number,
        text: eventData.text,
        timestamp: new Date(eventData.received_at),
        provider: 'telnyx',
        metadata: {
          messagingProfileId: eventData.messaging_profile_id,
          webhookUrl: eventData.webhook_url,
          encoding: eventData.encoding,
        },
      };

      // Add conversation context for routing
      if (!inboundSMS.metadata) {
        inboundSMS.metadata = {};
      }
      inboundSMS.metadata.conversationId = this.generateConversationId(inboundSMS.from, 'telnyx');

      // Emit event for processing
      this.eventEmitter.emit('sms.inbound.received', inboundSMS);

      this.logger.log(`Inbound SMS received from Telnyx: ${eventData.id}`);
      return { success: true };
    } catch (error) {
      this.logger.error(`Failed to process Telnyx inbound SMS: ${error.message}`);
      throw new BadRequestException('Failed to process webhook');
    }
  }

  /**
   * Handle Infobip inbound SMS webhooks
   */
  @Post('infobip/inbound')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Handle Infobip inbound SMS webhooks' })
  async handleInfobipInbound(
    @Body() body: any,
    @Headers() headers: Record<string, string>,
  ): Promise<{ success: boolean }> {
    try {
      // Infobip uses basic authentication or API key
      // Implement validation as needed

      const results = body.results || [body];

      for (const result of results) {
        const inboundSMS: InboundSMSPayload = {
          messageId: result.messageId,
          from: result.from,
          to: result.to,
          text: result.text,
          timestamp: new Date(result.receivedAt),
          provider: 'infobip',
          metadata: {
            keyword: result.keyword,
            cleanText: result.cleanText,
            smsCount: result.smsCount,
          },
        };

        // Add conversation context for routing
        if (!inboundSMS.metadata) {
          inboundSMS.metadata = {};
        }
        inboundSMS.metadata.conversationId = this.generateConversationId(inboundSMS.from, 'infobip');

        // Emit event for processing
        this.eventEmitter.emit('sms.inbound.received', inboundSMS);
      }

      this.logger.log(`Processed ${results.length} inbound SMS from Infobip`);
      return { success: true };
    } catch (error) {
      this.logger.error(`Failed to process Infobip inbound SMS: ${error.message}`);
      throw new BadRequestException('Failed to process webhook');
    }
  }

  /**
   * Generic SMS status webhook for delivery reports
   */
  @Post('status/:provider')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Generic SMS status webhook for delivery reports' })
  async handleGenericStatus(
    @Body() body: any,
    @Headers() headers: Record<string, string>,
  ): Promise<{ success: boolean }> {
    try {
      // Process generic status updates
      this.logger.log(`Generic SMS status webhook received for provider: ${body.provider}`);

      // Emit generic status event
      this.eventEmitter.emit('sms.status.generic', {
        provider: body.provider,
        data: body,
        headers,
        timestamp: new Date(),
      });

      return { success: true };
    } catch (error) {
      this.logger.error(`Failed to process generic SMS status: ${error.message}`);
      throw new BadRequestException('Failed to process webhook');
    }
  }

  /**
   * Validate Twilio webhook signature
   */
  private validateTwilioSignature(body: any, signature: string): boolean {
    if (!signature) return false;

    const authToken = this.configService.get('TWILIO_AUTH_TOKEN');
    const webhookUrl = this.configService.get('TWILIO_WEBHOOK_URL');

    if (!authToken || !webhookUrl) return false;

    // Create the signature
    const params = new URLSearchParams(body).toString();
    const data = webhookUrl + params;
    const expectedSignature = crypto
      .createHmac('sha1', authToken)
      .update(data, 'utf8')
      .digest('base64');

    return crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expectedSignature)
    );
  }

  /**
   * Validate Telnyx webhook signature
   */
  private validateTelnyxSignature(body: any, signature: string, timestamp: string): boolean {
    // Implement Telnyx Ed25519 signature validation
    // This is a simplified version - implement proper Ed25519 validation in production
    return true; // For now, always return true
  }

  /**
   * Map Twilio status to standard status
   */
  private mapTwilioStatus(twilioStatus: string): 'delivered' | 'failed' | 'sent' | 'received' {
    const statusMap: Record<string, 'delivered' | 'failed' | 'sent' | 'received'> = {
      'queued': 'sent',
      'sending': 'sent',
      'sent': 'sent',
      'delivered': 'delivered',
      'undelivered': 'failed',
      'failed': 'failed',
      'received': 'received',
    };

    return statusMap[twilioStatus] || 'failed';
  }

  /**
   * Generate conversation ID for tracking message threads
   */
  private generateConversationId(phoneNumber: string, provider: string): string {
    // Create a consistent conversation ID that allows routing replies back to the same provider
    const normalized = phoneNumber.replace(/[^\d]/g, '');
    return `${provider}_${normalized}`;
  }
}