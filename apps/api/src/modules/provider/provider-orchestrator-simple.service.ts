import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SMSRoutingService } from './providers/sms/sms-routing.service';
import { ProviderConfigRepository } from './provider-config.repository';

@Injectable()
export class ProviderOrchestratorSimpleService {
  private readonly logger = new Logger(ProviderOrchestratorSimpleService.name);

  constructor(
    private configService: ConfigService,
    private smsRoutingService: SMSRoutingService,
    private providerConfigRepository: ProviderConfigRepository,
  ) { }

  // SMS orchestration with intelligent routing
  async sendSMS(payload: { to: string; message: string; from?: string }, tenantId?: string): Promise<any> {
    try {
      // Check for BYOP configuration
      const byopProvider = await this.getBYOPProvider('sms', tenantId);
      if (byopProvider) {
        const provider = this.smsRoutingService.getProviderByName(byopProvider.providerName);
        if (provider) {
          return await provider.sendSMS(payload);
        }
      }

      // Use intelligent routing to select best provider
      const bestProvider = this.smsRoutingService.getBestProvider(payload.to);
      if (!bestProvider) {
        throw new Error('No SMS provider available for this phone number');
      }

      return await bestProvider.sendSMS(payload);
    } catch (error) {
      this.logger.error(`SMS sending failed: ${error.message}`, error.stack);
      throw error;
    }
  }

  // BYOP helper methods
  private async getBYOPProvider(
    type: 'email' | 'chat' | 'push' | 'sms',
    tenantId?: string,
    providerName?: string
  ): Promise<{ providerName: string; config: any } | null> {
    if (!tenantId) return null;

    try {
      // Map our types to NotificationChannel enum
      const channelMap = {
        'email': 'EMAIL',
        'chat': 'CHAT',
        'push': 'PUSH',
        'sms': 'SMS'
      };

      const channel = channelMap[type] as any;
      const configs = await this.providerConfigRepository.findActiveByTenantAndChannel(
        tenantId,
        channel
      );

      // If specific provider requested, find it
      if (providerName) {
        const config = configs.find(c => c.providerId === providerName);
        return config ? {
          providerName: config.providerId,
          config: config.config,
        } : null;
      }

      // Otherwise return first active config
      const config = configs[0];
      return config ? {
        providerName: config.providerId,
        config: config.config,
      } : null;
    } catch (error) {
      this.logger.warn(`Failed to get BYOP config: ${error.message}`);
      return null;
    }
  }

  // Utility methods
  getAvailableProviders(type: 'sms'): string[] {
    if (type === 'sms') {
      return this.smsRoutingService.getAllProviders().map(p => p.getProviderName());
    }
    return [];
  }

  async validatePhoneNumber(phoneNumber: string) {
    return this.smsRoutingService.validatePhoneNumber(phoneNumber);
  }
}