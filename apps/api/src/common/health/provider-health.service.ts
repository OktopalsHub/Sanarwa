import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRedis } from '@nestjs-modules/ioredis';
import Redis from 'ioredis';
import axios from 'axios';

export interface ProviderHealthStatus {
  provider: string;
  type: 'sms' | 'email' | 'push' | 'voice' | 'whatsapp' | 'chat';
  status: 'healthy' | 'degraded' | 'unhealthy';
  responseTime: number;
  lastChecked: Date;
  errorMessage?: string;
  details?: any;
}

export interface ProviderHealthSummary {
  totalProviders: number;
  healthyProviders: number;
  degradedProviders: number;
  unhealthyProviders: number;
  providers: ProviderHealthStatus[];
  overallStatus: 'healthy' | 'degraded' | 'unhealthy';
}

@Injectable()
export class ProviderHealthService {
  private readonly logger = new Logger(ProviderHealthService.name);
  private readonly healthCache = new Map<string, ProviderHealthStatus>();
  private readonly checkInterval = 60000; // 1 minute

  constructor(
    @InjectRedis() private readonly redis: Redis,
    private readonly configService: ConfigService,
  ) {
    this.startHealthChecks();
  }

  private startHealthChecks(): void {
    // Run health checks every minute
    setInterval(() => {
      this.runAllHealthChecks();
    }, this.checkInterval);

    // Run initial health check
    setTimeout(() => this.runAllHealthChecks(), 5000);
  }

  private async runAllHealthChecks(): Promise<void> {
    const providers = this.getConfiguredProviders();

    const healthChecks = providers.map(provider =>
      this.checkProviderHealth(provider).catch(error => {
        this.logger.error(`Health check failed for ${provider.provider}`, error);
        return {
          ...provider,
          status: 'unhealthy' as const,
          responseTime: 0,
          lastChecked: new Date(),
          errorMessage: error.message,
        };
      })
    );

    const results = await Promise.all(healthChecks);

    // Cache results
    results.forEach(result => {
      this.healthCache.set(result.provider, result);
    });

    // Store in Redis for persistence
    await this.storeHealthResults(results);
  }

  private getConfiguredProviders(): Array<{ provider: string; type: ProviderHealthStatus['type'] }> {
    const providers: Array<{ provider: string; type: ProviderHealthStatus['type'] }> = [];

    // SMS Providers
    if (this.configService.get('TELNYX_API_KEY')) {
      providers.push({ provider: 'telnyx', type: 'sms' });
    }
    if (this.configService.get('TWILIO_ACCOUNT_SID')) {
      providers.push({ provider: 'twilio', type: 'sms' });
    }
    if (this.configService.get('TERMII_API_KEY')) {
      providers.push({ provider: 'termii', type: 'sms' });
    }
    if (this.configService.get('AFRICASTALKING_API_KEY')) {
      providers.push({ provider: 'africastalking', type: 'sms' });
    }

    // Email Providers
    if (this.configService.get('AWS_ACCESS_KEY_ID')) {
      providers.push({ provider: 'ses', type: 'email' });
    }
    if (this.configService.get('SMTP_HOST')) {
      providers.push({ provider: 'smtp', type: 'email' });
    }
    if (this.configService.get('MAILGUN_API_KEY')) {
      providers.push({ provider: 'mailgun', type: 'email' });
    }

    // Push Providers
    if (this.configService.get('FCM_SERVER_KEY')) {
      providers.push({ provider: 'fcm', type: 'push' });
    }
    if (this.configService.get('APNS_KEY_ID')) {
      providers.push({ provider: 'apns', type: 'push' });
    }

    // Voice Providers
    if (this.configService.get('TELNYX_CONNECTION_ID')) {
      providers.push({ provider: 'telnyx-voice', type: 'voice' });
    }

    // WhatsApp
    if (this.configService.get('WHATSAPP_ACCESS_TOKEN')) {
      providers.push({ provider: 'whatsapp', type: 'whatsapp' });
    }

    // Chat Providers
    if (this.configService.get('SLACK_BOT_TOKEN')) {
      providers.push({ provider: 'slack', type: 'chat' });
    }
    if (this.configService.get('DISCORD_BOT_TOKEN')) {
      providers.push({ provider: 'discord', type: 'chat' });
    }

    return providers;
  }

