import { InjectRedis } from '@nestjs-modules/ioredis';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron, CronExpression } from '@nestjs/schedule';
import axios from 'axios';
import Redis from 'ioredis';
import { AlertingService } from './alerting.service';
import { LoggingService } from './logging.service';
import { MetricsService } from './metrics.service';

export interface ProviderHealthStatus {
  providerId: string;
  channel: string;
  tenantId: string;
  isHealthy: boolean;
  lastChecked: Date;
  responseTime: number;
  errorCount: number;
  successRate: number;
  lastError?: string;
}

export interface ProviderHealthCheck {
  providerId: string;
  channel: string;
  tenantId: string;
  endpoint?: string;
  timeout: number;
  expectedResponse?: any;
}

@Injectable()
export class ProviderHealthService {
  private readonly healthCheckInterval: number;
  private readonly healthThreshold: number;
  private readonly alertThreshold: number;

  constructor(
    private configService: ConfigService,
    private loggingService: LoggingService,
    private metricsService: MetricsService,
    private alertingService: AlertingService,
    @InjectRedis() private redis: Redis,
  ) {
    this.healthCheckInterval = this.configService.get<number>(
      'HEALTH_CHECK_INTERVAL',
      60000,
    ); // 1 minute
    this.healthThreshold = this.configService.get<number>(
      'HEALTH_THRESHOLD',
      0.95,
    ); // 95% success rate
    this.alertThreshold = this.configService.get<number>(
      'ALERT_THRESHOLD',
      0.8,
    ); // 80% success rate
  }

  // Periodic health check for all providers
  @Cron(CronExpression.EVERY_MINUTE)
  async performHealthChecks() {
    // Skip health checks if disabled
    const healthChecksEnabled = this.configService.get<string>('PROVIDER_HEALTH_CHECKS_ENABLED', 'true');
    if (healthChecksEnabled !== 'true') {
      return;
    }

    try {
      const providers = await this.getRegisteredProviders();
      const healthPromises = providers.map((provider) =>
        this.checkProviderHealth(provider),
      );

      const results = await Promise.allSettled(healthPromises);

      results.forEach((result, index) => {
        if (result.status === 'rejected') {
          this.loggingService.error('Health check failed', result.reason, {
            providerId: providers[index].providerId,
          });
        }
      });
    } catch (error) {
      this.loggingService.error('Failed to perform health checks', error);
    }
  }

  async checkProviderHealth(
    provider: ProviderHealthCheck,
  ): Promise<ProviderHealthStatus> {
    const startTime = Date.now();
    let isHealthy = false;
    let lastError: string | undefined;

    try {
      // Perform actual health check based on provider type
      isHealthy = await this.performProviderSpecificHealthCheck(provider);
    } catch (error) {
      lastError = error.message;
      this.loggingService.error('Provider health check failed', error, {
        providerId: provider.providerId,
        channel: provider.channel,
        tenantId: provider.tenantId,
      });
    }

    const responseTime = Date.now() - startTime;
    const healthStatus: ProviderHealthStatus = {
      providerId: provider.providerId,
      channel: provider.channel,
      tenantId: provider.tenantId,
      isHealthy,
      lastChecked: new Date(),
      responseTime,
      errorCount: 0,
      successRate: 0,
      lastError,
    };

    // Update health status in Redis
    await this.updateProviderHealthStatus(healthStatus);

    // Update metrics
    this.metricsService.setProviderHealth(
      provider.providerId,
      provider.channel,
      provider.tenantId,
      isHealthy,
    );

    // Check if alerting is needed
    await this.checkForAlerts(healthStatus);

    return healthStatus;
  }

  private async performProviderSpecificHealthCheck(
    provider: ProviderHealthCheck,
  ): Promise<boolean> {
    switch (provider.channel) {
      case 'email':
        return this.checkEmailProviderHealth(provider);
      case 'sms':
        return this.checkSMSProviderHealth(provider);
      case 'push':
        return this.checkPushProviderHealth(provider);
      case 'whatsapp':
        return this.checkWhatsAppProviderHealth(provider);
      default:
        throw new Error(`Unknown provider channel: ${provider.channel}`);
    }
  }

