import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import * as crypto from 'crypto';

export interface WebhookValidationConfig {
  provider: 'whatsapp' | 'twilio' | 'sendgrid' | 'mailgun' | 'stripe';
  secret: string;
  algorithm?: 'sha256' | 'sha1' | 'md5';
}

export interface WebhookValidationResult {
  isValid: boolean;
  error?: string;
  timestamp?: number;
}

@Injectable()
export class WebhookValidatorService {
  private readonly logger = new Logger(WebhookValidatorService.name);

  /**
   * Validate WhatsApp webhook signature
   * Uses X-Hub-Signature header with SHA256
   */
  validateWhatsAppWebhook(
    body: string,
    signature: string,
    secret: string,
  ): WebhookValidationResult {
    try {
      if (!signature) {
        return { isValid: false, error: 'Missing X-Hub-Signature header' };
      }

      // WhatsApp format: sha1=<signature>
      const [algorithm, hash] = signature.split('=');

      if (algorithm !== 'sha1') {
        return { isValid: false, error: `Invalid algorithm: ${algorithm}` };
      }

      // Calculate HMAC
      const hmac = crypto
        .createHmac('sha1', secret)
        .update(body)
        .digest('hex');

      // Constant-time comparison to prevent timing attacks
      const isValid = this.constantTimeCompare(hash, hmac);

      if (!isValid) {
        this.logger.warn('WhatsApp webhook signature validation failed');
        return { isValid: false, error: 'Invalid signature' };
      }

      this.logger.debug('WhatsApp webhook signature validated');
      return { isValid: true };
    } catch (error) {
      this.logger.error('WhatsApp webhook validation error', error);
      return { isValid: false, error: error.message };
    }
  }

  /**
   * Validate Twilio webhook signature
   * Uses X-Twilio-Signature header with SHA1
   */
  validateTwilioWebhook(
    url: string,
    body: Record<string, any>,
    signature: string,
    authToken: string,
  ): WebhookValidationResult {
    try {
      if (!signature) {
        return { isValid: false, error: 'Missing X-Twilio-Signature header' };
      }

      // Build the data to sign
      let data = url;
      
      // Add body parameters in sorted order
      const keys = Object.keys(body).toSorted();
      for (const key of keys) {
        data += key + body[key];
      }

      // Calculate HMAC
      const hmac = crypto
        .createHmac('sha1', authToken)
        .update(data)
        .digest('base64');

      // Constant-time comparison
      const isValid = this.constantTimeCompare(signature, hmac);

      if (!isValid) {
        this.logger.warn('Twilio webhook signature validation failed');
        return { isValid: false, error: 'Invalid signature' };
      }

      this.logger.debug('Twilio webhook signature validated');
      return { isValid: true };
    } catch (error) {
      this.logger.error('Twilio webhook validation error', error);
      return { isValid: false, error: error.message };
    }
  }

  /**
   * Validate SendGrid webhook signature
   * Uses X-Twilio-Email-Event-Webhook-Signature header with SHA256
   */
  validateSendGridWebhook(
    body: string,
    signature: string,
    timestamp: string,
    secret: string,
  ): WebhookValidationResult {
    try {
      if (!signature || !timestamp) {
        return {
          isValid: false,
          error: 'Missing signature or timestamp header',
        };
      }

      // Check timestamp is recent (within 5 minutes)
      const webhookTimestamp = parseInt(timestamp, 10);
      const currentTimestamp = Math.floor(Date.now() / 1000);
      const timeDiff = Math.abs(currentTimestamp - webhookTimestamp);

      if (timeDiff > 300) {
        // 5 minutes
        return {
          isValid: false,
          error: 'Webhook timestamp too old',
          timestamp: webhookTimestamp,
        };
      }

      // Build signed content
      const signedContent = `${timestamp}${body}`;

      // Calculate HMAC
      const hmac = crypto
        .createHmac('sha256', secret)
        .update(signedContent)
        .digest('base64');

      // Constant-time comparison
      const isValid = this.constantTimeCompare(signature, hmac);

      if (!isValid) {
        this.logger.warn('SendGrid webhook signature validation failed');
        return { isValid: false, error: 'Invalid signature' };
      }

      this.logger.debug('SendGrid webhook signature validated');
      return { isValid: true };
    } catch (error) {
      this.logger.error('SendGrid webhook validation error', error);
      return { isValid: false, error: error.message };
    }
  }

  /**
   * Validate Mailgun webhook signature
   * Uses X-Mailgun-Signature header with SHA256
   */
  validateMailgunWebhook(
    timestamp: string,
    token: string,
    signature: string,
    secret: string,
  ): WebhookValidationResult {
    try {
      if (!signature || !timestamp || !token) {
        return {
          isValid: false,
          error: 'Missing signature, timestamp, or token',
        };
      }

      // Check timestamp is recent (within 15 minutes)
      const webhookTimestamp = parseInt(timestamp, 10);
      const currentTimestamp = Math.floor(Date.now() / 1000);
      const timeDiff = Math.abs(currentTimestamp - webhookTimestamp);

      if (timeDiff > 900) {
        // 15 minutes
        return {
          isValid: false,
          error: 'Webhook timestamp too old',
          timestamp: webhookTimestamp,
        };
      }

      // Build signed content
      const signedContent = `${timestamp}${token}`;

      // Calculate HMAC
      const hmac = crypto
        .createHmac('sha256', secret)
        .update(signedContent)
        .digest('hex');

      // Constant-time comparison
      const isValid = this.constantTimeCompare(signature, hmac);

      if (!isValid) {
        this.logger.warn('Mailgun webhook signature validation failed');
        return { isValid: false, error: 'Invalid signature' };
      }

      this.logger.debug('Mailgun webhook signature validated');
      return { isValid: true };
    } catch (error) {
      this.logger.error('Mailgun webhook validation error', error);
      return { isValid: false, error: error.message };
    }
  }