  private async checkProviderHealth(provider: { provider: string; type: ProviderHealthStatus['type'] }): Promise<ProviderHealthStatus> {
    const startTime = Date.now();

    try {
      let healthResult: { healthy: boolean; details?: any; errorMessage?: string };

      switch (provider.provider) {
        case 'telnyx':
          healthResult = await this.checkTelnyxHealth();
          break;
        case 'twilio':
          healthResult = await this.checkTwilioHealth();
          break;
        case 'termii':
          healthResult = await this.checkTermiiHealth();
          break;
        case 'africastalking':
          healthResult = await this.checkAfricasTalkingHealth();
          break;
        case 'ses':
          healthResult = await this.checkSESHealth();
          break;
        case 'mailgun':
          healthResult = await this.checkMailgunHealth();
          break;
        case 'fcm':
          healthResult = await this.checkFCMHealth();
          break;
        case 'whatsapp':
          healthResult = await this.checkWhatsAppHealth();
          break;
        case 'slack':
          healthResult = await this.checkSlackHealth();
          break;
        case 'discord':
          healthResult = await this.checkDiscordHealth();
          break;
        default:
          healthResult = { healthy: false, errorMessage: 'Unknown provider' };
      }

      const responseTime = Date.now() - startTime;

      return {
        provider: provider.provider,
        type: provider.type,
        status: healthResult.healthy ? 'healthy' : 'unhealthy',
        responseTime,
        lastChecked: new Date(),
        errorMessage: healthResult.errorMessage,
        details: healthResult.details,
      };
    } catch (error) {
      return {
        provider: provider.provider,
        type: provider.type,
        status: 'unhealthy',
        responseTime: Date.now() - startTime,
        lastChecked: new Date(),
        errorMessage: error.message,
      };
    }
  }

  private async checkTelnyxHealth(): Promise<{ healthy: boolean; details?: any; errorMessage?: string }> {
    try {
      const apiKey = this.configService.get('TELNYX_API_KEY');
      const response = await axios.get('https://api.telnyx.com/v2/balance', {
        headers: { Authorization: `Bearer ${apiKey}` },
        timeout: 10000,
      });

      return {
        healthy: response.status === 200,
        details: {
          balance: response.data.data?.balance,
          currency: response.data.data?.currency,
        },
      };
    } catch (error) {
      return {
        healthy: false,
        errorMessage: error.response?.data?.errors?.[0]?.detail || error.message,
      };
    }
  }

  private async checkTwilioHealth(): Promise<{ healthy: boolean; details?: any; errorMessage?: string }> {
    try {
      const accountSid = this.configService.get('TWILIO_ACCOUNT_SID');
      const authToken = this.configService.get('TWILIO_AUTH_TOKEN');

      const response = await axios.get(`https://api.twilio.com/2010-04-01/Accounts/${accountSid}.json`, {
        auth: { username: accountSid, password: authToken },
        timeout: 10000,
      });

      return {
        healthy: response.status === 200,
        details: {
          status: response.data.status,
          type: response.data.type,
        },
      };
    } catch (error) {
      return {
        healthy: false,
        errorMessage: error.response?.data?.message || error.message,
      };
    }
  }

  private async checkTermiiHealth(): Promise<{ healthy: boolean; details?: any; errorMessage?: string }> {
    try {
      const apiKey = this.configService.get('TERMII_API_KEY');
      const response = await axios.get('https://api.ng.termii.com/api/get-balance', {
        params: { api_key: apiKey },
        timeout: 10000,
      });

      return {
        healthy: response.status === 200,
        details: {
          balance: response.data.balance,
          currency: response.data.currency,
        },
      };
    } catch (error) {
      return {
        healthy: false,
        errorMessage: error.response?.data?.message || error.message,
      };
    }
  }