  private async checkEmailProviderHealth(
    provider: ProviderHealthCheck,
  ): Promise<boolean> {
    try {
      // For AWS SES, use AWS SDK to check service status
      if (provider.providerId.includes('ses')) {
        const accessKeyId = this.configService.get('AWS_ACCESS_KEY_ID');
        const secretAccessKey = this.configService.get('AWS_SECRET_ACCESS_KEY');
        const region = this.configService.get('AWS_REGION', 'us-east-1');

        if (!accessKeyId || !secretAccessKey) {
          this.loggingService.warn('AWS SES credentials not configured');
          return false;
        }

        try {
          const { SESClient, GetSendQuotaCommand } = require('@aws-sdk/client-ses');
          
          const sesClient = new SESClient({
            region,
            credentials: {
              accessKeyId,
              secretAccessKey,
            },
          });

          // Test by getting sending quota - this is a lightweight operation
          await sesClient.send(new GetSendQuotaCommand({}));
          return true;
        } catch (error) {
          this.loggingService.error('AWS SES health check failed', error, {
            providerId: provider.providerId,
          });
          return false;
        }
      }

      // For SendGrid
      if (provider.providerId.includes('sendgrid')) {
        const response = await axios.get(
          'https://api.sendgrid.com/v3/user/profile',
          {
            timeout: provider.timeout,
            headers: {
              'Authorization': `Bearer ${this.configService.get('SENDGRID_API_KEY')}`,
              'User-Agent': 'NotificationPlatform-HealthCheck/1.0',
            },
            validateStatus: (status) => status === 200 || status === 401, // 401 means API is responding
          },
        );
        return response.status === 200 || response.status === 401;
      }

      // For Mailgun
      if (provider.providerId.includes('mailgun')) {
        const response = await axios.get(
          'https://api.mailgun.net/v3/domains',
          {
            timeout: provider.timeout,
            auth: {
              username: 'api',
              password: this.configService.get('MAILGUN_API_KEY') || 'test',
            },
            validateStatus: (status) => status === 200 || status === 401,
          },
        );
        return response.status === 200 || response.status === 401;
      }

      // For SMTP providers, try to connect to SMTP server
      if (provider.providerId.includes('smtp')) {
        // Basic TCP connection check to SMTP server
        const smtpHost = this.configService.get('SMTP_HOST', 'smtp.gmail.com');
        const smtpPort = this.configService.get('SMTP_PORT', 587);

        return new Promise((resolve) => {
          const net = require('net');
          const socket = new net.Socket();

          socket.setTimeout(Math.max(0, provider.timeout));

          socket.on('connect', () => {
            socket.destroy();
            resolve(true);
          });

          socket.on('timeout', () => {
            socket.destroy();
            resolve(false);
          });

          socket.on('error', () => {
            resolve(false);
          });

          socket.connect(smtpPort, smtpHost);
        });
      }

      return false;
    } catch (error) {
      this.loggingService.error('Email provider health check failed', error, {
        providerId: provider.providerId,
      });
      return false;
    }
  }

