import {
  BadRequestException,
  Body,
  Controller,
  Headers,
  Logger,
  Post,
  RawBody,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import { Public } from '../../auth/decorators/public.decorator';
import { WebhookValidatorService } from '../services/webhook-validator.service';

@ApiTags('Webhooks')
@Controller('webhooks')
@Public()
@SkipThrottle()
export class WebhookReceiverController {
  private readonly logger = new Logger(WebhookReceiverController.name);

  constructor(
    private readonly webhookValidator: WebhookValidatorService,
    private readonly configService: ConfigService,
    private readonly eventEmitter: EventEmitter2,
  ) { }

  /**
   * WhatsApp webhook receiver
   * Handles incoming messages and status updates
   */
  @Post('whatsapp')
  @ApiOperation({ summary: 'WhatsApp webhook receiver' })
  @ApiResponse({ status: 200, description: 'Webhook processed' })
  @ApiResponse({ status: 400, description: 'Invalid signature or bad request' })
  async handleWhatsAppWebhook(
    @RawBody() rawBody: Buffer,
    @Headers('x-hub-signature') signature: string,
    @Body() body: any,
  ) {
    try {
      const bodyString = rawBody.toString('utf-8');

      // Validate signature
      const secret = this.configService.get<string>('WHATSAPP_WEBHOOK_SECRET');
      if (!secret) {
        this.logger.warn('WhatsApp webhook secret not configured');
        throw new BadRequestException('Webhook secret not configured');
      }

      const validation = this.webhookValidator.validateWhatsAppWebhook(
        bodyString,
        signature,
        secret,
      );

      if (!validation.isValid) {
        this.logger.warn(`WhatsApp webhook validation failed: ${validation.error}`);
        throw new BadRequestException(`Webhook validation failed: ${validation.error}`);
      }

      this.logger.log('WhatsApp webhook validated and processing');

      // Process webhook
      if (body.entry?.[0]?.changes?.[0]?.value?.messages) {
        this.eventEmitter.emit('whatsapp.webhook.message', body);
      }

      if (body.entry?.[0]?.changes?.[0]?.value?.statuses) {
        this.eventEmitter.emit('whatsapp.webhook.status', body);
      }

      return { success: true, message: 'Webhook processed' };
    } catch (error) {
      this.logger.error('WhatsApp webhook processing failed', error);
      throw error;
    }
  }

  /**
   * Twilio webhook receiver
   * Handles SMS status callbacks and incoming messages
   */
  @Post('twilio')
  @ApiOperation({ summary: 'Twilio webhook receiver' })
  @ApiResponse({ status: 200, description: 'Webhook processed' })
  @ApiResponse({ status: 400, description: 'Invalid signature or bad request' })
  async handleTwilioWebhook(
    @RawBody() rawBody: Buffer,
    @Headers('x-twilio-signature') signature: string,
    @Headers('x-twilio-webhook-url') webhookUrl: string,
    @Body() body: any,
  ) {
    try {
      const bodyString = rawBody.toString('utf-8');

      // Validate signature
      const authToken = this.configService.get<string>('TWILIO_AUTH_TOKEN');
      if (!authToken) {
        this.logger.warn('Twilio auth token not configured');
        throw new BadRequestException('Twilio auth token not configured');
      }

      const validation = this.webhookValidator.validateTwilioWebhook(
        webhookUrl,
        body,
        signature,
        authToken,
      );

      if (!validation.isValid) {
        this.logger.warn(`Twilio webhook validation failed: ${validation.error}`);
        throw new BadRequestException(`Webhook validation failed: ${validation.error}`);
      }

      this.logger.log('Twilio webhook validated and processing');

      // Process webhook
      if (body.MessageSid) {
        this.eventEmitter.emit('twilio.webhook.sms', body);
      }

      if (body.MessageStatus) {
        this.eventEmitter.emit('twilio.webhook.status', body);
      }

      return { success: true, message: 'Webhook processed' };
    } catch (error) {
      this.logger.error('Twilio webhook processing failed', error);
      throw error;
    }
  }

  /**
   * SendGrid webhook receiver
   * Handles email events (bounce, delivery, open, click, etc.)
   */
  @Post('sendgrid')
  @ApiOperation({ summary: 'SendGrid webhook receiver' })
  @ApiResponse({ status: 200, description: 'Webhook processed' })
  @ApiResponse({ status: 400, description: 'Invalid signature or bad request' })
  async handleSendGridWebhook(
    @RawBody() rawBody: Buffer,
    @Headers('x-twilio-email-event-webhook-signature') signature: string,
    @Headers('x-twilio-email-event-webhook-timestamp') timestamp: string,
    @Body() body: any[],
  ) {
    try {
      const bodyString = rawBody.toString('utf-8');

      // Validate signature
      const secret = this.configService.get<string>('SENDGRID_WEBHOOK_SECRET');
      if (!secret) {
        this.logger.warn('SendGrid webhook secret not configured');
        throw new BadRequestException('SendGrid webhook secret not configured');
      }

      const validation = this.webhookValidator.validateSendGridWebhook(
        bodyString,
        signature,
        timestamp,
        secret,
      );

      if (!validation.isValid) {
        this.logger.warn(`SendGrid webhook validation failed: ${validation.error}`);
        throw new BadRequestException(`Webhook validation failed: ${validation.error}`);
      }

      this.logger.log('SendGrid webhook validated and processing');

      // Process events
      for (const event of body) {
        this.eventEmitter.emit('sendgrid.webhook.event', event);
      }

      return { success: true, message: 'Webhook processed' };
    } catch (error) {
      this.logger.error('SendGrid webhook processing failed', error);
      throw error;
    }
  }

  /**
   * Mailgun webhook receiver
   * Handles email events
   */
  @Post('mailgun')
  @ApiOperation({ summary: 'Mailgun webhook receiver' })
  @ApiResponse({ status: 200, description: 'Webhook processed' })
  @ApiResponse({ status: 400, description: 'Invalid signature or bad request' })
  async handleMailgunWebhook(
    @Headers('x-mailgun-timestamp') timestamp: string,
    @Headers('x-mailgun-token') token: string,
    @Headers('x-mailgun-signature') signature: string,
    @Body() body: any,
  ) {
    try {
      // Validate signature
      const secret = this.configService.get<string>('MAILGUN_WEBHOOK_SECRET');
      if (!secret) {
        this.logger.warn('Mailgun webhook secret not configured');
        throw new BadRequestException('Mailgun webhook secret not configured');
      }

      const validation = this.webhookValidator.validateMailgunWebhook(
        timestamp,
        token,
        signature,
        secret,
      );

      if (!validation.isValid) {
        this.logger.warn(`Mailgun webhook validation failed: ${validation.error}`);
        throw new BadRequestException(`Webhook validation failed: ${validation.error}`);
      }

      this.logger.log('Mailgun webhook validated and processing');

      // Process event
      this.eventEmitter.emit('mailgun.webhook.event', body);

      return { success: true, message: 'Webhook processed' };
    } catch (error) {
      this.logger.error('Mailgun webhook processing failed', error);
      throw error;
    }
  }

  /**
   * Stripe webhook receiver
   * Handles payment events
   */
  @Post('stripe')
  @ApiOperation({ summary: 'Stripe webhook receiver' })
  @ApiResponse({ status: 200, description: 'Webhook processed' })
  @ApiResponse({ status: 400, description: 'Invalid signature or bad request' })
  async handleStripeWebhook(
    @RawBody() rawBody: Buffer,
    @Headers('x-stripe-signature') signature: string,
    @Body() body: any,
  ) {
    try {
      const bodyString = rawBody.toString('utf-8');

      // Validate signature
      const secret = this.configService.get<string>('STRIPE_WEBHOOK_SECRET');
      if (!secret) {
        this.logger.warn('Stripe webhook secret not configured');
        throw new BadRequestException('Stripe webhook secret not configured');
      }

      const validation = this.webhookValidator.validateStripeWebhook(
        bodyString,
        signature,
        secret,
      );

      if (!validation.isValid) {
        this.logger.warn(`Stripe webhook validation failed: ${validation.error}`);
        throw new BadRequestException(`Webhook validation failed: ${validation.error}`);
      }

      this.logger.log('Stripe webhook validated and processing');

      // Process event
      this.eventEmitter.emit('stripe.webhook.event', body);

      return { success: true, message: 'Webhook processed' };
    } catch (error) {
      this.logger.error('Stripe webhook processing failed', error);
      throw error;
    }
  }

  /**
   * Health check endpoint for webhook configuration
   */
  @Post('health')
  @ApiOperation({ summary: 'Webhook health check' })
  @ApiResponse({ status: 200, description: 'Webhooks configured' })
  async webhookHealth() {
    const configured = {
      whatsapp: !!this.configService.get('WHATSAPP_WEBHOOK_SECRET'),
      twilio: !!this.configService.get('TWILIO_AUTH_TOKEN'),
      sendgrid: !!this.configService.get('SENDGRID_WEBHOOK_SECRET'),
      mailgun: !!this.configService.get('MAILGUN_WEBHOOK_SECRET'),
      stripe: !!this.configService.get('STRIPE_WEBHOOK_SECRET'),
    };

    return {
      status: 'ok',
      webhooks: configured,
      timestamp: new Date(),
    };
  }
}