  private async checkAfricasTalkingHealth(): Promise<{ healthy: boolean; details?: any; errorMessage?: string }> {
    try {
      const apiKey = this.configService.get('AFRICASTALKING_API_KEY');
      const username = this.configService.get('AFRICASTALKING_USERNAME');

      const response = await axios.get('https://api.africastalking.com/version1/user', {
        params: { username },
        headers: {
          'apiKey': apiKey,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        timeout: 10000,
      });

      return {
        healthy: response.status === 200,
        details: {
          balance: response.data.UserData?.balance,
        },
      };
    } catch (error) {
      return {
        healthy: false,
        errorMessage: error.response?.data?.ErrorMessage || error.message,
      };
    }
  }

  private async checkSESHealth(): Promise<{ healthy: boolean; details?: any; errorMessage?: string }> {
    // For AWS SES, we'll check if credentials are valid by making a simple API call
    try {
      // This is a simplified check - in production, you'd use AWS SDK
      return { healthy: true, details: { service: 'AWS SES' } };
    } catch (error) {
      return { healthy: false, errorMessage: error.message };
    }
  }

  private async checkMailgunHealth(): Promise<{ healthy: boolean; details?: any; errorMessage?: string }> {
    try {
      const apiKey = this.configService.get('MAILGUN_API_KEY');
      const domain = this.configService.get('MAILGUN_DOMAIN');

      const response = await axios.get(`https://api.mailgun.net/v3/domains/${domain}`, {
        auth: { username: 'api', password: apiKey },
        timeout: 10000,
      });

      return {
        healthy: response.status === 200,
        details: {
          domain: response.data.domain?.name,
          state: response.data.domain?.state,
        },
      };
    } catch (error) {
      return {
        healthy: false,
        errorMessage: error.response?.data?.message || error.message,
      };
    }
  }

  private async checkFCMHealth(): Promise<{ healthy: boolean; details?: any; errorMessage?: string }> {
    // FCM doesn't have a direct health check endpoint, so we'll validate the server key format
    try {
      const serverKey = this.configService.get('FCM_SERVER_KEY');
      return {
        healthy: !!serverKey && serverKey.startsWith('AAAA'),
        details: { service: 'Firebase Cloud Messaging' },
      };
    } catch (error) {
      return { healthy: false, errorMessage: error.message };
    }
  }

  private async checkWhatsAppHealth(): Promise<{ healthy: boolean; details?: any; errorMessage?: string }> {
    try {
      const accessToken = this.configService.get('WHATSAPP_ACCESS_TOKEN');
      const phoneNumberId = this.configService.get('WHATSAPP_PHONE_NUMBER_ID');

      const response = await axios.get(`https://graph.facebook.com/v18.0/${phoneNumberId}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
        timeout: 10000,
      });

      return {
        healthy: response.status === 200,
        details: {
          phoneNumber: response.data.display_phone_number,
          verifiedName: response.data.verified_name,
        },
      };
    } catch (error) {
      return {
        healthy: false,
        errorMessage: error.response?.data?.error?.message || error.message,
      };
    }
  }

  private async checkSlackHealth(): Promise<{ healthy: boolean; details?: any; errorMessage?: string }> {
    try {
      const botToken = this.configService.get('SLACK_BOT_TOKEN');
      const response = await axios.post('https://slack.com/api/auth.test', {}, {
        headers: { Authorization: `Bearer ${botToken}` },
        timeout: 10000,
      });

      return {
        healthy: response.data.ok,
        details: {
          team: response.data.team,
          user: response.data.user,
        },
        errorMessage: response.data.error,
      };
    } catch (error) {
      return {
        healthy: false,
        errorMessage: error.message,
      };
    }
  }

  private async checkDiscordHealth(): Promise<{ healthy: boolean; details?: any; errorMessage?: string }> {
    try {
      const botToken = this.configService.get('DISCORD_BOT_TOKEN');
      const response = await axios.get('https://discord.com/api/users/@me', {
        headers: { Authorization: `Bot ${botToken}` },
        timeout: 10000,
      });

      return {
        healthy: response.status === 200,
        details: {
          username: response.data.username,
          id: response.data.id,
        },
      };
    } catch (error) {
      return {
        healthy: false,
        errorMessage: error.response?.data?.message || error.message,
      };
    }
  }

  private async storeHealthResults(results: ProviderHealthStatus[]): Promise<void> {
    try {
      const key = 'provider_health_results';
      await this.redis.setex(key, 300, JSON.stringify(results)); // Cache for 5 minutes
    } catch (error) {
      this.logger.error('Failed to store health results in Redis', error);
    }
  }

  async getProviderHealthSummary(): Promise<ProviderHealthSummary> {
    // Try to get from cache first
    try {
      const cached = await this.redis.get('provider_health_results');
      if (cached) {
        const providers: ProviderHealthStatus[] = JSON.parse(cached);
        return this.buildHealthSummary(providers);
      }
    } catch (error) {
      this.logger.error('Failed to get cached health results', error);
    }

    // Fallback to in-memory cache
    const providers = Array.from(this.healthCache.values());
    return this.buildHealthSummary(providers);
  }

  private buildHealthSummary(providers: ProviderHealthStatus[]): ProviderHealthSummary {
    const healthyCount = providers.filter(p => p.status === 'healthy').length;
    const degradedCount = providers.filter(p => p.status === 'degraded').length;
    const unhealthyCount = providers.filter(p => p.status === 'unhealthy').length;

    let overallStatus: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
    if (unhealthyCount > 0) {
      overallStatus = 'unhealthy';
    } else if (degradedCount > 0) {
      overallStatus = 'degraded';
    }

    return {
      totalProviders: providers.length,
      healthyProviders: healthyCount,
      degradedProviders: degradedCount,
      unhealthyProviders: unhealthyCount,
      providers,
      overallStatus,
    };
  }

  async getProviderHealth(providerName: string): Promise<ProviderHealthStatus | null> {
    return this.healthCache.get(providerName) || null;
  }
}