  private async checkSMSProviderHealth(
    provider: ProviderHealthCheck,
  ): Promise<boolean> {
    try {
      // For AWS SNS
      if (provider.providerId.includes('sns')) {
        const response = await axios.head(
          'https://sns.us-east-1.amazonaws.com/',
          {
            timeout: provider.timeout,
            headers: {
              'User-Agent': 'NotificationPlatform-HealthCheck/1.0',
            },
          },
        );
        return response.status === 200;
      }

      // For Termii
      if (provider.providerId.includes('termii')) {
        const apiKey = this.configService.get('TERMII_API_KEY');
        if (!apiKey) {
          this.loggingService.warn('Termii API key not configured');
          return false;
        }

        const response = await axios.get(
          'https://api.ng.termii.com/api/get-balance',
          {
            timeout: provider.timeout,
            params: {
              api_key: apiKey,
            },
            headers: {
              'User-Agent': 'NotificationPlatform-HealthCheck/1.0',
            },
          },
        );
        return response.status === 200 && response.data.balance !== undefined;
      }

      // For Twilio
      if (provider.providerId.includes('twilio')) {
        const accountSid = this.configService.get('TWILIO_ACCOUNT_SID');
        const authToken = this.configService.get('TWILIO_AUTH_TOKEN');

        if (!accountSid || !authToken) {
          this.loggingService.warn('Twilio credentials not configured');
          return false;
        }

        const response = await axios.get(
          `https://api.twilio.com/2010-04-01/Accounts/${accountSid}.json`,
          {
            timeout: provider.timeout,
            auth: {
              username: accountSid,
              password: authToken,
            },
            headers: {
              'User-Agent': 'NotificationPlatform-HealthCheck/1.0',
            },
          },
        );
        return response.status === 200 && response.data.status === 'active';
      }

      // For Vonage (Nexmo)
      if (provider.providerId.includes('vonage') || provider.providerId.includes('nexmo')) {
        const apiKey = this.configService.get('VONAGE_API_KEY');
        const apiSecret = this.configService.get('VONAGE_API_SECRET');

        if (!apiKey || !apiSecret) {
          this.loggingService.warn('Vonage credentials not configured');
          return false;
        }

        const response = await axios.get(
          'https://rest.nexmo.com/account/get-balance',
          {
            timeout: provider.timeout,
            params: {
              api_key: apiKey,
              api_secret: apiSecret,
            },
            headers: {
              'User-Agent': 'NotificationPlatform-HealthCheck/1.0',
            },
          },
        );
        return response.status === 200 && response.data.value !== undefined;
      }

      return false;
    } catch (error) {
      this.loggingService.error('SMS provider health check failed', error, {
        providerId: provider.providerId,
      });
      return false;
    }
  }

  private async checkPushProviderHealth(
    provider: ProviderHealthCheck,
  ): Promise<boolean> {
    try {
      // For AWS Pinpoint
      if (provider.providerId.includes('pinpoint')) {
        const response = await axios.head(
          'https://pinpoint.us-east-1.amazonaws.com/',
          {
            timeout: provider.timeout,
            headers: {
              'User-Agent': 'NotificationPlatform-HealthCheck/1.0',
            },
          },
        );
        return response.status === 200;
      }

      // For Firebase Cloud Messaging (FCM)
      if (provider.providerId.includes('fcm') || provider.providerId.includes('firebase')) {
        const serverKey = this.configService.get('FCM_SERVER_KEY');
        if (!serverKey) {
          this.loggingService.warn('FCM server key not configured');
          return false;
        }

        // Test FCM by sending a validation request
        const response = await axios.post(
          'https://fcm.googleapis.com/fcm/send',
          {
            to: 'invalid_token_for_health_check',
            notification: {
              title: 'Health Check',
              body: 'This is a health check message',
            },
          },
          {
            timeout: provider.timeout,
            headers: {
              'Authorization': `key=${serverKey}`,
              'Content-Type': 'application/json',
              'User-Agent': 'NotificationPlatform-HealthCheck/1.0',
            },
            validateStatus: (status) => status === 200 || status === 400, // 400 is expected for invalid token
          },
        );

        // FCM is healthy if it responds with 200 or 400 (invalid token is expected)
        return response.status === 200 || response.status === 400;
      }

      // For Apple Push Notification Service (APNS)
      if (provider.providerId.includes('apns') || provider.providerId.includes('apple')) {
        // For APNS, we'll check if we can establish a connection to the APNS gateway
        const apnsGateway = this.configService.get('APNS_GATEWAY', 'api.push.apple.com');

        return new Promise((resolve) => {
          const net = require('net');
          const socket = new net.Socket();

          socket.setTimeout(Math.max(0, provider.timeout));

          socket.on('connect', () => {
            socket.destroy();
            resolve(true);
          });

          socket.on('timeout', () => {
            socket.destroy();
            resolve(false);
          });

          socket.on('error', () => {
            resolve(false);
          });

          socket.connect(443, apnsGateway);
        });
      }

      // For OneSignal
      if (provider.providerId.includes('onesignal')) {
        const appId = this.configService.get('ONESIGNAL_APP_ID');
        const apiKey = this.configService.get('ONESIGNAL_API_KEY');

        if (!appId || !apiKey) {
          this.loggingService.warn('OneSignal credentials not configured');
          return false;
        }

        const response = await axios.get(
          `https://onesignal.com/api/v1/apps/${appId}`,
          {
            timeout: provider.timeout,
            headers: {
              'Authorization': `Basic ${apiKey}`,
              'User-Agent': 'NotificationPlatform-HealthCheck/1.0',
            },
          },
        );
        return response.status === 200;
      }

      return false;
    } catch (error) {
      this.loggingService.error('Push provider health check failed', error, {
        providerId: provider.providerId,
      });
      return false;
    }
  }