  /**
   * Validate Stripe webhook signature
   * Uses X-Stripe-Signature header with SHA256
   */
  validateStripeWebhook(
    body: string,
    signature: string,
    secret: string,
  ): WebhookValidationResult {
    try {
      if (!signature) {
        return { isValid: false, error: 'Missing X-Stripe-Signature header' };
      }

      // Parse Stripe signature format: t=<timestamp>,v1=<signature>
      const parts = signature.split(',');
      let timestamp = '';
      let hash = '';

      for (const part of parts) {
        const [key, value] = part.split('=');
        if (key === 't') timestamp = value;
        if (key === 'v1') hash = value;
      }

      if (!timestamp || !hash) {
        return { isValid: false, error: 'Invalid signature format' };
      }

      // Check timestamp is recent (within 5 minutes)
      const webhookTimestamp = parseInt(timestamp, 10);
      const currentTimestamp = Math.floor(Date.now() / 1000);
      const timeDiff = Math.abs(currentTimestamp - webhookTimestamp);

      if (timeDiff > 300) {
        return {
          isValid: false,
          error: 'Webhook timestamp too old',
          timestamp: webhookTimestamp,
        };
      }

      // Build signed content
      const signedContent = `${timestamp}.${body}`;

      // Calculate HMAC
      const hmac = crypto
        .createHmac('sha256', secret)
        .update(signedContent)
        .digest('hex');

      // Constant-time comparison
      const isValid = this.constantTimeCompare(hash, hmac);

      if (!isValid) {
        this.logger.warn('Stripe webhook signature validation failed');
        return { isValid: false, error: 'Invalid signature' };
      }

      this.logger.debug('Stripe webhook signature validated');
      return { isValid: true };
    } catch (error) {
      this.logger.error('Stripe webhook validation error', error);
      return { isValid: false, error: error.message };
    }
  }

  /**
   * Generic webhook validation
   */
  validateWebhook(
    config: WebhookValidationConfig,
    body: string,
    headers: Record<string, string>,
  ): WebhookValidationResult {
    switch (config.provider) {
      case 'whatsapp':
        return this.validateWhatsAppWebhook(
          body,
          headers['x-hub-signature'],
          config.secret,
        );

      case 'twilio':
        return this.validateTwilioWebhook(
          headers['x-twilio-webhook-url'],
          JSON.parse(body),
          headers['x-twilio-signature'],
          config.secret,
        );

      case 'sendgrid':
        return this.validateSendGridWebhook(
          body,
          headers['x-twilio-email-event-webhook-signature'],
          headers['x-twilio-email-event-webhook-timestamp'],
          config.secret,
        );

      case 'mailgun':
        return this.validateMailgunWebhook(
          headers['x-mailgun-timestamp'],
          headers['x-mailgun-token'],
          headers['x-mailgun-signature'],
          config.secret,
        );

      case 'stripe':
        return this.validateStripeWebhook(
          body,
          headers['x-stripe-signature'],
          config.secret,
        );

      default:
        return { isValid: false, error: `Unknown provider: ${config.provider}` };
    }
  }

  /**
   * Constant-time string comparison to prevent timing attacks
   */
  private constantTimeCompare(a: string, b: string): boolean {
    if (a.length !== b.length) {
      return false;
    }

    let result = 0;
    for (let i = 0; i < a.length; i++) {
      result |= a.charCodeAt(i) ^ b.charCodeAt(i);
    }

    return result === 0;
  }

  /**
   * Generate webhook signature for testing
   */
  generateSignature(
    provider: string,
    body: string,
    secret: string,
  ): string {
    switch (provider) {
      case 'whatsapp':
        return (
          'sha1=' +
          crypto.createHmac('sha1', secret).update(body).digest('hex')
        );

      case 'sendgrid':
        const timestamp = Math.floor(Date.now() / 1000);
        const signedContent = `${timestamp}${body}`;
        return crypto
          .createHmac('sha256', secret)
          .update(signedContent)
          .digest('base64');

      case 'mailgun':
        const token = crypto.randomBytes(16).toString('hex');
        const mailgunTimestamp = Math.floor(Date.now() / 1000);
        const mailgunSignedContent = `${mailgunTimestamp}${token}`;
        return crypto
          .createHmac('sha256', secret)
          .update(mailgunSignedContent)
          .digest('hex');

      default:
        throw new Error(`Unsupported provider: ${provider}`);
    }
  }
}