  private async checkWhatsAppProviderHealth(
    provider: ProviderHealthCheck,
  ): Promise<boolean> {
    try {
      // For WhatsApp Business API (Meta)
      if (provider.providerId.includes('whatsapp-business') || provider.providerId.includes('meta')) {
        const accessToken = this.configService.get('WHATSAPP_ACCESS_TOKEN');
        const phoneNumberId = this.configService.get('WHATSAPP_PHONE_NUMBER_ID');

        if (!accessToken || !phoneNumberId) {
          this.loggingService.warn('WhatsApp Business API credentials not configured');
          return false;
        }

        // Check if we can get phone number info
        const response = await axios.get(
          `https://graph.facebook.com/v18.0/${phoneNumberId}`,
          {
            timeout: provider.timeout,
            headers: {
              'Authorization': `Bearer ${accessToken}`,
              'User-Agent': 'NotificationPlatform-HealthCheck/1.0',
            },
          },
        );
        return response.status === 200 && response.data.id;
      }

      // For Twilio WhatsApp
      if (provider.providerId.includes('twilio-whatsapp')) {
        const accountSid = this.configService.get('TWILIO_ACCOUNT_SID');
        const authToken = this.configService.get('TWILIO_AUTH_TOKEN');

        if (!accountSid || !authToken) {
          this.loggingService.warn('Twilio WhatsApp credentials not configured');
          return false;
        }

        const response = await axios.get(
          `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json?PageSize=1`,
          {
            timeout: provider.timeout,
            auth: {
              username: accountSid,
              password: authToken,
            },
            headers: {
              'User-Agent': 'NotificationPlatform-HealthCheck/1.0',
            },
          },
        );
        return response.status === 200;
      }

      // For 360Dialog
      if (provider.providerId.includes('360dialog')) {
        const apiKey = this.configService.get('DIALOG360_API_KEY');
        const partnerId = this.configService.get('DIALOG360_PARTNER_ID');

        if (!apiKey || !partnerId) {
          this.loggingService.warn('360Dialog credentials not configured');
          return false;
        }

        const response = await axios.get(
          `https://waba.360dialog.io/v1/configs/webhook`,
          {
            timeout: provider.timeout,
            headers: {
              'D360-API-KEY': apiKey,
              'User-Agent': 'NotificationPlatform-HealthCheck/1.0',
            },
          },
        );
        return response.status === 200;
      }

      // Generic WhatsApp endpoint check
      if (provider.endpoint) {
        const response = await axios.head(provider.endpoint, {
          timeout: provider.timeout,
          headers: {
            'User-Agent': 'NotificationPlatform-HealthCheck/1.0',
          },
        });
        return response.status === 200;
      }

      return false;
    } catch (error) {
      this.loggingService.error('WhatsApp provider health check failed', error, {
        providerId: provider.providerId,
      });
      return false;
    }
  }

  private async updateProviderHealthStatus(status: ProviderHealthStatus) {
    const key = `provider:health:${status.providerId}:${status.tenantId}`;

    // Get historical data
    const historicalData = await this.redis.get(key);
    let errorCount = 0;
    let totalChecks = 1;

    if (historicalData) {
      const parsed = JSON.parse(historicalData);
      errorCount = parsed.errorCount || 0;
      totalChecks = (parsed.totalChecks || 0) + 1;
    }

    if (!status.isHealthy) {
      errorCount++;
    }

    const successRate = ((totalChecks - errorCount) / totalChecks) * 100;

    const updatedStatus = {
      ...status,
      errorCount,
      totalChecks,
      successRate,
    };

    // Store in Redis with TTL
    await this.redis.setex(key, 3600, JSON.stringify(updatedStatus)); // 1 hour TTL

    this.loggingService.info('Provider health status updated', {
      providerId: status.providerId,
      channel: status.channel,
      tenantId: status.tenantId,
      isHealthy: status.isHealthy,
      successRate,
      responseTime: status.responseTime,
    });
  }

  private async checkForAlerts(status: ProviderHealthStatus) {
    if (status.successRate < this.alertThreshold * 100) {
      await this.alertingService.sendAlert({
        type: 'provider_health',
        severity: 'high',
        title: `Provider Health Alert: ${status.providerId}`,
        message: `Provider ${status.providerId} (${status.channel}) has a success rate of ${status.successRate.toFixed(2)}% which is below the threshold of ${this.alertThreshold * 100}%`,
        metadata: {
          providerId: status.providerId,
          channel: status.channel,
          tenantId: status.tenantId,
          successRate: status.successRate,
          threshold: this.alertThreshold * 100,
        },
      });
    }
  }

  async getProviderHealthStatus(
    providerId: string,
    tenantId: string,
  ): Promise<ProviderHealthStatus | null> {
    const key = `provider:health:${providerId}:${tenantId}`;
    const data = await this.redis.get(key);

    if (!data) {
      return null;
    }

    return JSON.parse(data);
  }

  async getAllProviderHealthStatuses(
    tenantId?: string,
  ): Promise<ProviderHealthStatus[]> {
    const pattern = tenantId
      ? `provider:health:*:${tenantId}`
      : 'provider:health:*';
    const keys = await this.redis.keys(pattern);

    if (keys.length === 0) {
      return [];
    }

    const values = await this.redis.mget(...keys);
    return values
      .filter((value) => value !== null)
      .map((value) => JSON.parse(value));
  }

  private async getRegisteredProviders(): Promise<ProviderHealthCheck[]> {
    // In a real implementation, this would fetch from database or configuration
    // For now, return a mock list of providers to check
    return [
      {
        providerId: 'aws-ses',
        channel: 'email',
        tenantId: 'default',
        timeout: 5000,
      },
      {
        providerId: 'aws-sns',
        channel: 'sms',
        tenantId: 'default',
        timeout: 5000,
      },
      {
        providerId: 'termii-sms',
        channel: 'sms',
        tenantId: 'default',
        timeout: 5000,
      },
      {
        providerId: 'aws-pinpoint',
        channel: 'push',
        tenantId: 'default',
        timeout: 5000,
      },
    ];
  }

  // Manual health check trigger
  async triggerHealthCheck(
    providerId: string,
    tenantId: string,
  ): Promise<ProviderHealthStatus> {
    const providers = await this.getRegisteredProviders();
    const provider = providers.find(
      (p) => p.providerId === providerId && p.tenantId === tenantId,
    );

    if (!provider) {
      throw new Error(
        `Provider ${providerId} not found for tenant ${tenantId}`,
      );
    }

    return this.checkProviderHealth(provider);
  }
}
